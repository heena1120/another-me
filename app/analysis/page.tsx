import type { Metadata } from 'next';
import AnalysisView from '@/components/AnalysisView';

export const metadata: Metadata = { title: '패턴 분석' };

export default function AnalysisPage() {
  return (
    <main className="page">
      <header className="page-head compact">
        <h1>내 패턴 분석</h1>
      </header>
      <AnalysisView />
    </main>
  );
}
