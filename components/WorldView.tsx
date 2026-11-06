'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import TwinStage from '@/components/TwinStage';
import { useAvatar } from '@/lib/avatar-store';
import { growthOf, totalXp } from '@/lib/growth';
import { nextStageLevel, roomStage, worldState, type ItemState } from '@/lib/world';
import { useTwinState } from '@/lib/twin-store';

const WALL = ['#efe9ff', '#fdf0e6', '#e6f4ee', '#e8f1ff'];
const FLOOR = ['#d9c9ff', '#f0cfa8', '#bfe3cc', '#c3d7f5'];

// 물건 그림: 단순한 도형으로만 그립니다.
function Thing({ id, x, y }: { id: string; x: number; y: number }) {
  switch (id) {
    case 'lamp': return <g transform={`translate(${x} ${y})`}><rect x="-2" y="-34" width="4" height="34" fill="#a98b6b" /><path d="M-14 -34 L14 -34 L8 -52 L-8 -52Z" fill="#ffd98a" /><circle cx="0" cy="-30" r="22" fill="#ffe9a8" opacity="0.35" /></g>;
    case 'bed': return <g transform={`translate(${x} ${y})`}><rect x="-34" y="-16" width="68" height="24" rx="6" fill="#b79cff" /><rect x="-34" y="-26" width="24" height="14" rx="6" fill="#fff" /><rect x="-34" y="8" width="5" height="8" fill="#8f77d9" /><rect x="29" y="8" width="5" height="8" fill="#8f77d9" /></g>;
    case 'mat': return <g transform={`translate(${x} ${y})`}><rect x="-30" y="-6" width="60" height="12" rx="4" fill="#7ed6a8" transform="skewX(-20)" /></g>;
    case 'plant': return <g transform={`translate(${x} ${y})`}><rect x="-10" y="-14" width="20" height="18" rx="3" fill="#d98a5b" /><path d="M0 -14 C-20 -34 -8 -46 0 -30 C8 -46 20 -34 0 -14Z" fill="#5fbf8a" /></g>;
    case 'shelf': return <g transform={`translate(${x} ${y})`}><rect x="-32" y="-4" width="64" height="6" rx="2" fill="#a98b6b" /><rect x="-24" y="-20" width="10" height="16" rx="2" fill="#ff8fb8" /><rect x="-10" y="-24" width="10" height="20" rx="2" fill="#6fd6b5" /><circle cx="14" cy="-12" r="8" fill="#ffd35c" /></g>;
    case 'rug': return <ellipse cx={x} cy={y} rx="46" ry="12" fill="#ff8fb8" opacity="0.55" />;
    case 'desk': return <g transform={`translate(${x} ${y})`}><rect x="-30" y="-14" width="60" height="8" rx="2" fill="#c9a37a" /><rect x="-26" y="-6" width="5" height="22" fill="#a98b6b" /><rect x="21" y="-6" width="5" height="22" fill="#a98b6b" /><rect x="-8" y="-30" width="16" height="16" rx="2" fill="#5aa0ff" /></g>;
    case 'window': return <g transform={`translate(${x} ${y})`}><rect x="-26" y="-26" width="52" height="52" rx="4" fill="#bfe4ff" stroke="#fff" strokeWidth="5" /><path d="M0 -26 V26 M-26 0 H26" stroke="#fff" strokeWidth="3" /><circle cx="10" cy="-10" r="6" fill="#ffe27a" /></g>;
    case 'friend': return <g transform={`translate(${x} ${y})`}><ellipse cx="0" cy="0" rx="14" ry="10" fill="#4a3f6b" opacity="0.55" /><circle cx="-5" cy="-2" r="1.8" fill="#fff" /><circle cx="5" cy="-2" r="1.8" fill="#fff" /></g>;
    case 'balcony': return <g transform={`translate(${x} ${y})`}><rect x="-26" y="-4" width="52" height="6" fill="#a98b6b" /><path d="M-26 -4 V-28 M-12 -4 V-28 M2 -4 V-28 M16 -4 V-28 M26 -4 V-28" stroke="#a98b6b" strokeWidth="3" /></g>;
    default: return null;
  }
}

export default function WorldView() {
  const state = useTwinState();
  const avatar = useAvatar();
  const [talk, setTalk] = useState<string | null>(null);
  const plans = state?.plans;
  const growth = useMemo(() => (plans ? growthOf(totalXp(plans)) : null), [plans]);
  const items = useMemo<ItemState[]>(() => (plans && growth ? worldState(growth.level, plans) : []), [plans, growth]);

  if (!state || !growth || avatar === undefined) return <p className="muted" role="status">불러오는 중…</p>;
  if (!avatar || !state.profile)
    return (
      <section className="card">
        <h2>먼저 나와 쌍둥이를 만들어 주세요</h2>
        <Link className="btn primary" href="/welcome">시작하기</Link>
      </section>
    );

  const stage = roomStage(growth.level);
  const open = items.filter(i => i.unlocked);
  const locked = items.filter(i => !i.unlocked);
  const nextLv = nextStageLevel(growth.level);

  return (
    <div className="stack">
      <section className="card world-card" aria-label="ANOTHER WORLD">
        <div className="section-head">
          <h2>ANOTHER WORLD</h2>
          <span className="tag">{stage.name}</span>
        </div>
        <svg viewBox="0 0 360 260" className="world-svg" role="img" aria-label={`${stage.name}. 열린 물건 ${open.length}개`}>
          <rect width="360" height="260" fill={WALL[stage.stage - 1]} />
          <rect y="168" width="360" height="92" fill={FLOOR[stage.stage - 1]} />
          {stage.stage >= 3 && <rect x="300" y="60" width="60" height="108" fill="#cfe8ff" opacity="0.6" />}
          {stage.stage === 4 && <g><circle cx="320" cy="200" r="22" fill="#9be0b3" /><circle cx="344" cy="212" r="16" fill="#7ed6a8" /><circle cx="20" cy="206" r="18" fill="#9be0b3" /></g>}
          {open.map(s => (
            <g key={s.item.id} role="button" tabIndex={0} aria-label={`${s.item.name}: 누르면 쌍둥이가 말해요`} className="world-thing" onClick={() => setTalk(s.item.line)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setTalk(s.item.line)}>
              <Thing id={s.item.id} x={s.item.x} y={s.item.y} />
              <rect x={s.item.x - 36} y={s.item.y - 56} width="72" height="72" fill="transparent" />
            </g>
          ))}
        </svg>
        <div className="world-twin">
          <div className="world-stage"><TwinStage avatar={avatar} height={150} vitality={0.8} mood="happy" /></div>
          <p className="speech" role="status">{talk ?? '물건을 눌러 보세요. 해낸 퀘스트가 이 공간에 쌓여요.'}</p>
        </div>
        <p className="muted small">Lv.{growth.level} · {nextLv ? `Lv.${nextLv}이 되면 방이 커져요` : '가장 큰 공간이에요'}</p>
        <details className="how">
          <summary>어떻게 열려요?</summary>
          <ul>
            <li>방 크기는 레벨(XP)로, 물건은 실제로 해낸 퀘스트 횟수로 열려요.</li>
            <li>이 장면은 프로그램 규칙이에요. AI가 만든 게 아니에요.</li>
          </ul>
        </details>
      </section>

      <section className="card">
        <h3>열린 물건 {open.length}/{items.length}</h3>
        <ul className="why-list">
          {open.map(s => <li key={s.item.id}><span>{s.item.name}</span><b>열림</b></li>)}
        </ul>
      </section>

      {locked.length > 0 && (
        <section className="card">
          <h3>아직 잠겨 있어요</h3>
          <ul className="why-list">
            {locked.map(s => <li key={s.item.id}><span>🔒 {s.item.name}</span><b>{s.remaining} ({s.progress}/{s.target})</b></li>)}
          </ul>
        </section>
      )}

      <p className="foot-links">
        <Link href="/shadow">🌑 MY SHADOW</Link>
        <Link href="/parallel">🪞 PARALLEL ME</Link>
      </p>
    </div>
  );
}
