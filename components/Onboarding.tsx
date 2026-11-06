'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AvatarCreator from '@/components/AvatarCreator';
import Brand from '@/components/Brand';
import Interview from '@/components/Interview';
import LifeClassPicker from '@/components/LifeClassPicker';
import ScanReveal from '@/components/ScanReveal';
import { useAvatar } from '@/lib/avatar-store';
import type { LifeClassId } from '@/lib/ai-types';
import { lifeClassOf } from '@/lib/life-class';
import type { Profile } from '@/lib/twin-data';
import { twinActions } from '@/lib/twin-store';
import { useTwin } from '@/lib/use-twin';

const TITLES = [
  { t: 'MY TWIN 만들기', s: '나를 닮은 또 하나의 나를 꾸며 보세요. 얼굴 사진은 선택이에요.' },
  { t: '요즘 생활은 어때요?', s: '선택지만 고르면 돼요. 답에 따라 질문이 달라져요.' },
  { t: '현재 상태 분석', s: '답변을 바탕으로 지금의 나를 살펴봤어요.' },
  { t: 'LIFE CLASS 선택', s: '되고 싶은 미래의 모습을 골라요. AI가 분석 기준과 퀘스트 방향을 거기에 맞춰요.' },
] as const;

// 질문 중 마지막 "목표" 질문은 4단계(LIFE CLASS)에서 고르므로 임시 값을 채워 건너뜁니다.
const SEED = { goal: 'stamina' } as const;

export default function Onboarding() {
  const avatar = useAvatar();
  useTwin(); // 신경망 사전학습을 미리 시작해, 3단계에서 바로 분석할 수 있게 합니다.
  if (avatar === undefined) return <p className="muted" role="status" style={{ padding: 24 }}>불러오는 중…</p>;
  // 이미 캐릭터를 만든 적이 있으면 2단계부터 이어서 합니다.
  return <Wizard startStep={avatar ? 1 : 0} />;
}

function Wizard({ startStep }: { startStep: number }) {
  const router = useRouter();
  const [step, setStep] = useState(startStep);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lifeClass, setLifeClass] = useState<LifeClassId | null>(null);

  const finish = () => {
    const lc = lifeClassOf(lifeClass);
    if (!profile || !lc) return;
    // goal은 예전 신경망 가중치와의 호환용 기본값이고, 실제 방향은 lifeClass로 정해요.
    twinActions.saveProfile({ ...profile, goal: lc.goal, lifeClass: lc.id });
    router.push('/');
  };

  return (
    <main className="onboard">
      <div className="onboard-top">
        <div className="onboard-nav">
          <button type="button" onClick={() => (step > 0 ? setStep(step - 1) : router.push('/welcome'))} aria-label="이전 단계">
            ← 이전
          </button>
          <Brand />
          <span style={{ width: 56, textAlign: 'right', fontSize: 13, color: '#7a7592', fontWeight: 700 }}>{step + 1}/4</span>
        </div>
        <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-label="온보딩 진행">
          {TITLES.map((_, i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <div>
          <h1>{TITLES[step].t}</h1>
          <p className="onboard-sub">{TITLES[step].s}</p>
        </div>
      </div>

      {step === 0 && <AvatarCreator submitLabel="다음" onSaved={() => setStep(1)} />}

      {step === 1 && (
        <Interview
          key="interview"
          seed={SEED}
          onDone={p => {
            setProfile(p);
            setStep(2);
          }}
        />
      )}

      {step === 2 && profile && (
        <>
          <section className="card">
            <ScanReveal profile={profile} />
          </section>
          <button type="button" className="btn primary wide-btn" onClick={() => setStep(3)}>
            되고 싶은 모습 고르기
          </button>
        </>
      )}
      {step === 2 && !profile && (
        <section className="card">
          <p className="muted">먼저 생활 질문에 답해 주세요.</p>
          <button type="button" className="btn primary" onClick={() => setStep(1)}>질문 하러 가기</button>
        </section>
      )}

      {step === 3 && (
        <>
          <LifeClassPicker value={lifeClass} onChange={setLifeClass} />
          <button type="button" className="btn primary wide-btn" disabled={!lifeClass || !profile} onClick={finish}>
            ANOTHER ME 시작하기
          </button>
          {!profile && <p className="muted small">생활 질문을 먼저 마쳐야 시작할 수 있어요.</p>}
        </>
      )}
    </main>
  );
}
