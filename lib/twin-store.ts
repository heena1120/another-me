'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { FEATURE_META, type SerializedModel } from '@/lib/twin-model';
import { todayKey, type Checkin, type ExploreLog, type PlanItem, type Profile } from '@/lib/twin-data';

// 지금은 이 기기의 localStorage에 저장합니다. (Supabase 연결 후 계정 저장으로 교체 예정)
export type TwinState = {
  profile: Profile | null;
  checkins: Checkin[];
  plans: Record<string, PlanItem[]>;
  model: SerializedModel | null;
  pretrainHistory: number[];
  /** 필터버블 탈출: 자주 하는 영역과 날짜별 도전 기록 */
  explore: { usual: string[]; log: ExploreLog };
  /** 마지막으로 축하해 준 레벨. 이보다 레벨이 오르면 캐릭터가 춤을 춥니다. */
  seenLevel: number | null;
};

const EMPTY: TwinState = { profile: null, checkins: [], plans: {}, model: null, pretrainHistory: [], explore: { usual: [], log: {} }, seenLevel: null };
const KEY = 'twin.state.v1';
const EVENT = 'twin-state-change';

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(EVENT, cb);
  };
}

const readRaw = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const validCheckin = (c: unknown): c is Checkin => {
  const o = c as Checkin;
  return !!o && typeof o.date === 'string' && typeof o.actual === 'number' && !!o.raw && FEATURE_META.every(f => Number.isFinite((o.raw as Record<string, number>)[f.key]));
};

function parse(raw: string | null): TwinState {
  if (!raw) return EMPTY;
  try {
    const o = JSON.parse(raw) as Partial<TwinState>;
    return {
      profile: o.profile && typeof o.profile === 'object' ? o.profile : null,
      checkins: Array.isArray(o.checkins) ? o.checkins.filter(validCheckin) : [],
      plans: o.plans && typeof o.plans === 'object' ? o.plans : {},
      model: o.model ?? null,
      pretrainHistory: Array.isArray(o.pretrainHistory) ? o.pretrainHistory.filter(Number.isFinite) : [],
      seenLevel: typeof o.seenLevel === 'number' ? o.seenLevel : null,
      explore: {
        usual: Array.isArray(o.explore?.usual) ? o.explore.usual.filter((x): x is string => typeof x === 'string') : [],
        log: o.explore?.log && typeof o.explore.log === 'object' ? o.explore.log : {},
      },
    };
  } catch {
    return EMPTY;
  }
}

const readState = () => parse(readRaw());

function write(next: TwinState) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

/** undefined = 아직 브라우저에서 읽는 중 */
export function useTwinState(): TwinState | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined);
  return useMemo(() => (raw === undefined ? undefined : parse(raw)), [raw]);
}

export const twinActions = {
  /** 인터뷰 결과 저장. 아직 달성한 항목이 없는 오늘 체크리스트는 새 프로필로 다시 만들도록 비웁니다. */
  saveProfile(profile: Profile) {
    const s = readState();
    const key = todayKey();
    const plans = { ...s.plans };
    if (!(plans[key] ?? []).some(i => i.done)) delete plans[key];
    write({ ...s, profile, plans });
  },
  /** 같은 날 기록이 있으면 덮어씁니다. */
  addCheckin(c: Checkin) {
    const s = readState();
    write({ ...s, checkins: [...s.checkins.filter(x => x.date !== c.date), c].sort((a, b) => a.date.localeCompare(b.date)) });
  },
  setPlan(date: string, items: PlanItem[]) {
    const s = readState();
    if (s.plans[date]) return; // 하루에 한 번만 만들어서 체크 중에 항목이 바뀌지 않게 합니다.
    write({ ...s, plans: { ...s.plans, [date]: items } });
  },
  toggleItem(date: string, id: string) {
    const s = readState();
    const items = s.plans[date];
    if (!items) return;
    write({ ...s, plans: { ...s.plans, [date]: items.map(i => (i.id === id ? { ...i, done: !i.done } : i)) } });
  },
  saveModel(model: SerializedModel, pretrainHistory: number[]) {
    write({ ...readState(), model, pretrainHistory });
  },
  /** 평소 자주 하는 영역을 저장합니다. 오늘 도전이 아직 미완료라면 새 영역 기준으로 다시 고르게 비웁니다. */
  saveUsual(usual: string[]) {
    const s = readState();
    const key = todayKey();
    const log = { ...s.explore.log };
    if (log[key] && !log[key].done) delete log[key];
    write({ ...s, explore: { usual, log } });
  },
  /** 오늘의 도전은 하루에 한 번만 정해서 바뀌지 않게 합니다. */
  setExplore(date: string, id: string) {
    const s = readState();
    if (s.explore.log[date]) return;
    write({ ...s, explore: { ...s.explore, log: { ...s.explore.log, [date]: { id, done: false } } } });
  },
  markLevelSeen(level: number) {
    const s = readState();
    if (s.seenLevel === level) return;
    write({ ...s, seenLevel: level });
  },
  toggleExplore(date: string) {
    const s = readState();
    const e = s.explore.log[date];
    if (!e) return;
    write({ ...s, explore: { ...s.explore, log: { ...s.explore.log, [date]: { ...e, done: !e.done } } } });
  },
};
