'use client';

import { useEffect, useRef } from 'react';
import ScanReveal from '@/components/ScanReveal';
import { QUESTIONS, generatePlan, todayKey } from '@/lib/twin-data';
import { twinActions } from '@/lib/twin-store';
import { useAiCoach } from '@/lib/use-ai-coach';
import { useAiStatus } from '@/lib/use-ai-enabled';
import { useTwin } from '@/lib/use-twin';

/**
 * 온보딩 마지막 단계: 저장된 답변과 LIFE CLASS를 AI가 읽어 HIDDEN ME와 첫 퀘스트를 만듭니다.
 * AI가 연결되지 않았거나 실패하면 결과를 지어내지 않고 그 사실을 보여 줍니다.
 */
export default function AiReveal({ since, onDone }: { since: number; onDone: () => void }) {
  const twin = useTwin();
  const ai = useAiStatus();
  const { run, busy, error, ready } = useAiCoach(twin);
  const started = useRef(false);
  const { state, model, baseHabits } = twin;
  const profile = state?.profile ?? null;
  const coach = state?.ai.coach ?? null;
  const fresh = !!coach && Date.parse(coach.at) >= since;

  // AI가 못 만들더라도 오늘 퀘스트가 비지 않게 기본 퀘스트를 먼저 둡니다.
  useEffect(() => {
    if (!profile || !model || !baseHabits) return;
    const day = todayKey();
    if (state?.plans[day]) return;
    twinActions.setPlan(day, generatePlan(model, profile, baseHabits, state?.questCount ?? 2));
  }, [profile, model, baseHabits, state]);

  useEffect(() => {
    if (!ai?.enabled || !ready || started.current || fresh) return;
    started.current = true;
    void run('initial');
  }, [ai, ready, fresh, run]);

  const answered = profile ? QUESTIONS.filter(q => profile[q.id] !== undefined).length : 0;
  const todayPlan = state ? state.plans[todayKey()] ?? [] : [];
  const aiQuests = todayPlan.filter(i => i.source === 'ai');

  return (
    <>
      {profile && (
        <section className="card">
          <ScanReveal profile={profile} />
        </section>
      )}

      <section className="card reveal-ai" aria-live="polite" aria-label="HIDDEN ME">
        <div className="section-head">
          <h2>HIDDEN ME</h2>
          <span className="tag ai">AI</span>
        </div>

        {ai && !ai.enabled && <p className="notice">AI가 아직 연결되지 않아 숨은 패턴 분석은 건너뛰어요. (서버에 OPENAI_API_KEY 필요)</p>}

        {ai?.enabled && !fresh && (busy || !ready) && !error && (
          <div className="shimmer-box" role="status">
            <p><b>AI가 내 답변 {answered}개와 LIFE CLASS를 읽고 있어요…</b></p>
            <p className="muted small">반복되는 패턴, 나를 막는 요인, 오늘 할 수 있는 첫 퀘스트를 찾는 중 (최대 1분)</p>
            <i /><i /><i />
          </div>
        )}

        {fresh && coach && (
          <>
            <p className="summary-text">{coach.result.summary}</p>
            {[...coach.result.hiddenMe.patterns.slice(0, 2), ...coach.result.hiddenMe.blockers.slice(0, 1)].map((it, i) => (
              <div key={i} className="insight">
                <p>{it.text}</p>
                {it.verified && <div className="ev">{it.evidence.map(e => <span key={e.key} className="ev-chip" title={e.label}>{e.value}</span>)}</div>}
              </div>
            ))}
            <p className="muted small">칩은 이 문장의 근거가 된 내 답변이에요 · {coach.model}</p>
            {aiQuests.length > 0 && <p className="hint-line">✦ 나만을 위한 첫 퀘스트 {aiQuests.length}개가 준비됐어요</p>}
          </>
        )}

        {error && (
          <>
            <p className="msg error" role="alert">{error}</p>
            <button type="button" className="btn" disabled={busy} onClick={() => run('initial')}>다시 시도</button>
          </>
        )}
      </section>

      <button type="button" className="btn primary wide-btn" onClick={onDone}>
        {busy ? '먼저 시작하기 (분석은 이어서 돼요)' : 'ANOTHER ME 시작하기'}
      </button>
    </>
  );
}
