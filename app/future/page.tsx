import type { Metadata } from 'next';
import FutureMirror from '@/components/FutureMirror';

export const metadata: Metadata = { title: '5년 뒤의 나' };

export default function FuturePage() {
  return (
    <main className="page wide">
      <header className="page-head compact">
        <h1>5년 뒤의 나</h1>
      </header>
      <FutureMirror />
    </main>
  );
}
