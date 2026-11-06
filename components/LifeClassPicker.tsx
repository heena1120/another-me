'use client';

import { LIFE_CLASSES } from '@/lib/life-class';
import type { LifeClassId } from '@/lib/ai-types';

// 되고 싶은 모습(LIFE CLASS). 고르면 AI의 분석 기준·퀘스트 방향과 퀘스트 추천 가중치가 달라집니다.
export default function LifeClassPicker({ value, onChange }: { value: LifeClassId | null; onChange: (id: LifeClassId) => void }) {
  return (
    <div className="class-grid" role="group" aria-label="되고 싶은 모습 선택">
      {LIFE_CLASSES.map(c => (
        <button key={c.id} type="button" className="class-card" aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
          <span className="cico" aria-hidden="true">{c.icon}</span>
          <span>
            <strong>{c.name}</strong>
            <span>{c.desc}</span>
            <span style={{ color: '#5846d6', fontWeight: 700 }}>먼저 보는 것: {c.focus}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
