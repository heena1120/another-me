// AI MEMORY: 사용자의 퀘스트 기록(해낸 것·못 한 것·이유·시간대·선호·만족도)을 AI 입력용으로 정리합니다.
// AI가 하는 일이 아니라 일반 프로그램 로직입니다. (어떤 기록을 AI에게 보낼지 결정하는 부분)
import type { CoachMemory } from './ai-types';
import type { PlanItem } from './twin-data';
import { difficultyOf } from './quest-meta';

/** AI가 퀘스트를 다시 만들 때 사라지는 "못 한 퀘스트" 기록을 따로 보관한 것 */
export type ArchivedFail = { date: string; lever: string; reason: string; at: number; minutes: number | null; difficulty: string };

export const bucketOf = (ms: number) => {
  const h = new Date(ms).getHours();
  return h < 6 ? '새벽' : h < 12 ? '아침' : h < 18 ? '오후' : h < 22 ? '저녁' : '밤';
};

export function buildMemory(plans: Record<string, PlanItem[]>, archived: ArchivedFail[]): CoachMemory {
  const stats = new Map<string, { done: number; total: number }>();
  const fails: ArchivedFail[] = [...archived];
  const badLevers = new Set<string>();
  const activeDates = new Set<string>(); // 실제 행동(완료·실패)을 기록한 날
  let good = 0;
  let bad = 0;

  for (const [date, items] of Object.entries(plans)) {
    for (const it of items) {
      const s = stats.get(it.id) ?? { done: 0, total: 0 };
      s.total++;
      if (it.done) s.done++;
      if (it.done || it.fail) activeDates.add(date);
      stats.set(it.id, s);
      if (it.fail) fails.push({ date, lever: it.id, reason: it.fail.reason, at: it.fail.at, minutes: it.minutes ?? null, difficulty: it.aiDifficulty ?? difficultyOf(it) });
      if (it.feedback === 'good') good++;
      if (it.feedback === 'bad') {
        bad++;
        badLevers.add(it.id);
      }
    }
  }

  for (const f of archived) activeDates.add(f.date);

  // 못 한 기록은 퀘스트 종류별로 묶고, 가장 최근 기록의 이유·시간·난이도를 대표값으로 씁니다.
  const byLever = new Map<string, ArchivedFail[]>();
  for (const f of fails) byLever.set(f.lever, [...(byLever.get(f.lever) ?? []), f]);
  const failed = [...byLever.entries()]
    .map(([lever, list]) => {
      const latest = [...list].sort((a, b) => b.at - a.at)[0];
      return { lever, reason: latest.reason, minutes: latest.minutes, difficulty: latest.difficulty, count: list.length };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const times = new Map<string, number>();
  for (const f of fails) times.set(bucketOf(f.at), (times.get(bucketOf(f.at)) ?? 0) + 1);

  return {
    daysObserved: activeDates.size,
    done: [...stats.entries()].map(([lever, s]) => ({ lever, ...s })).slice(0, 10),
    failed,
    failTimes: [...times.entries()].map(([bucket, count]) => ({ bucket, count })).sort((a, b) => b.count - a.count),
    preferred: [...stats.entries()]
      .filter(([, s]) => s.done >= 1)
      .sort((a, b) => b[1].done - a[1].done)
      .slice(0, 3)
      .map(([lever]) => lever),
    feedback: { good, bad, badLevers: [...badLevers].slice(0, 5) },
  };
}
