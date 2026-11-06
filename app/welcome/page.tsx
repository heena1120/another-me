import type { Metadata } from 'next';
import Welcome from '@/components/Welcome';

export const metadata: Metadata = { title: '시작하기' };

export default function WelcomePage() {
  return <Welcome />;
}
