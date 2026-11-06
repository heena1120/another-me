import type { Metadata } from 'next';
import WorldView from '@/components/WorldView';

export const metadata: Metadata = { title: 'ANOTHER WORLD' };

export default function Page() {
  return (
    <main className="page wide">
      <header className="page-head compact">
        <h1>ANOTHER WORLD</h1>
      </header>
      <WorldView />
    </main>
  );
}
