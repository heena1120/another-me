import { createClient } from '@supabase/supabase-js';

// 서버 컴포넌트·Route Handler·브라우저 어디서든 쓸 수 있는 공개용 클라이언트입니다.
// 공개 키만 사용하므로 읽기/쓰기 권한은 반드시 Supabase RLS 정책으로 제한하세요.
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim());
