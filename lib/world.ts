// ANOTHER WORLD: 성장과 행동에 따라 변하는 나만의 공간. 일반 프로그램 로직입니다(AI가 아님).
// 공간의 크기는 레벨(XP)로, 가구는 "실제로 해낸 퀘스트 횟수"로 열려요. 그냥 장식이 아니라 행동의 기록이에요.
import type { PlanItem } from './twin-data';
import { shadowDef, victoryPoints } from './shadow';

export type Unlock =
  | { type: 'level'; level: number }
  | { type: 'quests'; levers: string[]; count: number; label: string }
  | { type: 'wins'; count: number };

export type WorldItem = {
  id: string;
  name: string;
  unlock: Unlock;
  /** 캐릭터가 이 물건 앞에서 하는 말 */
  line: string;
  /** SVG 장면 안의 위치(0~360, 0~260) */
  x: number;
  y: number;
};

export const WORLD_ITEMS: WorldItem[] = [
  { id: 'lamp', name: '은은한 조명', unlock: { type: 'quests', levers: ['sleep', 'screen'], count: 1, label: '잠자리 퀘스트(일찍 눕기·폰 내려놓기)' }, line: '조명을 낮추니까 마음이 차분해져. 일찍 눕기를 해낸 덕분이야!', x: 84, y: 150 },
  { id: 'bed', name: '포근한 침대', unlock: { type: 'quests', levers: ['sleep', 'screen'], count: 3, label: '잠자리 퀘스트(일찍 눕기·폰 내려놓기)' }, line: '잠자리 퀘스트를 3번 해냈더니 침대가 생겼어. 오늘도 푹 자자.', x: 112, y: 188 },
  { id: 'mat', name: '요가 매트', unlock: { type: 'quests', levers: ['stretch', 'exercise', 'walk'], count: 2, label: '움직임 퀘스트(스트레칭·운동·걷기)' }, line: '몸을 움직인 기록이 매트가 됐어. 한 번만 펴 볼까?', x: 238, y: 196 },
  { id: 'plant', name: '튼튼한 화분', unlock: { type: 'quests', levers: ['outdoor', 'walk', 'water'], count: 2, label: '바깥·물 퀘스트(바깥 활동·걷기·물)' }, line: '화분이 자라는 건 네가 햇볕과 물을 챙긴 덕분이야.', x: 292, y: 168 },
  { id: 'shelf', name: '식사 선반', unlock: { type: 'quests', levers: ['meals', 'water', 'caffeine'], count: 2, label: '먹고 마시는 퀘스트(식사·물·카페인)' }, line: '식사 시간을 챙긴 기록이 선반에 쌓였어.', x: 196, y: 130 },
  { id: 'rug', name: '둥근 러그', unlock: { type: 'level', level: 2 }, line: '레벨 2가 되니 방이 더 아늑해졌어.', x: 180, y: 206 },
  { id: 'desk', name: '작은 책상', unlock: { type: 'level', level: 3 }, line: '레벨 3! 여기서 오늘의 계획을 정리해 보자.', x: 150, y: 160 },
  { id: 'window', name: '큰 창문', unlock: { type: 'level', level: 4 }, line: '창문이 생겨서 바깥 햇살이 들어와.', x: 250, y: 106 },
  { id: 'friend', name: '작아진 그림자 친구', unlock: { type: 'wins', count: 3 }, line: '그림자가 많이 작아졌어. 이제는 같이 앉아 있는 친구야.', x: 52, y: 200 },
  { id: 'balcony', name: '발코니', unlock: { type: 'level', level: 7 }, line: '레벨 7! 발코니에서 바람을 쐬어 볼래?', x: 330, y: 120 },
];

export type RoomStage = { stage: 1 | 2 | 3 | 4; name: string; from: number };

/** 공간 단계: 레벨이 오르면 방이 커지고 배경이 바뀝니다. */
export function roomStage(level: number): RoomStage {
  if (level >= 9) return { stage: 4, name: '정원이 있는 집', from: 9 };
  if (level >= 6) return { stage: 3, name: '넓은 방과 발코니', from: 6 };
  if (level >= 3) return { stage: 2, name: '아늑한 방', from: 3 };
  return { stage: 1, name: '작은 방', from: 1 };
}

export const nextStageLevel = (level: number) => [3, 6, 9].find(l => l > level) ?? null;

/** 퀘스트 종류별로 해낸 횟수 */
export function doneCounts(plans: Record<string, PlanItem[]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const items of Object.values(plans)) for (const it of items) if (it.done) out[it.id] = (out[it.id] ?? 0) + 1;
  return out;
}

/** 그림자와의 싸움에서 이긴 점수 합(작아진 그림자 친구의 조건) */
export function totalWins(plans: Record<string, PlanItem[]>): number {
  const sh = ['night', 'phone', 'avoid'].map(shadowDef);
  return sh.reduce((s, d) => s + (d ? victoryPoints(plans, d) : 0), 0);
}

export type ItemState = { item: WorldItem; unlocked: boolean; progress: number; target: number; remaining: string };

export function worldState(level: number, plans: Record<string, PlanItem[]>): ItemState[] {
  const counts = doneCounts(plans);
  const wins = Object.values(plans).flat().filter(i => i.done && i.shadow).length;
  return WORLD_ITEMS.map(item => {
    const u = item.unlock;
    let progress = 0;
    let target = 1;
    let remaining = '';
    if (u.type === 'level') {
      progress = level;
      target = u.level;
      remaining = `레벨 ${u.level}이 되면 열려요`;
    } else if (u.type === 'quests') {
      progress = u.levers.reduce((s, l) => s + (counts[l] ?? 0), 0);
      target = u.count;
      remaining = `${u.label}를 ${Math.max(0, u.count - progress)}번 더 해내면 열려요`;
    } else {
      progress = wins;
      target = u.count;
      remaining = `그림자에 도전한 퀘스트를 ${Math.max(0, u.count - progress)}번 더 해내면 열려요`;
    }
    return { item, unlocked: progress >= target, progress: Math.min(progress, target), target, remaining };
  });
}
