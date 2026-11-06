'use client';
// A/B 데모: 두 사람이 같은 질문에 다르게 답했을 때 AI가 서로 다른 퀘스트를 만드는지 보여 줍니다.
// 내 실제 기록과 완전히 분리해서(localStorage 'twin.demo.v1') 저장하고, 신경망은 개인 보정 전의 사전학습 모델만 씁니다.
import { useMemo, useSyncExternalStore } from 'react';
import type { CoachResult, TraceEntry } from './ai-types';
import type { ArchivedFail } from './ai-memory';
import { difficultyOf } from './quest-meta';
import type { PlanItem, Profile } from './twin-data';

export type PersonaId = 'A' | 'B';

export const PERSONAS: Record<PersonaId, { id: PersonaId; name: string; tagline: string; traits: string[]; profile: Profile; body: string }> = {
  A: {
    id: 'A',
    name: 'A · 올빼미 모찌',
    tagline: '늦게 자고, 운동이 부담스럽고, 변화가 어려운 사람',
    traits: ['늦게 자고 수면이 불규칙해요', '운동은 부담스러워요', '숏폼을 오래 봐요', '내 방식: "30분 걸을 시간은 없어요. 집에서, 무작정 운동은 싫어요"'],
    body: 'lilac',
    profile: { job: 'student', walk: 'none', sleep: 'irregular', sleepWhy: 'screen', caffeine: 'few', shortform: 'heavy', budget: '10', pref: 'none', goal: 'sleep', energyTime: 'night', diet: 'irregular', selfcare: 'rarely', change: 'hard', lifeClass: 'healthy', wish: '30분 걸을 시간은 없어요. 집에서 할 수 있는 걸로요. 무작정 운동만 시키는 건 싫어요.' },
  },
  B: {
    id: 'B',
    name: 'B · 아침형 두부',
    tagline: '일찍 일어나지만 앉아서 일하고, 저녁에 지치는 사람',
    traits: ['아침형이고 수면은 규칙적이에요', '하루 종일 앉아 있어요', '저녁에 가장 피곤해요', '짧은 활동은 할 수 있어요'],
    body: 'mint',
    profile: { job: 'sitting', walk: 'short', sleep: 'regular', caffeine: 'one', shortform: 'light', budget: '20', pref: 'home', goal: 'stamina', energyTime: 'evening', diet: 'balanced', selfcare: 'half', change: 'gradual', lifeClass: 'balanced' },
  },
};

export type DemoRun = {
  at: string;
  mode: 'initial' | 'reanalyze';
  model: string;
  promptVersion: string;
  ms: number;
  tokens: number | null;
  requestId: string | null;
  result: CoachResult;
  adjustments: string[];
  inputKinds: string[];
};

export type PersonaState = {
  day: string;
  plan: PlanItem[];
  archived: ArchivedFail[];
  traces: TraceEntry[];
  /** 분석 기록(오래된 것부터). 재분석 전후 비교에 씁니다. */
  runs: DemoRun[];
};

export type DemoState = Record<PersonaId, PersonaState | null>;

const KEY = 'twin.demo.v1';
const EVENT = 'twin-demo-change';
const EMPTY: DemoState = { A: null, B: null };

const subscribe = (cb: () => void) => {
  window.addEventListener('storage', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(EVENT, cb);
  };
};
const readRaw = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

function parse(raw: string | null | undefined): DemoState {
  if (!raw) return EMPTY;
  try {
    const o = JSON.parse(raw) as Partial<DemoState>;
    const one = (p: unknown): PersonaState | null => {
      const s = p as PersonaState | null;
      return s && typeof s.day === 'string' && Array.isArray(s.plan) && Array.isArray(s.runs) ? { ...s, archived: Array.isArray(s.archived) ? s.archived : [], traces: Array.isArray(s.traces) ? s.traces : [] } : null;
    };
    return { A: one(o.A), B: one(o.B) };
  } catch {
    return EMPTY;
  }
}

const readState = () => parse(readRaw());
function write(next: DemoState) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

export function useDemoState(): DemoState | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined);
  return useMemo(() => (raw === undefined ? undefined : parse(raw)), [raw]);
}

const update = (id: PersonaId, fn: (s: PersonaState) => PersonaState) => {
  const all = readState();
  const cur = all[id];
  if (!cur) return;
  write({ ...all, [id]: fn(cur) });
};

export const demoActions = {
  /** AI 결과로 오늘 계획을 바꿉니다. 해낸 퀘스트는 남기고, 못 한 퀘스트는 기록 보관함으로 옮깁니다. */
  applyRun(id: PersonaId, day: string, items: PlanItem[], run: DemoRun, trace: TraceEntry) {
    const all = readState();
    const cur = all[id];
    const old = cur?.plan ?? [];
    const archived: ArchivedFail[] = old
      .filter(i => i.fail && !i.done)
      .map(i => ({ date: cur?.day ?? day, lever: i.id, reason: i.fail!.reason, at: i.fail!.at, minutes: i.minutes ?? null, difficulty: i.aiDifficulty ?? difficultyOf(i) }));
    const keptDone = old.filter(i => i.done && !items.some(n => n.id === i.id));
    const merged = items.map(n => {
      const prev = old.find(i => i.id === n.id && i.done);
      return prev ? { ...n, done: true, doneAt: prev.doneAt } : n;
    });
    write({
      ...all,
      [id]: { day, plan: [...merged, ...keptDone], archived: [...archived, ...(cur?.archived ?? [])].slice(0, 30), traces: [trace, ...(cur?.traces ?? [])].slice(0, 20), runs: [...(cur?.runs ?? []), run].slice(-6) },
    });
  },
  addFailedTrace(id: PersonaId, day: string, trace: TraceEntry) {
    const all = readState();
    const cur = all[id] ?? { day, plan: [], archived: [], traces: [], runs: [] };
    write({ ...all, [id]: { ...cur, traces: [trace, ...cur.traces].slice(0, 20) } });
  },
  toggle(id: PersonaId, lever: string) {
    update(id, s => ({ ...s, plan: s.plan.map(i => (i.id === lever ? { ...i, done: !i.done, fail: undefined, doneAt: !i.done ? Date.now() : undefined } : i)) }));
  },
  fail(id: PersonaId, lever: string, reason: string) {
    update(id, s => ({ ...s, plan: s.plan.map(i => (i.id === lever && !i.done ? { ...i, fail: { reason, at: Date.now() } } : i)) }));
  },
  reset(id: PersonaId) {
    write({ ...readState(), [id]: null });
  },
};

// ───────── A/B 비교(프로그램이 계산, AI가 아님) ─────────
export type Compare = { shared: string[]; onlyA: string[]; onlyB: string[]; overlap: number };

export function compareQuests(a: PlanItem[], b: PlanItem[]): Compare {
  const ia = a.filter(i => i.source === 'ai').map(i => i.id);
  const ib = b.filter(i => i.source === 'ai').map(i => i.id);
  const shared = ia.filter(x => ib.includes(x));
  const union = new Set([...ia, ...ib]).size;
  return { shared, onlyA: ia.filter(x => !ib.includes(x)), onlyB: ib.filter(x => !ia.includes(x)), overlap: union === 0 ? 0 : shared.length / union };
}

export { diffRuns, type Diff } from './ai-diff';
