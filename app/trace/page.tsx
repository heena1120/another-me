import type { Metadata } from 'next';
import TraceView from '@/components/TraceView';

export const metadata: Metadata = { title: 'AI TRACE' };

export default function TracePage() {
  return (
    <main className="page">
      <header className="page-head compact">
        <h1>AI TRACE</h1>
      </header>
      <TraceView />
    </main>
  );
}
