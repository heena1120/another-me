import { claudeModel, json, missingKeyResponse, rejectForeignOrigin, upstreamError } from '@/lib/api-guard';
import { buildRequestBody, parseToolResult } from '@/lib/avatar-ai';

const PREFIX = 'data:image/jpeg;base64,';
const MAX_BASE64 = 2_000_000; // 약 1.5MB. 화면에서 이미 작게 줄여서 보냅니다.

// 사진은 저장하지 않고 로그에도 남기지 않습니다. 분석 요청에 한 번만 쓰고 버립니다.
export async function POST(req: Request) {
  const foreign = rejectForeignOrigin(req);
  if (foreign) return foreign;

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return missingKeyResponse();

  let image: unknown;
  try {
    image = ((await req.json()) as { image?: unknown }).image;
  } catch {
    return json({ error: '요청 형식이 올바르지 않아요.' }, 400);
  }
  if (typeof image !== 'string' || !image.startsWith(PREFIX) || image.length > MAX_BASE64 + PREFIX.length) {
    return json({ error: '사진을 읽지 못했어요. 더 작은 JPEG 사진으로 다시 시도해 주세요.' }, 400);
  }
  const base64 = image.slice(PREFIX.length);
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) return json({ error: '사진을 읽지 못했어요.' }, 400);

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(buildRequestBody(base64, claudeModel())),
      cache: 'no-store',
      signal: AbortSignal.timeout(40000),
    });
  } catch {
    return json({ error: 'AI에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.' }, 504);
  }
  if (!res.ok) return upstreamError(res.status);

  const parsed = parseToolResult(await res.json().catch(() => null));
  if (!parsed) return json({ error: 'AI 응답을 이해하지 못했어요. 다시 시도해 주세요.' }, 502);
  return json(parsed);
}
