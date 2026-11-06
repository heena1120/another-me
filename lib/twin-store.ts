'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { FEATURE_META, type SerializedModel } from '@/lib/twin-model';
import { todayKey, type Checkin, type ExploreLog, type PlanItem, type Profile } from '@/lib/twin-data';
import type { CoachResult, TraceEntry } from '@/lib/ai-types';
import type { ArchivedFail } from '@/lib/ai-memory';
import { difficultyOf } from '@/lib/quest-meta';
import { shadowDef, withBattle, withMicro } from '@/lib/shadow';
import type { ShadowId } from '@/lib/twin-data';

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
  /** 하루 퀘스트 개수(1~6). 맞춤형이 핵심이라 기본은 2개. */
  questCount: number;
  /** 마지막 체크인 시각. 이보다 오래된 AI 분석은 체크인을 반영해 다시 돌립니다. */
  lastCheckinAt: number | null;
  /** AI 결과·기록(AI TRACE). 이 기기에만 저장되고 사진은 저장하지 않습니다. */
  ai: {
    coach: StoredCoach | null;
    traces: TraceEntry[];
    archivedFails: ArchivedFail[];
  };
};

export type StoredCoach = { at: string; model: string; mode: 'initial' | 'reanalyze'; promptVersion: string; result: CoachResult; adjustments: string[] };

export const DEFAULT_QUEST_COUNT = 2;
export const MAX_QUEST_COUNT = 6;
const clampCount = (n: number) => Math.max(1, Math.min(MAX_QUEST_COUNT, Math.round(n)));

const EMPTY: TwinState = { profile: null, checkins: [], plans: {}, model: null, pretrainHistory: [], explore: { usual: [], log: {} }, seenLevel: null, questCount: DEFAULT_QUEST_COUNT, lastCheckinAt: null, ai: { coach: null, traces: [], archivedFails: [] } };
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
      questCount: typeof o.questCount === 'number' ? clampCount(o.questCount) : DEFAULT_QUEST_COUNT,
      lastCheckinAt: typeof o.lastCheckinAt === 'number' ? o.lastCheckinAt : null,
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
  /** 내 방식(AI에게 한마디)만 바꿉니다. 오늘 계획은 건드리지 않고, 다음 AI 분석부터 반영돼요. */
  setWish(wish: string) {
    const s = readState();
    if (!s.profile) return;
    const w = wish.trim().slice(0, 160);
    write({ ...s, profile: { ...s.profile, wish: w || undefined } });
  },
  /** 같은 날 기록이 있으면 덮어씁니다. */
  addCheckin(c: Checkin) {
    const s = readState();
    write({ ...s, lastCheckinAt: Date.now(), checkins: [...s.checkins.filter(x => x.date !== c.date), c].sort((a, b) => a.date.localeCompare(b.date)) });
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
  /** SHADOW BATTLE: 오늘 계획에서 그림자에 맞서는 퀘스트를 지정하거나 작은 단계 퀘스트를 더합니다. */
  startBattle(date: string, shadow: ShadowId) {
    const s = readState();
    const def = shadowDef(shadow);
    if (!def) return;
    const { items } = withBattle(s.plans[date] ?? [], def);
    write({ ...s, plans: { ...s.plans, [date]: items } });
  },
  /** 못 한 퀘스트를 더 작은 단계로 바꾸고, 못 한 기록은 AI 기억용 보관함으로 옮깁니다. */
  shrinkItem(date: string, id: string) {
    const s = readState();
    const { items, failed } = withMicro(s.plans[date] ?? [], id);
    if (!failed) return;
    const archived: ArchivedFail[] = failed.fail ? [{ date, lever: failed.id, reason: failed.fail.reason, at: failed.fail.at, minutes: failed.minutes ?? null, difficulty: failed.aiDifficulty ?? difficultyOf(failed) }] : [];
    write({ ...s, plans: { ...s.plans, [date]: items }, ai: { ...s.ai, archivedFails: [...archived, ...s.ai.archivedFails].slice(0, 60) } });
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
  /**
   * 하루 퀘스트 개수를 바꿉니다. 오늘 계획도 바로 맞춥니다:
   * 해낸·못 한 기록이 있는 퀘스트는 남기고, 나머지를 줄이거나 filler(신경망 추천)에서 채웁니다.
   */
  setQuestCount(n: number, filler: PlanItem[] = []) {
    const s = readState();
    const count = clampCount(n);
    const day = todayKey();
    const items = s.plans[day];
    let plans = s.plans;
    if (items) {
      const keep = items.filter(i => i.done || i.fail);
      const rest = items.filter(i => !i.done && !i.fail);
      const next = [...keep, ...rest.slice(0, Math.max(0, count - keep.length))];
      for (const f of filler) {
        if (next.length >= count) break;
        if (!next.some(i => i.id === f.id)) next.push(f);
      }
      plans = { ...s.plans, [day]: next };
    }
    write({ ...s, questCount: count, plans });
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
