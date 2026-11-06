'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { FEATURE_META, type SerializedModel } from '@/lib/twin-model';
import { todayKey, type Checkin, type ExploreLog, type PlanItem, type Profile } from '@/lib/twin-data';
import type { CoachResult, TraceEntry } from '@/lib/ai-types';
import type { ArchivedFail } from '@/lib/ai-memory';
import { difficultyOf } from '@/lib/quest-meta';

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
  /** AI 결과·기록(AI TRACE). 이 기기에만 저장되고 사진은 저장하지 않습니다. */
  ai: {
    coach: StoredCoach | null;
    traces: TraceEntry[];
    archivedFails: ArchivedFail[];
  };
};

export type StoredCoach = { at: string; model: string; mode: 'initial' | 'reanalyze'; promptVersion: string; result: CoachResult; adjustments: string[] };

const EMPTY: TwinState = { profile: null, checkins: [], plans: {}, model: null, pretrainHistory: [], explore: { usual: [], log: {} }, seenLevel: null, ai: { coach: null, traces: [], archivedFails: [] } };
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
      ai: {
        coach: o.ai?.coach && typeof o.ai.coach === 'object' && o.ai.coach.result && Array.isArray(o.ai.coach.result.quests) ? o.ai.coach : null,
        traces: Array.isArray(o.ai?.traces) ? o.ai.traces.filter(t => t && typeof t.id === 'string' && typeof t.at === 'string').slice(0, 40) : [],
        archivedFails: Array.isArray(o.ai?.archivedFails) ? o.ai.archivedFails.filter(f => f && typeof f.lever === 'string' && typeof f.at === 'number').slice(0, 60) : [],
      },
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
    write({ ...s, plans: { ...s.plans, [date]: items.map(i => (i.id === id ? { ...i, done: !i.done, fail: undefined, doneAt: !i.done ? Date.now() : undefined } : i)) } });
  },
  /** 오늘 퀘스트를 못 했다고 사유와 함께 기록합니다. (이미 한 퀘스트에는 쓰지 않음) */
  failItem(date: string, id: string, reason: string) {
    const s = readState();
    const items = s.plans[date];
    if (!items) return;
    write({ ...s, plans: { ...s.plans, [date]: items.map(i => (i.id === id && !i.done ? { ...i, fail: { reason: reason.slice(0, 20), at: Date.now() } } : i)) } });
  },
  /** 실패 기록만 지웁니다. */
  clearFail(date: string, id: string) {
    const s = readState();
    const items = s.plans[date];
    if (!items) return;
    write({ ...s, plans: { ...s.plans, [date]: items.map(i => (i.id === id ? { ...i, fail: undefined } : i)) } });
  },
  /** 퀘스트에 대한 만족도를 남깁니다. 같은 값을 다시 누르면 취소합니다. */
  setFeedback(date: string, id: string, value: 'good' | 'bad') {
    const s = readState();
    const items = s.plans[date];
    if (!items) return;
    write({ ...s, plans: { ...s.plans, [date]: items.map(i => (i.id === id ? { ...i, feedback: i.feedback === value ? undefined : value } : i)) } });
  },
  /** AI TRACE: 새 기록을 맨 앞에 추가합니다(최대 40개). */
  addTrace(entry: TraceEntry) {
    const s = readState();
    write({ ...s, ai: { ...s.ai, traces: [entry, ...s.ai.traces].slice(0, 40) } });
  },
  clearTraces() {
    const s = readState();
    write({ ...s, ai: { ...s.ai, traces: [] } });
  },
  setCoach(coach: StoredCoach) {
    const s = readState();
    write({ ...s, ai: { ...s.ai, coach } });
  },
  /**
   * AI가 만든 퀘스트로 오늘 계획을 바꿉니다.
   * - 이미 해낸 퀘스트는 그대로 둡니다(성과를 지우지 않음).
   * - 못 한 기록이 있던 퀘스트는 기록 보관함으로 옮겨서, 다음 AI 분석이 계속 참고할 수 있게 합니다.
   */
  applyAiPlan(date: string, items: PlanItem[]) {
    const s = readState();
    const old = s.plans[date] ?? [];
    const archived: ArchivedFail[] = old
      .filter(i => i.fail && !i.done)
      .map(i => ({ date, lever: i.id, reason: i.fail!.reason, at: i.fail!.at, minutes: i.minutes ?? null, difficulty: i.aiDifficulty ?? difficultyOf(i) }));
    const keptDone = old.filter(i => i.done && !items.some(n => n.id === i.id));
    const merged = items.map(n => {
      const prev = old.find(i => i.id === n.id && i.done);
      return prev ? { ...n, done: true, doneAt: prev.doneAt } : n;
    });
    write({ ...s, plans: { ...s.plans, [date]: [...merged, ...keptDone] }, ai: { ...s.ai, archivedFails: [...archived, ...s.ai.archivedFails].slice(0, 60) } });
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
