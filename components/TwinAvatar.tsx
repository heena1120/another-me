import {
  BACKGROUNDS,
  BLUSHES,
  BODY_COLORS,
  OUTFIT_COLORS,
  type Avatar,
  type Mood,
} from '@/lib/avatar';

const INK = '#5a4545'; // 윤곽선
const FACE = '#3b2f2f'; // 눈·입

const GEO = {
  round: { rx: 74, ry: 70, cy: 150, spread: 27, blushX: 44 },
  egg: { rx: 62, ry: 84, cy: 148, spread: 22, blushX: 36 },
  chubby: { rx: 88, ry: 66, cy: 156, spread: 32, blushX: 52 },
} as const;

const CX = 120;

type Props = {
  avatar: Avatar;
  mood?: Mood;
  size?: number;
  /** 배경 카드를 함께 그릴지 */
  withBackground?: boolean;
  className?: string;
};

export default function TwinAvatar({ avatar, mood = 'normal', size = 240, withBackground = false, className }: Props) {
  const g = GEO[avatar.shape];
  const top = g.cy - g.ry;
  const bottom = g.cy + g.ry;
  const faceY = g.cy - g.ry * 0.06;
  const bodyColor = BODY_COLORS.find(c => c.id === avatar.body)?.value ?? '#fff';
  const outfitColor = OUTFIT_COLORS.find(c => c.id === avatar.outfitColor)?.value ?? '#ff8fa8';
  const blushColor = BLUSHES.find(b => b.id === avatar.blush)?.value ?? '';
  const bg = BACKGROUNDS.find(b => b.id === avatar.bg)?.value ?? '#e8f3ff';
  const clipId = `twin-clip-${avatar.shape}`;

  // 컨디션에 따라 표정을 덮어씁니다.
  const eyes = mood === 'happy' ? 'happy' : mood === 'tired' ? 'sleepy' : avatar.eyes;
  const mouth = mood === 'happy' ? 'open' : mood === 'tired' ? 'flat' : avatar.mouth;

  const ex = [CX - g.spread, CX + g.spread];
  const my = faceY + 17;

  const eye = (x: number, kind: string) => {
    switch (kind) {
      case 'sparkle':
        return (
          <g key={x}>
            <circle cx={x} cy={faceY} r={7.5} fill={FACE} />
            <circle cx={x - 2.4} cy={faceY - 2.6} r={2.6} fill="#fff" />
            <circle cx={x + 2.4} cy={faceY + 2.4} r={1.2} fill="#fff" />
          </g>
        );
      case 'happy':
        return <path key={x} d={`M${x - 7},${faceY + 3} Q${x},${faceY - 9} ${x + 7},${faceY + 3}`} fill="none" stroke={FACE} strokeWidth={3.4} strokeLinecap="round" />;
      case 'sleepy':
        return <path key={x} d={`M${x - 7},${faceY - 1} Q${x},${faceY + 6} ${x + 7},${faceY - 1}`} fill="none" stroke={FACE} strokeWidth={3.4} strokeLinecap="round" />;
      default:
        return <circle key={x} cx={x} cy={faceY} r={5.2} fill={FACE} />;
    }
  };

  const mouthEl = (() => {
    const stroke = { fill: 'none', stroke: FACE, strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    switch (mouth) {
      case 'open':
        return (
          <g>
            <path d={`M${CX - 8},${my - 2} Q${CX},${my + 17} ${CX + 8},${my - 2} Z`} fill="#7a3b45" stroke={FACE} strokeWidth={2.4} strokeLinejoin="round" />
            <ellipse cx={CX} cy={my + 6.5} rx={3.8} ry={2.6} fill="#ff9fb0" />
          </g>
        );
      case 'cat':
        return <path d={`M${CX - 10},${my} Q${CX - 5},${my + 8} ${CX},${my} Q${CX + 5},${my + 8} ${CX + 10},${my}`} {...stroke} />;
      case 'o':
        return <ellipse cx={CX} cy={my + 2} rx={3.6} ry={4.2} fill="#7a3b45" />;
      case 'flat':
        return <path d={`M${CX - 5},${my + 2} L${CX + 5},${my + 2}`} {...stroke} />;
      default:
        return <path d={`M${CX - 7},${my} Q${CX},${my + 8} ${CX + 7},${my}`} {...stroke} />;
    }
  })();

  // ───── 귀 (몸 뒤에 그립니다) ─────
  const earInner = '#ffc9d6';
  const ears = (() => {
    const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
    switch (avatar.ears) {
      case 'pointy':
        return [-1, 1].map(s => (
          <g key={s}>
            <path d={`M${CX + s * 64},${top + 26} L${CX + s * 52},${top - 20} L${CX + s * 18},${top + 6} Z`} fill={bodyColor} {...stroke} />
            <path d={`M${CX + s * 53},${top + 12} L${CX + s * 50},${top - 6} L${CX + s * 36},${top + 6} Z`} fill={earInner} />
          </g>
        ));
      case 'long':
        return [-1, 1].map(s => (
          <g key={s} transform={`rotate(${s * 11} ${CX + s * 36} ${top + 4})`}>
            <ellipse cx={CX + s * 36} cy={top - 16} rx={15} ry={36} fill={bodyColor} {...stroke} />
            <ellipse cx={CX + s * 36} cy={top - 14} rx={7} ry={24} fill={earInner} />
          </g>
        ));
      case 'tiny':
        return [-1, 1].map(s => <circle key={s} cx={CX + s * 54} cy={top + 16} r={11} fill={bodyColor} {...stroke} />);
      default:
        return [-1, 1].map(s => (
          <g key={s}>
            <circle cx={CX + s * 48} cy={top + 8} r={21} fill={bodyColor} {...stroke} />
            <circle cx={CX + s * 48} cy={top + 9} r={11} fill={earInner} />
          </g>
        ));
    }
  })();

  // ───── 옷 (몸 모양으로 잘라서 그립니다) ─────
  const outfit = (() => {
    const y0 = g.cy + 24; // 입 아래에서 옷이 시작되도록
    switch (avatar.outfit) {
      case 'tee':
        return <rect x={0} y={y0} width={240} height={200} fill={outfitColor} />;
      case 'stripes':
        return (
          <g>
            <rect x={0} y={y0} width={240} height={200} fill="#fff" />
            {[0, 1, 2, 3, 4, 5].map(i => (
              <rect key={i} x={0} y={y0 + i * 16} width={240} height={8} fill={outfitColor} />
            ))}
          </g>
        );
      case 'overalls':
        return (
          <g>
            <rect x={0} y={g.cy + 38} width={240} height={200} fill={outfitColor} />
            <rect x={CX - 31} y={g.cy + 26} width={11} height={16} fill={outfitColor} />
            <rect x={CX + 20} y={g.cy + 26} width={11} height={16} fill={outfitColor} />
            <circle cx={CX - 25.5} cy={g.cy + 41} r={3} fill="#fff" />
            <circle cx={CX + 25.5} cy={g.cy + 41} r={3} fill="#fff" />
          </g>
        );
      default:
        return null;
    }
  })();

  // ───── 액세서리 ─────
  const accessory = (() => {
    switch (avatar.accessory) {
      case 'ribbon': {
        const x = CX + 36;
        const y = top + 12;
        return (
          <g stroke={INK} strokeWidth={2.4} strokeLinejoin="round">
            <path d={`M${x},${y} L${x - 18},${y - 11} L${x - 18},${y + 11} Z`} fill="#ff7aa0" />
            <path d={`M${x},${y} L${x + 18},${y - 11} L${x + 18},${y + 11} Z`} fill="#ff7aa0" />
            <circle cx={x} cy={y} r={5.5} fill="#ff4f82" />
          </g>
        );
      }
      case 'flower': {
        const x = CX - 36;
        const y = top + 12;
        return (
          <g stroke={INK} strokeWidth={1.8}>
            {[0, 72, 144, 216, 288].map(a => (
              <circle key={a} cx={x + 9 * Math.cos((a * Math.PI) / 180)} cy={y + 9 * Math.sin((a * Math.PI) / 180)} r={6.4} fill="#ffb3c8" />
            ))}
            <circle cx={x} cy={y} r={5.4} fill="#ffe27a" />
          </g>
        );
      }
      case 'crown':
        return (
          <g stroke={INK} strokeWidth={2.6} strokeLinejoin="round">
            <path d={`M${CX - 24},${top + 12} L${CX - 24},${top - 12} L${CX - 12},${top} L${CX},${top - 17} L${CX + 12},${top} L${CX + 24},${top - 12} L${CX + 24},${top + 12} Z`} fill="#ffd35c" />
            <circle cx={CX} cy={top + 2} r={3.4} fill="#ff7aa0" strokeWidth={1.4} />
          </g>
        );
      case 'glasses':
        return (
          <g fill="#ffffff55" stroke={INK} strokeWidth={2.8}>
            <circle cx={ex[0]} cy={faceY} r={13} />
            <circle cx={ex[1]} cy={faceY} r={13} />
            <path d={`M${ex[0] + 13},${faceY} L${ex[1] - 13},${faceY}`} fill="none" />
          </g>
        );
      case 'scarf': {
        const y = g.cy + g.ry * 0.46;
        return (
          <g>
            <g clipPath={`url(#${clipId})`}>
              <rect x={0} y={y} width={240} height={15} fill={outfitColor} />
              <rect x={0} y={y + 5} width={240} height={4} fill="#ffffff66" />
            </g>
            <rect x={CX + 14} y={y + 6} width={15} height={32} rx={5} fill={outfitColor} stroke={INK} strokeWidth={2.6} />
          </g>
        );
      }
      default:
        return null;
    }
  })();

  // ───── 컨디션 효과 ─────
  const sparkle = (x: number, y: number, r: number) => (
    <path key={`${x}-${y}`} d={`M${x},${y - r} Q${x},${y} ${x + r},${y} Q${x},${y} ${x},${y + r} Q${x},${y} ${x - r},${y} Q${x},${y} ${x},${y - r} Z`} fill="#ffd35c" stroke="#e8b830" strokeWidth={1} />
  );

  return (
    <svg
      viewBox="0 0 240 250"
      width={size}
      height={(size * 250) / 240}
      role="img"
      aria-label={`${avatar.name || '내 쌍둥이'} 캐릭터`}
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <ellipse cx={CX} cy={g.cy} rx={g.rx} ry={g.ry} />
        </clipPath>
      </defs>

      {withBackground && <rect width={240} height={250} rx={28} fill={bg} />}

      {/* 바닥 그림자 */}
      <ellipse cx={CX} cy={bottom + 9} rx={g.rx * 0.78} ry={7} fill="#00000014" />

      {/* 귀 */}
      {ears}

      {/* 팔·발 */}
      {[-1, 1].map(s => (
        <g key={s}>
          <ellipse cx={CX + s * (g.rx - 2)} cy={g.cy + 16} rx={11} ry={15} transform={`rotate(${s * -18} ${CX + s * (g.rx - 2)} ${g.cy + 16})`} fill={bodyColor} stroke={INK} strokeWidth={3} />
          <ellipse cx={CX + s * 30} cy={bottom - 1} rx={17} ry={11} fill={bodyColor} stroke={INK} strokeWidth={3} />
        </g>
      ))}

      {/* 몸 */}
      <ellipse cx={CX} cy={g.cy} rx={g.rx} ry={g.ry} fill={bodyColor} />
      {outfit && <g clipPath={`url(#${clipId})`}>{outfit}</g>}
      <ellipse cx={CX} cy={g.cy} rx={g.rx} ry={g.ry} fill="none" stroke={INK} strokeWidth={3} />

      {/* 얼굴 */}
      {blushColor && (
        <g fill={blushColor} opacity={0.78}>
          <ellipse cx={CX - g.blushX} cy={faceY + 12} rx={9.5} ry={5.5} />
          <ellipse cx={CX + g.blushX} cy={faceY + 12} rx={9.5} ry={5.5} />
        </g>
      )}
      {mood === 'tired' && (
        <g fill="none" stroke="#a58a9a" strokeWidth={2} strokeLinecap="round" opacity={0.7}>
          <path d={`M${ex[0] - 7},${faceY + 9} Q${ex[0]},${faceY + 13} ${ex[0] + 7},${faceY + 9}`} />
          <path d={`M${ex[1] - 7},${faceY + 9} Q${ex[1]},${faceY + 13} ${ex[1] + 7},${faceY + 9}`} />
        </g>
      )}
      {avatar.eyes === 'wink' && mood === 'normal' ? (
        <>
          {eye(ex[0], 'dot')}
          {eye(ex[1], 'happy')}
        </>
      ) : (
        ex.map(x => eye(x, eyes))
      )}
      {mouthEl}

      {accessory}

      {mood === 'happy' && (
        <g>
          {sparkle(CX + g.rx * 0.92, top + 14, 9)}
          {sparkle(CX - g.rx * 0.98, top + 38, 6)}
        </g>
      )}
      {mood === 'tired' && (
        <path
          d={`M${CX + g.rx * 0.72},${top + 30} Q${CX + g.rx * 0.72 + 7},${top + 42} ${CX + g.rx * 0.72},${top + 48} Q${CX + g.rx * 0.72 - 7},${top + 42} ${CX + g.rx * 0.72},${top + 30} Z`}
          fill="#8ec8ff"
          stroke="#5aa5e8"
          strokeWidth={1.6}
        />
      )}
    </svg>
  );
}
