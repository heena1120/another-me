'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { nextQuestion, toProfile, type Answers } from '@/lib/twin-data';
import { twinActions } from '@/lib/twin-store';

export default function Interview() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [order, setOrder] = useState<string[]>([]); // 답한 순서 (되돌아가기용)

  const q = nextQuestion(answers);
  const step = order.length + 1;

  const choose = (id: string) => {
    if (!q) return;
    const next = { ...answers, [q.id]: id };
    const profile = toProfile(next);
    if (profile) {
      twinActions.saveProfile(profile);
      router.push('/');
      return;
    }
    setAnswers(next);
    setOrder(o => [...o, q.id]);
  };

  const back = () => {
    const last = order[order.length - 1];
    if (!last) return;
    setAnswers(a => {
      const copy = { ...a };
      delete copy[last as keyof Answers];
      return copy;
    });
    setOrder(o => o.slice(0, -1));
  };

  if (!q) return null;

  return (
    <section className="card qcard" aria-live="polite">
      <p className="step">질문 {step}</p>
      <h2>{q.text}</h2>
      {q.hint && <p className="muted">{q.hint}</p>}
      <div className="opts" role="group" aria-label={q.text}>
        {q.options.map(o => (
          <button key={o.id} type="button" className="opt" onClick={() => choose(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
      {order.length > 0 && (
        <button type="button" className="btn ghost small" onClick={back}>
          ← 이전 질문
        </button>
      )}
      <p className="muted small">답에 따라 다음 질문이 달라져요. 의료 진단이 아니라 생활 습관 참고용이에요.</p>
    </section>
  );
}
