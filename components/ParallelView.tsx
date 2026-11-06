'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import TwinStage from '@/components/TwinStage';
import { useAvatar } from '@/lib/avatar-store';
import { growthOf, totalXp } from '@/lib/growth';
import { shadowStates } from '@/lib/shadow';
import { improvedHabits } from '@/lib/twin-data';
import { groupScores, vitalityOf } from '@/lib/twin-sim';
import { predict } from '@/lib/twin-model';
import { leverName } from '@/lib/ai-types';
import { useTwin } from '@/lib/use-twin';

// PARALLEL ME: "아무것도 안 바꾼 나"와 "해낸 퀘스트를 반영한 나"를 나란히 보여 줍니다.
// 두 모습의 차이는 쌍둥이 신경망이 계산한 추정치예요(AI 모델이 쓴 글이 아님).
export default function ParallelView() {
  const { state, model, baseHabits } = useTwin();
  const avatar = useAvatar();
  const plans = state?.plans;

  const view = useMemo(() => {
    if (!state?.profile || !model || !baseHabits || !plans) return null;
    const counts: Record<string, number> = {};
    for (const items of Object.values(plans)) for (const it of items) if (it.done) counts[it.id] = (counts[it.id] ?? 0) + 1;
    const ids = Object.keys(counts);
    const improved = improvedHabits(state.profile, baseHabits, ids);
    const a = groupScores(model, baseHabits);
    const b = groupScores(model, improved);
    const areas = a.map((g, i) => ({ id: g.id, label: g.label, now: Math.round(g.score), better: Math.round(b[i].score) }));
    const scoreNow = predict(model, baseHabits);
    const scoreBetter = predict(model, improved);
    const shadows = shadowStates(state.profile, plans);
    const top = [...areas].sort((x, y) => y.better - y.now - (x.better - x.now))[0];
    const days = Object.values(plans).filter(items => items.some(i => i.done)).length;
    return { counts, ids, areas, scoreNow, scoreBetter, shadows, top, days, xp: totalXp(plans) };
  }, [state, model, baseHabits, plans]);

  if (!state || avatar === undefined) return <p className="muted" role="status">불러오는 중…</p>;
  if (!state.profile || !avatar)
    return (
      <section className="card">
        <h2>먼저 나를 알려 주세요</h2>
        <Link className="btn primary" href="/onboarding">시작하기</Link>
      </section>
    );
  if (!view) return <p className="muted" role="status">쌍둥이 신경망을 준비하는 중…</p>;

  const empty = view.ids.length === 0;
  const g = growthOf(view.xp);

  return (
    <div className="stack">
      <section className="card">
        <h2>PARALLEL ME</h2>
        <p className="muted">아무것도 안 바꾼 나 vs 해낸 퀘스트를 반영한 나.</p>
        <div className="parallel-pair">
          <div>
            <TwinStage avatar={avatar} height={170} vitality={vitalityOf(view.scoreNow)} mood="tired" />
            <strong>지금 패턴 그대로</strong>
            <small>컨디션 {Math.round(view.scoreNow)}점</small>
          </div>
          <div className="good">
            <TwinStage avatar={avatar} height={170} vitality={vitalityOf(view.scoreBetter)} mood="happy" />
            <strong>해낸 퀘스트 반영</strong>
            <small>컨디션 {Math.round(view.scoreBetter)}점</small>
          </div>
        </div>
        {empty && <p className="notice" role="note">아직 해낸 퀘스트가 없어서 두 모습이 같아요. 퀘스트를 하나 해내 보세요.</p>}
      </section>

      <section className="card">
        <h3>무엇이 달라졌나요</h3>
        <table className="compare">
          <thead><tr><th>영역</th><th>지금 패턴</th><th>반영 후</th></tr></thead>
          <tbody>
            {view.areas.map(a => (
              <tr key={a.id}><th scope="row">{a.label}</th><td>{a.now}</td><td>{a.better}{a.better > a.now ? ` (+${a.better - a.now})` : ''}</td></tr>
            ))}
          </tbody>
        </table>
        {!empty && (
          <p className="muted small">
            해낸 퀘스트: {Object.entries(view.counts).map(([id, n]) => `${leverName(id)} ${n}회`).join(', ')} · 퀘스트를 한 날 {view.days}일 · Lv.{g.level}
          </p>
        )}
      </section>

      <section className="card">
        <h3>성장 방향</h3>
        {!empty && view.top.better > view.top.now ? (
          <p>지금까지 가장 많이 달라진 영역은 <b>{view.top.label}</b>이에요. 이 흐름을 이어 가면 5년 시나리오도 함께 좋아져요.</p>
        ) : (
          <p className="muted">기록이 쌓이면 가장 많이 달라진 영역을 알려 줄게요.</p>
        )}
        <ul className="why-list">
          {view.shadows.filter(s => s.wins > 0).map(s => <li key={s.def.id}><span>{s.def.name}</span><b>처음보다 {Math.round(s.overcome * 100)}% 작아졌어요</b></li>)}
        </ul>
        <p className="muted small">신경망 추정이에요(AI 글 아님). 확정 예측이 아니에요.</p>
        <Link className="btn" href="/future">FUTURE ME 보러 가기</Link>
      </section>
    </div>
  );
}
