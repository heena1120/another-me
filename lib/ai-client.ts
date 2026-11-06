// AI 코치에 보낼 입력을 만들고, AI가 돌려준 결과를 앱의 퀘스트로 바꿉니다. (브라우저 쪽 일반 프로그램 로직)
import { LEVER_AREA, type AiQuest, type CoachInput, type CoachResult } from './ai-types';
import { buildMemory, type ArchivedFail } from './ai-memory';
import { lifeClassOf } from './life-class';
import { QUESTIONS, whatIfRanking, type Checkin, type PlanItem, type Profile } from './twin-data';
import type { Raw, TwinModel } from './twin-model';
import { acceptProbs, groupScores, missionStats } from './twin-sim';

export function buildCoachInput(args: {
  mode: 'initial' | 'reanalyze';
  profile: Profile;
  plans: Record<string, PlanItem[]>;
  archived: ArchivedFail[];
  model: TwinModel;
  baseHabits: Raw;
  today: string;
  /** 하루 퀘스트 개수(1~6) */
  maxQuests?: number;
  /** 체크인 기록(오늘 것이 있으면 AI에 함께 보냄) */
  checkins?: Checkin[];
}): CoachInput {
  const { mode, profile, plans, archived, model, baseHabits, today, maxQuests = 4, checkins = [] } = args;
  const ck = checkins.find(c => c.date === today);
  const checkin: CoachInput['checkin'] = ck
    ? { date: ck.date, sleepHours: ck.raw.sleepHours, steps: ck.raw.steps, exerciseMin: ck.raw.exerciseMin, caffeineCups: ck.raw.caffeineCups, shortformMin: ck.raw.shortformMin, screenBeforeBed: ck.raw.screenBeforeBed >= 0.5, feeling: Math.round(ck.actual) }
    : null;
  const lc = lifeClassOf(profile.lifeClass);

  // 사용자가 직접 고른 답변 (목표는 LIFE CLASS에서 따로 고르므로 중복해서 보내지 않음)
  const answers = QUESTIONS.filter(q => !(q.id === 'goal' && lc))
    .map(q => {
      const v = profile[q.id];
      const label = v === undefined ? undefined : q.options.find(o => o.id === v)?.label;
      return label ? { key: q.id as string, question: q.text, answer: label } : null;
    })
    .filter((a): a is { key: string; question: string; answer: string } => a !== null);

  const accept = acceptProbs(missionStats(plans, today));
  const levers = whatIfRanking(model, profile, baseHabits, accept)
    .ranking.slice(0, 10)
    .map(r => ({ id: r.id as CoachInput['signals']['levers'][number]['id'], title: r.title, gain: Math.round(r.gain * 10) / 10, minutes: r.minutes }));

  const areas = groupScores(model, baseHabits).map(g => ({ id: g.id, label: g.label, score: Math.round(g.score) }));
  const lowest = [...areas].sort((a, b) => a.score - b.score)[0];
  const covers = lowest && levers.some(l => LEVER_AREA[l.id] === lowest.id);

  return {
    mode,
    lifeClass: lc ? { id: lc.id, name: lc.name, meaning: lc.meaning } : null,
    answers,
    signals: {
      areas,
      levers,
    },
    memory: buildMemory(plans, archived),
    preference: { wish: profile.wish?.trim() ? profile.wish.trim().slice(0, 160) : null },
    checkin,
    constraints: { mustCoverArea: covers ? lowest.id : null, maxQuests },
  };
}

/** 화면에 보여 줄 "AI에 보낸 데이터의 종류" */
export function inputKindsOf(input: CoachInput): string[] {
  const kinds = [`설문 답변 ${input.answers.length}개`];
  if (input.lifeClass) kinds.push(`LIFE CLASS(${input.lifeClass.name})`);
  kinds.push('프로그램이 계산한 영역 점수와 퀘스트 후보');
  if (input.checkin) kinds.push(`오늘 체크인(수면 ${input.checkin.sleepHours}h·걸음 ${input.checkin.steps}·컨디션 ${input.checkin.feeling}점)`);
  if (input.preference?.wish) kinds.push('내 방식(한마디)');
  kinds.push(input.memory.daysObserved > 0 ? `퀘스트 기록 ${input.memory.daysObserved}일치` : '퀘스트 기록 없음(처음)');
  return kinds;
}

/** AI가 만든 퀘스트를 앱의 퀘스트로. 효과 점수(gain)는 AI가 아니라 신경망이 계산한 값을 씁니다. */
export function planFromCoach(result: CoachResult, levers: CoachInput['signals']['levers'], aiAt: string): PlanItem[] {
  return result.quests.map((q: AiQuest) => ({
    id: q.lever,
    title: q.title,
    reason: q.why,
    points: 1,
    gain: levers.find(l => l.id === q.lever)?.gain ?? 0,
    done: false,
    minutes: q.minutes,
    source: 'ai' as const,
    action: q.action,
    expected: q.expected,
    doneWhen: q.doneWhen,
    aiDifficulty: q.difficulty,
    evidence: q.evidence,
    verified: q.verified,
    aiAt,
  }));
}
