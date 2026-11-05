'use client';

import { useEffect, useState } from 'react';

/** AI 기능을 쓸 수 있으면 true, 아직 모르면(확인 중) null, 키가 없으면 false */
export function useAiEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/ai-status', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: { enabled?: boolean }) => alive && setEnabled(d.enabled === true))
      .catch(() => alive && setEnabled(false));
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}
