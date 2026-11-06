// AI 코치의 입력 검증, 출력 스키마, 출력 검증, 안전 장치(가드레일). 순수 함수라서 화면 없이 테스트할 수 있습니다.
import {
  ANSWER_KEYS,
  DIFFICULTIES,
  EVIDENCE_KEYS,
  LEVER_IDS,
  LIFE_CLASS_IDS,
  type AiQuest,
  type CoachInput,
  type CoachMemory,
  type CoachResult,
  type Difficulty,
  type Evidence,
  type Insight,
  type LeverId,
} from './ai-types';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const isLever = (v: unknown): v is LeverId => typeof v === 'string' && (LEVER_IDS as readonly string[]).includes(v);

// ───────── 입력 검증: 브라우저에서 온 값을 믿지 않고 모양·길이·허용 목록을 확인합니다 ─────────
export function validateCoachInput(body: unknown): CoachInput | null {
  const o = body as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  const mode = o.mode === 'reanalyze' ? 'reanalyze' : o.mode === 'initial' ? 'initial' : null;
  if (!mode) return null;

  const lc = o.lifeClass as Record<string, unknown> | null;
  const lifeClass =
    lc && typeof lc === 'object' && (LIFE_CLASS_IDS as readonly string[]).includes(lc.id as string)
      ? { id: lc.id as CoachInput['lifeClass'] extends infer T ? (T extends { id: infer I } ? I : never) : never, name: str(lc.name, 30), meaning: str(lc.meaning, 80) }
      : null;

  const answers = arr(o.answers, 20)
    .map(a => a as Record<string, unknown>)
    .filter(a => a && (ANSWER_KEYS as readonly string[]).includes(a.key as string))
    .map(a => ({ key: a.key as string, question: str(a.question, 80), answer: str(a.answer, 60) }))
    .filter(a => a.question && a.answer);
  if (answers.length < 3) return null;

  const sg = o.signals as Record<string, unknown> | null;
  if (!sg || typeof sg !== 'object') return null;
  const areas = arr(sg.areas, 6)
    .map(a => a as Record<string, unknown>)
    .map(a => ({ id: str(a?.id, 12), label: str(a?.label, 10), score: num(a?.score, 0, 100) }))
    .filter((a): a is { id: string; label: string; score: number } => !!a.id && !!a.label && a.score !== null)
    .map(a => ({ ...a, score: Math.round(a.score) }));
  const levers = arr(sg.levers, 10)
    .map(l => l as Record<string, unknown>)
    .filter(l => l && isLever(l.id))
    .map(l => ({ id: l.id as LeverId, title: str(l.title, 60), gain: Math.round((num(l.gain, 0, 60) ?? 0) * 10) / 10, minutes: Math.round(num(l.minutes, 0, 120) ?? 0) }))
    .filter(l => l.title);
  if (levers.length === 0) return null;

  const m = (o.memory ?? {}) as Record<string, unknown>;
  const memory: CoachMemory = {
    daysObserved: Math.round(num(m.daysObserved, 0, 365) ?? 0),
    done: arr(m.done, 10)
      .map(d => d as Record<string, unknown>)
      .filter(d => d && isLever(d.lever))
      .map(d => ({ lever: d.lever as string, done: Math.round(num(d.done, 0, 400) ?? 0), total: Math.round(num(d.total, 0, 400) ?? 0) })),
    failed: arr(m.failed, 10)
      .map(f => f as Record<string, unknown>)
      .filter(f => f && isLever(f.lever))
      .map(f => ({
        lever: f.lever as string,
        reason: str(f.reason, 20),
        minutes: num(f.minutes, 0, 120),
        difficulty: (DIFFICULTIES as readonly string[]).includes(f.difficulty as string) ? (f.difficulty as string) : null,
        count: Math.round(num(f.count, 1, 400) ?? 1),
      })),
    failTimes: arr(m.failTimes, 6)
      .map(t => t as Record<string, unknown>)
      .map(t => ({ bucket: str(t?.bucket, 10), count: Math.round(num(t?.count, 0, 400) ?? 0) }))
      .filter(t => t.bucket),
    preferred: arr(m.preferred, 5).filter(isLever),
    feedback: {
      good: Math.round(num((m.feedback as Record<string, unknown> | undefined)?.good, 0, 400) ?? 0),
      bad: Math.round(num((m.feedback as Record<string, unknown> | undefined)?.bad, 0, 400) ?? 0),
      badLevers: arr((m.feedback as Record<string, unknown> | undefined)?.badLevers, 5).filter(isLever),
    },
  };

  return { mode, lifeClass, answers, signals: { areas, levers }, memory };
}

// ───────── 출력 스키마(OpenAI Structured Outputs, strict) ─────────
const insightArray = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'evidence'],
    properties: {
      text: { type: 'string', description: '근거에 기반한 한 문장. 단정하지 말고 "~일 수 있어요"처럼 가능성으로 표현' },
      evidence: { type: 'array', items: { type: 'string', enum: [...EVIDENCE_KEYS] }, description: '이 문장의 근거가 된 입력 항목 키' },
    },
  },
};

export const COACH_SCHEMA = {
  name: 'another_me_coach',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'hidden_me', 'quests'],
    properties: {
      summary: { type: 'string', description: '지금 상태와 LIFE CLASS를 반영한 한두 문장 요약' },
      hidden_me: {
        type: 'object',
        additionalProperties: false,
        required: ['patterns', 'strengths', 'improve', 'blockers', 'unnoticed'],
        properties: { patterns: insightArray, strengths: insightArray, improve: insightArray, blockers: insightArray, unnoticed: insightArray },
      },
      quests: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['lever', 'title', 'action', 'minutes', 'difficulty', 'why', 'expected', 'done_when', 'evidence'],
          properties: {
            lever: { type: 'string', enum: [...LEVER_IDS] },
            title: { type: 'string' },
            action: { type: 'string', description: '언제·어디서·어떻게 하는지 구체적인 행동' },
            minutes: { type: 'integer' },
            difficulty: { type: 'string', enum: [...DIFFICULTIES] },
            why: { type: 'string', description: '사용자의 실제 입력과 연결한 추천 이유' },
            expected: { type: 'string', description: '실천했을 때 기대하는 변화(과장 금지)' },
            done_when: { type: 'string', description: '끝났는지 스스로 확인할 수 있는 완료 조건' },
            evidence: { type: 'array', items: { type: 'string', enum: [...EVIDENCE_KEYS] } },
          },
        },
      },
    },
  },
} as const;

// ───────── 근거 키 → 실제 입력에서 뽑은 표시 값 (AI가 쓴 글이 아니라 입력에서 직접 가져옵니다) ─────────
export function evidenceFor(key: string, input: CoachInput): Evidence | null {
  const a = input.answers.find(x => x.key === key);
  if (a) return { key, label: a.question, value: a.answer };
  switch (key) {
    case 'lifeClass':
      return input.lifeClass ? { key, label: 'LIFE CLASS', value: input.lifeClass.name } : null;
    case 'signals.areas': {
      const w = [...input.signals.areas].sort((x, y) => x.score - y.score)[0];
      return w ? { key, label: '프로그램이 계산한 영역 점수', value: `${w.label} ${w.score}%가 가장 낮음` } : null;
    }
    case 'memory.failed':
      return input.memory.failed.length ? { key, label: '못 한 기록', value: input.memory.failed.map(f => `${f.lever}(${f.reason || '이유 없음'})`).join(', ') } : null;
    case 'memory.done':
      return input.memory.done.length ? { key, label: '지난 기록', value: input.memory.done.map(d => `${d.lever} ${d.done}/${d.total}`).join(', ') } : null;
    case 'memory.failTimes':
      return input.memory.failTimes.length ? { key, label: '자주 못 한 시간대', value: input.memory.failTimes.map(t => `${t.bucket} ${t.count}회`).join(', ') } : null;
    case 'memory.preferred':
      return input.memory.preferred.length ? { key, label: '자주 해낸 퀘스트', value: input.memory.preferred.join(', ') } : null;
    case 'memory.feedback':
      return input.memory.feedback.good + input.memory.feedback.bad > 0 ? { key, label: '추천 만족도', value: `좋아요 ${input.memory.feedback.good}, 별로예요 ${input.memory.feedback.bad}` } : null;
    default:
      return null;
  }
}

const insights = (raw: unknown, input: CoachInput): Insight[] =>
  arr(raw, 4)
    .map(r => r as Record<string, unknown>)
    .map(r => {
      const evidence = arr(r?.evidence, 5)
        .filter((k): k is string => typeof k === 'string')
        .map(k => evidenceFor(k, input))
        .filter((e): e is Evidence => e !== null);
      // 같은 키가 겹치면 하나만 남깁니다.
      const uniq = evidence.filter((e, i) => evidence.findIndex(x => x.key === e.key) === i);
      return { text: str(r?.text, 160), evidence: uniq, verified: uniq.length > 0 };
    })
    .filter(i => i.text);

const RANK: Record<Difficulty, number> = { 쉬움: 0, 보통: 1, 도전: 2 };

/**
 * AI 결과를 검증해 우리 형식으로 바꿉니다.
 * - 퀘스트 종류는 입력으로 준 목록 안에서만, 중복 없이 최대 4개
 * - 근거 키는 실제 입력에 있는 것만 인정(없으면 verified=false로 표시)
 * - 안전 장치: 지난번에 못 한 퀘스트는 시간을 줄이고 난이도를 올리지 못하게 코드가 제한
 */
export function validateCoachOutput(raw: unknown, input: CoachInput): { ok: true; result: CoachResult; adjustments: string[] } | { ok: false; reason: string } {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return { ok: false, reason: 'not_object' };
  const allowed = new Set(input.signals.levers.map(l => l.id as string));
  const seen = new Set<string>();
  const adjustments: string[] = [];

  const quests: AiQuest[] = [];
  for (const rq of arr(o.quests, 8)) {
    const q = rq as Record<string, unknown>;
    if (!q || !isLever(q.lever) || !allowed.has(q.lever) || seen.has(q.lever)) continue;
    const title = str(q.title, 30);
    const action = str(q.action, 140);
    if (!title || !action) continue;
    seen.add(q.lever);

    let minutes = Math.round(num(q.minutes, 0, 60) ?? 0);
    let difficulty: Difficulty = (DIFFICULTIES as readonly string[]).includes(q.difficulty as string) ? (q.difficulty as Difficulty) : '보통';

    const last = input.memory.failed.filter(f => f.lever === q.lever).sort((a, b) => b.count - a.count)[0];
    if (last) {
      if (last.minutes && last.minutes > 0) {
        const cap = Math.max(1, Math.floor(last.minutes * 0.7));
        if (minutes > cap) {
          adjustments.push(`${q.lever}: 지난번 ${last.minutes}분짜리를 못 해서, 시간을 ${minutes}분에서 ${cap}분으로 코드가 제한했어요.`);
          minutes = cap;
        }
      }
      const lastRank = RANK[(last.difficulty as Difficulty) ?? '보통'] ?? 1;
      if (RANK[difficulty] >= lastRank && lastRank > 0) {
        const lowered = DIFFICULTIES[lastRank - 1];
        adjustments.push(`${q.lever}: 지난번 '${last.difficulty ?? '보통'}' 난이도를 못 해서, 난이도를 '${difficulty}' → '${lowered}'(으)로 코드가 낮췄어요.`);
        difficulty = lowered;
      }
    }

    const evidence = arr(q.evidence, 5)
      .filter((k): k is string => typeof k === 'string')
      .map(k => evidenceFor(k, input))
      .filter((e): e is Evidence => e !== null)
      .filter((e, i, all) => all.findIndex(x => x.key === e.key) === i);

    quests.push({
      lever: q.lever,
      title,
      action,
      minutes,
      difficulty,
      why: str(q.why, 200),
      expected: str(q.expected, 120),
      doneWhen: str(q.done_when, 100),
      evidence,
      verified: evidence.length > 0,
    });
    if (quests.length >= 4) break;
  }
  if (quests.length === 0) return { ok: false, reason: 'no_valid_quests' };

  const h = (o.hidden_me ?? {}) as Record<string, unknown>;
  const result: CoachResult = {
    summary: str(o.summary, 220),
    hiddenMe: { patterns: insights(h.patterns, input), strengths: insights(h.strengths, input), improve: insights(h.improve, input), blockers: insights(h.blockers, input), unnoticed: insights(h.unnoticed, input) },
    quests,
  };
  return { ok: true, result, adjustments };
}
