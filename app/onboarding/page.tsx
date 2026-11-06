import type { Metadata } from 'next';
import Onboarding from '@/components/Onboarding';

export const metadata: Metadata = { title: '시작하기' };

export default function OnboardingPage() {
  return <Onboarding />;
}
