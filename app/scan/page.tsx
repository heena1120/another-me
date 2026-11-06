import type { Metadata } from 'next';
import ScanView from '@/components/ScanView';

export const metadata: Metadata = { title: 'REALITY SCAN' };

export default function ScanPage() {
  return (
    <main className="page">
      <header className="page-head compact">
        <h1>REALITY SCAN</h1>
      </header>
      <ScanView />
    </main>
  );
}
