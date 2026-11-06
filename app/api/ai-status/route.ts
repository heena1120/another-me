import { json } from '@/lib/api-guard';
import { openaiConfigured, openaiModel } from '@/lib/openai';

// AI 기능을 쓸 수 있는지와 모델 이름만 알려 줍니다. 키 값은 절대 내보내지 않습니다.
export async function GET(req: Request) {
  void req.headers; // 요청 시점에 계산되도록(빌드 때 미리 굳어지지 않게) 요청을 읽습니다.
  return json({ enabled: openaiConfigured(), provider: 'openai', model: openaiModel() });
}
