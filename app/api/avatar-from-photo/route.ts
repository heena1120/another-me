import { json, llmErrorResponse, rateLimited, rejectForeignOrigin } from '@/lib/api-guard';
import { PHOTO_SCHEMA, parsePhotoResult, photoMessages } from '@/lib/avatar-ai';
import { PROMPT_VERSIONS } from '@/lib/ai-types';
import { chat } from '@/lib/openai';

export const maxDuration = 60;

const PREFIX = 'data:image/jpeg;base64,';
const MAX_BASE64 = 2_000_000; // 약 1.5MB. 화면에서 이미 작게 줄여서 보냅니다.

// 사진은 서버에 저장하지 않고 로그에도 남기지 않습니다. 분석 요청에 한 번만 OpenAI로 보내고 버립니다.
export async function POST(req: Request) {
  const foreign = rejectForeignOrigin(req);
  if (foreign) return foreign;
  const limited = rateLimited(req, 'photo', 10, 10 * 60 * 1000);
  if (limited) return limited;

  let image: unknown;
  try {
    image = ((await req.json()) as { image?: unknown }).image;
  } catch {
    return json({ error: '요청 형식이 올바르지 않아요.', code: 'bad_request' }, 400);
  }
  if (typeof image !== 'string' || !image.startsWith(PREFIX) || image.length > MAX_BASE64 + PREFIX.length) {
    return json({ error: '사진을 읽지 못했어요. 더 작은 JPEG 사진으로 다시 시도해 주세요.', code: 'bad_request' }, 400);
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(image.slice(PREFIX.length))) return json({ error: '사진을 읽지 못했어요.', code: 'bad_request' }, 400);

  const res = await chat({ messages: photoMessages(image), schema: PHOTO_SCHEMA, maxTokens: 4000, timeoutMs: 55000 });
  if (!res.ok) return llmErrorResponse(res.code);

  const parsed = parsePhotoResult(res.data);
  if (!parsed) return llmErrorResponse('bad_format');
  return json({ ...parsed, meta: { provider: 'openai', model: res.model, ms: res.ms, promptVersion: PROMPT_VERSIONS.photo } });
}
