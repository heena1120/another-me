'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import TwinAvatar from '@/components/TwinAvatar';
import { useAvatar } from '@/lib/avatar-store';
import { predict } from '@/lib/twin-model';
import { generatePlan, improvedHabits } from '@/lib/twin-data';
import { useTwin } from '@/lib/use-twin';

type Scenario = 'now' | 'improved';
type Msg = { role: 'user' | 'assistant'; content: string };

const STARTERS = ['5년 뒤엔 어떻게 지내고 있어?', '지금의 나한테 해줄 말 있어?', '뭘 바꾸면 제일 좋을까?'];

export default function FutureChat({ compact = false }: { compact?: boolean }) {
  const avatar = useAvatar();
  const { state, model, baseHabits } = useTwin();
  const [scenario, setScenario] = useState<Scenario>('improved');
  const [chats, setChats] = useState<Record<Scenario, Msg[]>>({ now: [], improved: [] });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = state?.profile ?? null;
  const sim = useMemo(() => {
    if (!profile || !model || !baseHabits) return null;
    const items = generatePlan(model, profile, baseHabits);
    const improved = improvedHabits(profile, baseHabits, items.map(i => i.id));
    return { items, nowScore: predict(model, baseHabits), improvedScore: predict(model, improved) };
  }, [profile, model, baseHabits]);

  if (!state || !avatar) return <p className="muted" role="status">불러오는 중…</p>;
  if (!profile)
    return (
      <section className="card">
        <h2>먼저 나를 알려 주세요</h2>
        <p className="muted">쌍둥이가 내 습관을 알아야 5년 뒤의 모습을 그릴 수 있어요.</p>
        <Link className="btn primary" href="/interview">쌍둥이에게 나 소개하기</Link>
      </section>
    );
  if (!sim)
    return (
      <p className="muted" role="status">
        쌍둥이 신경망이 학습 중이에요. 잠시 뒤 다시 확인해 주세요. 홈 화면에서 학습이 진행돼요.
      </p>
    );

  const gap = sim.improvedScore - sim.nowScore;
  const msgs = chats[scenario];
  const mood = scenario === 'improved' ? 'happy' : sim.nowScore < 50 ? 'tired' : 'normal';
  const greeting =
    scenario === 'improved'
      ? `나는 체크리스트를 꾸준히 지킨 5년 뒤의 ${avatar.name}이야. 궁금한 거 물어봐!`
      : `나는 지금 습관 그대로 5년을 보낸 ${avatar.name}이야. 솔직하게 얘기해 줄게.`;

  const send = async (text: string) => {
    const content = text.trim().slice(0, 500);
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content }];
    setChats(c => ({ ...c, [scenario]: next }));
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/future-twin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scenario,
          name: avatar.name,
          nowScore: sim.nowScore,
          improvedScore: sim.improvedScore,
          changes: sim.items.map(i => i.title),
          messages: next.slice(-11),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error ?? '답을 받지 못했어요. 다시 시도해 주세요.');
      setChats(c => ({ ...c, [scenario]: [...next, { role: 'assistant', content: data.reply as string }] }));
    } catch (e) {
      // 실패한 질문은 되돌려서 대화 순서(질문→답)가 어긋나지 않게 합니다.
      setChats(c => ({ ...c, [scenario]: msgs }));
      setInput(content);
      setError(e instanceof Error ? e.message : '답을 받지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {!compact && (
      <section className="card" aria-label="두 가지 미래 비교">
        <h2>두 가지 미래</h2>
        <p className="muted">쌍둥이 신경망이 예측한 <b>오늘 기준 컨디션</b>이에요. 5년 뒤를 맞히는 예언이 아니라 상상 시뮬레이션이에요.</p>
        <div className="futures">
          <div className="future">
            <small>지금 습관 그대로</small>
            <strong>{sim.nowScore.toFixed(0)}점</strong>
          </div>
          <div className="future good">
            <small>체크리스트를 지키면</small>
            <strong>{sim.improvedScore.toFixed(0)}점</strong>
            <em>{gap >= 0.5 ? `+${gap.toFixed(1)}` : '비슷해요'}</em>
          </div>
        </div>
        {sim.items.length > 0 ? (
          <ul className="facts">
            {sim.items.map(i => (
              <li key={i.id}>{i.title}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">이미 좋은 습관이라 바뀌는 항목이 거의 없어요. 지금처럼만 이어가면 돼요!</p>
        )}
      </section>
      )}

      <section className="card chat" aria-label="미래 쌍둥이와 대화">
        <div className="tabs" role="tablist" aria-label="어느 미래와 이야기할까요">
          {([
            ['improved', '체크리스트를 지킨 나'],
            ['now', '지금 습관 그대로인 나'],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={scenario === id} className={`tab${scenario === id ? ' selected' : ''}`} onClick={() => { setScenario(id); setError(null); }}>
              {label}
            </button>
          ))}
        </div>

        <div className="log" aria-live="polite">
          <div className="msg-row">
            <TwinAvatar avatar={avatar} mood={mood} size={64} />
            <p className="bubble-msg">{greeting}</p>
          </div>
          {msgs.map((m, i) => (
            <div key={i} className={`msg-row ${m.role}`}>
              {m.role === 'assistant' && <TwinAvatar avatar={avatar} mood={mood} size={64} />}
              <p className="bubble-msg">{m.content}</p>
            </div>
          ))}
          {busy && <p className="muted small" role="status">미래의 {avatar.name}가 생각 중…</p>}
        </div>

        {msgs.length === 0 && (
          <div className="chips" role="group" aria-label="추천 질문">
            {STARTERS.map(s => (
              <button key={s} type="button" className="chip" disabled={busy} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {error && <p className="msg error" role="alert">{error}</p>}

        <form
          className="composer"
          onSubmit={e => {
            e.preventDefault();
            send(input);
          }}
        >
          <label htmlFor="future-input" className="sr-only">미래의 나에게 보낼 메시지</label>
          <input id="future-input" value={input} maxLength={500} placeholder="미래의 나에게 물어보기" onChange={e => setInput(e.target.value)} disabled={busy} />
          <button type="submit" className="btn primary" disabled={busy || input.trim().length === 0}>
            보내기
          </button>
        </form>
        <p className="muted small">AI가 만든 상상 속 대화예요. 의료 조언이 아니고, 대화 내용은 저장되지 않아요.</p>
      </section>
    </div>
  );
}
