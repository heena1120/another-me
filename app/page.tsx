import { Suspense } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';

async function checkSupabase(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured()) return { ok: false, message: '아직 연결 전이에요. .env.local 에 URL과 Publishable key를 입력하고 서버를 다시 시작하세요.' };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim() },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? { ok: true, message: 'Supabase에 연결되었어요.' } : { ok: false, message: `Supabase가 오류를 응답했어요 (HTTP ${res.status}). URL과 키를 확인하세요.` };
  } catch {
    return { ok: false, message: 'Supabase에 닿지 못했어요. URL이 맞는지, 네트워크가 되는지 확인하세요.' };
  }
}

async function SupabaseStatus() {
  const status = await checkSupabase();
  return <p role="status"><strong>Supabase:</strong> {status.message}</p>;
}

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '12vh auto', padding: '0 24px', lineHeight: 1.7 }}>
      <h1>Hackathon App</h1>
      <p>Next.js + Supabase + Vercel 시작 틀입니다. 여기에 아이디어를 구현하세요.</p>
      <Suspense fallback={<p role="status"><strong>Supabase:</strong> 확인 중…</p>}>
        <SupabaseStatus />
      </Suspense>
    </main>
  );
}
