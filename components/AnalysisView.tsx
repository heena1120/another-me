'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import LossChart from '@/components/LossChart';
import NeuralViz from '@/components/NeuralViz';
import { CurveChart, SeriesChart } from '@/components/Charts';
import { neuralTrace, PERSONALIZE_MIN_DAYS, predict, responseCurve, type Raw } from '@/lib/twin-model';
import { predictionError, todayKey, whatIfRanking } from '@/lib/twin-data';
import { acceptProbs, missionStats } from '@/lib/twin-sim';
import { questShort } from '@/components/home/QuestTray';
import { useTwin } from '@/lib/use-twin';

// 모델이 찾은 패턴을 곡선으로 그릴 습관들
const PATTERNS: { key: keyof Raw; label: string; unit: string; from: number; to: number; lowerIsBetter: string }[] = [
  { key: 'sleepHours', label: '수면 시간', unit: '시간', from: 3, to: 11, lowerIsBetter: '' },
  { key: 'steps', label: '걸음 수', unit: '보', from: 0, to: 15000, lowerIsBetter: '' },
  { key: 'caffeineCups', label: '카페인', unit: '잔', from: 0, to: 6, lowerIsBetter: '적을수록' },
  { key: 'shortformMin', label: '숏폼', unit: '분', from: 0, to: 300, lowerIsBetter: '적을수록' },
  { key: 'exerciseMin', label: '운동', unit: '분', from: 0, to: 90, lowerIsBetter: '' },
  { key: 'outdoorMin', label: '바깥 활동', unit: '분', from: 0, to: 120, lowerIsBetter: '' },
  { key: 'waterCups', label: '물', unit: '컵', from: 0, to: 10, lowerIsBetter: '' },
  { key: 'bedtimeVar', label: '취침 시각 흔들림', unit: '분', from: 0, to: 180, lowerIsBetter: '적을수록' },
];

// 받침이 있으면 '은', 없으면 '는'
const topic = (w: string) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  return c >= 0 && c <= 11171 && c % 28 !== 0 ? `${w}은` : `${w}는`;
};

const fmt = (v: number) => (Math.abs(v) >= 1000 ? Math.round(v / 100) * 100 : Math.round(v * 2) / 2).toLocaleString('ko-KR');

export default function AnalysisView() {
  const { state, model, training, baseHabits } = useTwin();

  const trace = useMemo(() => (model && baseHabits ? neuralTrace(model, baseHabits) : null), [model, baseHabits]);

  const patterns = useMemo(() => {
    if (!model || !baseHabits) return [];
    return PATTERNS.map(p => {
      const points = responseCurve(model, baseHabits, p.key, p.from, p.to);
      const ys = points.map(q => q.y);
      const best = points.reduce((a, b) => (b.y > a.y ? b : a));
      const cur = baseHabits[p.key];
      return { ...p, points, best, cur, spread: Math.max(...ys) - Math.min(...ys), curScore: predict(model, baseHabits) };
    })
      .sort((a, b) => b.spread - a.spread)
      .slice(0, 3);
  }, [model, baseHabits]);

  // 지난 날들의 미션 기록에서 미션별로 내가 지킨 비율을 배웁니다. (오늘은 진행 중이라 제외)
  const stats = useMemo(() => (state ? missionStats(state.plans, todayKey()) : null), [state]);

  if (!state) return <p className="muted" role="status">불러오는 중…</p>;
  if (!state.profile)
    return (
      <section className="card">
        <h2>🧠 패턴 분석을 시작해요</h2>
        <p className="muted">나를 알려 주면 쌍둥이 신경망이 내 습관을 분석해요.</p>
        <Link className="btn primary" href="/interview">나 소개하기</Link>
      </section>
    );

  const days = state.checkins.length;
  const err = predictionError(state.checkins);
  const stage = days < PERSONALIZE_MIN_DAYS ? '일반 모델' : days < 14 ? '개인화 시작' : '개인화 강화';
  const history = training ? training.history : state.pretrainHistory;
  const what = model && baseHabits ? whatIfRanking(model, state.profile, baseHabits) : null;
  const series = state.checkins.slice(-14).map(c => ({ actual: c.actual, predicted: c.predicted }));
  const maxGain = what ? Math.max(1, ...what.ranking.map(r => Math.max(r.gain, 0))) : 1;

  return (
    <div className="stack">
      <section className="card hero-ai" aria-label="신경망이 내 습관을 계산하는 모습">
        <div className="card-head">
          <h2>🧠 내 습관 → 신경망</h2>
          <span className="points">{stage}</span>
        </div>
        {trace ? <NeuralViz trace={trace} /> : <p className="muted" role="status">쌍둥이 신경망을 학습하는 중이에요…</p>}
        <div className="stats">
          <div><strong>{what ? what.baseScore.toFixed(0) : '–'}</strong><small>예상 컨디션</small></div>
          <div><strong>{days}</strong><small>학습 기록(일)</small></div>
          <div><strong>{err ? `±${err.mae.toFixed(1)}` : '–'}</strong><small>사전 예측 오차</small></div>
        </div>
        <p className="muted small">내 지금 습관 12개가 신경망(12→24→12→1)을 지나며 실제로 계산되는 모습이에요. 분홍 선은 컨디션을 올리는 연결, 파랑 선은 내리는 연결이에요.</p>
      </section>

      {patterns.length > 0 && (
        <section className="card" aria-labelledby="pattern-title">
          <h2 id="pattern-title">AI가 찾은 내 패턴</h2>
          <div className="patterns">
            {patterns.map(p => {
              const atMin = p.best.x - p.from < (p.to - p.from) * 0.1;
              const atMax = p.to - p.best.x < (p.to - p.from) * 0.1;
              const gap = p.best.y - p.curScore;
              const headline = atMin ? `${topic(p.label)} ${p.lowerIsBetter || '적을수록'} 높아요` : atMax ? `${topic(p.label)} 많을수록 높아요` : `${topic(p.label)} ${fmt(p.best.x)}${p.unit} 근처에서 가장 높아요`;
              return (
                <article key={p.key} className="pattern">
                  <h3>{headline}</h3>
                  <CurveChart points={p.points} current={p.cur} label={`${p.label}에 따른 예상 컨디션 곡선`} />
                  <p className="muted small">
                    지금 <b>{fmt(p.cur)}{p.unit}</b>
                    {gap >= 1 ? ` · 최고점(노란 점)보다 ${gap.toFixed(0)}점 낮아요` : ' · 이미 최고점 근처예요'}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {series.length >= 3 && series.some(r => r.predicted !== null) && (
        <section className="card">
          <h2>쌍둥이의 예측 vs 실제</h2>
          <SeriesChart rows={series} />
          <p className="muted small">파란 점선은 기록하기 <b>전에</b> 쌍둥이가 미리 맞힌 값이에요.</p>
        </section>
      )}

      {what && (
        <section className="card">
          <h2>바꾸면 오르는 순서</h2>
          <ul className="whatif">
            {what.ranking.slice(0, 5).map(r => (
              <li key={r.id}>
                <span className="wtitle">{r.title}</span>
                <span className="wbar" aria-hidden="true"><i style={{ width: `${Math.max(2, (Math.max(r.gain, 0) / maxGain) * 100)}%` }} /></span>
                <b>{r.gain >= 0 ? '+' : ''}{r.gain.toFixed(1)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats && Object.keys(stats).length > 0 && (
        <section className="card">
          <h2>내가 잘 지키는 미션</h2>
          <ul className="accept">
            {Object.entries(acceptProbs(stats))
              .sort((a, b) => b[1] - a[1])
              .map(([id, p]) => (
                <li key={id}>
                  <span>{questShort(id, id)}</span>
                  <span className="wbar" aria-hidden="true"><i style={{ width: `${Math.round(p * 100)}%` }} /></span>
                  <b>{Math.round(p * 100)}%</b>
                </li>
              ))}
          </ul>
          <p className="muted small">효과가 커도 못 지키면 소용없어요. 쌍둥이가 내 실천 기록을 배워서, 앞으로는 내가 지킬 만한 미션을 더 먼저 추천해요.</p>
        </section>
      )}

      <section className="card" aria-labelledby="dept-title">
        <h2 id="dept-title">🎓 AI융합과 × 이 앱</h2>
        <div className="dept">
          <div className="dept-item">
            <strong>JavaScript · TypeScript</strong>
            <p>화면, 3D 캐릭터, 서비스 전체(React · Next.js · three.js)와 브라우저에서 돌아가는 신경망까지 모두 JS/TS로 만들었어요.</p>
          </div>
          <div className="dept-item">
            <strong>인공지능 · 딥러닝</strong>
            <p>다층 신경망을 라이브러리 없이 직접 구현해(역전파 · Adam) 학습해요. 사전학습 → 개인 보정(전이학습), what-if 설명, 미션 추천 학습(밴딧), 몬테카를로 시뮬레이션을 썼어요.</p>
          </div>
          <div className="dept-item soon">
            <strong>Python · 데이터 분석 (다음 단계)</strong>
            <p>같은 모델을 Python(NumPy · PyTorch)으로 학습·검증하고 그 결과를 앱에 불러오는 구조로 확장할 수 있어요.</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>학습 과정</h2>
        {history.length > 1 ? <LossChart history={history} /> : <p className="muted">홈에서 학습이 시작돼요.</p>}
        <ul className="facts">
          <li>처음엔 일반 생활습관 상식으로 만든 <b>합성 데이터</b>로 사전학습했어요.</li>
          <li>{days < PERSONALIZE_MIN_DAYS ? `기록이 ${PERSONALIZE_MIN_DAYS}일 쌓이면 내 데이터로 보정을 시작해요. (지금 ${days}일)` : '내 기록으로 개인 보정층을 학습하고 있어요.'}</li>
        </ul>
        <p className="muted small">의료 진단이 아니라 생활 습관 참고용이에요.</p>
      </section>
    </div>
  );
}
