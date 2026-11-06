import { json, llmErrorResponse, rateLimited, rejectForeignOrigin } from '@/lib/api-guard';
import { COACH_SCHEMA, validateCoachInput, validateCoachOutput } from '@/lib/ai-schema';
import { coachMessages } from '@/lib/ai-prompts';
import { PROMPT_VERSIONS, type CoachMeta } from '@/lib/ai-types';
import { chat } from '@/lib/openai';

export const maxDuration = 60; // 추론 모델이라 응답이 오래 걸릴 수 있어요

// HIDDEN ME(숨은 나 분석) + AI QUEST(맞춤 퀘스트)를 OpenAI로 한 번에 생성합니다.
// 입력과 결과는 서버에 저장하지 않고 로그에도 남기지 않습니다. (기록은 브라우저의 AI TRACE에만 남습니다)
export async function POST(req: Request) {
  const foreign = rejectForeignOrigin(req);
  if (foreign) return foreign;
  const limited = rateLimited(req, 'coach', 15, 10 * 60 * 1000);
  if (limited) return limited;

  const input = validateCoachInput(await req.json().catch(() => null));
  if (!input) return json({ error: '요청 형식이 올바르지 않아요.', code: 'bad_request' }, 400);

  const res = await chat({ messages: coachMessages(input), schema: COACH_SCHEMA, maxTokens: 8000, timeoutMs: 58000 });
  if (!res.ok) return llmErrorResponse(res.code);

  const checked = validateCoachOutput(res.data, input);
  if (!checked.ok) return llmErrorResponse('bad_format');

  const meta: CoachMeta = { provider: 'openai', model: res.model, ms: res.ms, usage: res.usage, requestId: res.requestId, promptVersion: PROMPT_VERSIONS.coach };
  return json({ result: checked.result, adjustments: checked.adjustments, meta });
}
