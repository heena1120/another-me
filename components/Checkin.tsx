'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { fitAdapter, predict, PERSONALIZE_MIN_DAYS, type Raw } from '@/lib/twin-model';
import { baselineFromProfile, todayKey } from '@/lib/twin-data';
import { twinActions } from '@/lib/twin-store';
import { useTwin } from '@/lib/use-twin';

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} <strong>{Number.isInteger(value) ? value : value.toFixed(1)}{unit}</strong>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

const FEELINGS = [
  { v: 15, emoji: '😵', label: '많이 힘들어요' },
  { v: 35, emoji: '😞', label: '별로예요' },
  { v: 55, emoji: '😐', label: '보통이에요' },
  { v: 75, emoji: '🙂', label: '좋아요' },
  { v: 92, emoji: '😆', label: '최고예요' },
];

export default function Checkin() {
  const { state, base } = useTwin();
  if (!state || !base) return <p className="muted" role="status">불러오는 중…</p>;
  if (!state.profile)
    return (
      <section className="card">
        <h2>먼저 나를 알려 주세요</h2>
        <p className="muted">쌍둥이가 내 습관을 알아야 컨디션을 예측할 수 있어요.</p>
        <Link className="btn primary" href="/interview">쌍둥이에게 나 소개하기</Link>
      </section>
    );
  const last = state.checkins[state.checkins.length - 1];
  const initial: Raw = last ? { ...last.raw } : baselineFromProfile(state.profile);
  return <Form key={state.checkins.length === 0 ? 'new' : 'has'} initial={initial} />;
}

function Form({ initial }: { initial: Raw }) {
  const { state, base } = useTwin();
  const [raw, setRaw] = useState<Raw>(() => ({
    ...initial,
    sleepHours: Math.round(initial.sleepHours * 2) / 2,
    steps: Math.round(initial.steps / 500) * 500,
    exerciseMin: Math.round(initial.exerciseMin / 5) * 5,
    caffeineCups: Math.round(initial.caffeineCups),
    waterCups: Math.round(initial.waterCups),
    shortformMin: Math.round(initial.shortformMin / 10) * 10,
    outdoorMin: Math.round(initial.outdoorMin / 10) * 10,
  }));
  const [step, setStep] = useState<'input' | 'predicted' | 'done'>('input');
  const [predicted, setPredicted] = useState<number | null>(null);
  const [actual, setActual] = useState<number | null>(null);
  const set = <K extends keyof Raw>(k: K, v: Raw[K]) => setRaw(r => ({ ...r, [k]: v }));

  if (!state || !base) return null;
  const today = todayKey();
  const past = state.checkins.filter(c => c.date !== today);

  const showPrediction = () => {
    // 오늘 기록을 배우기 "전"의 쌍둥이로 예측합니다. (미리 맞혀 보는 것이라 학습에 쓰이지 않은 예측)
    const adapter = fitAdapter(base, past.map(c => ({ raw: c.raw, actual: c.actual })));
    setPredicted(predict({ net: base.net, adapter }, raw));
    setStep('predicted');
  };

  const save = () => {
    if (actual === null || predicted === null) return;
    twinActions.addCheckin({ date: today, raw, actual, predicted });
    setStep('done');
  };

  if (step === 'done' && predicted !== null && actual !== null) {
    const diff = actual - predicted;
    const days = past.length + 1;
    return (
      <section className="card" aria-live="polite">
        <h2>쌍둥이가 학습했어요 ✨</h2>
        <p className="hint-line"><b className="tag ai">AI</b> 홈으로 가면 오늘 기록을 반영해 퀘스트를 다시 맞춰요.</p>
        <p>
          쌍둥이의 예측 <strong>{predicted.toFixed(0)}점</strong> · 실제 <strong>{actual}점</strong> ({diff >= 0 ? '+' : ''}{diff.toFixed(0)})
        </p>
        <p className="muted">
          {days < PERSONALIZE_MIN_DAYS
            ? `기록 ${days}일째예요. ${PERSONALIZE_MIN_DAYS}일이 쌓이면 쌍둥이가 나만의 패턴을 배우기 시작해요.`
            : `기록 ${days}일째! 쌍둥이가 내 데이터로 보정하고 있어요.`}
        </p>
        <div className="actions">
          <Link className="btn ghost" href="/analysis">내 패턴 분석 보기</Link>
          <Link className="btn primary" href="/">홈으로</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>어제 밤부터 오늘까지</h2>
        <Slider label="지난밤 수면" value={raw.sleepHours} min={3} max={11} step={0.5} unit="시간" onChange={v => set('sleepHours', v)} />
        <div className="field">
          <span className="label">취침 시각이 평소와 다른 정도</span>
          <div className="chips" role="radiogroup" aria-label="취침 시각 차이">
            {[
              [0, '거의 같아요'],
              [30, '30분'],
              [60, '1시간'],
              [120, '2시간 이상'],
            ].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={Math.abs(raw.bedtimeVar - (v as number)) < 15} className={`chip${Math.abs(raw.bedtimeVar - (v as number)) < 15 ? ' selected' : ''}`} onClick={() => set('bedtimeVar', v as number)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <Toggle label="자기 전에 폰·화면을 봤어요" checked={raw.screenBeforeBed >= 0.5} onChange={v => set('screenBeforeBed', v ? 1 : 0)} />
      </section>

      <section className="card">
        <h2>오늘 움직임</h2>
        <Slider label="걸음 수" value={raw.steps} min={0} max={20000} step={500} unit="보" onChange={v => set('steps', v)} />
        <Slider label="운동" value={raw.exerciseMin} min={0} max={120} step={5} unit="분" onChange={v => set('exerciseMin', v)} />
        <Slider label="바깥에서 보낸 시간" value={raw.outdoorMin} min={0} max={180} step={10} unit="분" onChange={v => set('outdoorMin', v)} />
        <Toggle label="오늘은 대부분 앉아서 보냈어요" checked={raw.sedentaryJob >= 0.5} onChange={v => set('sedentaryJob', v ? 1 : 0)} />
      </section>

      <section className="card">
        <h2>먹고 마신 것</h2>
        <Slider label="카페인 음료" value={raw.caffeineCups} min={0} max={6} step={1} unit="잔" onChange={v => set('caffeineCups', v)} />
        <Toggle label="오후 3시 이후에도 카페인을 마셨어요" checked={raw.caffeineLate >= 0.5} onChange={v => set('caffeineLate', v ? 1 : 0)} />
        <Slider label="물" value={raw.waterCups} min={0} max={10} step={1} unit="컵" onChange={v => set('waterCups', v)} />
        <Toggle label="식사 시간이 규칙적이었어요" checked={raw.mealsRegular >= 0.5} onChange={v => set('mealsRegular', v ? 1 : 0)} />
      </section>

      <section className="card">
        <h2>숏폼</h2>
        <Slider label="숏폼 본 시간" value={raw.shortformMin} min={0} max={360} step={10} unit="분" onChange={v => set('shortformMin', v)} />
      </section>

      {step === 'input' && (
        <button type="button" className="btn primary wide-btn" onClick={showPrediction}>
          쌍둥이의 예측 보기
        </button>
      )}

      {step === 'predicted' && predicted !== null && (
        <section className="card" aria-live="polite">
          <h2>쌍둥이는 이렇게 예측했어요</h2>
          <p className="big">오늘 컨디션 <strong>{predicted.toFixed(0)}점</strong></p>
          <p className="muted">이 예측은 오늘 기록을 배우기 전의 쌍둥이가 한 거예요. 실제는 어땠나요?</p>
          <div className="feelings" role="radiogroup" aria-label="오늘 실제 컨디션">
            {FEELINGS.map(f => (
              <button key={f.v} type="button" role="radio" aria-checked={actual === f.v} className={`feeling${actual === f.v ? ' selected' : ''}`} onClick={() => setActual(f.v)}>
                <span aria-hidden="true">{f.emoji}</span>
                <small>{f.label}</small>
              </button>
            ))}
          </div>
          <button type="button" className="btn primary wide-btn" disabled={actual === null} onClick={save}>
            기록하고 쌍둥이 학습시키기
          </button>
        </section>
      )}
    </div>
  );
}
