'use client';

import Link from 'next/link';
import Brand from '@/components/Brand';
import TwinStage from '@/components/TwinStage';
import { DEFAULT_AVATAR, type Avatar } from '@/lib/avatar';
import { useAvatar } from '@/lib/avatar-store';
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
          <h1>같은 체크리스트로는<br />아무도 바뀌지 않아요</h1>
          <p>
            <b>ANOTHER ME</b>는 AI가 <b>내 생활</b>을 읽고 퀘스트를 만들어요. 실패하면 내가 아니라 퀘스트가 작아지고, 트윈은 내가 실제로 한 만큼만 자라요.
          </p>
          <ul className="welcome-points" aria-label="핵심">
            <li>✦ AI가 내 답변에서 숨은 패턴을 찾아요</li>
            <li>⚔️ 못 하면 퀘스트가 더 작아져요</li>
            <li>🔮 5년 뒤의 나를 스위치로 비교해요</li>
          </ul>
        </div>
        <div style={{ marginTop: 16 }}>
          <Link className="btn primary" href={returning ? '/' : '/onboarding'}>
            {returning ? '계속하기' : '3분이면 돼요 · 시작하기'}
          </Link>
          <small>얼굴 사진은 선택 · 서버에 저장하지 않아요</small>
        </div>
      </div>
    </main>
  );
}
