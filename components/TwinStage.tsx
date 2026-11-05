'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode } from 'react';
import TwinAvatar from '@/components/TwinAvatar';
import { BACKGROUNDS, type Avatar, type Mood } from '@/lib/avatar';

type Props = {
  avatar: Avatar;
  mood?: Mood;
  /** 숫자(px) 또는 'fill'(부모 높이를 채움) */
  height?: number | 'fill';
  className?: string;
  dance?: boolean;
  vitality?: number;
  lift?: number;
  distance?: number;
};

function Flat({ avatar, mood, height = 340, className }: Props) {
  const bg = BACKGROUNDS.find(b => b.id === avatar.bg)?.value ?? '#e8f3ff';
  const size = typeof height === 'number' ? Math.min(height * 0.9, 300) : 280;
  return (
    <div className={['flat-stage', className].filter(Boolean).join(' ')} style={{ width: '100%', height: height === 'fill' ? '100%' : height, background: bg, borderRadius: 28, display: 'grid', placeItems: 'center' }}>
      <TwinAvatar avatar={avatar} mood={mood} size={size} />
    </div>
  );
}

// 3D 라이브러리는 브라우저에서만 불러옵니다. 로딩 중에는 2D 캐릭터를 보여줍니다.
const Avatar3D = dynamic(() => import('@/components/TwinAvatar3D'), {
  ssr: false,
  loading: () => null,
});

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** 3D 캐릭터. WebGL을 쓸 수 없는 환경에서는 2D 캐릭터로 대신합니다. */
export default function TwinStage(props: Props) {
  return (
    <Boundary fallback={<Flat {...props} />}>
      <div style={{ position: 'relative', width: '100%', height: props.height === 'fill' ? '100%' : undefined }}>
        <Flat {...props} />
        <div style={{ position: 'absolute', inset: 0 }}>
          <Avatar3D {...props} />
        </div>
      </div>
    </Boundary>
  );
}
