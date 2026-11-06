'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Brand from '@/components/Brand';

// 시작 화면과 온보딩은 자체 상단 영역이 있어서 헤더를 숨깁니다.
const HIDDEN = ['/welcome', '/onboarding'];

export default function AppHeader() {
  const pathname = usePathname();
  if (HIDDEN.includes(pathname)) return null;
  return (
    <header className="app-header">
      <Link href="/" aria-label="ANOTHER ME 홈">
        <Brand />
      </Link>
      <Link className="header-link" href="/interview" aria-label="내 정보 다시 입력">
        ⚙
      </Link>
    </header>
  );
}
