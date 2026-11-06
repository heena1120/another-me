'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buildMemory } from '@/lib/ai-memory';
import type { PlanItem } from '@/lib/twin-data';
import type { TraceEntry } from '@/lib/ai-types';
import { questShort } from '@/lib/quest-meta';
import { twinActions, useTwinState } from '@/lib/twin-store';
import { useAiStatus } from '@/lib/use-ai-enabled';

const KIND: Record<TraceEntry['kind'], string> = { coach: 'HIDDEN ME 분석 + AI QUEST', photo: '사진 → 캐릭터 옵션', future: '미래 쌍둥이 대화' };

const ERR: Record<string, string> = {
  no_key: 'AI 키가 설정되지 않음',
  auth: '키가 올바르지 않거나 권한 없음',
  rate: '요청 과다 / 사용 한도',
  timeout: '응답 시간 초과',
  network: '네트워크 오류',
  upstream: 'AI 서버 오류',
  refused: 'AI가 답을 거절함',
  truncated: '응답이 중간에 잘림',
  bad_format: '응답 형식을 이해하지 못함',
  bad_request: '요청 형식 오류',
};

const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const sec = (ms?: number) => (ms === undefined ? '–' : `${(ms / 1000).toFixed(1)}초`);

/** 이 호출로 만든 퀘스트에 사용자가 남긴 만족도 */
function feedbackOf(plans: Record<string, PlanItem[]>, at: string) {
  const items = Object.values(plans).flat().filter(i => i.aiAt === at && i.feedback);
  return items.map(i => `${questShort(i.id, i.title)} ${i.feedback === 'good' ? '👍' : '👎'}`);
}

export default function TraceView() {
  const state = useTwinState();
  const ai = useAiStatus();
  const [confirming, setConfirming] = useState(false);
  // 확인 단계는 잠깐만 유지
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(t);
  }, [confirming]);

  if (!state) return <p className="muted" role="status">불러오는 중…</p>;
  const memory = buildMemory(state.plans, state.ai.archivedFails);
  const traces = state.ai.traces;

  return (
    <div className="stack">
      <section className="card" aria-label="AI와 프로그램의 역할">
        <div className="section-head">
          <h2>무엇을 AI가 하고, 무엇을 프로그램이 하나요?</h2>
        </div>
        <div className="role-grid">
          <div>
            <h3>AI (OpenAI {ai?.model || 'gpt-5-mini'})</h3>
            <ul>
              <li>생활 패턴·방해 요인 분석 (HIDDEN ME)</li>
              <li>맞춤 퀘스트의 제목·행동·이유 생성</li>
              <li>실패 기록을 반영한 재추천</li>
              <li>사진에서 캐릭터 꾸미기 옵션 고르기</li>
              <li>미래 쌍둥이 대화</li>
            </ul>
          </div>
          <div>
            <h3>프로그램 (AI 아님)</h3>
            <ul>
              <li>영역 점수·컨디션 지수 (직접 구현한 신경망)</li>
              <li>퀘스트 효과 점수·난이도 계산</li>
              <li>완료 처리·레벨·기록 저장</li>
              <li>AI 결과 검증과 안전 장치</li>
              <li>5년 뒤 시뮬레이션</li>
            </ul>
          </div>
        </div>
        <p className={ai?.enabled ? 'muted small' : 'notice'} role="status">
          {ai === null ? 'AI 연결 상태를 확인하는 중…' : ai.enabled ? `AI가 연결돼 있어요. (모델: ${ai.model})` : 'AI가 아직 연결되지 않았어요. 서버에 OPENAI_API_KEY가 설정되면 쓸 수 있어요.'}
        </p>
      </section>

      <section className="card" aria-label="AI MEMORY">
        <div className="section-head">
          <h2>AI MEMORY</h2>
          <span className="points">{memory.daysObserved}일치</span>
        </div>
        <p className="muted small">다음 AI 분석에 함께 보내는 내 행동 기록이에요. 이 기기에만 저장돼요.</p>
        {memory.daysObserved === 0 ? (
          <p className="muted">아직 기록이 없어요. 퀘스트를 하고 나면 쌓여요.</p>
        ) : (
          <dl className="mem">
            <div><dt>해낸 퀘스트</dt><dd>{memory.done.length ? memory.done.map(d => `${questShort(d.lever, d.lever)} ${d.done}/${d.total}`).join(' · ') : '–'}</dd></div>
            <div><dt>못 한 퀘스트와 이유</dt><dd>{memory.failed.length ? memory.failed.map(f => `${questShort(f.lever, f.lever)}(${f.reason || '이유 없음'}${f.count > 1 ? ` ×${f.count}` : ''})`).join(' · ') : '–'}</dd></div>
            <div><dt>자주 못 한 시간대</dt><dd>{memory.failTimes.length ? memory.failTimes.map(t => `${t.bucket} ${t.count}회`).join(' · ') : '–'}</dd></div>
            <div><dt>자주 해낸 퀘스트</dt><dd>{memory.preferred.length ? memory.preferred.map(l => questShort(l, l)).join(' · ') : '–'}</dd></div>
            <div><dt>추천 만족도</dt><dd>{memory.feedback.good + memory.feedback.bad > 0 ? `👍 ${memory.feedback.good} · 👎 ${memory.feedback.bad}` : '–'}</dd></div>
          </dl>
        )}
      </section>

      <section className="card" aria-label="AI TRACE">
        <div className="section-head">
          <h2>AI TRACE</h2>
          <span className="points">{traces.length}건</span>
        </div>
        {traces.length === 0 && <p className="muted">아직 AI를 호출한 기록이 없어요. HIDDEN ME에서 AI 분석을 실행하거나 퀘스트 화면에서 AI 맞춤 퀘스트를 받아 보세요.</p>}
        <div className="trace-list">
          {traces.map(t => {
            const fb = t.kind === 'coach' ? feedbackOf(state.plans, t.at) : [];
            return (
              <details key={t.id} className={`trace${t.ok ? '' : ' bad'}`}>
                <summary>
                  <span className={`tag ${t.ok ? 'easy' : 'hard'}`}>{t.ok ? 'AI 호출 성공' : 'AI 호출 실패'}</span>
                  <span className="trace-kind">{KIND[t.kind]}{t.mode === 'reanalyze' ? ' · 재분석' : ''}</span>
                  <small>{when(t.at)}</small>
                </summary>
                <dl className="mem">
                  <div><dt>AI 모델</dt><dd>{t.model ?? '–'} {t.ok ? '(API 응답이 알려 준 값)' : ''}</dd></div>
                  <div><dt>프롬프트 버전</dt><dd>{t.promptVersion ?? '–'}</dd></div>
                  <div><dt>생성 시각</dt><dd>{when(t.at)}</dd></div>
                  <div><dt>소요 시간</dt><dd>{sec(t.ms)}</dd></div>
                  {t.usage && <div><dt>토큰</dt><dd>입력 {t.usage.prompt} · 출력 {t.usage.completion} · 합계 {t.usage.total}</dd></div>}
                  {t.requestId && <div><dt>요청 ID</dt><dd>{t.requestId}</dd></div>}
                  {!t.ok && <div><dt>실패 이유</dt><dd>{ERR[t.error ?? ''] ?? t.error ?? '알 수 없음'}</dd></div>}
                  <div><dt>입력 데이터의 종류</dt><dd>{t.inputKinds.join(' · ')}</dd></div>
                  {fb.length > 0 && <div><dt>사용자 피드백</dt><dd>{fb.join(' · ')}</dd></div>}
                </dl>

                {t.output && (
                  <>
                    <h4>생성된 퀘스트와 추천 근거</h4>
                    <ol className="trace-quests">
                      {t.output.quests.map(q => (
                        <li key={q.lever}>
                          <b>{q.title}</b> <span className="muted">({questShort(q.lever, q.lever)} · {q.minutes}분 · {q.difficulty})</span>
                          <p>{q.why}</p>
                          <div className="ev">
                            {q.evidence.length ? q.evidence.map(e => <span key={e.key} className="ev-chip" title={e.label}>{e.value}</span>) : <span className="tag">연결된 입력 없음</span>}
                          </div>
                        </li>
                      ))}
                    </ol>
                    <details className="raw">
                      <summary>분석 결과 전체 (JSON)</summary>
                      <pre>{JSON.stringify(t.output, null, 2)}</pre>
                    </details>
                  </>
                )}
                {t.adjustments && t.adjustments.length > 0 && (
                  <>
                    <h4>코드가 AI 결과를 고친 내용 (안전 장치)</h4>
                    <ul className="trace-adjust">{t.adjustments.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </>
                )}
                {t.input && (
                  <details className="raw">
                    <summary>AI에 실제로 보낸 입력</summary>
                    <pre>{JSON.stringify(t.input, null, 2)}</pre>
                  </details>
                )}
              </details>
            );
          })}
        </div>
        {traces.length > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!confirming) setConfirming(true);
              else {
                twinActions.clearTraces();
                setConfirming(false);
              }
            }}
          >
            {confirming ? '정말 모두 지울까요? 한 번 더 누르면 지워져요' : 'AI 기록 모두 지우기'}
          </button>
        )}
        <p className="muted small">기록은 이 기기의 브라우저에만 저장돼요. 얼굴 사진은 저장하지 않고, 사진을 보낸 사실만 남겨요. 지우면 복구할 수 없어요.</p>
      </section>

      <p className="foot-links"><Link href="/scan">← REALITY SCAN</Link><Link href="/quests">AI QUEST →</Link></p>
    </div>
  );
}
