// AI 코치(HIDDEN ME + AI QUEST) 공용 타입과 허용 목록. 서버와 브라우저가 같이 씁니다. (순수 데이터, 비밀 없음)

export const LEVER_IDS = ['sleep', 'caffeine', 'screen', 'shortform', 'walk', 'stretch', 'exercise', 'water', 'meals', 'outdoor'] as const;
export type LeverId = (typeof LEVER_IDS)[number];

export const DIFFICULTIES = ['쉬움', '보통', '도전'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const LIFE_CLASS_IDS = ['healthy', 'creative', 'balanced', 'successful'] as const;
export type LifeClassId = (typeof LIFE_CLASS_IDS)[number];

/** 설문 답변으로 AI에게 보낼 수 있는 항목(허용 목록). 이 밖의 값은 서버가 버립니다. */
export const ANSWER_KEYS = ['job', 'walk', 'sleep', 'sleepWhy', 'caffeine', 'shortform', 'budget', 'pref', 'goal', 'energyTime', 'diet', 'selfcare', 'change'] as const;

/** 추천 근거로 가리킬 수 있는 입력 항목 */
export const EVIDENCE_KEYS = [...ANSWER_KEYS, 'lifeClass', 'memory.failed', 'memory.done', 'memory.failTimes', 'memory.preferred', 'memory.feedback', 'signals.areas'] as const;
export type EvidenceKey = (typeof EVIDENCE_KEYS)[number];

export const PROMPT_VERSIONS = { coach: 'coach-v1', photo: 'photo-v1', future: 'future-v1' } as const;

// ───────── AI에게 보내는 입력 ─────────
export type CoachMemory = {
  daysObserved: number;
  /** 퀘스트 종류별 지난 기록 */
  done: { lever: string; done: number; total: number }[];
  /** 못 한 기록(종류·이유·그때의 시간/난이도) */
  failed: { lever: string; reason: string; minutes: number | null; difficulty: string | null; count: number }[];
  /** 못 한 시각대 */
  failTimes: { bucket: string; count: number }[];
  /** 자주 해낸 퀘스트 종류 */
  preferred: string[];
  /** 추천 만족도 */
  feedback: { good: number; bad: number; badLevers: string[] };
};

export type CoachInput = {
  mode: 'initial' | 'reanalyze';
  lifeClass: { id: LifeClassId; name: string; meaning: string } | null;
  /** 사용자가 직접 고른 답변 */
  answers: { key: string; question: string; answer: string }[];
  /** 프로그램(신경망·규칙)이 계산한 값. AI가 만든 값이 아닙니다. */
  signals: {
    areas: { id: string; label: string; score: number }[];
    levers: { id: LeverId; title: string; gain: number; minutes: number }[];
  };
  memory: CoachMemory;
};

// ───────── AI가 돌려준 결과(검증 후) ─────────
export type Evidence = { key: string; label: string; value: string };
export type Insight = { text: string; evidence: Evidence[]; verified: boolean };

export type AiQuest = {
  lever: LeverId;
  title: string;
  action: string;
  minutes: number;
  difficulty: Difficulty;
  why: string;
  expected: string;
  doneWhen: string;
  evidence: Evidence[];
  verified: boolean;
};

export type CoachResult = {
  summary: string;
  hiddenMe: { patterns: Insight[]; strengths: Insight[]; improve: Insight[]; blockers: Insight[]; unnoticed: Insight[] };
  quests: AiQuest[];
};

export type CoachMeta = { provider: 'openai'; model: string; ms: number; usage: { prompt: number; completion: number; total: number } | null; requestId: string | null; promptVersion: string };

// ───────── AI TRACE ─────────
export type TraceEntry = {
  id: string;
  at: string; // ISO 시각
  kind: 'coach' | 'photo' | 'future';
  ok: boolean;
  /** 실패했다면 오류 종류 */
  error?: string;
  mode?: 'initial' | 'reanalyze';
  model?: string;
  promptVersion?: string;
  ms?: number;
  usage?: CoachMeta['usage'];
  requestId?: string | null;
  /** AI에 보낸 입력 데이터의 종류 */
  inputKinds: string[];
  /** 보낸 입력(사진은 저장하지 않고 설명만 남김) */
  input?: CoachInput | { note: string };
  /** 검증을 통과한 AI 결과 */
  output?: CoachResult;
  /** AI 결과를 코드가 고친 내용(안전 장치) */
  adjustments?: string[];
};
