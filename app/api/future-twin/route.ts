import { json, llmErrorResponse, rateLimited, rejectForeignOrigin } from '@/lib/api-guard';
import { futureMessages, validateInput } from '@/lib/future-ai';
import { PROMPT_VERSIONS } from '@/lib/ai-types';
import { chat } from '@/lib/openai';

export const maxDuration = 60;

// 대화 내용은 저장하지 않고 로그에도 남기지 않습니다.
export async function POST(req: Request) {
  const foreign = rejectForeignOrigin(req);
  if (foreign) return foreign;
  const limited = rateLimited(req, 'future', 30, 10 * 60 * 1000);
  if (limited) return limited;

  const input = validateInput(await req.json().catch(() => null));
  if (!input) return json({ error: '요청 형식이 올바르지 않아요.', code: 'bad_request' }, 400);

  const res = await chat({ messages: futureMessages(input), maxTokens: 3000, timeoutMs: 55000 });
  if (!res.ok) return llmErrorResponse(res.code);

  const reply = typeof res.data === 'string' ? res.data.trim().slice(0, 1200) : '';
  if (!reply) return llmErrorResponse('bad_format');
  return json({ reply, meta: { provider: 'openai', model: res.model, ms: res.ms, promptVersion: PROMPT_VERSIONS.future } });
}
