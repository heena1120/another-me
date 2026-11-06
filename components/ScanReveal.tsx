'use client';

import { useMemo } from 'react';
import Radar from '@/components/Radar';
import { predict } from '@/lib/twin-model';
import { baselineFromProfile, type Profile } from '@/lib/twin-data';
import { groupScores, idealRange, levelOfScore } from '@/lib/twin-sim';
import { useTwin } from '@/lib/use-twin';

/** 온보딩 3단계: 질문 답변으로 "현재 상태"를 분석해 보여 줍니다. (신경망이 준비되면 계산) */
export default function ScanReveal({ profile }: { profile: Profile }) {
  const { model } = useTwin();

  const scan = useMemo(() => {
    if (!model) return null;
    const base = baselineFromProfile(profile);
    const score = predict(model, base);
    const lv = levelOfScore(score, idealRange(model));
    const groups = groupScores(model, base);
    const weakest = [...groups].sort((a, b) => a.score - b.score)[0];
    return { lv, groups, weakest };
  }, [model, profile]);

  if (!scan) return <p className="muted" role="status">내 답변을 분석하는 중이에요…</p>;
  const { lv, groups, weakest } = scan;

  return (
    <div className="reveal" aria-live="polite">
      <div>
        <p className="eyebrow">지금의 나</p>
        <p className="big">{Math.round(lv.closeness * 100)}%</p>
        <p className="muted">{lv.name} · 근접 {lv.level}단계 (되고 싶은 모습에 가까운 정도)</p>
      </div>
      <Radar items={groups.map(g => ({ label: g.label, score: g.score }))} />
      <p>
        가장 먼저 챙기면 좋은 영역은 <b>{weakest.label}</b>({Math.round(weakest.score)}%)이에요.
      </p>
      <p className="muted small">신경망 추정 · 기록이 쌓이면 정확해져요 · 의료 진단 아님</p>
    </div>
  );
}
