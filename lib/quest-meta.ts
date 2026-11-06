// 퀘스트를 화면에 보여 줄 때 쓰는 공통 정보(아이콘·짧은 이름·난이도·시간 문구)
import type { PlanItem } from './twin-data';

export const QUEST_LOOK: Record<string, { icon: string; short: string }> = {
  sleep: { icon: '😴', short: '일찍 눕기' },
  caffeine: { icon: '☕', short: '카페인 쉬기' },
  screen: { icon: '📵', short: '폰 내려놓기' },
  shortform: { icon: '📱', short: '숏폼 줄이기' },
  walk: { icon: '🚶', short: '걷기' },
  stretch: { icon: '🧘', short: '스트레칭' },
  exercise: { icon: '💪', short: '운동' },
  water: { icon: '💧', short: '물 마시기' },
  meals: { icon: '🍚', short: '규칙 식사' },
  outdoor: { icon: '☀️', short: '햇볕 쬐기' },
};

export const questIcon = (id: string) => QUEST_LOOK[id]?.icon ?? '⭐';
export const questShort = (id: string, fallback: string) => QUEST_LOOK[id]?.short ?? fallback;

/** 미션 하나로 오르는 점수(올림). */
export const questGain = (item: PlanItem) => Math.max(1, Math.round(item.gain));

export type Difficulty = '쉬움' | '보통' | '도전';

/**
 * 난이도 = 걸리는 시간과 "내가 지킬 확률"로 계산합니다.
 * 시간이 길수록, 내가 잘 못 지킬수록 어려운 미션으로 봅니다.
 */
export function difficultyOf(item: PlanItem, acceptProb = 0.5): Difficulty {
  const d = (item.minutes ?? 0) / 20 + (1 - acceptProb);
  return d < 0.6 ? '쉬움' : d < 1.2 ? '보통' : '도전';
}

export const minutesLabel = (item: PlanItem) => (item.minutes && item.minutes > 0 ? `약 ${item.minutes}분` : '추가 시간 없음');

export const FAIL_REASONS = ['시간이 없었어요', '깜빡했어요', '귀찮았어요', '몸이 힘들었어요', '상황이 안 됐어요'] as const;
