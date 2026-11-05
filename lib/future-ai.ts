// 미래 쌍둥이 대화 (서버에서만 사용)

export type Scenario = 'now' | 'improved';
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type FutureInput = {
  scenario: Scenario;
  name: string;
  nowScore: number;
  improvedScore: number;
  changes: string[]; // 체크리스트로 바뀌는 습관 문장들
  messages: ChatMessage[];
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : null);

/** 브라우저에서 온 값을 믿지 않고 모양·길이를 확인합니다. 문제가 있으면 null. */
export function validateInput(body: unknown): FutureInput | null {
  const o = body as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  if (o.scenario !== 'now' && o.scenario !== 'improved') return null;
  const nowScore = num(o.nowScore);
  const improvedScore = num(o.improvedScore);
  if (nowScore === null || improvedScore === null) return null;
  if (!Array.isArray(o.messages) || o.messages.length < 1 || o.messages.length > 12) return null;
  const messages: ChatMessage[] = [];
  for (const m of o.messages as Record<string, unknown>[]) {
    const role = m?.role;
    const content = str(m?.content, 500);
    if ((role !== 'user' && role !== 'assistant') || !content) return null;
    messages.push({ role, content });
  }
  // Claude는 user부터 시작해 user/assistant가 번갈아 나와야 합니다.
  if (messages[0].role !== 'user' || messages[messages.length - 1].role !== 'user') return null;
  for (let i = 1; i < messages.length; i++) if (messages[i].role === messages[i - 1].role) return null;
  const changes = Array.isArray(o.changes) ? (o.changes as unknown[]).slice(0, 6).map(c => str(c, 60)).filter(Boolean) : [];
  return { scenario: o.scenario, name: str(o.name, 10) || '쌍둥이', nowScore, improvedScore, changes, messages };
}

export function buildSystemPrompt(i: FutureInput): string {
  const who =
    i.scenario === 'now'
      ? '지금의 습관을 그대로 이어간 5년 뒤의 나'
      : `오늘의 체크리스트 습관(${i.changes.join(', ') || '건강 습관'})을 꾸준히 지킨 5년 뒤의 나`;
  return `너는 사용자의 "5년 뒤 쌍둥이" ${i.name}이야. 지금 너는 "${who}"의 입장에서 말해.

앱의 쌍둥이 신경망이 예측한 오늘 기준 컨디션은 다음과 같아.
- 지금 습관 그대로: ${i.nowScore}점
- 체크리스트를 지킨 습관: ${i.improvedScore}점
이건 상상 속 시뮬레이션이고, 미래를 맞히는 예언이 아니야.

말하는 규칙:
- 다정한 반말로, 3~5문장 안으로 짧게 말해.
- 위에 적힌 점수와 습관 밖의 구체적인 통계, 병명, 진단, 약, 수치는 지어내지 마.
- 의학적 조언이나 진단은 하지 마. 몸이 많이 아프다는 이야기가 나오면 전문가(병원)와 상담해 보라고 권해.
- 사용자가 자해나 극단적인 힘듦을 말하면 따뜻하게 받아 주고, 가까운 사람이나 전문 상담(자살예방상담 109)에 연락하도록 부드럽게 권해.
- 현재의 사용자에게 부담이나 죄책감을 주지 말고, 작은 실천 하나를 응원하는 쪽으로 이야기해.
- 이 대화는 상상이라는 걸 잊지 않되, 지금의 습관과 연결해서 말해.`;
}

export function buildRequestBody(i: FutureInput, model: string) {
  return { model, max_tokens: 400, system: buildSystemPrompt(i), messages: i.messages };
}

export function parseReply(json: unknown): string | null {
  const content = (json as { content?: unknown })?.content;
  if (!Array.isArray(content)) return null;
  const text = content
    .filter((b: { type?: string }) => b?.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('\n')
    .trim();
  return text ? text.slice(0, 1200) : null;
}
