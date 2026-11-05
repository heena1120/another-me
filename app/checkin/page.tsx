import type { Metadata } from 'next';
import Checkin from '@/components/Checkin';

export const metadata: Metadata = { title: '오늘 체크인' };

export default function CheckinPage() {
  return (
    <main className="page">
      <header className="page-head">
        <h1>오늘 체크인</h1>
        <p>60초면 끝나요. 쌍둥이가 먼저 예측하고, 실제와 비교해서 배워요.</p>
      </header>
      <Checkin />
    </main>
  );
}
