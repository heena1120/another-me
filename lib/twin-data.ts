// 인터뷰 → 프로필 → 기준 습관 → what-if → 오늘의 체크리스트 → 점수·레벨
// 모두 순수 함수라서 화면 없이도 동작을 검증할 수 있습니다.
import { predict, type Raw, type TwinModel } from './twin-model';

// ───────── 프로필(인터뷰 결과) ─────────
export type Profile = {
  job: 'sitting' | 'moving' | 'student' | 'irregular';
  walk?: 'long' | 'mid' | 'short' | 'none';
  sleep: 'regular' | 'night' | 'irregular' | 'short';
  sleepWhy?: 'work' | 'screen' | 'worry' | 'other';
  caffeine: 'none' | 'one' | 'few' | 'many';
  shortform: 'rare' | 'light' | 'heavy' | 'extreme';
  budget: '10' | '20' | '40' | '60';
  pref?: 'home' | 'gym' | 'outdoor' | 'none';
  goal: 'stamina' | 'sleep' | 'focus' | 'mood';
};

export type Answers = Partial<Record<keyof Profile, string>>;

export type Question = {
  id: keyof Profile;
  text: string;
  hint?: string;
  options: { id: string; label: string }[];
  /** 앞의 답변에 따라 이 질문을 물을지 결정합니다. (맞춤 인터뷰의 분기) */
  when?: (a: Answers) => boolean;
};

const sedentary = (a: Answers) => a.job === 'sitting' || a.job === 'student';

export const QUESTIONS: Question[] = [
  {
    id: 'job',
    text: '하루 대부분을 어떻게 보내나요?',
    options: [
      { id: 'sitting', label: '하루 종일 앉아서 일해요' },
      { id: 'student', label: '학생이라 수업·공부가 대부분이에요' },
      { id: 'moving', label: '서 있거나 많이 움직여요' },
      { id: 'irregular', label: '일정이 들쭉날쭉해요 (교대·프리랜서)' },
    ],
  },
  {
    id: 'walk',
    text: '하루에 30분 이상 걸을 수 있나요?',
    hint: '앉아 있는 시간이 길다고 하셨어요.',
    when: sedentary,
    options: [
      { id: 'long', label: '네, 30분 이상 괜찮아요' },
      { id: 'mid', label: '10~20분 정도는 가능해요' },
      { id: 'short', label: '틈틈이 5분씩만 가능해요' },
      { id: 'none', label: '걷는 게 힘들어요' },
    ],
  },
  {
    id: 'sleep',
    text: '요즘 잠은 어떤가요?',
    options: [
      { id: 'regular', label: '비교적 규칙적이에요' },
      { id: 'night', label: '늦게 자고 늦게 일어나요' },
      { id: 'irregular', label: '자는 시간이 매일 달라요' },
      { id: 'short', label: '늘 잠이 부족해요' },
    ],
  },
  {
    id: 'sleepWhy',
    text: '늦게 자게 되는 가장 큰 이유는 뭐예요?',
    when: a => a.sleep !== undefined && a.sleep !== 'regular',
    options: [
      { id: 'work', label: '일·공부가 늦게 끝나요' },
      { id: 'screen', label: '폰·영상을 보다가 늦어져요' },
      { id: 'worry', label: '생각이 많아 잠이 안 와요' },
      { id: 'other', label: '그냥 습관이에요' },
    ],
  },
  {
    id: 'caffeine',
    text: '카페인(커피·에너지드링크)은 하루에 얼마나 마셔요?',
    options: [
      { id: 'none', label: '거의 안 마셔요' },
      { id: 'one', label: '1잔 정도' },
      { id: 'few', label: '2~3잔' },
      { id: 'many', label: '4잔 이상' },
    ],
  },
  {
    id: 'shortform',
    text: '숏폼(릴스·틱톡·쇼츠)은 하루 얼마나 봐요?',
    options: [
      { id: 'rare', label: '거의 안 봐요' },
      { id: 'light', label: '30분 안팎' },
      { id: 'heavy', label: '1~2시간' },
      { id: 'extreme', label: '3시간 이상' },
    ],
  },
  {
    id: 'budget',
    text: '건강을 위해 하루에 낼 수 있는 시간은요?',
    hint: '체크리스트가 이 시간 안에 끝나도록 만들어요.',
    options: [
      { id: '10', label: '10분이면 충분해요' },
      { id: '20', label: '20분 정도' },
      { id: '40', label: '40분 정도' },
      { id: '60', label: '1시간 이상' },
    ],
  },
  {
    id: 'pref',
    text: '어디서 움직이는 게 제일 편해요?',
    when: a => a.budget !== '10',
    options: [
      { id: 'home', label: '집에서 편하게' },
      { id: 'gym', label: '헬스장·운동 시설' },
      { id: 'outdoor', label: '밖에서 (산책·러닝)' },
      { id: 'none', label: '움직이는 건 별로예요' },
    ],
  },
  {
    id: 'goal',
    text: '가장 바꾸고 싶은 건 뭐예요?',
    options: [
      { id: 'stamina', label: '체력' },
      { id: 'sleep', label: '수면' },
      { id: 'focus', label: '집중력' },
      { id: 'mood', label: '기분·스트레스' },
    ],
  },
];

/** 지금까지의 답변으로 다음에 물을 질문을 고릅니다. 더 없으면 null. */
export function nextQuestion(a: Answers): Question | null {
  return QUESTIONS.find(q => a[q.id] === undefined && (!q.when || q.when(a))) ?? null;
}

/** 분기 때문에 건너뛴 질문을 정리해서 프로필로 확정합니다. */
export function toProfile(a: Answers): Profile | null {
  if (nextQuestion(a)) return null;
  const p: Record<string, string> = {};
  for (const q of QUESTIONS) if (a[q.id] !== undefined && (!q.when || q.when(a))) p[q.id] = a[q.id]!;
  return p as unknown as Profile;
}

// ───────── 기준 습관(체크인이 없을 때는 인터뷰로 추정) ─────────
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function baselineFromProfile(p: Profile): Raw {
  const sleepHours = { regular: 7.3, night: 6.6, irregular: 6.2, short: 5.6 }[p.sleep];
  const bedtimeVar = { regular: 20, night: 70, irregular: 140, short: 60 }[p.sleep];
  const stepsBase = { moving: 9000, irregular: 6000, student: 5000, sitting: 3500 }[p.job];
  const steps = p.walk === 'none' ? stepsBase * 0.6 : stepsBase;
  const cups = { none: 0, one: 1, few: 2.5, many: 4.5 }[p.caffeine];
  const sf = { rare: 10, light: 30, heavy: 90, extreme: 200 }[p.shortform];
  return {
    sleepHours,
    bedtimeVar,
    steps,
    exerciseMin: p.job === 'moving' ? 15 : 0,
    caffeineCups: cups,
    caffeineLate: p.caffeine === 'few' || p.caffeine === 'many' ? 1 : 0,
    waterCups: 4,
    mealsRegular: p.job === 'irregular' || p.sleep === 'irregular' ? 0 : 1,
    shortformMin: sf,
    screenBeforeBed: p.shortform === 'heavy' || p.shortform === 'extreme' || p.sleepWhy === 'screen' ? 1 : 0,
    outdoorMin: p.job === 'moving' ? 30 : p.job === 'student' ? 20 : 15,
    sedentaryJob: p.job === 'sitting' || p.job === 'student' ? 1 : 0,
  };
}

/** 최근 기록이 있으면 그 평균을, 없으면 인터뷰 추정값을 기준 습관으로 씁니다. */
export function baseline(p: Profile, recent: Raw[]): Raw {
  if (recent.length === 0) return baselineFromProfile(p);
  const last = recent.slice(-7);
  const keys = Object.keys(last[0]) as (keyof Raw)[];
  const out = {} as Raw;
  for (const k of keys) out[k] = last.reduce((s, r) => s + r[k], 0) / last.length;
  out.sedentaryJob = baselineFromProfile(p).sedentaryJob;
  return out;
}

// ───────── 습관 레버(what-if) ─────────
type Category = 'sleep' | 'caffeine' | 'screen' | 'move' | 'body' | 'food';

type Lever = {
  id: string;
  category: Category;
  title: string;
  why: string;
  minutes: number;
  apply: (r: Raw) => Raw;
};

const GOAL_BOOST: Record<Profile['goal'], Partial<Record<Category, number>>> = {
  stamina: { move: 1.25, body: 1.1 },
  sleep: { sleep: 1.3, screen: 1.2, caffeine: 1.2 },
  focus: { caffeine: 1.15, screen: 1.15, sleep: 1.15 },
  mood: { move: 1.15, sleep: 1.1, screen: 1.1, body: 1.1 },
};

function buildLevers(p: Profile, base: Raw): Lever[] {
  const budget = Number(p.budget);
  const levers: Lever[] = [];
  const sedentaryDay = base.sedentaryJob >= 0.5;

  // 수면: 일 때문에 늦다면 줄이는 폭을 작게 제안
  const workLate = p.sleepWhy === 'work';
  levers.push({
    id: 'sleep',
    category: 'sleep',
    title: workLate ? '평소보다 30분만 일찍 눕기' : '평소보다 1시간 일찍 눕기',
    why: workLate ? '일이 늦게 끝나는 날이 많아서, 무리하지 않는 폭으로 잡았어요' : '수면이 부족한 편이라서',
    minutes: 0,
    apply: r => ({ ...r, sleepHours: Math.min(9, r.sleepHours + (workLate ? 0.5 : 1)), bedtimeVar: Math.max(0, r.bedtimeVar - 30) }),
  });

  if (base.caffeineCups > 0.5) {
    levers.push({
      id: 'caffeine',
      category: 'caffeine',
      title: '오후 3시 이후엔 카페인 쉬기',
      why: base.caffeineLate >= 0.5 ? '오후에도 카페인을 마시는 편이라서' : `하루 ${Math.round(base.caffeineCups)}잔 마시는 편이라서`,
      minutes: 0,
      apply: r => ({ ...r, caffeineLate: 0, caffeineCups: Math.max(0, r.caffeineCups - 1) }),
    });
  }

  if (base.screenBeforeBed >= 0.5) {
    levers.push({
      id: 'screen',
      category: 'screen',
      title: '자기 30분 전엔 폰 내려놓기',
      why: p.sleepWhy === 'screen' ? '폰을 보다가 늦게 자는 편이라서' : '자기 전에 화면을 보는 편이라서',
      minutes: 0,
      apply: r => ({ ...r, screenBeforeBed: 0, shortformMin: Math.max(0, r.shortformMin - 20) }),
    });
  }

  if (base.shortformMin >= 50) {
    levers.push({
      id: 'shortform',
      category: 'screen',
      title: '숏폼은 30분만 보기',
      why: `하루 ${Math.round(base.shortformMin / 10) * 10}분쯤 보는 편이라서`,
      minutes: 0,
      apply: r => ({ ...r, shortformMin: Math.max(0, r.shortformMin - 30) }),
    });
  }

  // 걷기: 인터뷰에서 답한 가능 범위에 맞춰 크기를 정함
  const walkPlan = sedentaryDay
    ? { long: { m: Math.min(30, budget), t: '점심 후 {m}분 걷기' }, mid: { m: Math.min(15, budget), t: '점심 후 {m}분 걷기' }, short: { m: 5, t: '틈틈이 5분씩 걷기 (3번)' }, none: null }[p.walk ?? 'mid']
    : { m: Math.min(20, budget), t: '저녁에 {m}분 가볍게 걷기' };
  if (walkPlan) {
    const m = walkPlan.m;
    const gain = p.walk === 'short' ? 1500 : m * 110;
    levers.push({
      id: 'walk',
      category: 'move',
      title: walkPlan.t.replace('{m}', String(m)),
      why: sedentaryDay ? '하루 종일 앉아 있는 날이 많아서' : '활동량을 조금만 더 채우면 좋아서',
      minutes: p.walk === 'short' ? 5 : m,
      apply: r => ({ ...r, steps: r.steps + gain }),
    });
  }

  if (sedentaryDay) {
    levers.push({
      id: 'stretch',
      category: 'move',
      title: '1시간마다 일어나 1분 스트레칭',
      why: '오래 앉아 있는 걸 끊어 주려고',
      minutes: 3,
      apply: r => ({ ...r, steps: r.steps + 700, sedentaryJob: 0.6 }),
    });
  }

  if (p.pref && p.pref !== 'none' && budget >= 20 && !(p.walk === 'none' && p.pref !== 'home')) {
    const m = Math.min(40, budget);
    const where = { home: '집에서 스트레칭·홈트', gym: '헬스장에서 운동', outdoor: '밖에서 가볍게 러닝·산책' }[p.pref];
    levers.push({
      id: 'exercise',
      category: 'body',
      title: `${where} ${m}분`,
      why: '좋아하는 장소에서 하면 이어가기 쉬워서',
      minutes: m,
      apply: r => ({ ...r, exerciseMin: Math.max(r.exerciseMin, m) }),
    });
  }

  if (base.waterCups < 7) {
    levers.push({
      id: 'water',
      category: 'food',
      title: '물 2컵 더 마시기',
      why: `물을 하루 ${Math.round(base.waterCups)}컵쯤 마시는 편이라서`,
      minutes: 0,
      apply: r => ({ ...r, waterCups: Math.min(9, r.waterCups + 2) }),
    });
  }

  if (base.mealsRegular < 0.7) {
    levers.push({
      id: 'meals',
      category: 'food',
      title: '식사 시간을 비슷하게 맞추기',
      why: '식사 시간이 들쭉날쭉한 편이라서',
      minutes: 0,
      apply: r => ({ ...r, mealsRegular: 1 }),
    });
  }

  if (base.outdoorMin < 40) {
    const m = Math.min(20, Math.max(10, budget));
    levers.push({
      id: 'outdoor',
      category: 'body',
      title: `햇볕 쬐며 ${m}분 바깥 시간`,
      why: '밖에서 보내는 시간이 짧은 편이라서',
      minutes: m,
      apply: r => ({ ...r, outdoorMin: r.outdoorMin + m }),
    });
  }
  return levers;
}

// ───────── 오늘의 체크리스트 ─────────
export type PlanItem = {
  id: string;
  title: string;
  reason: string;
  points: number;
  gain: number; // 쌍둥이 모델이 예상한 컨디션 상승(점)
  done: boolean;
};

export type WhatIf = { id: string; title: string; gain: number };

/** 모든 레버의 예상 효과를 계산해 큰 순서로 돌려줍니다. */
/** accept: 미션별로 내가 실제로 지킬 확률(0~1). 없으면 0.5 = 효과만으로 정렬합니다. */
export function whatIfRanking(model: TwinModel, p: Profile, base: Raw, accept: Record<string, number> = {}): { ranking: (WhatIf & { weighted: number; minutes: number; why: string; accept: number })[]; baseScore: number } {
  const baseScore = predict(model, base);
  const boost = GOAL_BOOST[p.goal];
  const ranking = buildLevers(p, base)
    .map(l => {
      const gain = predict(model, l.apply(base)) - baseScore;
      // 기대 효과 = 예측 효과 × 목표 가중치 × (0.5 + 내가 지킬 확률). 효과가 커도 안 지키는 미션은 뒤로 밀립니다.
      const p0 = accept[l.id] ?? 0.5;
      return { id: l.id, title: l.title, gain, weighted: gain * (boost[l.category] ?? 1) * (0.5 + p0), minutes: l.minutes, why: l.why, accept: p0 };
    })
    .sort((a, b) => b.weighted - a.weighted);
  return { ranking, baseScore };
}

/** 모델 예측이 큰 습관부터, 하루 낼 수 있는 시간 안에서 체크리스트를 만듭니다. */
export function generatePlan(model: TwinModel, p: Profile, base: Raw, maxItems = 4, accept: Record<string, number> = {}): PlanItem[] {
  const { ranking } = whatIfRanking(model, p, base, accept);
  let left = Number(p.budget);
  const items: PlanItem[] = [];
  for (const r of ranking) {
    if (items.length >= maxItems) break;
    if (r.gain < 0.8) continue;
    if (r.minutes > left) continue;
    left -= r.minutes;
    items.push({
      id: r.id,
      title: r.title,
      reason: `${r.why} · 쌍둥이 예측 컨디션 +${r.gain.toFixed(1)}점`,
      points: clamp(Math.round(r.gain * 1.6), 3, 20),
      gain: r.gain,
      done: false,
    });
  }
  return items;
}

// ───────── 점수·레벨 ─────────
export const ALL_DONE_BONUS = 10;

export const dayPoints = (items: PlanItem[] | undefined) => {
  if (!items || items.length === 0) return 0;
  const sum = items.filter(i => i.done).reduce((s, i) => s + i.points, 0);
  return sum + (items.every(i => i.done) ? ALL_DONE_BONUS : 0);
};

export const totalPoints = (plans: Record<string, PlanItem[]>) => Object.values(plans).reduce((s, items) => s + dayPoints(items), 0);

const START = (lv: number) => 25 * (lv - 1) ** 2;

export function levelOf(total: number) {
  const level = 1 + Math.floor(Math.sqrt(total / 25));
  const from = START(level);
  const to = START(level + 1);
  return { level, from, to, progress: (total - from) / (to - from) };
}

export const todayKey = (d = new Date()) => d.toLocaleDateString('sv-SE'); // yyyy-mm-dd (현지 시간)

/** 오늘(또는 어제)부터 거꾸로, 하나라도 달성한 날이 이어진 일수 */
export function streakOf(plans: Record<string, PlanItem[]>, today = new Date()): number {
  const has = (d: Date) => (plans[todayKey(d)] ?? []).some(i => i.done);
  const d = new Date(today);
  if (!has(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (has(d)) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ───────── 체크인 ─────────
export type Checkin = { date: string; raw: Raw; actual: number; predicted: number | null };

export const moodOf = (actual: number | undefined): 'normal' | 'happy' | 'tired' =>
  actual === undefined ? 'normal' : actual >= 70 ? 'happy' : actual <= 40 ? 'tired' : 'normal';

/** 쌍둥이가 "미리" 예측했던 값과 실제의 평균 차이(점). 기록 전에 한 예측이라 학습에 쓰인 적이 없습니다. */
export function predictionError(checkins: Checkin[]): { mae: number; n: number } | null {
  const rows = checkins.filter(c => c.predicted !== null).slice(-7);
  if (rows.length === 0) return null;
  return { mae: rows.reduce((s, c) => s + Math.abs((c.predicted as number) - c.actual), 0) / rows.length, n: rows.length };
}

// ───────── 미래 쌍둥이: 체크리스트를 지켰을 때의 습관 ─────────
/** 체크리스트 항목(레버 id)을 모두 지켰다고 가정했을 때의 습관 */
export function improvedHabits(p: Profile, base: Raw, itemIds: string[]): Raw {
  let r = base;
  for (const l of buildLevers(p, base)) if (itemIds.includes(l.id)) r = l.apply(r);
  return r;
}

// ───────── 필터버블 탈출 ─────────
export const CATEGORIES = [
  { id: 'music', label: '음악' },
  { id: 'video', label: '영상·숏폼' },
  { id: 'read', label: '책·글' },
  { id: 'food', label: '음식' },
  { id: 'place', label: '장소·산책' },
  { id: 'move', label: '몸 움직이기' },
  { id: 'people', label: '사람·대화' },
  { id: 'make', label: '만들기·취미' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export type Challenge = { id: string; category: CategoryId; title: string; minutes: number };

export const CHALLENGES: Challenge[] = [
  { id: 'music-1', category: 'music', title: '평소 안 듣던 나라의 노래 한 곡 끝까지 듣기', minutes: 5 },
  { id: 'music-2', category: 'music', title: '장르 하나를 골라 그 장르 대표곡 3곡 들어보기', minutes: 10 },
  { id: 'music-3', category: 'music', title: '가사 없는 음악(연주곡)을 틀어놓고 10분 보내기', minutes: 10 },
  { id: 'music-4', category: 'music', title: '부모님·친구가 좋아하는 노래를 물어보고 들어보기', minutes: 10 },
  { id: 'video-1', category: 'video', title: '알고리즘이 추천하지 않는 분야의 영상 하나 직접 검색해서 보기', minutes: 10 },
  { id: 'video-2', category: 'video', title: '숏폼 대신 10분짜리 다큐·강의 영상 하나 보기', minutes: 10 },
  { id: 'video-3', category: 'video', title: '자막 없이 외국어 영상 1분 보고 무슨 내용일지 상상하기', minutes: 5 },
  { id: 'video-4', category: 'video', title: '내 피드와 반대되는 취향의 채널 하나 구경하기', minutes: 10 },
  { id: 'read-1', category: 'read', title: '평소 안 읽는 분야 글(과학·역사·시 등) 한 편 읽기', minutes: 10 },
  { id: 'read-2', category: 'read', title: '서점·도서관 아무 칸에서 제목만 보고 한 권 펼쳐보기', minutes: 15 },
  { id: 'read-3', category: 'read', title: '뉴스 대신 오래된 명문장 한 구절 찾아 읽기', minutes: 5 },
  { id: 'read-4', category: 'read', title: '짧은 글 한 편을 읽고 한 줄 감상 적어보기', minutes: 10 },
  { id: 'food-1', category: 'food', title: '안 먹어본 과일이나 간식 하나 사서 먹어보기', minutes: 10 },
  { id: 'food-2', category: 'food', title: '늘 시키던 메뉴 말고 다른 메뉴 고르기', minutes: 5 },
  { id: 'food-3', category: 'food', title: '다른 나라 음식 레시피 하나 찾아 재료 확인해보기', minutes: 10 },
  { id: 'food-4', category: 'food', title: '평소 안 마시던 차나 음료 한 잔 마셔보기', minutes: 5 },
  { id: 'place-1', category: 'place', title: '안 가본 골목이나 길로 돌아서 집에 오기', minutes: 15 },
  { id: 'place-2', category: 'place', title: '동네에서 처음 보는 가게 한 곳 구경하기', minutes: 15 },
  { id: 'place-3', category: 'place', title: '평소 앉던 자리 말고 다른 자리에서 하루 보내기', minutes: 5 },
  { id: 'place-4', category: 'place', title: '가까운 공원이나 하천길 10분 걷고 사진 한 장 찍기', minutes: 15 },
  { id: 'move-1', category: 'move', title: '안 해본 스트레칭 동영상 하나 따라 해보기', minutes: 10 },
  { id: 'move-2', category: 'move', title: '평소와 반대 손으로 양치하거나 물 마셔보기', minutes: 5 },
  { id: 'move-3', category: 'move', title: '음악 틀고 3분 동안 마음대로 춤춰보기', minutes: 5 },
  { id: 'move-4', category: 'move', title: '계단이 있으면 한 층 더 올라가 보기', minutes: 5 },
  { id: 'people-1', category: 'people', title: '연락 뜸했던 친구에게 안부 한 줄 보내기', minutes: 5 },
  { id: 'people-2', category: 'people', title: '가족이나 친구에게 "요즘 빠진 것"을 물어보기', minutes: 10 },
  { id: 'people-3', category: 'people', title: '고마웠던 사람에게 구체적으로 이유 적어 고마움 전하기', minutes: 10 },
  { id: 'people-4', category: 'people', title: '평소 안 쓰는 이모티콘 대신 내 말로 답장해보기', minutes: 5 },
  { id: 'make-1', category: 'make', title: '메모장에 오늘의 장면 하나를 세 문장으로 그려보기', minutes: 10 },
  { id: 'make-2', category: 'make', title: '주변 물건 하나를 종이에 30초 동안 그려보기', minutes: 5 },
  { id: 'make-3', category: 'make', title: '재료가 있는 대로 간단한 요리나 음료 만들어보기', minutes: 15 },
  { id: 'make-4', category: 'make', title: '사진 앱으로 평소 안 찍던 것(그림자, 하늘 등) 3장 찍기', minutes: 10 },
];

export type ExploreEntry = { id: string; done: boolean };
export type ExploreLog = Record<string, ExploreEntry>;

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** 오늘의 도전: 자주 하는 영역은 피하고, 이미 해낸 도전은 빼서, 날짜마다 고정된 하나를 고릅니다. */
export function pickChallenge(usual: string[], log: ExploreLog, date: string): Challenge {
  const done = new Set(Object.values(log).filter(e => e.done).map(e => e.id));
  const fresh = CHALLENGES.filter(c => !done.has(c.id));
  const pool0 = fresh.length > 0 ? fresh : CHALLENGES;
  const away = pool0.filter(c => !usual.includes(c.category));
  const pool = away.length > 0 ? away : pool0;
  return pool[hash(date) % pool.length];
}

export const EXPLORE_POINTS = 15;
export const NEW_CATEGORY_BONUS = 10;

/** 탐험 점수: 도전 하나당 15점, 처음 해보는 영역이면 보너스 10점 */
export function explorePoints(log: ExploreLog): { points: number; categories: number; done: number } {
  const seen = new Set<string>();
  let points = 0;
  let done = 0;
  for (const date of Object.keys(log).sort()) {
    const e = log[date];
    if (!e.done) continue;
    const c = CHALLENGES.find(x => x.id === e.id);
    done++;
    points += EXPLORE_POINTS;
    if (c && !seen.has(c.category)) {
      seen.add(c.category);
      points += NEW_CATEGORY_BONUS;
    }
  }
  return { points, categories: seen.size, done };
}
