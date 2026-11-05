import type { Metadata } from 'next';
import Explore from '@/components/Explore';

export const metadata: Metadata = { title: '필터버블 탈출' };

export default function ExplorePage() {
  return (
    <main className="page">
      <header className="page-head">
        <h1>필터버블 탈출</h1>
        <p>알고리즘이 모르는 나를 만들어요. 하루에 하나, 안 해본 것에 도전!</p>
      </header>
      <Explore />
    </main>
  );
}
