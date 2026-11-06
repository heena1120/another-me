'use client';

import type { PlanItem } from '@/lib/twin-data';
import { QUEST_LOOK, questGain, questShort } from '@/lib/quest-meta';

// 기존 import 경로를 깨지 않도록 다시 내보냅니다.
export { questGain, questShort };

/** 아이콘 버튼 형태의 간단한 미션 트레이 (홈의 이전 디자인에서 쓰던 컴포넌트) */
export default function QuestTray({ items, hintIds, onToggle }: { items: PlanItem[]; hintIds: string[]; onToggle: (item: PlanItem) => void }) {
  return (
    <div className="tray" role="group" aria-label="오늘의 퀘스트">
      {items.map(item => {
        const look = QUEST_LOOK[item.id] ?? { icon: '⭐', short: item.title };
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
