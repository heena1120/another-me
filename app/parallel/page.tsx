import type { Metadata } from 'next';
import ParallelView from '@/components/ParallelView';

export const metadata: Metadata = { title: 'PARALLEL ME' };

export default function Page() {
  return (
    <main className="page wide">
      <header className="page-head compact">
        <h1>PARALLEL ME</h1>
      </header>
      <ParallelView />
    </main>
  );
}
