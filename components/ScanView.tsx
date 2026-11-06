'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import HiddenMe from '@/components/HiddenMe';
import Radar from '@/components/Radar';
import { lifeClassOf } from '@/lib/life-class';
import { predict } from '@/lib/twin-model';
import { todayKey, whatIfRanking } from '@/lib/twin-data';
import { LEVER_GROUP, acceptProbs, groupScores, idealRange, levelOfScore, missionStats } from '@/lib/twin-sim';
import { useTwin } from '@/lib/use-twin';

export default function ScanView() {
  const twin = useTwin();
  const { state, model, baseHabits } = twin;

  const scan = useMemo(() => {
    if (!state?.profile || !model || !baseHabits) return null;
    const score = predict(model, baseHabits);
    const ideal = idealRange(model);
    const lv = levelOfScore(score, ideal);
    const groups = groupScores(model, baseHabits);
    const accept = acceptProbs(missionStats(state.plans, todayKey()));
    const ranking = whatIfRanking(model, state.profile, baseHabits, accept).ranking;
    const weak = [...groups].sort((a, b) => a.score - b.score).slice(0, 2).map(g => {
      const lever = ranking.find(r => LEVER_GROUP[r.id] === g.id && r.gain >= 0.8);
      return { ...g, lever };
    });
    return { score, ideal, lv, groups, weak };
  }, [state, model, baseHabits]);

  if (!state) return <p className="muted" role="status">불러오는 중…</p>;
  if (!state.profile)
    return (
      <section className="card">
        <h2>현재 상태를 분석해 볼까요?</h2>
        <p className="muted">생활 질문에 답하면 REALITY SCAN이 시작돼요.</p>
        <Link className="btn primary" href="/onboarding">시작하기</Link>
      </section>
    );
  if (!scan || !baseHabits) return <p className="muted" role="status">내 상태를 분석하는 중이에요…</p>;

  const { lv, groups, weak, score, ideal } = scan;
  const n = state.checkins.length;
  const cls = lifeClassOf(state.profile?.lifeClass);
  const circ = 2 * Math.PI * 42;

  const tiles: [string, string][] = [
    ['수면', `${baseHabits.sleepHours.toFixed(1)}시간`],
    ['걸음', `${Math.round(baseHabits.steps).toLocaleString('ko-KR')}보`],
    ['운동', `${Math.round(baseHabits.exerciseMin)}분`],
    ['카페인', `${baseHabits.caffeineCups.toFixed(1)}잔`],
    ['숏폼', `${Math.round(baseHabits.shortformMin)}분`],
    ['물', `${Math.round(baseHabits.waterCups)}컵`],
  ];

  return (
    <div className="stack">
      <section className="card scan-hero" aria-label="현재 생활 상태">
        <div className="ring" role="img" aria-label={`되고 싶은 모습까지 ${Math.round(lv.closeness * 100)}%`}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#ece8f8" strokeWidth="10" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="url(#ringg)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${Math.max(0.02, lv.closeness) * circ} ${circ}`} transform="rotate(-90 50 50)" />
            <defs>
              <linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#9a88ff" />
                <stop offset="1" stopColor="#ff9cc4" />
              </linearGradient>
            </defs>
          </svg>
          <span>{Math.round(lv.closeness * 100)}%<small>되고 싶은 모습</small></span>
        </div>
        <div>
          <p className="eyebrow">지금의 나</p>
          <h2 style={{ fontSize: 20 }}>Lv.{lv.level} {lv.name}</h2>
          <p className="muted small">컨디션 지수 {score.toFixed(0)}점 (가장 이상적인 습관이면 {ideal.best.toFixed(0)}점)</p>
          {cls && <p className="small" style={{ marginTop: 6 }}><span className="tag">LIFE CLASS</span> {cls.icon} {cls.name}</p>}
        </div>
      </section>

      <section className="card" aria-label="영역별 분석 점수">
        <h2>영역별 분석 점수</h2>
        <Radar items={groups.map(g => ({ label: g.label, score: g.score }))} />
        <ul className="area-list">
          {groups.map(g => (
            <li key={g.id}>
              <span>{g.label}</span>
              <span className={`bar${g.score < 50 ? ' warn' : ''}`} aria-hidden="true"><span style={{ width: `${Math.max(3, Math.round(g.score))}%` }} /></span>
              <b>{Math.round(g.score)}%</b>
            </li>
          ))}
        </ul>
        <p className="muted small">각 영역이 이상적인 습관에 비해 어느 정도인지를 신경망으로 계산한 값이에요.</p>
      </section>

      <section className="card" aria-label="생활 패턴 요약">
        <div className="section-head">
          <h2>생활 패턴 요약</h2>
          <span className="points">{n > 0 ? `최근 ${Math.min(7, n)}일 평균` : '질문 답변 기준'}</span>
        </div>
        <div className="habit-grid">
          {tiles.map(([k, v]) => (
            <div key={k}><strong>{v}</strong><small>{k}</small></div>
          ))}
        </div>
        {n === 0 && <p className="muted small">아직 체크인 기록이 없어서 질문 답변으로 추정한 값이에요. 체크인을 하면 실제 기록으로 바뀌어요.</p>}
      </section>

      <HiddenMe twin={twin} />

      <section className="card" aria-label="개선이 필요한 부분">
        <h2>개선이 필요한 부분</h2>
        <div className="improve">
          {weak.map(w => (
            <div key={w.id} className="improve-item">
              <strong>{w.label} {Math.round(w.score)}%</strong>
              <span>{w.lever ? `‘${w.lever.title}’ 로 컨디션 +${w.lever.gain.toFixed(0)}점 정도 오를 것으로 예상돼요.` : '지금도 괜찮은 편이에요. 지금 습관을 이어 가 보세요.'}</span>
            </div>
          ))}
        </div>
        <div className="twin-actions">
          <Link className="btn primary" href="/quests">퀘스트 하러 가기</Link>
          <Link className="btn" href="/checkin">체크인</Link>
        </div>
      </section>

      <p className="foot-links">
        <Link href="/analysis">🧠 신경망 분석 근거</Link>
        <Link href="/trace">🔎 AI TRACE</Link>
      </p>
    </div>
  );
}
