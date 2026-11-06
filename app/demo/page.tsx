import type { Metadata } from 'next';
import DemoView from '@/components/DemoView';

export const metadata: Metadata = { title: 'A/B 데모' };

export default function DemoPage() {
  return (
    <main className="page wide">
      <header className="page-head compact">
        <h1>A/B 데모</h1>
      </header>
      <DemoView />
    </main>
  );
}
