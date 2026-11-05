import { claudeModel, json, missingKeyResponse, rejectForeignOrigin, upstreamError } from '@/lib/api-guard';
import { buildRequestBody, parseReply, validateInput } from '@/lib/future-ai';

// 대화 내용은 저장하지 않고 로그에도 남기지 않습니다.
export async function POST(req: Request) {
  const foreign = rejectForeignOrigin(req);
  if (foreign) return foreign;

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return missingKeyResponse();

  const input = validateInput(await req.json().catch(() => null));
  if (!input) return json({ error: '요청 형식이 올바르지 않아요.' }, 400);

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(buildRequestBody(input, claudeModel())),
      cache: 'no-store',
      signal: AbortSignal.timeout(40000),
    });
  } catch {
    return json({ error: 'AI에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.' }, 504);
  }
  if (!res.ok) return upstreamError(res.status);

  const reply = parseReply(await res.json().catch(() => null));
  if (!reply) return json({ error: 'AI 응답을 이해하지 못했어요. 다시 시도해 주세요.' }, 502);
  return json({ reply });
}
