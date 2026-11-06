import type { Metadata } from 'next';
import QuestBoard from '@/components/QuestBoard';

export const metadata: Metadata = { title: 'AI QUEST' };

export default function QuestsPage() {
  return (
    <main className="page">
      <header className="page-head compact">
        <h1>오늘의 AI QUEST</h1>
      </header>
      <QuestBoard />
    </main>
  );
}
