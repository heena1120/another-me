// 쌍둥이 신경망: 작은 다층 퍼셉트론(MLP)을 브라우저에서 직접 학습합니다.
//  1) 사전학습  : 일반적인 생활습관 가설로 만든 "합성 데이터"로 먼저 학습
//  2) 미세조정  : 사전학습 신경망 위에 "내 개인 보정층"을 얹어 내 체크인 기록으로만 학습 (전이학습)
//  3) what-if  : 습관 하나를 바꿨을 때 예상 컨디션이 얼마나 바뀌는지 모델로 비교
// 외부 라이브러리 없이 순수 TypeScript로 작성했습니다.

export type Raw = {
  sleepHours: number; // 지난밤 수면 시간
  bedtimeVar: number; // 취침 시각이 평소와 다른 정도(분)
  steps: number; // 걸음 수
  exerciseMin: number; // 운동 시간(분)
  caffeineCups: number; // 카페인 음료 잔 수
  caffeineLate: number; // 오후 3시 이후 카페인 (0/1)
  waterCups: number; // 물 잔 수
  mealsRegular: number; // 식사가 규칙적이었는지 (0/1)
  shortformMin: number; // 숏폼 시청 시간(분)
  screenBeforeBed: number; // 자기 전 화면 사용 (0/1)
  outdoorMin: number; // 야외 활동(분)
  sedentaryJob: number; // 앉아서 보내는 날인지 (0/1)
};

export const FEATURE_META: { key: keyof Raw; label: string; min: number; max: number }[] = [
  { key: 'sleepHours', label: '수면 시간', min: 3, max: 11 },
  { key: 'bedtimeVar', label: '취침 시각 흔들림', min: 0, max: 180 },
  { key: 'steps', label: '걸음 수', min: 0, max: 20000 },
  { key: 'exerciseMin', label: '운동 시간', min: 0, max: 120 },
  { key: 'caffeineCups', label: '카페인', min: 0, max: 6 },
  { key: 'caffeineLate', label: '오후 카페인', min: 0, max: 1 },
  { key: 'waterCups', label: '물', min: 0, max: 10 },
  { key: 'mealsRegular', label: '규칙적 식사', min: 0, max: 1 },
  { key: 'shortformMin', label: '숏폼 시간', min: 0, max: 360 },
  { key: 'screenBeforeBed', label: '자기 전 화면', min: 0, max: 1 },
  { key: 'outdoorMin', label: '야외 활동', min: 0, max: 180 },
  { key: 'sedentaryJob', label: '앉아 있는 날', min: 0, max: 1 },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const toVector = (r: Raw): number[] => FEATURE_META.map(f => clamp((r[f.key] - f.min) / (f.max - f.min), 0, 1));

// ───────── 사전학습용 "생활습관 가설" (합성 데이터의 정답 함수) ─────────
// 실제 의학 모델이 아니라, 일반적으로 알려진 생활습관 상식을 단순하게 옮긴 가설입니다.
export function priorCondition(r: Raw): number {
  let s = 46;
  s += 22 * Math.exp(-(((r.sleepHours - 7.8) / 1.7) ** 2)) - 8;
  s -= 8 * (r.bedtimeVar / 180);
  s += 10 * (1 - Math.exp(-r.steps / 5000));
  s += 8 * Math.exp(-(((r.exerciseMin - 45) / 35) ** 2));
  s -= 3 * Math.max(0, r.caffeineCups - 2);
  s -= 5 * r.caffeineLate;
  s += 5 * (Math.min(r.waterCups, 8) / 8);
  s += 5 * r.mealsRegular;
  s -= 10 * (Math.min(r.shortformMin, 240) / 240);
  s -= 6 * r.screenBeforeBed;
  s += 6 * (Math.min(r.outdoorMin, 60) / 60);
  s -= 4 * r.sedentaryJob;
  return clamp(s, 5, 98);
}

// 재현 가능한 난수
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleRaw(rnd: () => number): Raw {
  const bern = (p: number) => (rnd() < p ? 1 : 0);
  const cups = Math.round(rnd() * rnd() * 6);
  return {
    sleepHours: clamp(6.8 + (rnd() + rnd() + rnd() - 1.5) * 3.2, 3, 11),
    bedtimeVar: rnd() < 0.5 ? rnd() * 60 : rnd() * 180,
    steps: Math.round(rnd() ** 1.4 * 16000),
    exerciseMin: rnd() < 0.45 ? 0 : Math.round(rnd() * 90),
    caffeineCups: cups,
    caffeineLate: cups > 0 ? bern(0.5) : 0,
    waterCups: Math.round(rnd() * 9),
    mealsRegular: bern(0.6),
    shortformMin: Math.round(rnd() ** 1.3 * 300),
    screenBeforeBed: bern(0.55),
    outdoorMin: rnd() < 0.3 ? 0 : Math.round(rnd() * 120),
    sedentaryJob: bern(0.55),
  };
}

export function makeSyntheticData(n: number, seed = 7) {
  const rnd = mulberry32(seed);
  const xs: number[][] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = sampleRaw(rnd);
    xs.push(toVector(r));
    ys.push(clamp(priorCondition(r) + (rnd() + rnd() - 1) * 5, 0, 100) / 100);
  }
  return { xs, ys };
}

// ───────── 신경망 ─────────
export const ARCH = [FEATURE_META.length, 24, 12, 1];

type Layer = { w: Float64Array; b: Float64Array; nIn: number; nOut: number };
export type Net = { layers: Layer[] };

export function createNet(seed = 1): Net {
  const rnd = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const layers: Layer[] = [];
  for (let l = 0; l < ARCH.length - 1; l++) {
    const nIn = ARCH[l];
    const nOut = ARCH[l + 1];
    const w = new Float64Array(nIn * nOut);
    const std = Math.sqrt(2 / nIn); // He 초기화
    for (let i = 0; i < w.length; i++) w[i] = gauss() * std;
    layers.push({ w, b: new Float64Array(nOut), nIn, nOut });
  }
  return { layers };
}

function forward(net: Net, x: ArrayLike<number>, acts?: Float64Array[]): number {
  let cur: ArrayLike<number> = x;
  if (acts) acts[0] = Float64Array.from(x as ArrayLike<number>);
  for (let l = 0; l < net.layers.length; l++) {
    const { w, b, nIn, nOut } = net.layers[l];
    const out = new Float64Array(nOut);
    const last = l === net.layers.length - 1;
    for (let o = 0; o < nOut; o++) {
      let sum = b[o];
      for (let i = 0; i < nIn; i++) sum += w[o * nIn + i] * cur[i];
      out[o] = last ? sum : sum > 0 ? sum : 0; // 마지막 층은 선형, 나머지는 ReLU
    }
    if (acts) acts[l + 1] = out;
    cur = out;
  }
  return cur[0];
}

/** 신경망 본체의 예상 컨디션 (0~100) */
export function predictNet(net: Net, raw: Raw): number {
  return clamp(forward(net, toVector(raw)) * 100, 0, 100);
}

// ───────── 개인 보정층(어댑터) ─────────
// 사전학습한 신경망은 그대로 두고, 그 위에 "나만의 보정"을 한 층 얹어 내 데이터로만 학습합니다.
// (기록이 며칠뿐일 때 신경망 전체를 다시 학습하면 과적합되기 때문입니다.)
export type Adapter = { bias: number; w: number[] };
export type TwinModel = { net: Net; adapter: Adapter };
export const emptyAdapter = (): Adapter => ({ bias: 0, w: FEATURE_META.map(() => 0) });

/** 예상 컨디션 (0~100) = 사전학습 신경망 + 내 보정층 */
export function predict(model: TwinModel, raw: Raw): number {
  const x = toVector(raw);
  let p = forward(model.net, x) * 100 + model.adapter.bias;
  for (let i = 0; i < x.length; i++) p += model.adapter.w[i] * x[i];
  return clamp(p, 0, 100);
}

export type TrainOptions = {
  epochs: number;
  lr: number;
  batch?: number;
  seed?: number;
  /** 에폭마다 호출됩니다. (화면에 학습 곡선을 그릴 때 사용) */
  onEpoch?: (epoch: number, rmse: number) => void;
};

/** 학습 후 에폭별 RMSE(점수 단위) 기록을 돌려줍니다. 화면이 멈추지 않도록 에폭마다 양보합니다. */
export async function train(net: Net, xs: number[][], ys: number[], opts: TrainOptions): Promise<number[]> {
  const { epochs, lr, batch = 64, seed = 3, onEpoch } = opts;
  const rnd = mulberry32(seed);
  const n = xs.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  const m = net.layers.map(L => ({ w: new Float64Array(L.w.length), b: new Float64Array(L.b.length) }));
  const v = net.layers.map(L => ({ w: new Float64Array(L.w.length), b: new Float64Array(L.b.length) }));
  const g = net.layers.map(L => ({ w: new Float64Array(L.w.length), b: new Float64Array(L.b.length) }));
  const [beta1, beta2, eps] = [0.9, 0.999, 1e-8];
  let step = 0;
  const history: number[] = [];

  for (let e = 0; e < epochs; e++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    let sq = 0;
    for (let s = 0; s < n; s += batch) {
      const end = Math.min(s + batch, n);
      const B = end - s;
      for (const G of g) {
        G.w.fill(0);
        G.b.fill(0);
      }
      for (let k = s; k < end; k++) {
        const acts: Float64Array[] = [];
        const pred = forward(net, xs[idx[k]], acts);
        const err = pred - ys[idx[k]];
        sq += err * err;
        let delta = Float64Array.of((2 * err) / B);
        for (let l = net.layers.length - 1; l >= 0; l--) {
          const { w, nIn, nOut } = net.layers[l];
          const a = acts[l];
          const next = new Float64Array(nIn);
          for (let o = 0; o < nOut; o++) {
            const d = delta[o];
            if (d === 0) continue;
            g[l].b[o] += d;
            for (let i = 0; i < nIn; i++) {
              g[l].w[o * nIn + i] += d * a[i];
              next[i] += d * w[o * nIn + i];
            }
          }
          if (l > 0) for (let i = 0; i < nIn; i++) if (acts[l][i] <= 0) next[i] = 0; // ReLU 미분
          delta = next;
        }
      }
      step++;
      const c1 = 1 - beta1 ** step;
      const c2 = 1 - beta2 ** step;
      for (let l = 0; l < net.layers.length; l++) {
        const L = net.layers[l];
        for (let i = 0; i < L.w.length; i++) {
          m[l].w[i] = beta1 * m[l].w[i] + (1 - beta1) * g[l].w[i];
          v[l].w[i] = beta2 * v[l].w[i] + (1 - beta2) * g[l].w[i] ** 2;
          L.w[i] -= (lr * (m[l].w[i] / c1)) / (Math.sqrt(v[l].w[i] / c2) + eps);
        }
        for (let i = 0; i < L.b.length; i++) {
          m[l].b[i] = beta1 * m[l].b[i] + (1 - beta1) * g[l].b[i];
          v[l].b[i] = beta2 * v[l].b[i] + (1 - beta2) * g[l].b[i] ** 2;
          L.b[i] -= (lr * (m[l].b[i] / c1)) / (Math.sqrt(v[l].b[i] / c2) + eps);
        }
      }
    }
    const rmse = Math.sqrt(sq / n) * 100;
    history.push(rmse);
    onEpoch?.(e + 1, rmse);
    await new Promise(r => setTimeout(r, 0));
  }
  return history;
}

/** 사전학습: 합성 데이터로 학습한 새 모델을 만듭니다. (개인 보정층은 비어 있음) */
export async function pretrain(opts: { epochs?: number; samples?: number; onEpoch?: TrainOptions['onEpoch'] } = {}) {
  const net = createNet(1);
  const { xs, ys } = makeSyntheticData(opts.samples ?? 3000, 7);
  const history = await train(net, xs, ys, { epochs: opts.epochs ?? 40, lr: 0.01, onEpoch: opts.onEpoch });
  const model: TwinModel = { net, adapter: emptyAdapter() };
  return { model, history };
}

export type UserSample = { raw: Raw; actual: number };

// 연립방정식(가우스 소거법)
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map(row => row[n]);
}

/**
 * 개인 미세조정: 사전학습 신경망의 예측이 내 실제 컨디션과 얼마나 어긋나는지(잔차)를 보고,
 * 그 어긋남을 설명하는 개인 보정층(편향 + 습관별 민감도)을 릿지 규제로 학습합니다.
 * 신경망 본체는 바꾸지 않으므로 기록이 적어도 과적합되지 않습니다.
 */
export const PERSONALIZE_MIN_DAYS = 7; // 이보다 적은 기록으로는 개인 보정이 오히려 나빠질 수 있어 적용하지 않습니다.

export function fitAdapter(model: TwinModel, samples: UserSample[], lambda?: number): Adapter {
  const n = samples.length;
  const d = FEATURE_META.length;
  if (n < PERSONALIZE_MIN_DAYS) return emptyAdapter();
  const lam = lambda ?? (n >= 14 ? 1 : 4); // 기록이 많을수록 보정을 더 강하게 반영
  const rows = samples.map(s => {
    const x = toVector(s.raw);
    return { x, r: s.actual - forward(model.net, x) * 100 };
  });
  const k = d + 1; // 0번 = 편향
  const A = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const b = new Array<number>(k).fill(0);
  for (const { x, r } of rows) {
    const v = [1, ...x];
    for (let i = 0; i < k; i++) {
      b[i] += v[i] * r;
      for (let j = 0; j < k; j++) A[i][j] += v[i] * v[j];
    }
  }
  for (let i = 1; i < k; i++) A[i][i] += lam; // 편향은 규제하지 않음
  const sol = solve(A, b);
  const cap = (v: number) => clamp(v, -45, 45);
  return { bias: clamp(sol[0], -30, 30), w: sol.slice(1).map(cap) };
}

// ───────── 저장용 직렬화 ─────────
export type SerializedModel = { arch: number[]; w: number[][]; b: number[][]; adapter: Adapter };

export function serialize(model: TwinModel): SerializedModel {
  return {
    arch: [...ARCH],
    w: model.net.layers.map(L => Array.from(L.w)),
    b: model.net.layers.map(L => Array.from(L.b)),
    adapter: { bias: model.adapter.bias, w: [...model.adapter.w] },
  };
}

export function deserialize(s: unknown): TwinModel | null {
  try {
    const o = s as SerializedModel;
    if (!o || !Array.isArray(o.arch) || o.arch.join() !== ARCH.join()) return null;
    const layers: Layer[] = [];
    for (let l = 0; l < ARCH.length - 1; l++) {
      const nIn = ARCH[l];
      const nOut = ARCH[l + 1];
      if (o.w[l].length !== nIn * nOut || o.b[l].length !== nOut) return null;
      if (!o.w[l].every(Number.isFinite) || !o.b[l].every(Number.isFinite)) return null;
      layers.push({ w: Float64Array.from(o.w[l]), b: Float64Array.from(o.b[l]), nIn, nOut });
    }
    const a = o.adapter;
    const adapter: Adapter =
      a && Number.isFinite(a.bias) && Array.isArray(a.w) && a.w.length === FEATURE_META.length && a.w.every(Number.isFinite)
        ? { bias: a.bias, w: a.w }
        : emptyAdapter();
    return { net: { layers }, adapter };
  } catch {
    return null;
  }
}

// ───────── 분석용: 신경망 내부 들여다보기 ─────────
export type NeuralTrace = {
  /** 층별 노드 활성도(0~1로 정규화). 0번 = 입력 습관 12개, 마지막 = 예상 컨디션 */
  layers: number[][];
  /** 활성도 × 가중치가 큰 연결(같은 층 안에서 0~1로 정규화). v>0 이면 컨디션을 올리는 방향 */
  edges: { l: number; i: number; o: number; v: number }[];
};

/** 내 습관을 신경망에 넣었을 때 각 노드가 얼마나 켜지는지(실제 계산)와 영향이 큰 연결을 돌려줍니다. */
export function neuralTrace(model: TwinModel, raw: Raw, keep = 0.16): NeuralTrace {
  const acts: Float64Array[] = [];
  forward(model.net, toVector(raw), acts);
  const layers = acts.map(a => {
    const max = Math.max(1e-9, ...Array.from(a, Math.abs));
    return Array.from(a, v => Math.abs(v) / max);
  });
  const edges: NeuralTrace['edges'] = [];
  model.net.layers.forEach((L, l) => {
    const all: { l: number; i: number; o: number; v: number }[] = [];
    for (let o = 0; o < L.nOut; o++) for (let i = 0; i < L.nIn; i++) all.push({ l, i, o, v: L.w[o * L.nIn + i] * acts[l][i] });
    const max = Math.max(1e-9, ...all.map(e => Math.abs(e.v)));
    all.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    for (const e of all.slice(0, Math.max(8, Math.round(all.length * keep)))) edges.push({ ...e, v: e.v / max });
  });
  return { layers, edges };
}

/** 한 습관만 범위 안에서 바꿔 가며, 나머지는 그대로 둔 채 예상 컨디션이 어떻게 변하는지 계산합니다. (내 모델이 찾은 패턴 곡선) */
export function responseCurve(model: TwinModel, base: Raw, key: keyof Raw, from: number, to: number, n = 28): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, k) => {
    const x = from + ((to - from) * k) / (n - 1);
    return { x, y: predict(model, { ...base, [key]: x }) };
  });
}
