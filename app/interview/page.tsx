import type { Metadata } from 'next';
import Interview from '@/components/Interview';

export const metadata: Metadata = { title: '나 소개하기' };

export default function InterviewPage() {
  return (
    <main className="page">
      <header className="page-head">
        <h1>쌍둥이에게 나 소개하기</h1>
        <p>선택지만 고르면 돼요. 답에 따라 질문이 달라져요.</p>
      </header>
      <Interview />
    </main>
  );
}
