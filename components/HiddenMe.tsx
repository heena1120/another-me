'use client';

import Link from 'next/link';
import { useAiStatus } from '@/lib/use-ai-enabled';
import { useAiCoach } from '@/lib/use-ai-coach';
import type { Insight } from '@/lib/ai-types';
import type { TwinInfo } from '@/lib/use-twin';

const GROUPS: { key: 'patterns' | 'strengths' | 'improve' | 'blockers' | 'unnoticed'; title: string }[] = [
  { key: 'patterns', title: '반복되는 생활 패턴' },
  { key: 'strengths', title: '강점' },
  { key: 'improve', title: '개선이 필요한 습관' },
  { key: 'blockers', title: '행동을 방해하는 요인' },
  { key: 'unnoticed', title: '미처 몰랐을 수 있는 특징' },
];

const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function InsightList({ items }: { items: Insight[] }) {
  return (
    <ul className="insights">
      {items.map((it, i) => (
        <li key={i}>
          <p>{it.text}</p>
          {it.verified ? (
            <div className="ev" aria-label="근거가 된 내 입력">
              {it.evidence.map(e => (
                <span key={e.key} className="ev-chip" title={e.label}>
                  {e.value}
                </span>
              ))}
            </div>
          ) : (
            <span className="tag">입력과 직접 연결되지 않은 해석</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** HIDDEN ME: 내가 입력한 답변과 행동 기록을 AI가 분석한 결과. AI가 분석하지 않았다면 결과를 보여 주지 않습니다. */
export default function HiddenMe({ twin }: { twin: TwinInfo }) {
  const ai = useAiStatus();
  const { run, busy, error, ready } = useAiCoach(twin);
  const coach = twin.state?.ai.coach ?? null;

  return (
    <section className="card" aria-label="HIDDEN ME">
      <div className="section-head">
        <h2>HIDDEN ME</h2>
        {coach && <span className="points">AI 분석</span>}
      </div>

      {!coach && (
        <>
          <p className="muted">내가 입력한 답변과 행동 기록에서 반복되는 패턴, 강점, 나를 방해하는 요인을 AI가 찾아 줘요.</p>
          {ai === null && <p className="muted small" role="status">AI 연결 상태를 확인하는 중…</p>}
          {ai && !ai.enabled && (
            <p className="notice" role="note">
              AI가 아직 연결되지 않아 분석할 수 없어요. 서버에 <b>OPENAI_API_KEY</b>가 설정되면 쓸 수 있어요. 분석 결과를 대신 만들어 보여 주지는 않아요.
            </p>
          )}
          {ai?.enabled && (
            <>
              <button type="button" className="btn primary" disabled={busy || !ready} onClick={() => run('initial')}>
                {busy ? 'AI가 분석하는 중… (최대 1분)' : '✨ AI로 숨은 나 찾기'}
              </button>
              <p className="muted small">AI에 보내는 것: 설문 답변, LIFE CLASS, 프로그램이 계산한 점수, 행동 기록(사진은 보내지 않아요). 분석과 함께 오늘의 퀘스트도 AI가 만들어요.</p>
            </>
          )}
        </>
      )}

      {coach && (
        <>
          <p className="provenance">
            <b>{coach.model}</b>가 {when(coach.at)}에 분석 · 프롬프트 {coach.promptVersion}
          </p>
          <p className="summary-text">{coach.result.summary}</p>
          {GROUPS.map(g => {
            const items = coach.result.hiddenMe[g.key];
            if (items.length === 0) return null;
            return (
              <div key={g.key} className="insight-group">
                <h3>{g.title}</h3>
                <InsightList items={items} />
              </div>
            );
          })}
          <p className="muted small">AI의 해석이며 의학적 진단이 아니에요. 칩은 이 문장의 근거가 된 내가 입력한 값이에요.</p>
          {ai?.enabled && (
            <button type="button" className="btn" disabled={busy || !ready} onClick={() => run('reanalyze')}>
              {busy ? 'AI가 다시 분석하는 중…' : '기록을 반영해서 다시 분석'}
            </button>
          )}
          <Link className="muted small" href="/trace">AI TRACE에서 이 분석의 입력과 과정 확인 →</Link>
        </>
      )}

      {error && <p className="msg error" role="alert">{error}</p>}
    </section>
  );
}
