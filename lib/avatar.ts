
// ───────── 캐릭터 옵션 (치이카와풍 말랑 캐릭터) ─────────
export const BODY_COLORS = [
  { id: 'milk', label: '우유', value: '#ffffff' },
  { id: 'cream', label: '크림', value: '#fff3d6' },
  { id: 'pink', label: '딸기', value: '#ffd9e4' },
  { id: 'sky', label: '소다', value: '#d6ecff' },
  { id: 'mint', label: '민트', value: '#d4f5e4' },
  { id: 'lemon', label: '레몬', value: '#fff0a8' },
  { id: 'lilac', label: '라일락', value: '#e6dcff' },
  { id: 'peach', label: '복숭아', value: '#ffd9c2' },
] as const;

export const SHAPES = [
  { id: 'round', label: '동글' },
  { id: 'egg', label: '길쭉' },
  { id: 'chubby', label: '통통' },
] as const;

export const EARS = [
  { id: 'round', label: '동글귀' },
  { id: 'pointy', label: '뾰족귀' },
  { id: 'long', label: '긴귀' },
  { id: 'tiny', label: '쪼꼬미' },
] as const;

export const EYES = [
  { id: 'dot', label: '콩눈' },
  { id: 'sparkle', label: '반짝' },
  { id: 'happy', label: '웃는눈' },
  { id: 'sleepy', label: '졸린눈' },
  { id: 'wink', label: '윙크' },
] as const;

export const MOUTHS = [
  { id: 'smile', label: '방긋' },
  { id: 'open', label: '아~' },
  { id: 'cat', label: '고양이' },
  { id: 'o', label: '오' },
  { id: 'flat', label: '무표정' },
] as const;

export const BLUSHES = [
  { id: 'pink', label: '분홍볼', value: '#ff9fb5' },
  { id: 'peach', label: '복숭아볼', value: '#ffb48a' },
  { id: 'none', label: '없음', value: '' },
] as const;

export const ACCESSORIES = [
  { id: 'none', label: '없음' },
  { id: 'ribbon', label: '리본' },
  { id: 'flower', label: '꽃' },
  { id: 'crown', label: '왕관' },
  { id: 'glasses', label: '안경' },
  { id: 'scarf', label: '목도리' },
] as const;

export const OUTFITS = [
  { id: 'none', label: '맨몸' },
  { id: 'tee', label: '티셔츠' },
  { id: 'stripes', label: '줄무늬' },
  { id: 'overalls', label: '멜빵' },
] as const;

export const OUTFIT_COLORS = [
  { id: 'rose', label: '로즈', value: '#ff8fa8' },
  { id: 'blue', label: '블루', value: '#7fb8ff' },
  { id: 'green', label: '그린', value: '#7ed6a8' },
  { id: 'yellow', label: '옐로', value: '#ffd35c' },
  { id: 'purple', label: '퍼플', value: '#b79cff' },
  { id: 'navy', label: '네이비', value: '#5b6a9a' },
] as const;

export const BACKGROUNDS = [
  { id: 'cloud', label: '구름', value: '#e8f3ff' },
  { id: 'sakura', label: '벚꽃', value: '#ffe6ee' },
  { id: 'mint', label: '민트', value: '#def7ec' },
  { id: 'butter', label: '버터', value: '#fff5cf' },
  { id: 'lavender', label: '라벤더', value: '#ece6ff' },
] as const;

type Id<T extends readonly { id: string }[]> = T[number]['id'];

export type Avatar = {
  name: string;
  body: Id<typeof BODY_COLORS>;
  shape: Id<typeof SHAPES>;
  ears: Id<typeof EARS>;
  eyes: Id<typeof EYES>;
  mouth: Id<typeof MOUTHS>;
  blush: Id<typeof BLUSHES>;
  accessory: Id<typeof ACCESSORIES>;
  outfit: Id<typeof OUTFITS>;
  outfitColor: Id<typeof OUTFIT_COLORS>;
  bg: Id<typeof BACKGROUNDS>;
};

export type Mood = 'normal' | 'happy' | 'tired';

export const DEFAULT_AVATAR: Avatar = {
  name: '',
  body: 'milk',
  shape: 'round',
  ears: 'round',
  eyes: 'dot',
  mouth: 'smile',
  blush: 'pink',
  accessory: 'none',
  outfit: 'none',
  outfitColor: 'rose',
  bg: 'cloud',
};

const pick = <T extends readonly { id: string }[]>(list: T): Id<T> =>
  list[Math.floor(Math.random() * list.length)].id as Id<T>;

export function randomAvatar(name = ''): Avatar {
  return {
    name,
    body: pick(BODY_COLORS),
    shape: pick(SHAPES),
    ears: pick(EARS),
    eyes: pick(EYES),
    mouth: pick(MOUTHS),
    blush: pick(BLUSHES),
    accessory: pick(ACCESSORIES),
    outfit: pick(OUTFITS),
    outfitColor: pick(OUTFIT_COLORS),
    bg: pick(BACKGROUNDS),
  };
}

// 저장된 값이 깨져 있거나 옵션이 바뀌었어도 안전하게 복원합니다.
export function sanitizeAvatar(input: unknown): Avatar | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const has = (list: readonly { id: string }[], v: unknown, fallback: string) =>
    typeof v === 'string' && list.some(i => i.id === v) ? v : fallback;
  const d = DEFAULT_AVATAR;
  return {
    name: typeof o.name === 'string' ? o.name.slice(0, 10) : '',
    body: has(BODY_COLORS, o.body, d.body) as Avatar['body'],
    shape: has(SHAPES, o.shape, d.shape) as Avatar['shape'],
    ears: has(EARS, o.ears, d.ears) as Avatar['ears'],
    eyes: has(EYES, o.eyes, d.eyes) as Avatar['eyes'],
    mouth: has(MOUTHS, o.mouth, d.mouth) as Avatar['mouth'],
    blush: has(BLUSHES, o.blush, d.blush) as Avatar['blush'],
    accessory: has(ACCESSORIES, o.accessory, d.accessory) as Avatar['accessory'],
    outfit: has(OUTFITS, o.outfit, d.outfit) as Avatar['outfit'],
    outfitColor: has(OUTFIT_COLORS, o.outfitColor, d.outfitColor) as Avatar['outfitColor'],
    bg: has(BACKGROUNDS, o.bg, d.bg) as Avatar['bg'],
  };
}

