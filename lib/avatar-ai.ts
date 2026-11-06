// 사진 → 캐릭터 옵션 자동 설정 (서버에서만 사용, OpenAI 비전 + Structured Outputs)
import { ACCESSORIES, BACKGROUNDS, BLUSHES, BODY_COLORS, EARS, EYES, MOUTHS, OUTFITS, OUTFIT_COLORS, SHAPES, type Avatar } from './avatar';

const ids = (list: readonly { id: string }[]) => list.map(i => i.id);

const FIELDS: Record<Exclude<keyof Avatar, 'name'>, readonly { id: string }[]> = {
  body: BODY_COLORS,
  shape: SHAPES,
  ears: EARS,
  eyes: EYES,
  mouth: MOUTHS,
  blush: BLUSHES,
  accessory: ACCESSORIES,
  outfit: OUTFITS,
  outfitColor: OUTFIT_COLORS,
  bg: BACKGROUNDS,
};

const properties: Record<string, unknown> = {
  ok: { type: 'boolean', description: '사진에 사람이 보이면 true, 사람이 없거나 알아보기 어려우면 false' },
  reason: { type: 'string', description: '어떤 겉모습(안경, 머리, 옷, 표정, 배경)을 보고 골랐는지 한국어 한두 문장. 나이·성별·인종·체형·피부 상태·건강은 언급하지 않는다.' },
};
for (const [key, list] of Object.entries(FIELDS)) properties[key] = { type: 'string', enum: ids(list) };

export const PHOTO_SCHEMA = {
  name: 'avatar_from_photo',
  schema: { type: 'object', additionalProperties: false, required: ['ok', 'reason', ...Object.keys(FIELDS)], properties },
} as const;

export const PHOTO_PROMPT = `사진 속 사람의 "눈에 보이는 스타일"을 참고해서, 말랑한 동물 캐릭터의 옵션을 JSON으로 골라 주세요.

고르는 기준 (보이는 것만 사용):
- accessory: 안경을 썼으면 glasses, 리본·머리핀이면 ribbon, 꽃 장식이면 flower, 왕관·모자 느낌이면 crown, 목도리나 머플러면 scarf. 없으면 none.
- outfit / outfitColor: 입은 옷의 종류(티셔츠, 줄무늬, 멜빵)와 가장 가까운 색.
- body: 전체 분위기·머리색·옷 색에 어울리는 파스텔 몸 색.
- ears: 긴 머리는 long, 짧고 단정한 머리는 tiny, 동그란 느낌은 round, 시크하거나 날렵한 인상은 pointy.
- eyes / mouth: 표정(웃는 얼굴이면 happy·smile, 활짝 웃으면 open, 무덤덤하면 dot·flat 등).
- blush: 밝고 화사한 인상이면 pink, 따뜻한 인상이면 peach, 아니면 none.
- bg: 사진 배경 색에 가까운 것.
- shape: 머리 모양이나 전체 실루엣의 인상에서만 정하세요. 몸매·체중을 판단하지 마세요.

지켜야 할 것:
- 나이, 성별, 인종, 체형, 피부 상태, 눈 상태, 건강 상태, 신원을 추측하거나 reason에 쓰지 마세요. 건강을 진단하거나 질병을 추정하지 마세요.
- 사람이 보이지 않으면 ok를 false로 하고, 나머지는 기본 값으로 채우세요.`;

/** dataUrl: data:image/jpeg;base64,... */
export function photoMessages(dataUrl: string) {
  return [
    {
      role: 'user' as const,
      content: [
        { type: 'text', text: PHOTO_PROMPT },
        { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
      ],
    },
  ];
}

export type AvatarFromPhoto = { ok: boolean; reason: string; avatar: Partial<Avatar> };

/** AI 응답에서 허용된 값만 남깁니다. 형식이 이상하면 null. */
export function parsePhotoResult(data: unknown): AvatarFromPhoto | null {
  const input = data as Record<string, unknown> | null;
  if (!input || typeof input !== 'object') return null;
  const avatar: Record<string, string> = {};
  for (const [key, list] of Object.entries(FIELDS)) {
    const v = input[key];
    if (typeof v === 'string' && list.some(i => i.id === v)) avatar[key] = v;
  }
  const reason = typeof input.reason === 'string' ? input.reason.slice(0, 200) : '';
  return { ok: input.ok === true, reason, avatar: avatar as Partial<Avatar> };
}
