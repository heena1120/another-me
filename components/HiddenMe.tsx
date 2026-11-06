'use client';

import { useAiStatus } from '@/lib/use-ai-enabled';
import { useAiCoach } from '@/lib/use-ai-coach';
import type { Insight } from '@/lib/ai-types';
import type { TwinInfo } from '@/lib/use-twin';

type GroupKey = 'patterns' | 'blockers' | 'unnoticed' | 'strengths' | 'improve';
const GROUPS: { key: GroupKey; icon: string; title: string }[] = [
  { key: 'patterns', icon: '🔁', title: '반복 패턴' },
  { key: 'blockers', icon: '🧱', title: '막는 요인' },
  { key: 'unnoticed', icon: '👀', title: '몰랐던 나' },
  { key: 'strengths', icon: '💪', title: '강점' },
  { key: 'improve', icon: '🌱', title: '바꿀 습관' },
];

function Row({ icon, title, it }: { icon: string; title: string; it: Insight }) {
  return (
    <li className="hm-row">
      <span className="hm-ico" aria-hidden="true">{icon}</span>
      <div>
        <small>{title}</small>
        <p>{it.text}</p>
        {it.verified && (
          <div className="ev" aria-label="근거가 된 내 입력">
            {it.evidence.map(e => <span key={e.key} className="ev-chip" title={e.label}>{e.value}</span>)}
          </div>
        )}
      </div>
    </li>
  );
}

/** HIDDEN ME: 내 답변·기록을 AI가 읽은 결과. 그룹마다 첫 문장만 먼저 보여 주고, 나머지는 접어 둡니다. */
export default function HiddenMe({ twin }: { twin: TwinInfo }) {
  const ai = useAiStatus();
  const { run, busy, error, ready } = useAiCoach(twin);
  const coach = twin.state?.ai.coach ?? null;

  const top: { icon: string; title: string; it: Insight }[] = [];
  const rest: { icon: string; title: string; it: Insight }[] = [];
  if (coach) {
    for (const g of GROUPS) {
      const items = coach.result.hiddenMe[g.key];
      items.forEach((it, i) => (i === 0 && top.length < 4 ? top : rest).push({ icon: g.icon, title: g.title, it }));
    }
  }

  return (
    <section className="card" aria-label="HIDDEN ME">
      <div className="section-head">
        <h2>HIDDEN ME</h2>
        <span className="tag ai">AI</span>
      </div>

      {!coach && (
        <>
          <p className="muted">내 답변과 기록에서 내가 몰랐던 패턴을 AI가 찾아요.</p>
          {ai && !ai.enabled && <p className="notice" role="note">AI 연결 전이라 분석할 수 없어요.</p>}
          {ai?.enabled && (
            <button type="button" className="btn primary" disabled={busy || !ready} onClick={() => run('initial')}>
              {busy ? 'AI가 읽는 중… (최대 1분)' : '✦ AI로 숨은 나 찾기'}
            </button>
          )}
        </>
      )}

      {coach && (
        <>
          <p className="summary-text">{coach.result.summary}</p>
          <ul className="hm-list">
            {top.map((r, i) => <Row key={i} {...r} />)}
          </ul>
          {rest.length > 0 && (
            <details className="how">
              <summary>더 보기 ({rest.length})</summary>
              <ul className="hm-list">
                {rest.map((r, i) => <Row key={i} {...r} />)}
              </ul>
            </details>
          )}
          <p className="muted small">칩 = 근거가 된 내 입력 · 의학적 진단 아님</p>
          {ai?.enabled && (
            <button type="button" className="btn" disabled={busy || !ready} onClick={() => run('reanalyze')}>
              {busy ? 'AI가 다시 읽는 중…' : '🔄 기록 반영해서 다시 읽기'}
            </button>
          )}
        </>
      )}

      {error && <p className="msg error" role="alert">{error}</p>}
    </section>
  );
}
