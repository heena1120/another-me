'use client';

import { useCallback, useState } from 'react';
import { buildCoachInput, inputKindsOf, planFromCoach } from '@/lib/ai-client';
import { todayKey } from '@/lib/twin-data';
import { twinActions } from '@/lib/twin-store';
import type { TwinInfo } from '@/lib/use-twin';

/**
 * HIDDEN ME 분석 + AI QUEST 생성을 OpenAI로 요청합니다.
 * 성공하든 실패하든 AI TRACE에 기록을 남기고, 실패하면 이유를 사용자에게 알려 줍니다.
 * (AI가 응답하지 못했을 때 결과를 대신 만들어 보여 주지 않습니다.)
 */
export function useAiCoach(twin: TwinInfo) {
  const { state, model, baseHabits } = twin; // 이미 가진 값을 넘겨받아 신경망 학습이 이중으로 시작되지 않게 합니다.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = state?.profile ?? null;
  const ready = !!(profile && model && baseHabits && state);

  const run = useCallback(
    async (mode: 'initial' | 'reanalyze'): Promise<boolean> => {
      if (!profile || !model || !baseHabits || !state) return false;
      setBusy(true);
      setError(null);
      const today = todayKey();
      const input = buildCoachInput({ mode, profile, plans: state.plans, archived: state.ai.archivedFails, model, baseHabits, today });
      const base = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), kind: 'coach' as const, mode, inputKinds: inputKindsOf(input), input };

      try {
        const res = await fetch('/api/ai/coach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          result?: import('@/lib/ai-types').CoachResult;
          adjustments?: string[];
          meta?: import('@/lib/ai-types').CoachMeta;
        };
        if (!res.ok || !data.result || !data.meta) {
          twinActions.addTrace({ ...base, ok: false, error: data.code ?? `http_${res.status}` });
          setError(data.error ?? 'AI 분석에 실패했어요. 다시 시도해 주세요.');
          return false;
        }
        const adjustments = data.adjustments ?? [];
        twinActions.addTrace({ ...base, ok: true, model: data.meta.model, promptVersion: data.meta.promptVersion, ms: data.meta.ms, usage: data.meta.usage, requestId: data.meta.requestId, output: data.result, adjustments });
        twinActions.setCoach({ at: base.at, model: data.meta.model, mode, promptVersion: data.meta.promptVersion, result: data.result, adjustments });
        twinActions.applyAiPlan(today, planFromCoach(data.result, input.signals.levers, base.at));
        return true;
      } catch {
        twinActions.addTrace({ ...base, ok: false, error: 'network' });
        setError('네트워크 문제로 AI에 연결하지 못했어요. 다시 시도해 주세요.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [profile, model, baseHabits, state],
  );

  return { run, busy, error, clearError: () => setError(null), ready };
}
