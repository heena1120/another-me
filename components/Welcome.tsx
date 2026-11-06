'use client';

import Link from 'next/link';
import Brand from '@/components/Brand';
import TwinStage from '@/components/TwinStage';
import { DEFAULT_AVATAR, type Avatar } from '@/lib/avatar';
import { useAvatar } from '@/lib/avatar-store';
import { APP_TAGLINE } from '@/lib/config';
import { useTwinState } from '@/lib/twin-store';

// 아직 캐릭터가 없는 사람에게 보여 줄 예시 쌍둥이
const SAMPLE: Avatar = { ...DEFAULT_AVATAR, name: 'ME', body: 'lilac', ears: 'round', eyes: 'sparkle', mouth: 'smile', blush: 'pink', accessory: 'ribbon', outfit: 'tee', outfitColor: 'purple', bg: 'lavender' };

export default function Welcome() {
  const avatar = useAvatar();
  const state = useTwinState();
  const returning = !!avatar && !!state?.profile;

  return (
    <main className="welcome">
      <div style={{ textAlign: 'center' }}>
        <Brand large />
      </div>

      <div className="welcome-stage">
        <TwinStage avatar={avatar ?? SAMPLE} height="fill" distance={9.2} lift={-0.1} />
      </div>

      <div>
        <div className="welcome-copy">
          <h1>캐릭터를 키우는 줄 알았는데,<br />어느새 현실의 내가 바뀌고 있었다</h1>
          <p>{APP_TAGLINE}</p>
        </div>
        <div style={{ marginTop: 20 }}>
          <Link className="btn primary" href={returning ? '/' : '/onboarding'}>
            {returning ? '계속하기' : '시작하기'}
          </Link>
          <small>얼굴 사진은 선택이에요. 사진은 서버에 저장하지 않아요.</small>
        </div>
      </div>
    </main>
  );
}
