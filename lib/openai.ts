// OpenAI Chat Completions 호출 (서버 전용). 키는 서버 환경변수에서만 읽고, 브라우저로는 절대 내보내지 않습니다.
// 요청/응답 내용과 키는 로그에 남기지 않습니다.

export type LlmOk = {
  ok: true;
  /** 응답 본문(JSON 스키마를 요청했다면 파싱된 값, 아니면 문자열) */
  data: unknown;
  /** API 응답이 알려 준 실제 모델 이름 */
  model: string;
  ms: number;
  usage: { prompt: number; completion: number; total: number } | null;
  requestId: string | null;
};

export type LlmErrorCode = 'no_key' | 'auth' | 'model' | 'quota' | 'rate' | 'timeout' | 'network' | 'upstream' | 'refused' | 'truncated' | 'bad_format';
export type LlmErr = { ok: false; code: LlmErrorCode };

export const openaiModel = () => process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';
export const openaiConfigured = () => Boolean(process.env.OPENAI_API_KEY?.trim());

type Message = { role: 'system' | 'user' | 'assistant'; content: string | unknown[] };

/**
 * schema를 주면 Structured Outputs(json_schema, strict)로 JSON을 받고, 없으면 일반 텍스트를 받습니다.
 * gpt-5 계열은 추론 토큰도 max_completion_tokens에 포함되므로 넉넉하게 잡습니다.
 */
export async function chat(opts: { messages: Message[]; schema?: { name: string; schema: object }; maxTokens: number; timeoutMs?: number }): Promise<LlmOk | LlmErr> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { ok: false, code: 'no_key' };
  const base = (process.env.OPENAI_API_BASE?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '');
  const effort = process.env.OPENAI_REASONING_EFFORT?.trim();

  const body: Record<string, unknown> = {
    model: openaiModel(),
    messages: opts.messages,
    max_completion_tokens: opts.maxTokens,
  };
  if (effort) body.reasoning_effort = effort;
  if (opts.schema) body.response_format = { type: 'json_schema', json_schema: { name: opts.schema.name, strict: true, schema: opts.schema.schema } };

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
    });
  } catch (e) {
    return { ok: false, code: e instanceof DOMException && e.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
  const ms = Date.now() - t0;

  if (!res.ok) {
    // 응답 본문에는 키 일부나 입력이 섞일 수 있어 그대로 전달하지 않고, 오류 "코드"만 읽어 종류를 구분합니다.
    const err = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    const c = err?.error?.code;
    if (c === 'model_not_found') return { ok: false, code: 'model' };
    if (c === 'insufficient_quota') return { ok: false, code: 'quota' };
    return { ok: false, code: res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate' : 'upstream' };
  }

  const json = (await res.json().catch(() => null)) as {
    model?: string;
    choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  } | null;
  const choice = json?.choices?.[0];
  if (!json || !choice) return { ok: false, code: 'bad_format' };
  if (choice.message?.refusal) return { ok: false, code: 'refused' };
  const content = choice.message?.content;
  if (!content) return { ok: false, code: choice.finish_reason === 'length' ? 'truncated' : 'bad_format' };
  if (choice.finish_reason === 'length') return { ok: false, code: 'truncated' };

  let data: unknown = content;
  if (opts.schema) {
    try {
      data = JSON.parse(content);
    } catch {
      return { ok: false, code: 'bad_format' };
    }
  }
  return {
    ok: true,
    data,
    model: typeof json.model === 'string' ? json.model : openaiModel(),
    ms,
    usage: json.usage ? { prompt: json.usage.prompt_tokens ?? 0, completion: json.usage.completion_tokens ?? 0, total: json.usage.total_tokens ?? 0 } : null,
    requestId: res.headers.get('x-request-id'),
  };
}

/** 오류 종류별로 사용자에게 보여 줄 안내 문구와 HTTP 상태 */
export const LLM_ERRORS: Record<LlmErrorCode, { status: number; message: string }> = {
  no_key: { status: 503, message: 'AI가 아직 연결되지 않았어요. 서버의 OPENAI_API_KEY 설정이 필요해요.' },
  auth: { status: 502, message: 'OpenAI API 키가 올바르지 않거나 권한이 없어요.' },
  model: { status: 502, message: '이 OpenAI 프로젝트에서는 설정된 모델을 쓸 수 없어요. OpenAI 대시보드(프로젝트 설정의 모델 접근)에서 허용하거나, 서버의 OPENAI_MODEL을 허용된 모델로 바꿔 주세요.' },
  quota: { status: 502, message: 'OpenAI 사용 한도(크레딧)가 소진됐어요. OpenAI 결제·한도 설정을 확인해 주세요.' },
  rate: { status: 429, message: '요청이 많거나 사용 한도에 걸렸어요. 잠시 뒤 다시 시도해 주세요.' },
  timeout: { status: 504, message: 'AI 응답이 너무 오래 걸려요. 다시 시도해 주세요.' },
  network: { status: 504, message: 'AI 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.' },
  upstream: { status: 502, message: 'AI 서버에서 오류가 났어요. 잠시 뒤 다시 시도해 주세요.' },
  refused: { status: 502, message: 'AI가 이 요청에는 답하지 않았어요.' },
  truncated: { status: 502, message: 'AI 응답이 중간에 잘렸어요. 다시 시도해 주세요.' },
  bad_format: { status: 502, message: 'AI 응답을 이해하지 못했어요. 다시 시도해 주세요.' },
};
