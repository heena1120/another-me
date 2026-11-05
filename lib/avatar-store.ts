'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { sanitizeAvatar, type Avatar } from '@/lib/avatar';

// ───────── 저장소 (지금은 이 기기의 localStorage, 나중에 Supabase로 교체) ─────────
const KEY = 'twin.avatar.v1';
const EVENT = 'twin-avatar-change';

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(EVENT, cb);
  };
}

const readRaw = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export function saveAvatar(avatar: Avatar) {
  window.localStorage.setItem(KEY, JSON.stringify(avatar));
  window.dispatchEvent(new Event(EVENT));
}

export function clearAvatar() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** undefined = 아직 브라우저에서 읽는 중, null = 저장된 캐릭터 없음 */
export function useAvatar(): Avatar | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined);
  return useMemo(() => {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    try {
      return sanitizeAvatar(JSON.parse(raw));
    } catch {
      return null;
    }
  }, [raw]);
}
