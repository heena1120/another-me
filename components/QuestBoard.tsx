'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { generatePlan, todayKey, type PlanItem } from '@/lib/twin-data';
import { FAIL_REASONS, difficultyOf, minutesLabel, questGain, questIcon } from '@/lib/quest-meta';
import { acceptProbs, missionStats } from '@/lib/twin-sim';
import { DAILY_XP_CAP, dayXp, xpIfDone } from '@/lib/growth';
import { shadowDef } from '@/lib/shadow';
import { twinActions } from '@/lib/twin-store';
import { useAiCoach } from '@/lib/use-ai-coach';
import { useAiStatus } from '@/lib/use-ai-enabled';
import { useTwin } from '@/lib/use-twin';
import { diffCount, diffRuns } from '@/lib/ai-diff';
import { leverName } from '@/lib/ai-types';

const tagClass = (d: string) => (d === '쉬움' ? 'easy' : d === '도전' ? 'hard' : '');
const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 오늘로부터 back일 전의 날짜 키(yyyy-mm-dd) */
const dayKey = (back: number) => {
  const d = new Date();
  d.setDate(d.getDate() - back);
  return d.toLocaleDateString('sv-SE');
};

export default function QuestBoard() {
  const twin = useTwin();
  const { state, model, baseHabits } = twin;
  const ai = useAiStatus();
  const { run, busy, error } = useAiCoach(twin);
  const [failing, setFailing] = useState<string | null>(null);
  const [wishDraft, setWishDraft] = useState<string | null>(null);

  const plans = state?.plans;
  const accept = useMemo(() => (plans ? acceptProbs(missionStats(plans, todayKey())) : {}), [plans]);

  // 홈을 거치지 않고 바로 들어와도 기본 퀘스트가 만들어지게 합니다. (하루에 한 번만, AI가 아니라 신경망·규칙)
  useEffect(() => {
    const day = todayKey();
    if (!state?.profile || !model || !baseHabits || state.plans[day]) return;
    twinActions.setPlan(day, generatePlan(model, state.profile, baseHabits, state.questCount, accept));
  }, [state, model, baseHabits, accept]);

  if (!state) return <p className="muted" role="status">불러오는 중…</p>;
  if (!state.profile)
    return (
      <section className="card">
        <h2>먼저 나를 알려 주세요</h2>
        <p className="muted">1분이면 내게 맞는 퀘스트를 만들어 드려요.</p>
        <Link className="btn primary" href="/onboarding">시작하기</Link>
      </section>
    );

  const today = todayKey();
  const plan: PlanItem[] | undefined = state.plans[today];
  if (!plan) return <p className="muted" role="status">오늘의 퀘스트를 준비하는 중이에요…</p>;

  const stats = missionStats(state.plans, today);
  const doneCount = plan.filter(i => i.done).length;
  const totalMin = plan.reduce((s, i) => s + (i.minutes ?? 0), 0);
  const aiPlan = plan.some(i => i.source === 'ai');
  const coach = state.ai.coach;
  const hasFail = plan.some(i => i.fail && !i.done);
  // 재분석이면 바로 전 분석과 비교해 "AI가 바꾼 것"을 보여 줍니다. (프로그램이 비교)
  const okRuns = state.ai.traces.filter(t => t.kind === 'coach' && t.ok && t.output);
  const prevRun = coach?.mode === 'reanalyze' && okRuns.length >= 2 ? okRuns[1].output : null;
  const diff = coach && prevRun ? diffRuns(prevRun, coach.result) : null;
  const wish = wishDraft ?? state.profile.wish ?? '';
  const wishDirty = wishDraft !== null && wishDraft.trim() !== (state.profile.wish ?? '');

  return (
    <div className="stack">
      {/* 이 퀘스트들을 누가 만들었는지 분명히 알려 줍니다 */}
      <section className="card ai-panel" aria-label="퀘스트 생성 방식">
        {aiPlan && coach ? (
          <>
            <p className="provenance"><span className="tag ai">AI</span> <b>{coach.model}</b> · {when(coach.at)} · 근거 확인 {plan.filter(i => i.source === 'ai' && i.verified).length}/{plan.filter(i => i.source === 'ai').length}</p>
          </>
        ) : (
          <>
            <p className="provenance"><span className="tag">기본</span> 신경망·규칙으로 고른 퀘스트 (AI 아님)</p>
          </>
        )}
        {ai === null && <p className="muted small" role="status">AI 연결 상태를 확인하는 중…</p>}
        {ai && !ai.enabled && <p className="notice" role="note">AI 연결 전이에요 (서버에 OPENAI_API_KEY 필요).</p>}
        {ai?.enabled && (
          <div className="twin-actions">
            <button type="button" className="btn primary" disabled={busy} onClick={() => run(aiPlan ? 'reanalyze' : 'initial')}>
              {busy ? 'AI가 만드는 중… (최대 1분)' : aiPlan ? '🔄 기록 반영해서 재분석' : '✨ AI 맞춤 퀘스트 받기'}
            </button>
          </div>
        )}
        {error && <p className="msg error" role="alert">{error}</p>}
        {aiPlan && coach && coach.adjustments.length > 0 && (
          <details className="privacy">
            <summary>코드가 고친 부분 (안전 장치 {coach.adjustments.length}건)</summary>
            <ul>{coach.adjustments.map((a, i) => <li key={i}>{a}</li>)}</ul>
            <p className="muted small">못 한 퀘스트가 더 어려워지지 않도록 프로그램이 AI 결과를 제한했어요.</p>
          </details>
        )}
      </section>

      {diff && diffCount(diff) > 0 && (
        <section className="card" aria-label="AI가 바꾼 것">
          <h3><span className="tag ai">AI</span> 내 기록을 보고 바꾼 것</h3>
          <ul className="diff-list">
            {diff.changed.map(c => <li key={'c' + c.lever}>{leverName(c.lever)} <b>{c.from} → {c.to}</b></li>)}
            {diff.removed.map(l => <li key={'r' + l}>{leverName(l)} <b>빼고</b></li>)}
            {diff.added.map(l => <li key={'a' + l}>{leverName(l)} <b>새로</b></li>)}
          </ul>
        </section>
      )}

      <section className="card" aria-label="내 방식">
        <h3>내 방식 <small className="muted">AI가 가장 먼저 지켜요</small></h3>
        <textarea className="wish-input" value={wish} maxLength={160} rows={2} onChange={e => setWishDraft(e.target.value)} placeholder="예) 30분 걸을 시간은 없어요. 집에서 할 수 있는 걸로요. 무작정 운동만 시키는 건 싫어요." />
        <div className="twin-actions">
          <button type="button" className="btn" disabled={!wishDirty} onClick={() => { twinActions.setWish(wish); setWishDraft(null); }}>저장</button>
          {ai?.enabled && <button type="button" className="btn primary" disabled={busy} onClick={() => { if (wishDirty) { twinActions.setWish(wish); setWishDraft(null); } void run(aiPlan ? 'reanalyze' : 'initial'); }}>{busy ? 'AI가 만드는 중…' : '✦ 이 방식으로 다시 받기'}</button>}
        </div>
      </section>

      <div className="summary-strip" aria-label="오늘 요약">
        <div><strong>{doneCount}/{plan.length}</strong><small>완료</small></div>
        <div><strong>{totalMin > 0 ? `${totalMin}분` : '–'}</strong><small>예상 시간</small></div>
        <div><strong>{dayXp(plan)}/{DAILY_XP_CAP}</strong><small>오늘 XP</small></div>
      </div>

      {plan.length === 0 && <p className="card muted">이미 좋은 습관이에요. 체크인으로 기록을 쌓아 보세요.</p>}

      {plan.map(item => {
        const p = accept[item.id] ?? 0.5;
        const diff = item.aiDifficulty ?? difficultyOf(item, p);
        const isAi = item.source === 'ai';
        const [why, effect] = isAi ? [item.reason, ''] : item.reason.split(' · ');
        const open = failing === item.id;
        return (
          <article key={item.id} className={`qcard${item.done ? ' done' : item.fail ? ' failed' : ''}`}>
            <div className="qcard-top">
              <span className="qicon" aria-hidden="true">{questIcon(item.id)}</span>
              <div className="qtext">
                <strong>{item.title}</strong>
                <div className="qmeta">
                  <span className={`tag ${isAi ? 'ai' : ''}`}>{isAi ? 'AI' : '기본'}</span>
                  <span className={`tag ${tagClass(diff)}`}>{diff}</span>
                  <span>{minutesLabel(item)}</span>
                  <span className="tag xp">+{xpIfDone(item)}XP</span>
                  <span className="tag">효과 +{questGain(item)}점</span>
                  {item.shadow && <span className="tag">⚔️ {shadowDef(item.shadow)?.name}</span>}
                  {item.micro && <span className="tag easy">작은 단계</span>}
                </div>
              </div>
            </div>

            {isAi && (
              <dl className="qdetail">
                <div><dt>구체적인 행동</dt><dd>{item.action}</dd></div>
                <div><dt>완료 조건</dt><dd>{item.doneWhen}</dd></div>
                <div><dt>기대하는 변화</dt><dd>{item.expected}</dd></div>
              </dl>
            )}

            <details>
              <summary>왜 이 퀘스트예요?</summary>
              <ul className="why-list">
                {why && <li><span>{isAi ? 'AI가 쓴 이유' : '이유'}</span><b>{why}</b></li>}
                {isAi && item.evidence && item.evidence.length > 0 && (
                  <li>
                    <span>연결된 내 입력</span>
                    <b className="ev">
                      {item.evidence.map(e => (
                        <span key={e.key} className="ev-chip" title={e.label}>{e.value}</span>
                      ))}
                    </b>
                  </li>
                )}
                {effect && <li><span>예상 효과</span><b>{effect.replace('쌍둥이 예측 ', '')}</b></li>}
                {isAi && <li><span>예상 효과 (신경망 계산)</span><b>컨디션 +{item.gain.toFixed(1)}점</b></li>}
                <li><span>내가 지킬 확률</span><b>{Math.round(p * 100)}%{(stats[item.id]?.total ?? 0) === 0 ? ' (기록 전)' : ''}</b></li>
                <li><span>난이도</span><b>{diff}</b></li>
              </ul>
              {isAi && item.verified === false && <p>AI가 이 추천을 내 입력과 직접 연결한 근거를 대지 못했어요.</p>}
              {!isAi && <p>난이도는 걸리는 시간과 내 실천 기록으로 계산해요.</p>}
            </details>

            <div className="qcard-actions">
              <button type="button" className={`btn${item.done ? '' : ' primary'}`} aria-pressed={item.done} onClick={() => { setFailing(null); twinActions.toggleItem(today, item.id); }}>
                {item.done ? '✓ 완료됨 (취소)' : '완료하기'}
              </button>
              {!item.done && (
                <button type="button" className="btn" aria-expanded={open} onClick={() => setFailing(open ? null : item.id)}>
                  못 했어요
                </button>
              )}
            </div>

            {isAi && (
              <div className="feedback" role="group" aria-label="이 추천은 어땠나요?">
                <span className="muted small">이 추천은 어땠나요?</span>
                <button type="button" className="chip" aria-pressed={item.feedback === 'good'} onClick={() => twinActions.setFeedback(today, item.id, 'good')}>👍 좋아요</button>
                <button type="button" className="chip" aria-pressed={item.feedback === 'bad'} onClick={() => twinActions.setFeedback(today, item.id, 'bad')}>👎 별로예요</button>
              </div>
            )}

            {item.fail && !open && (
              <p className="fail-note">
                기록됨: {item.fail.reason}{' '}
                <button type="button" className="chip" style={{ minHeight: 32, padding: '2px 10px' }} onClick={() => twinActions.clearFail(today, item.id)}>
                  지우기
                </button>{' '}
                {!item.micro && (
                  <button type="button" className="chip" style={{ minHeight: 32, padding: '2px 10px' }} onClick={() => twinActions.shrinkItem(today, item.id)}>
                    더 작은 단계로 바꾸기
                  </button>
                )}
              </p>
            )}

            {open && (
              <div className="fail-box">
                <strong style={{ fontSize: 14 }}>어떤 이유였나요?</strong>
                <div className="chips" role="group" aria-label="못 한 이유">
                  {FAIL_REASONS.map(r => (
                    <button key={r} type="button" className="chip" onClick={() => { twinActions.failItem(today, item.id, r); setFailing(null); }}>
                      {r}
                    </button>
                  ))}
                </div>
                <p className="fail-note">이유는 다음 AI 분석에 전해져요.</p>
              </div>
            )}
          </article>
        );
      })}

      {hasFail && ai?.enabled && (
        <section className="card" aria-label="재분석 안내">
          <h2>못 한 퀘스트가 있어요</h2>
          <p className="muted">이유를 AI에게 전해서 더 작은 퀘스트로 받아 볼까요?</p>
          <button type="button" className="btn primary" disabled={busy} onClick={() => run('reanalyze')}>
            {busy ? 'AI가 다시 만드는 중…' : '🔄 이유를 반영해서 재분석'}
          </button>
        </section>
      )}

      <section className="card" aria-label="최근 7일 기록">
        <h2>최근 7일 기록</h2>
        <div className="history">
          {Array.from({ length: 7 }, (_, i) => {
            const key = dayKey(i);
            const items = state.plans[key] ?? [];
            return (
              <div key={key} className="hrow">
                <span>{key.slice(5).replace('-', '/')}</span>
                <span className="hdots" role="img" aria-label={items.length ? `${items.filter(x => x.done).length}개 완료, ${items.length}개 중` : '기록 없음'}>
                  {items.length === 0 ? <i /> : items.map(x => <i key={x.id} className={x.done ? 'ok' : x.fail || i > 0 ? 'no' : ''} />)}
                </span>
                <span className="muted small">{items.length ? `${items.filter(x => x.done).length}/${items.length}` : '–'}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
