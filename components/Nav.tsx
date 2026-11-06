'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// 모바일 하단 탭바: 엄지로 누르기 쉬운 위치에 5개. (MY SHADOW·PARALLEL ME는 WORLD 안에서 열어요)
const TABS: { href: string; label: string; also: string[]; icon: ReactNode }[] = [
  {
    href: '/',
    label: 'MY TWIN',
    also: ['/checkin', '/explore', '/create', '/interview'],
    icon: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  },
  {
    href: '/scan',
    label: 'SCAN',
    also: ['/analysis'],
    icon: (
      <>
        <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  {
    href: '/quests',
    label: 'QUEST',
    also: [],
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l3 3 5-6" />
      </>
    ),
  },
  {
    href: '/world',
    label: 'WORLD',
    also: ['/shadow', '/parallel'],
    icon: <path d="M3 20h18M5 20V9l7-5 7 5v11M10 20v-6h4v6" />,
  },
  {
    href: '/future',
    label: 'FUTURE',
    also: [],
    icon: <path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />,
  },
];

// 시작 화면과 온보딩은 전체 화면으로 보여 주므로 탭바를 숨깁니다.
const HIDDEN = ['/welcome', '/onboarding'];

export default function Nav() {
  const pathname = usePathname();
  if (HIDDEN.includes(pathname)) return null;
  return (
    <nav className="nav" aria-label="주 메뉴">
      {TABS.map(t => {
        const current = pathname === t.href || t.also.includes(pathname);
        return (
          <Link key={t.href} href={t.href} aria-current={current ? 'page' : undefined}>
            <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
              {t.icon}
            </svg>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
