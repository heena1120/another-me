// 행동 기반 성장: 경험치(XP)·레벨·보상. 모두 일반 프로그램 로직이고 AI가 하는 일이 아닙니다.
// XP는 따로 저장하지 않고 "완료한 퀘스트 기록"에서 매번 계산합니다.
//  → 로그인하거나 버튼만 눌러서는 오르지 않고, 완료를 취소하면 XP도 함께 사라지며, 레벨·그림자·공간이 어긋날 수 없습니다.
import { UNLOCK, ACCESSORIES, EARS, HAIRS, OUTFITS, POSES, type RewardKind } from './avatar';
import type { PlanItem } from './twin-data';
import { difficultyOf, type Difficulty } from './quest-meta';
import { LEVEL_NAMES } from './twin-sim';

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = { 쉬움: 10, 보통: 20, 도전: 35 };
/** 하루에 얻을 수 있는 XP 상한(몰아서 누르기 방지) */
export const DAILY_XP_CAP = 100;
export const MAX_LEVEL = 10;

/** 이 퀘스트를 완료했을 때 얻는 XP (난이도 + 걸리는 시간 + 그림자 도전 보너스) */
export function xpIfDone(item: PlanItem): number {
  const diff = (item.aiDifficulty as Difficulty | undefined) ?? difficultyOf(item);
  const base = XP_BY_DIFFICULTY[diff] ?? 10;
  return Math.round(base + Math.min(item.minutes ?? 0, 30) * 0.5 + (item.shadow ? 5 : 0));
}

export const xpOfItem = (item: PlanItem) => (item.done ? xpIfDone(item) : 0);

/** 하루 XP (상한 적용) */
export const dayXp = (items: PlanItem[] | undefined) => Math.min(DAILY_XP_CAP, (items ?? []).reduce((s, i) => s + xpOfItem(i), 0));

export const totalXp = (plans: Record<string, PlanItem[]>) => Object.values(plans).reduce((s, items) => s + dayXp(items), 0);

/** 레벨 L에 필요한 누적 XP: 1→0, 2→60, 3→180, 4→360, 5→600 … */
export const xpForLevel = (level: number) => 30 * level * (level - 1);

export type Growth = { level: number; name: string; xp: number; floor: number; next: number | null; into: number; need: number | null; progress: number };

export function growthOf(xp: number): Growth {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const next = level < MAX_LEVEL ? xpForLevel(level + 1) : null;
  return { level, name: LEVEL_NAMES[level - 1], xp, floor, next, into: xp - floor, need: next === null ? null : next - xp, progress: next === null ? 1 : (xp - floor) / (next - floor) };
}

/** 다음 레벨까지 필요한 XP를 채우려면 오늘 아직 안 한 퀘스트 중 무엇을 하면 되는지(XP 큰 순). 오늘 한도로 부족하면 null */
export function xpPath(items: PlanItem[], need: number): { ids: string[]; gain: number } | null {
  const room = DAILY_XP_CAP - dayXp(items);
  const rest = items.filter(i => !i.done).map(i => ({ id: i.id, xp: xpIfDone(i) })).sort((a, b) => b.xp - a.xp);
  const ids: string[] = [];
  let gain = 0;
  for (const r of rest) {
    ids.push(r.id);
    gain += r.xp;
    if (gain >= need) return gain <= room || room >= need ? { ids, gain } : null;
  }
  return null;
}

// ───────── 보상: 레벨이 오르면 새로 열리는 것 ─────────
const LABELS: Record<RewardKind, readonly { id: string; label: string }[]> = { accessory: ACCESSORIES, outfit: OUTFITS, hair: HAIRS, ears: EARS, pose: POSES };
const KIND_NAME: Record<RewardKind, string> = { accessory: '액세서리', outfit: '옷', hair: '헤어', ears: '귀', pose: '포즈' };

export type Reward = { kind: RewardKind; id: string; text: string };

/** 정확히 이 레벨에서 새로 열리는 보상 */
export function rewardsAt(level: number): Reward[] {
  if (level <= 1) return [];
  const out: Reward[] = [];
  for (const kind of Object.keys(UNLOCK) as RewardKind[])
    for (const [id, lv] of Object.entries(UNLOCK[kind])) if (lv === level) out.push({ kind, id, text: `${KIND_NAME[kind]} · ${LABELS[kind].find(o => o.id === id)?.label ?? id}` });
  return out;
}

/** 지금까지 열린 보상 전체 (레벨 1에서 기본으로 열려 있는 것은 제외) */
export function unlockedRewards(level: number): Reward[] {
  const out: Reward[] = [];
  for (let l = 2; l <= level; l++) out.push(...rewardsAt(l));
  return out;
}

/** 다음에 열리는 보상 */
export function nextReward(level: number): { level: number; rewards: Reward[] } | null {
  for (let l = level + 1; l <= MAX_LEVEL; l++) {
    const r = rewardsAt(l);
    if (r.length) return { level: l, rewards: r };
  }
  return null;
}

