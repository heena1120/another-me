'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { shadowStates, type ShadowState } from '@/lib/shadow';
import { todayKey } from '@/lib/twin-data';
import { twinActions, useTwinState } from '@/lib/twin-store';

// 그림자 모양: 크기가 줄어들수록 작고 흐려집니다. (프로그램이 계산한 값을 그림으로 보여 줄 뿐)
function Blob({ s }: { s: ShadowState }) {
  const r = 14 + (s.strength / 100) * 34;
  return (
    <svg viewBox="0 0 100 100" className="blob" role="img" aria-label={`${s.def.name}: ${s.stage}`}>
      <ellipse cx="50" cy="86" rx={r * 0.9} ry="5" fill="#2b2540" opacity="0.18" />
      <path
        d={`M${50 - r} 62 C${50 - r} ${62 - r * 1.1} ${50 + r} ${62 - r * 1.1} ${50 + r} 62 C${50 + r} ${62 + r * 0.5} ${50 + r * 0.5} 80 50 80 C${50 - r * 0.5} 80 ${50 - r} ${62 + r * 0.5} ${50 - r} 62Z`}
        fill="#4a3f6b"
        opacity={0.35 + s.strength / 160}
      />
      <circle cx={50 - r * 0.3} cy={58 - r * 0.15} r={Math.max(1.5, r * 0.07)} fill="#fff" />
      <circle cx={50 + r * 0.3} cy={58 - r * 0.15} r={Math.max(1.5, r * 0.07)} fill="#fff" />
    </svg>
  );
}

export default function ShadowView() {
  const state = useTwinState();
  const states = useMemo(() => (state?.profile ? shadowStates(state.profile, state.plans) : null), [state]);
  if (!state) return <p className="muted" role="status">불러오는 중…</p>;
  if (!state.profile || !states)
    return (
      <section className="card">
        <h2>먼저 나를 알려 주세요</h2>
        <p className="muted">내가 고른 답변으로 그림자의 처음 크기를 정해요.</p>
        <Link className="btn primary" href="/onboarding">시작하기</Link>
      </section>
    );
  const day = todayKey();
  const plan = state.plans[day] ?? [];
  const sorted = [...states].sort((a, b) => b.strength - a.strength);

  return (
    <div className="stack">
      <section className="card">
        <h2>MY SHADOW</h2>
        <p className="muted">행동을 가로막던 반복 패턴이에요. 퀘스트를 해낼수록 작아져요.</p>
        <details className="how">
          <summary>어떻게 계산해요?</summary>
          <ul>
            <li>처음 크기는 내 답변으로, 줄어드는 양은 완료 기록으로 프로그램이 계산해요. (AI 판단·진단 아님)</li>
            <li>SHADOW BATTLE: 오늘 퀘스트 중 맞서는 퀘스트에 ⚔️ 표시가 붙고, 해내면 XP +5. 없으면 1~2분짜리 작은 퀘스트를 더해요.</li>
            <li>못 했어요 → ‘더 작은 단계로 바꾸기’를 누르면 같은 퀘스트가 더 작아져요.</li>
            <li>그림자 도전 퀘스트 8, 맞서는 종류 4(그 외 2)만큼 작아져요.</li>
          </ul>
        </details>
      </section>

      {sorted.map(s => {
        const fighting = plan.some(i => i.shadow === s.def.id && !i.done);
        return (
          <article key={s.def.id} className="card shadow-card">
            <div className="shadow-top">
              <Blob s={s} />
              <div>
                <h3>{s.def.name}</h3>
                <p className="muted small">{s.def.blurb}</p>
                <p className="small">
                  <span className="tag">{s.stage}</span> 크기 {Math.round(s.strength)} / 처음 {Math.round(s.base)}
                </p>
              </div>
            </div>
            <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.overcome * 100)} aria-label={`${s.def.name} 줄어든 정도`}>
              <span style={{ width: `${Math.max(3, Math.round(s.overcome * 100))}%` }} />
            </div>
            <p className="muted small">처음보다 {Math.round(s.overcome * 100)}% 작아졌어요 · 이긴 점수 {s.wins}</p>
            <button type="button" className="btn primary" disabled={fighting || s.strength < 3} onClick={() => twinActions.startBattle(day, s.def.id)}>
              {s.strength < 3 ? '잠잠해졌어요' : fighting ? '⚔️ 도전 중 (퀘스트에서 해내요)' : '⚔️ SHADOW BATTLE 시작'}
            </button>
          </article>
        );
      })}

      <Link className="btn" href="/quests">오늘 퀘스트 보기</Link>
    </div>
  );
}
