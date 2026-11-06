// 재분석 전후로 AI 퀘스트가 어떻게 달라졌는지(프로그램이 비교, AI가 아님)
import type { CoachResult } from './ai-types';

export type Diff = { added: string[]; removed: string[]; changed: { lever: string; from: string; to: string }[] };

export function diffRuns(before: CoachResult, after: CoachResult): Diff {
  const b = new Map(before.quests.map(q => [q.lever as string, q]));
  const a = new Map(after.quests.map(q => [q.lever as string, q]));
  const changed: Diff['changed'] = [];
  for (const [lever, q] of a) {
    const p = b.get(lever);
    if (p && (p.minutes !== q.minutes || p.difficulty !== q.difficulty)) changed.push({ lever, from: `${p.minutes}분·${p.difficulty}`, to: `${q.minutes}분·${q.difficulty}` });
  }
  return { added: [...a.keys()].filter(k => !b.has(k)), removed: [...b.keys()].filter(k => !a.has(k)), changed };
}

export const diffCount = (d: Diff) => d.added.length + d.removed.length + d.changed.length;
