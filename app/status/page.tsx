import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase';

export const metadata: Metadata = { title: '연결 상태' };

async function checkSupabase(): Promise<string> {
  if (!isSupabaseConfigured()) return '아직 연결 전이에요. .env.local 에 URL과 Publishable key를 입력하고 서버를 다시 시작하세요.';
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim() },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? 'Supabase에 연결되었어요.' : `Supabase가 오류를 응답했어요 (HTTP ${res.status}). URL과 키를 확인하세요.`;
  } catch {
    return 'Supabase에 닿지 못했어요. URL이 맞는지, 네트워크가 되는지 확인하세요.';
  }
}

async function SupabaseStatus() {
  return <p role="status"><strong>Supabase:</strong> {await checkSupabase()}</p>;
}

export default function StatusPage() {
  return (
    <main className="page">
      <header className="page-head">
        <h1>연결 상태</h1>
      </header>
      <section className="card" aria-label="내 정보">
        <h2>내 정보</h2>
        <p className="foot-links" style={{ justifyContent: 'flex-start' }}>
          <Link href="/interview">✏️ 생활 질문 다시 답하기</Link>
          <Link href="/create">🎨 트윈 꾸미기</Link>
        </p>
        <h2 style={{ marginTop: 16 }}>심사·개발용</h2>
        <p className="foot-links" style={{ justifyContent: 'flex-start' }}>
          <Link href="/demo">🧪 A/B 데모 (실제 AI 호출)</Link>
          <Link href="/trace">🔎 AI TRACE</Link>
          <Link href="/analysis">🧠 신경망 분석 근거</Link>
        </p>
      </section>
      <Suspense fallback={<p role="status"><strong>Supabase:</strong> 확인 중…</p>}>
        <SupabaseStatus />
      </Suspense>
    </main>
  );
}
