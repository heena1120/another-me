import type { Metadata } from 'next';
import AvatarCreator from '@/components/AvatarCreator';

export const metadata: Metadata = { title: '캐릭터 만들기' };

export default function CreatePage() {
  return (
    <main className="page wide">
      <header className="page-head">
        <h1>나의 쌍둥이 만들기</h1>
        <p>나를 닮은 캐릭터를 꾸며 주세요. 언제든 다시 바꿀 수 있어요.</p>
      </header>
      <AvatarCreator />
    </main>
  );
}
