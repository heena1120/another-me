import { json } from '@/lib/api-guard';

// AI 기능(사진 분석, 미래와의 대화)을 쓸 수 있는지만 알려 줍니다. 키 값은 절대 내보내지 않습니다.
export async function GET(req: Request) {
  void req.headers; // 요청 시점에 계산되도록(빌드 때 미리 굳어지지 않게) 요청을 읽습니다.
  return json({ enabled: Boolean(process.env.ANTHROPIC_API_KEY?.trim()) });
}
