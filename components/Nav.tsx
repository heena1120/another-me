'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 모바일 하단 탭바. 엄지로 누르기 쉬운 위치에 3개만 둡니다.
const TABS = [
  { href: '/', label: '오늘', icon: '🏠', also: ['/checkin', '/explore', '/create', '/interview'] },
  { href: '/future', label: '5년 뒤', icon: '🔮', also: [] },
  { href: '/analysis', label: '분석', icon: '🧠', also: [] },
] as const;

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="주 메뉴">
      {TABS.map(t => {
        const current = pathname === t.href || (t.also as readonly string[]).includes(pathname);
        return (
          <Link key={t.href} href={t.href} aria-current={current ? 'page' : undefined}>
            <span className="nav-icon" aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
