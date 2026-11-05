// 서버 API 공통 도우미

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

export const claudeModel = () => process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-5-5';

export const missingKeyResponse = () =>
  json({ error: '서버에 Claude API 키가 아직 설정되지 않았어요. .env.local 에 ANTHROPIC_API_KEY 를 넣고 서버를 다시 시작해 주세요.' }, 503);

/** Anthropic 오류 응답은 본문을 그대로 전달하지 않고 안전한 문구로 바꿉니다. */
export function upstreamError(status: number): Response {
  const msg = status === 401 ? 'Claude API 키가 올바르지 않아요.' : status === 429 ? '요청이 많아요. 잠시 뒤 다시 시도해 주세요.' : 'AI 응답에 실패했어요. 다시 시도해 주세요.';
  return json({ error: msg }, 502);
}
