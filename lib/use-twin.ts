'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { deserialize, fitAdapter, pretrain, serialize, type TwinModel } from '@/lib/twin-model';
import { baseline, moodOf, type Profile } from '@/lib/twin-data';
import { twinActions, useTwinState, type TwinState } from '@/lib/twin-store';

export type TwinInfo = {
  state: TwinState | undefined;
  /** 사전학습 신경망 + 내 개인 보정층. 아직 준비 중이면 null */
  model: TwinModel | null;
  /** 개인 보정 전의 사전학습 모델 */
  base: TwinModel | null;
  training: { epoch: number; epochs: number; history: number[] } | null;
  baseHabits: ReturnType<typeof baseline> | null;
  mood: 'normal' | 'happy' | 'tired';
};

const EPOCHS = 40;

/** 저장된 모델을 불러오고, 없으면 처음 한 번 사전학습합니다. 체크인이 쌓이면 개인 보정층을 다시 학습합니다. */
export function useTwin(): TwinInfo {
  const state = useTwinState();
  const modelData = state?.model ?? null;
  const saved = useMemo(() => (modelData ? deserialize(modelData) : null), [modelData]);
  const [training, setTraining] = useState<TwinInfo['training']>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!state || saved || started.current) return;
    started.current = true;
    pretrain({
      epochs: EPOCHS,
      onEpoch: (epoch, rmse) => setTraining(t => ({ epoch, epochs: EPOCHS, history: [...(t?.history ?? []), rmse] })),
    }).then(({ model, history }) => twinActions.saveModel(serialize(model), history));
  }, [state, saved]);

  const checkins = state?.checkins;
  const model = useMemo<TwinModel | null>(() => {
    if (!saved || !checkins) return null;
    return { net: saved.net, adapter: fitAdapter(saved, checkins.map(c => ({ raw: c.raw, actual: c.actual }))) };
  }, [saved, checkins]);

  const profile: Profile | null = state?.profile ?? null;
  const baseHabits = useMemo(() => (profile && checkins ? baseline(profile, checkins.map(c => c.raw)) : null), [profile, checkins]);
  const mood = moodOf(checkins && checkins.length > 0 ? checkins[checkins.length - 1].actual : undefined);

  return { state, model, base: saved, training: saved ? null : training, baseHabits, mood };
}
