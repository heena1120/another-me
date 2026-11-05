// 5년 뒤 시뮬레이션과 4대 패턴 점수 (순수 함수: 화면 없이 검증할 수 있습니다)
// 주의: 이 값들은 "쌍둥이 신경망 + 내 실제 달성률"로 계산한 시뮬레이션이며, 미래를 맞히는 예언이 아닙니다.
import { mulberry32, predict, type Raw, type TwinModel } from './twin-model';
import { generatePlan, improvedHabits, type Checkin, type PlanItem, type Profile } from './twin-data';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ───────── 4대 패턴 점수 ─────────
export const GROUPS = {
  sleep: { label: '수면', keys: ['sleepHours', 'bedtimeVar', 'screenBeforeBed'] },
  move: { label: '활동', keys: ['steps', 'exerciseMin', 'outdoorMin', 'sedentaryJob'] },
  energy: { label: '에너지', keys: ['caffeineCups', 'caffeineLate', 'waterCups', 'mealsRegular'] },
  digital: { label: '디지털', keys: ['shortformMin'] },
} as const satisfies Record<string, { label: string; keys: readonly (keyof Raw)[] }>;

export type GroupId = keyof typeof GROUPS;

// 모두 이상적인 습관 / 모두 나쁜 습관 (영역 하나의 효과만 분리해서 보기 위한 기준점)
export const REF_BEST: Raw = {
  sleepHours: 7.8, bedtimeVar: 10, steps: 9000, exerciseMin: 45, caffeineCups: 1, caffeineLate: 0,
  waterCups: 8, mealsRegular: 1, shortformMin: 20, screenBeforeBed: 0, outdoorMin: 60, sedentaryJob: 0,
};
export const REF_WORST: Raw = {
  sleepHours: 4.5, bedtimeVar: 150, steps: 1500, exerciseMin: 0, caffeineCups: 5, caffeineLate: 1,
  waterCups: 1, mealsRegular: 0, shortformMin: 240, screenBeforeBed: 1, outdoorMin: 0, sedentaryJob: 1,
};

const only = (r: Raw, keys: readonly (keyof Raw)[]) => Object.fromEntries(keys.map(k => [k, r[k]])) as Partial<Raw>;

/** 한 영역이 "최상 대비 몇 %"인지(0~100). 다른 영역은 이상적인 상태로 두고 이 영역만 내 습관/최악으로 바꿔서 비교합니다. */
export function groupScore(model: TwinModel, user: Raw, g: GroupId): number {
  const keys = GROUPS[g].keys;
  const best = predict(model, REF_BEST);
  const worst = predict(model, { ...REF_BEST, ...only(REF_WORST, keys) });
  const mine = predict(model, { ...REF_BEST, ...only(user, keys) });
  return clamp(((mine - worst) / Math.max(best - worst, 1e-6)) * 100, 0, 100);
}

export const groupScores = (model: TwinModel, user: Raw) =>
  (Object.keys(GROUPS) as GroupId[]).map(g => ({ id: g, label: GROUPS[g].label, score: groupScore(model, user, g) }));

// ───────── 5년 시뮬레이션 ─────────
const todayish = (today: string, back: number) => {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - back);
  return d.toLocaleDateString('sv-SE');
};

/**
 * 최근 `days`일 동안의 퀘스트 달성률(0~1). 기록이 없으면 null.
 * 오늘은 하나라도 달성했을 때부터 반영합니다. (하루가 막 시작해 0%인 상태가 평균을 깎지 않게)
 */
export function completionRate(plans: Record<string, PlanItem[]>, today: string, days = 14): number | null {
  const ratios: number[] = [];
  for (let i = 0; i < days; i++) {
    const items = plans[todayish(today, i)];
    if (!items || items.length === 0) continue;
    const r = items.filter(x => x.done).length / items.length;
    if (i === 0 && r === 0) continue;
    ratios.push(r);
  }
  return ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
}

/** 쌍둥이가 미리 맞힌 값과 실제의 차이(RMSE). 기록이 5일 미만이면 null. */
export function residualStd(checkins: Checkin[]): number | null {
  const rows = checkins.filter(c => c.predicted !== null);
  if (rows.length < 5) return null;
  const mse = rows.reduce((s, c) => s + ((c.predicted as number) - c.actual) ** 2, 0) / rows.length;
  return clamp(Math.sqrt(mse), 4, 18);
}

const lerpRaw = (a: Raw, b: Raw, t: number): Raw => Object.fromEntries((Object.keys(a) as (keyof Raw)[]).map(k => [k, a[k] + (b[k] - a[k]) * t])) as Raw;

export type Sim = {
  traj: { month: number; now: number; improved: number }[]; // 0~60개월
  items: PlanItem[]; // 바뀌는 습관(체크리스트)
  adherence: number; // 실제 달성률(또는 가정)
  adherenceAssumed: boolean;
  sigma: number; // 하루하루의 들쭉날쭉함(점)
  days: { now: { good: number; tough: number }; improved: { good: number; tough: number } }; // 5년(1,825일) 중
  fullScore: number; // 모든 퀘스트를 완벽히 지켰을 때의 지수
};

export const GOOD_AT = 70;
export const TOUGH_AT = 40;
const ADOPT_MONTHS = 3; // 새 습관이 몸에 붙는 데 걸리는 시간(가정)

export function simulate5y(
  model: TwinModel,
  profile: Profile,
  base: Raw,
  opts: { adherence: number | null; sigma: number | null; /** 오늘 실제로 정해진 미션이 있으면 그걸로 계산 */ items?: PlanItem[] | null; accept?: Record<string, number> },
): Sim {
  const items = opts.items && opts.items.length > 0 ? opts.items : generatePlan(model, profile, base, 4, opts.accept);
  const full = improvedHabits(profile, base, items.map(i => i.id));
  const adherenceAssumed = opts.adherence === null;
  const adherence = clamp(opts.adherence ?? 0.6, 0.15, 1);
  const sigma = opts.sigma ?? 9;
  const nowScore = predict(model, base);
  const adopt = (m: number) => 1 - Math.exp(-m / ADOPT_MONTHS);
  const traj = Array.from({ length: 61 }, (_, month) => ({
    month,
    now: nowScore,
    improved: predict(model, lerpRaw(base, full, adherence * adopt(month))),
  }));

  // 하루하루의 들쭉날쭉함까지 반영해 5년(1,825일) 동안 컨디션 좋은 날/힘든 날을 셉니다. (두 시나리오가 같은 난수를 써서 공정하게 비교)
  const rnd = mulberry32(42);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const days = { now: { good: 0, tough: 0 }, improved: { good: 0, tough: 0 } };
  for (let d = 0; d < 1825; d++) {
    const z = gauss() * sigma;
    const m = Math.min(60, Math.floor(d / 30.4));
    for (const k of ['now', 'improved'] as const) {
      const s = clamp(traj[m][k] + z, 0, 100);
      if (s >= GOOD_AT) days[k].good++;
      if (s <= TOUGH_AT) days[k].tough++;
    }
  }
  return { traj, items, adherence, adherenceAssumed, sigma, days, fullScore: predict(model, full) };
}

/** 컨디션 지수 → 캐릭터의 생기(0~1). 30점 이하면 0, 80점 이상이면 1 */
export const vitalityOf = (score: number) => clamp((score - 30) / 50, 0, 1);

export const moodForVitality = (v: number): 'tired' | 'normal' | 'happy' => (v < 0.3 ? 'tired' : v > 0.75 ? 'happy' : 'normal');

// ───────── 레벨 = 지금 내 패턴이 "완벽한 나"에 얼마나 가까운가 ─────────
export const LEVEL_NAMES = ['잠든 씨앗', '깨어난 새싹', '튼튼 새싹', '꼬물꼬물', '반짝 쌍둥이', '든든 쌍둥이', '빛나는 쌍둥이', '슈퍼 쌍둥이', '전설 쌍둥이', '완벽한 나'] as const;

export type IdealRange = { worst: number; best: number };

/** 모델이 보기에 가장 나쁜 습관/가장 좋은 습관의 지수. 내 점수가 이 사이 어디쯤인지로 "완벽한 나"에 대한 근접도를 계산합니다. */
export const idealRange = (model: TwinModel): IdealRange => ({ worst: predict(model, REF_WORST), best: predict(model, REF_BEST) });

/** 0~1: 완벽한 나에 얼마나 가까운가 */
export const closenessOf = (score: number, r: IdealRange) => clamp((score - r.worst) / Math.max(r.best - r.worst, 1e-6), 0, 1);

export type LevelInfo = { level: number; name: string; closeness: number; /** 현재 레벨 구간에서 다음 레벨까지 얼마나 왔는지(0~1) */ progress: number; nextAtScore: number | null; toNext: number | null };

/** 레벨 10(완벽한 나)은 근접도 95% 이상. 그 아래는 같은 간격으로 9단계로 나눕니다. */
const LEVEL_STEP = 0.95 / 9;
export function levelOfScore(score: number, r: IdealRange): LevelInfo {
  const closeness = closenessOf(score, r);
  const level = Math.min(10, 1 + Math.floor(closeness / LEVEL_STEP + 1e-9));
  const nextAtScore = level < 10 ? r.worst + level * LEVEL_STEP * (r.best - r.worst) : null;
  const progress = level >= 10 ? 1 : clamp(closeness / LEVEL_STEP - (level - 1), 0, 1);
  return { level, name: LEVEL_NAMES[level - 1], closeness, progress, nextAtScore, toNext: nextAtScore === null ? null : Math.max(0, nextAtScore - score) };
}

/** 다음 레벨에 도달하려면 아직 안 한 미션 중 무엇을(효과 큰 순서로) 하면 되는지. 다 해도 모자라면 null. */
export function levelUpPath(model: TwinModel, profile: Profile, base: Raw, plan: PlanItem[], target: number): string[] | null {
  const done = plan.filter(i => i.done).map(i => i.id);
  const rest = plan.filter(i => !i.done).sort((a, b) => b.gain - a.gain);
  for (let k = 1; k <= rest.length; k++) {
    const ids = rest.slice(0, k).map(i => i.id);
    if (predict(model, improvedHabits(profile, base, [...done, ...ids])) >= target) return ids;
  }
  return null;
}

// ───────── 미션 수용 학습(밴딧): 내가 실제로 지키는 미션을 배웁니다 ─────────
export type MissionStat = { done: number; total: number };

/** 미션 종류별로 지난 날들에 몇 번 제안되고 몇 번 지켰는지. 오늘은 아직 진행 중이라 제외합니다. */
export function missionStats(plans: Record<string, PlanItem[]>, today: string): Record<string, MissionStat> {
  const out: Record<string, MissionStat> = {};
  for (const [date, items] of Object.entries(plans)) {
    if (date === today) continue;
    for (const it of items) {
      const s = (out[it.id] ??= { done: 0, total: 0 });
      s.total++;
      if (it.done) s.done++;
    }
  }
  return out;
}

/** 베타(1,1) 사전분포로 부드럽게 한 "지킬 확률". 기록이 없으면 0.5. */
export const acceptProbs = (stats: Record<string, MissionStat>): Record<string, number> =>
  Object.fromEntries(Object.entries(stats).map(([id, s]) => [id, (s.done + 1) / (s.total + 2)]));
