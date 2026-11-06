'use client';

import { useEffect, useState } from 'react';

export type AiStatus = { enabled: boolean; model: string };

/** AI 상태(연결 여부와 모델 이름). 아직 모르면(확인 중) null */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/ai-status', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: { enabled?: boolean; model?: string }) => alive && setStatus({ enabled: d.enabled === true, model: d.model ?? '' }))
      .catch(() => alive && setStatus({ enabled: false, model: '' }));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

/** AI 기능을 쓸 수 있으면 true, 아직 모르면(확인 중) null, 키가 없으면 false */
export function useAiEnabled(): boolean | null {
  const s = useAiStatus();
  return s === null ? null : s.enabled;
}
