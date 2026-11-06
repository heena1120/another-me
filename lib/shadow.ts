// MY SHADOW / SHADOW BATTLE: 반복해서 행동을 가로막는 패턴을 "바꿀 수 있는 그림자"로 보여 줍니다.
// 모두 일반 프로그램 로직입니다(AI가 아님). 그림자 크기는 내가 고른 답변과 실제 완료 기록에서 계산해요.
// 사람을 평가하지 않고, "작아질 수 있는 패턴"으로만 표현합니다.
import type { PlanItem, Profile, ShadowId } from './twin-data';

export type ShadowDef = {
  id: ShadowId;
  name: string;
  blurb: string;
  /** 이 그림자에 맞서는 퀘스트 종류 */
  levers: string[] | 'any';
  /** 작은 단계로 시작할 때 쓸 퀘스트 종류(우선순위) */
  starter: string[];
};

export const SHADOWS: ShadowDef[] = [
  { id: 'night', name: '들쭉날쭉 밤 그림자', blurb: '잠드는 시간이 매일 달라지는 패턴이에요.', levers: ['sleep', 'screen'], starter: ['screen', 'sleep'] },
  { id: 'phone', name: '끝없는 화면 그림자', blurb: '숏폼과 폰을 내려놓기 어려운 패턴이에요.', levers: ['shortform', 'screen'], starter: ['shortform', 'screen'] },
  { id: 'avoid', name: '움직임 미루기 그림자', blurb: '몸을 움직이기가 부담스럽게 느껴지는 패턴이에요.', levers: ['walk', 'stretch', 'exercise', 'outdoor'], starter: ['stretch', 'outdoor', 'walk'] },
  { id: 'delay', name: '나중에 그림자', blurb: '해야 할 일을 자꾸 뒤로 미루게 되는 패턴이에요.', levers: 'any', starter: ['water', 'stretch', 'meals'] },
  { id: 'plan', name: '계획만 그림자', blurb: '계획은 세우는데 실천으로 이어지기 어려운 패턴이에요.', levers: 'any', starter: ['water', 'stretch', 'meals'] },
];

export const shadowDef = (id: string) => SHADOWS.find(s => s.id === id);

const covers = (def: ShadowDef, lever: string) => def.levers === 'any' || def.levers.includes(lever);

/** 그림자 하나를 이긴 횟수: 맞서는 종류의 퀘스트를 해내면 3, 그림자에 직접 도전(배틀)한 퀘스트면 8 */
export function victoryPoints(plans: Record<string, PlanItem[]>, def: ShadowDef): number {
  let v = 0;
  for (const items of Object.values(plans))
    for (const it of items) {
      if (!it.done) continue;
      if (it.shadow === def.id) v += 8;
      else if (covers(def, it.id)) v += def.levers === 'any' ? 2 : 4;
    }
  return v;
}

/** 답변으로 정해지는 그림자의 처음 크기(0~100). 체크인이 바뀌어도 흔들리지 않도록 프로필만 씁니다. */
export function baseStrength(id: ShadowId, p: Profile, plans: Record<string, PlanItem[]>): number {
  const selfcare = { rarely: 80, sometimes: 60, half: 35, always: 10 }[p.selfcare ?? 'half'];
  switch (id) {
    case 'night':
      return { regular: 15, night: 55, irregular: 80, short: 70 }[p.sleep];
    case 'phone':
      return { rare: 10, light: 30, heavy: 70, extreme: 90 }[p.shortform];
    case 'avoid': {
      const walk = p.walk ? { long: 20, mid: 35, short: 55, none: 85 }[p.walk] : 35;
      const pref = p.pref === 'none' ? 75 : 35;
      return Math.min(100, Math.round((walk + pref) / 2) + (p.job === 'sitting' || p.job === 'student' ? 10 : 0));
    }
    case 'delay': {
      // 못 한 이유가 "귀찮았어요/깜빡했어요"로 쌓일수록 조금 커집니다. (최대 +20)
      let n = 0;
      for (const items of Object.values(plans)) for (const it of items) if (it.fail && /귀찮|깜빡/.test(it.fail.reason)) n++;
      return Math.min(100, selfcare + Math.min(20, n * 5));
    }
    case 'plan': {
      // 제안된 퀘스트 중 해낸 비율이 낮을수록 커집니다. (기록이 6개 이상일 때만)
      const all = Object.values(plans).flat();
      const low = all.length >= 6 ? Math.round((1 - all.filter(i => i.done).length / all.length) * 30) : 0;
      return Math.min(100, Math.round(selfcare * 0.8) + low);
    }
  }
}

export type ShadowState = {
  def: ShadowDef;
  base: number;
  strength: number;
  wins: number;
  /** 처음보다 얼마나 작아졌는지(0~1) */
  overcome: number;
  /** 모습: 크기에 따른 상태 이름 */
  stage: '거대함' | '커짐' | '작아지는 중' | '아주 작아짐' | '잠잠해짐';
};

export function stageOf(strength: number): ShadowState['stage'] {
  return strength >= 70 ? '거대함' : strength >= 45 ? '커짐' : strength >= 25 ? '작아지는 중' : strength >= 10 ? '아주 작아짐' : '잠잠해짐';
}

export function shadowStates(profile: Profile, plans: Record<string, PlanItem[]>): ShadowState[] {
  return SHADOWS.map(def => {
    const base = baseStrength(def.id, profile, plans);
    const wins = victoryPoints(plans, def);
    const strength = Math.max(0, Math.min(100, base - wins));
    return { def, base, strength, wins, overcome: base > 0 ? Math.min(1, Math.max(0, (base - strength) / base)) : 1, stage: stageOf(strength) };
  });
}

// ───────── 더 작은 단계(프로그램이 제안하는 작은 버전) ─────────
export const MICRO: Record<string, { title: string; minutes: number; action: string; doneWhen: string }> = {
  sleep: { title: '불 끄고 눈 감고 1분 누워 있기', minutes: 1, action: '잘 시간이 되면 불을 끄고, 1분만 눈을 감고 누워 있어요.', doneWhen: '불을 끄고 1분 누워 있었다면 완료예요.' },
  screen: { title: '폰을 침대에서 팔 길이만큼 떨어뜨려 두기', minutes: 1, action: '잠자리에 들기 전에 폰을 손이 닿지 않는 곳에 두어요.', doneWhen: '폰을 침대에서 떨어뜨려 놓았다면 완료예요.' },
  shortform: { title: '숏폼을 열기 전에 숨 한 번 고르기', minutes: 1, action: '숏폼 앱을 열기 전에 숨을 크게 한 번 쉬고, 정말 볼지 정해요.', doneWhen: '앱을 열기 전에 숨을 한 번 골랐다면 완료예요.' },
  walk: { title: '현관 밖까지만 나갔다 오기', minutes: 2, action: '신발을 신고 현관 밖까지만 나갔다 와요.', doneWhen: '집 밖으로 한 걸음이라도 나갔다 왔다면 완료예요.' },
  stretch: { title: '앉은 채로 어깨 10번 돌리기', minutes: 1, action: '앉은 자리에서 어깨를 앞뒤로 10번 돌려요.', doneWhen: '어깨를 10번 돌렸다면 완료예요.' },
  exercise: { title: '운동복으로 갈아입기만 하기', minutes: 2, action: '운동은 안 해도 돼요. 운동복으로 갈아입기만 해요.', doneWhen: '운동복으로 갈아입었다면 완료예요.' },
  outdoor: { title: '창문 열고 30초 바깥 보기', minutes: 1, action: '창문을 열고 30초 동안 바깥을 바라봐요.', doneWhen: '창문을 열고 30초 바깥을 봤다면 완료예요.' },
  caffeine: { title: '오후 커피를 반 잔으로 줄이기', minutes: 0, action: '오후에 마시는 커피 한 잔을 반 잔만 마셔요.', doneWhen: '오후 커피를 반 잔 이하로 마셨다면 완료예요.' },
  water: { title: '물 한 모금 마시기', minutes: 0, action: '지금 물을 한 모금만 마셔요.', doneWhen: '물을 한 모금 마셨다면 완료예요.' },
  meals: { title: '오늘 먹은 한 끼 시간만 적어 두기', minutes: 1, action: '오늘 먹은 한 끼의 시간을 메모해 둬요.', doneWhen: '한 끼의 시간을 적어 두었다면 완료예요.' },
};

/** 어떤 퀘스트든 작은 단계 버전으로 만듭니다. (프로그램이 정한 고정 문구, AI가 쓴 것이 아님) */
export function microVersion(item: Pick<PlanItem, 'id' | 'gain'> & Partial<PlanItem>, shadow?: ShadowId): PlanItem {
  const m = MICRO[item.id] ?? { title: '아주 작게 시작하기', minutes: 1, action: '아주 작은 한 걸음만 해요.', doneWhen: '한 걸음이라도 했다면 완료예요.' };
  return {
    id: item.id,
    title: `${m.title} (작은 단계)`,
    reason: '더 작은 단계부터 다시 시작해요. 작게라도 해내면 그림자가 줄어요.',
    points: 1,
    gain: Math.max(0.5, Math.round(item.gain * 0.3 * 10) / 10),
    done: false,
    minutes: m.minutes,
    source: 'model',
    action: m.action,
    doneWhen: m.doneWhen,
    expected: '작게라도 해내면 다음 단계가 쉬워져요.',
    aiDifficulty: '쉬움',
    micro: true,
    shadow: shadow ?? item.shadow,
  };
}

/**
 * 그림자에 도전: 오늘 계획에 맞서는 퀘스트가 있으면 그걸 그림자 도전으로 지정하고,
 * 없으면 작은 단계 퀘스트를 하나 더합니다. 이미 도전 중이면 그대로 둡니다.
 */
export function withBattle(items: PlanItem[], def: ShadowDef): { items: PlanItem[]; added: boolean } {
  if (items.some(i => i.shadow === def.id && !i.done)) return { items, added: false };
  const target = items.find(i => !i.done && !i.shadow && def.levers !== 'any' && def.levers.includes(i.id));
  if (target) return { items: items.map(i => (i === target ? { ...i, shadow: def.id } : i)), added: false };
  const lever = def.starter.find(l => !items.some(i => i.id === l && !i.done)) ?? def.starter[0];
  const base: PlanItem = { id: lever, title: '', reason: '', points: 1, gain: 2, done: false };
  return { items: [...items, microVersion(base, def.id)], added: true };
}

/** 못 한 퀘스트를 더 작은 단계로 바꿉니다. 못 한 기록은 돌려줘서 보관할 수 있게 합니다. */
export function withMicro(items: PlanItem[], id: string): { items: PlanItem[]; failed: PlanItem | null } {
  const old = items.find(i => i.id === id && !i.done);
  if (!old) return { items, failed: null };
  return { items: items.map(i => (i === old ? microVersion(old) : i)), failed: old };
}
