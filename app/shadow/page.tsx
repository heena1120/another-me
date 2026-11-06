import type { Metadata } from 'next';
import ShadowView from '@/components/ShadowView';

export const metadata: Metadata = { title: 'MY SHADOW' };

export default function Page() {
  return (
    <main className="page wide">
      <header className="page-head compact">
        <h1>MY SHADOW</h1>
      </header>
      <ShadowView />
    </main>
  );
}
