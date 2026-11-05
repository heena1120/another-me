'use client';

import type { PlanItem } from '@/lib/twin-data';

// 미션마다 아이콘과 짧은 이름 (긴 설명은 화면에서 빼고, 이유는 접근성 이름에만 남깁니다)
const LOOK: Record<string, { icon: string; short: string }> = {
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

export const questShort = (id: string, fallback: string) => LOOK[id]?.short ?? fallback;

/** 미션 하나로 오르는 점수(올림). 화면에는 이 숫자를 보여 줍니다. */
export const questGain = (item: PlanItem) => Math.max(1, Math.round(item.gain));

export default function QuestTray({ items, hintIds, onToggle }: { items: PlanItem[]; hintIds: string[]; onToggle: (item: PlanItem) => void }) {
  return (
    <div className="tray" role="group" aria-label="오늘의 미션">
      {items.map(item => {
        const look = LOOK[item.id] ?? { icon: '⭐', short: item.title };
        const hint = !item.done && hintIds.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={`quest${item.done ? ' done' : ''}${hint ? ' hint' : ''}`}
            aria-pressed={item.done}
            aria-label={`${item.title}, 컨디션 +${questGain(item)}점${hint ? ', 레벨업에 필요해요' : ''}. ${item.reason}`}
            onClick={() => onToggle(item)}
          >
            <span className="quest-icon" aria-hidden="true">{item.done ? '✅' : look.icon}</span>
            <span className="quest-name">{look.short}</span>
            <span className="quest-pts">+{questGain(item)}점</span>
          </button>
        );
      })}
    </div>
  );
}
