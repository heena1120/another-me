// 서버 API 공통 도우미
import { LLM_ERRORS, type LlmErrorCode } from './openai';

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** 다른 사이트에서 이 API를 몰래 호출하지 못하게 막습니다. 문제가 있으면 응답을, 없으면 null을 돌려줍니다. */
export function rejectForeignOrigin(req: Request): Response | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  try {
    if (new URL(origin).host === req.headers.get('host')) return null;
  } catch {
    /* 아래에서 거절 */
  }
  return json({ error: '허용되지 않은 요청이에요.' }, 403);
}

// 서버 한 대(인스턴스) 안에서만 세는 간단한 호출 횟수 제한입니다. 키가 남용되는 것을 줄이려는 최소한의 장치예요.
const hits = new Map<string, number[]>();

export function rateLimited(req: Request, bucket: string, limit: number, windowMs: number): Response | null {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  const k = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(k) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(k, recent);
    return json({ error: '잠시 뒤에 다시 시도해 주세요. (짧은 시간에 너무 많이 요청했어요)', code: 'rate' }, 429);
  }
  recent.push(now);
  hits.set(k, recent);
  return null;
}

/** OpenAI 호출 실패를 사용자 안내 응답으로 바꿉니다. */
export function llmErrorResponse(code: LlmErrorCode): Response {
  const e = LLM_ERRORS[code];
  return json({ error: e.message, code }, e.status);
}
