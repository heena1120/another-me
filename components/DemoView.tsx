'use client';

import { useState } from 'react';
import Link from 'next/link';
import TwinStage from '@/components/TwinStage';
import { buildCoachInput, inputKindsOf, planFromCoach } from '@/lib/ai-client';
import { leverName, type CoachMeta, type CoachResult } from '@/lib/ai-types';
import { DEFAULT_AVATAR, type Avatar } from '@/lib/avatar';
import { PERSONAS, compareQuests, demoActions, diffRuns, useDemoState, type PersonaId } from '@/lib/demo';
import { dayXp, growthOf, DAILY_XP_CAP, xpIfDone } from '@/lib/growth';
import { predict } from '@/lib/twin-model';
import { QUESTIONS, baselineFromProfile, improvedHabits, todayKey } from '@/lib/twin-data';
import { FAIL_REASONS, minutesLabel } from '@/lib/quest-meta';
import { closenessOf, idealRange, moodForVitality, simulate5y, vitalityOf } from '@/lib/twin-sim';
import { useAiStatus } from '@/lib/use-ai-enabled';
import { useTwin } from '@/lib/use-twin';

const pct = (c: number) => `${Math.round(c * 100)}%`;
const avatarOf = (id: PersonaId): Avatar => ({ ...DEFAULT_AVATAR, name: id, body: PERSONAS[id].body as Avatar['body'] });

export default function DemoView() {
  const twin = useTwin();
  const ai = useAiStatus();
  const demo = useDemoState();
  const [who, setWho] = useState<PersonaId>('A');
  const [busy, setBusy] = useState<PersonaId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failing, setFailing] = useState<string | null>(null);

  const model = twin.base; // 내 개인 보정이 섞이지 않은 사전학습 신경망
  const persona = PERSONAS[who];
  const cur = demo?.[who] ?? null;

  const analyze = async (id: PersonaId, mode: 'initial' | 'reanalyze') => {
    const p = PERSONAS[id];
    const s = demo?.[id];
    if (!model) return;
    setBusy(id);
    setError(null);
    const day = s?.day ?? todayKey();
    const habits = baselineFromProfile(p.profile);
    const input = buildCoachInput({ mode, profile: p.profile, plans: { [day]: s?.plan ?? [] }, archived: s?.archived ?? [], model, baseHabits: habits, today: day, maxQuests: 3 });
    const trace = { id: `demo-${id}-${Date.now()}`, at: new Date().toISOString(), kind: 'coach' as const, mode, inputKinds: inputKindsOf(input), input };
    try {
      const res = await fetch('/api/ai/coach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; result?: CoachResult; adjustments?: string[]; meta?: CoachMeta };
      if (!res.ok || !data.result || !data.meta) {
        demoActions.addFailedTrace(id, day, { ...trace, ok: false, error: data.code ?? `http_${res.status}` });
        setError(data.error ?? 'AI 분석에 실패했어요. 다시 시도해 주세요.');
        return;
      }
      const run = { at: trace.at, mode, model: data.meta.model, promptVersion: data.meta.promptVersion, ms: data.meta.ms, tokens: data.meta.usage?.total ?? null, requestId: data.meta.requestId, result: data.result, adjustments: data.adjustments ?? [], inputKinds: trace.inputKinds };
      demoActions.applyRun(id, day, planFromCoach(data.result, input.signals.levers, trace.at), run, { ...trace, ok: true, model: data.meta.model, promptVersion: data.meta.promptVersion, ms: data.meta.ms, usage: data.meta.usage, requestId: data.meta.requestId, output: data.result, adjustments: data.adjustments ?? [] });
    } catch {
      demoActions.addFailedTrace(id, day, { ...trace, ok: false, error: 'network' });
      setError('네트워크 문제로 AI에 연결하지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  if (demo === undefined || ai === null) return <p className="muted" role="status">불러오는 중…</p>;

  const aiOn = ai.enabled;
  const a = demo.A;
  const b = demo.B;
  const cmp = a && b ? compareQuests(a.plan, b.plan) : null;
  const lastRun = cur?.runs.at(-1) ?? null;
  const firstRun = cur?.runs[0] ?? null;
  const diff = cur && cur.runs.length >= 2 ? diffRuns(cur.runs[cur.runs.length - 2].result, cur.runs[cur.runs.length - 1].result) : null;

  // 캐릭터 변화·FUTURE SWITCH: 이 인물이 해낸 퀘스트를 신경망에 반영해 계산
  const live = (() => {
    if (!model || !cur) return null;
    const habits = baselineFromProfile(persona.profile);
    const doneIds = cur.plan.filter(i => i.done).map(i => i.id);
    const ideal = idealRange(model);
    const nowScore = predict(model, habits);
    const liveScore = predict(model, improvedHabits(persona.profile, habits, doneIds));
    const doneShare = cur.plan.length ? cur.plan.filter(i => i.done).length / cur.plan.length : null;
    const sim = simulate5y(model, persona.profile, habits, { adherence: doneShare && doneShare > 0 ? doneShare : null, sigma: null, items: cur.plan });
    return { nowScore, liveScore, ideal, sim, doneShare, endNow: closenessOf(sim.traj[60].now, ideal), endOn: closenessOf(sim.traj[60].improved, ideal) };
  })();

  const xp = cur ? dayXp(cur.plan) : 0;

  return (
    <div className="stack">
      <section className="card">
        <h2>A/B 데모</h2>
        <p className="muted">같은 질문에 다르게 답한 두 사람에게 <b>실제 AI 호출</b>로 퀘스트를 만들어 비교해요. 내 기록과는 분리돼요.</p>
        {!aiOn && <p className="notice" role="note">AI가 아직 연결되지 않았어요. 서버에 <b>OPENAI_API_KEY</b>가 있어야 데모를 실행할 수 있어요. (연결 전에는 아래 답변 비교만 볼 수 있어요)</p>}
        {!model && <p className="muted small" role="status">신경망을 준비하는 중이에요. <Link href="/">홈</Link>에서 학습이 진행돼요.</p>}
      </section>

      <div className="mood-row" role="tablist" aria-label="인물 선택">
        {(['A', 'B'] as const).map(id => (
          <button key={id} type="button" role="tab" aria-selected={who === id} className={`mini${who === id ? ' selected' : ''}`} onClick={() => { setWho(id); setFailing(null); setError(null); }}>
            {PERSONAS[id].name}
          </button>
        ))}
      </div>

      <section className="card" aria-label="선택한 인물">
        <h3>{persona.name}</h3>
        <p className="muted">{persona.tagline}</p>
        <table className="compare" aria-label="같은 질문, 다른 답변">
          <thead><tr><th>질문</th><th>A</th><th>B</th></tr></thead>
          <tbody>
            {QUESTIONS.map(q => {
              const label = (id: PersonaId) => {
                const v = PERSONAS[id].profile[q.id];
                return v === undefined ? '–' : (q.options.find(o => o.id === v)?.label ?? '–');
              };
              return <tr key={q.id}><th scope="row">{q.text}</th><td>{label('A')}</td><td>{label('B')}</td></tr>;
            })}
          </tbody>
        </table>
        <button type="button" className="btn primary" disabled={!aiOn || !model || busy !== null || (cur?.runs.length ?? 0) > 0} onClick={() => analyze(who, 'initial')}>
          {busy === who ? 'AI가 분석 중… (최대 1분)' : cur && cur.runs.length > 0 ? '분석 완료' : `✨ ${who} 분석 요청 (실제 AI 호출)`}
        </button>
        {error && <p className="msg error" role="alert">{error}</p>}
      </section>

      {cur && lastRun && live && (
        <>
          <section className="card ai-panel" aria-label="AI TRACE">
            <p className="provenance"><span className="tag ai">AI 생성</span> {lastRun.mode === 'reanalyze' ? '재분석 결과' : '첫 분석 결과'}</p>
            <p>{lastRun.result.summary}</p>
            <dl className="qdetail">
              <div><dt>모델(API 응답)</dt><dd>{lastRun.model}</dd></div>
              <div><dt>프롬프트 버전</dt><dd>{lastRun.promptVersion}</dd></div>
              <div><dt>응답 시간 · 토큰</dt><dd>{(lastRun.ms / 1000).toFixed(1)}초 · {lastRun.tokens ?? '–'}</dd></div>
              <div><dt>요청 ID</dt><dd>{lastRun.requestId ?? '–'}</dd></div>
              <div><dt>AI에 보낸 데이터</dt><dd>{lastRun.inputKinds.join(', ')}</dd></div>
              <div><dt>코드가 고친 부분</dt><dd>{lastRun.adjustments.length}건</dd></div>
            </dl>
          </section>

          <section className="card" aria-label="캐릭터 변화">
            <div className="parallel-pair">
              <div>
                <TwinStage avatar={avatarOf(who)} height={150} vitality={vitalityOf(live.nowScore)} mood={moodForVitality(vitalityOf(live.nowScore))} />
                <strong>처음</strong><small>컨디션 {Math.round(live.nowScore)}점</small>
              </div>
              <div className="good">
                <TwinStage avatar={avatarOf(who)} height={150} vitality={vitalityOf(live.liveScore)} mood={moodForVitality(vitalityOf(live.liveScore))} />
                <strong>해낸 퀘스트 반영</strong><small>컨디션 {Math.round(live.liveScore)}점</small>
              </div>
            </div>
            <p className="muted small">오늘 XP {xp}/{DAILY_XP_CAP} · Lv.{growthOf(xp).level} (신경망·프로그램 계산)</p>
          </section>

          {cur.plan.map(item => (
            <article key={item.id} className={`qcard${item.done ? ' done' : item.fail ? ' failed' : ''}`}>
              <div className="qcard-top">
                <div className="qtext">
                  <strong>{item.title}</strong>
                  <div className="qmeta">
                    <span className="tag ai">{item.source === 'ai' ? 'AI' : '기록'}</span>
                    <span className="tag">{leverName(item.id)}</span>
                    <span>{minutesLabel(item)}</span>
                    <span className="tag xp">+{xpIfDone(item)}XP</span>
                    {item.verified === false && <span className="tag">근거 미확인</span>}
                  </div>
                </div>
              </div>
              {item.action && (
                <dl className="qdetail">
                  <div><dt>구체적인 행동</dt><dd>{item.action}</dd></div>
                  <div><dt>AI가 쓴 이유</dt><dd>{item.reason}</dd></div>
                  {item.evidence && item.evidence.length > 0 && (
                    <div><dt>연결된 내 입력</dt><dd className="ev">{item.evidence.map(e => <span key={e.key} className="ev-chip" title={e.label}>{e.value}</span>)}</dd></div>
                  )}
                </dl>
              )}
              <div className="qcard-actions">
                <button type="button" className={`btn${item.done ? '' : ' primary'}`} aria-pressed={item.done} onClick={() => { setFailing(null); demoActions.toggle(who, item.id); }}>
                  {item.done ? '✓ 완료됨 (취소)' : '완료하기'}
                </button>
                {!item.done && <button type="button" className="btn" onClick={() => setFailing(failing === item.id ? null : item.id)}>못 했어요</button>}
              </div>
              {item.fail && failing !== item.id && <p className="fail-note">기록됨: {item.fail.reason}</p>}
              {failing === item.id && (
                <div className="fail-box">
                  <div className="chips" role="group" aria-label="못 한 이유">
                    {FAIL_REASONS.map(r => <button key={r} type="button" className="chip" onClick={() => { demoActions.fail(who, item.id, r); setFailing(null); }}>{r}</button>)}
                  </div>
                </div>
              )}
            </article>
          ))}

          <section className="card" aria-label="재분석">
            <h3>기록을 반영해서 재분석</h3>
            <p className="muted small">해낸 것·못 한 것과 이유가 AI MEMORY로 정리되어 다음 분석에 전해져요.</p>
            <button type="button" className="btn primary" disabled={!aiOn || busy !== null || !cur.plan.some(i => i.done || i.fail)} onClick={() => analyze(who, 'reanalyze')}>
              {busy === who ? 'AI가 다시 만드는 중…' : '🔄 재분석'}
            </button>
            {!cur.plan.some(i => i.done || i.fail) && <p className="muted small">퀘스트를 완료하거나 ‘못 했어요’를 먼저 기록하세요.</p>}
            {diff && (
              <div className="notice" role="status" aria-label="재분석 전후 변화">
                <b>이전 분석과 달라진 점 (프로그램이 비교)</b>
                <ul>
                  {diff.added.map(l => <li key={'a' + l}>추가: {leverName(l)}</li>)}
                  {diff.removed.map(l => <li key={'r' + l}>빠짐: {leverName(l)}</li>)}
                  {diff.changed.map(c => <li key={'c' + c.lever}>{leverName(c.lever)}: {c.from} → {c.to}</li>)}
                  {diff.added.length + diff.removed.length + diff.changed.length === 0 && <li>퀘스트 종류·시간·난이도는 같고 문구만 바뀌었어요.</li>}
                </ul>
              </div>
            )}
            {firstRun && cur.runs.length > 1 && <p className="muted small">분석 {cur.runs.length}회 기록됨</p>}
          </section>

          <section className="card" aria-label="FUTURE SWITCH">
            <h3>FUTURE SWITCH</h3>
            <div className="preview-future">
              <div><strong>{pct(live.endNow)}</strong><small>스위치 OFF · 지금 습관 5년</small></div>
              <span className="arrow" aria-hidden="true">→</span>
              <div className="good"><strong>{pct(live.endOn)}</strong><small>스위치 ON · 퀘스트 지키면 5년</small></div>
            </div>
            <p className="muted small">
              {live.doneShare ? `이 인물이 해낸 비율(${pct(live.doneShare)})로 계산한` : '아직 해낸 퀘스트가 없어서 지킬 확률을 60%로 가정한'} 가상 시나리오예요. 확정된 예측이 아니에요.
            </p>
          </section>
        </>
      )}

      {cmp && a && b && (
        <section className="card" aria-label="A와 B 비교">
          <h3>A와 B는 정말 다른가요?</h3>
          <table className="compare">
            <thead><tr><th>종류</th><th>A</th><th>B</th></tr></thead>
            <tbody>
              <tr><th scope="row">AI 퀘스트</th><td>{a.plan.filter(i => i.source === 'ai').map(i => leverName(i.id)).join(', ')}</td><td>{b.plan.filter(i => i.source === 'ai').map(i => leverName(i.id)).join(', ')}</td></tr>
              <tr><th scope="row">시간 합계</th><td>{a.plan.reduce((s, i) => s + (i.minutes ?? 0), 0)}분</td><td>{b.plan.reduce((s, i) => s + (i.minutes ?? 0), 0)}분</td></tr>
              <tr><th scope="row">근거 확인됨</th><td>{a.plan.filter(i => i.verified).length}/{a.plan.length}</td><td>{b.plan.filter(i => i.verified).length}/{b.plan.length}</td></tr>
            </tbody>
          </table>
          <p>겹치는 퀘스트 종류 <b>{cmp.shared.length}개</b> · 겹침 정도 <b>{pct(cmp.overlap)}</b> {cmp.shared.length > 0 && `(${cmp.shared.map(leverName).join(', ')})`}</p>
          <p className="muted small">한 번의 실행 결과예요. 여러 번 반복한 통계는 <code>npm run eval:ab</code>로 확인해요.</p>
        </section>
      )}

      <section className="card">
        <div className="twin-actions">
          <button type="button" className="btn" onClick={() => { demoActions.reset('A'); demoActions.reset('B'); setError(null); }}>데모 처음부터</button>
          <Link className="btn" href="/trace">🔎 내 AI TRACE</Link>
        </div>
      </section>
    </div>
  );
}

