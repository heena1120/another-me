# ANOTHER ME (어나더미)

> 같은 체크리스트로는 아무도 바뀌지 않아요.
> AI가 **내 생활**을 읽고 퀘스트를 만들고, 실패하면 내가 아니라 **퀘스트가 작아지고**, 디지털 트윈은 **내가 실제로 한 만큼만** 자라는 AI 자기성장 앱.

- 공개 사이트: https://another-me-wine.vercel.app (모바일 기준 390px)
- 저장소: https://github.com/heena1120/another-me

## 사용 흐름
1. **MY TWIN 만들기** — 3D 캐릭터(선택: 얼굴 사진으로 옵션 자동 설정, 사진은 저장하지 않음)
2. **생활 질문 + LIFE CLASS + AI에게 한마디** — 내 패턴과 되고 싶은 모습, 내 방식(예: "30분 걸을 시간은 없어요, 집에서 할 수 있는 걸로")
3. **AI가 나를 읽는 중(HIDDEN ME)** — 숨은 패턴·막는 요인과 첫 퀘스트를 AI가 생성, 근거는 내 입력과 연결
4. **홈** — 오늘 체크인 → AI가 반영해 퀘스트 재조정, FUTURE SWITCH(5년 뒤 OFF/ON), 퀘스트 개수 1~6
5. **퀘스트 성공/실패 기록** → 다음 분석에서 난이도·시간 조정("AI가 바꾼 것" 표시), 실패 시 더 작은 단계
6. **성장** — XP·레벨·꾸미기 해금, MY SHADOW(패턴이 작아짐), ANOTHER WORLD(행동으로 열리는 공간), PARALLEL ME

## AI가 하는 일 / 프로그램이 하는 일 (정직한 구분)
| AI (OpenAI, 서버에서만 호출) | 프로그램(신경망·규칙) |
|---|---|
| HIDDEN ME 분석 문장, 퀘스트 제목·행동·이유·완료 조건, 재분석 시 난이도 조정 | 영역 점수·효과 점수(브라우저 내 MLP), 5년 시뮬레이션, XP·레벨·그림자·월드, 안전 장치(실패한 퀘스트가 더 어려워지지 않게 제한), 근거 검증 |

- AI 결과는 서버에서 스키마·허용 목록·근거 키로 검증하고, 통과한 것만 보여 줍니다. AI가 없으면 결과를 지어내지 않고 "AI 연결 전"으로 표시합니다.
- 모든 AI 호출은 입력 종류·모델·프롬프트 버전·요청 ID와 함께 AI TRACE에 기록됩니다(⚙ → 심사·개발용).

## 실행
```sh
npm install
cp .env.example .env.local   # OPENAI_API_KEY 채우기 (서버에서만 읽음, Git에 올라가지 않음)
npm run dev                  # http://localhost:3000
npm test                     # XP·그림자·월드 로직 테스트
npm run eval:ab -- 3         # A/B 인물로 실제 AI 호출 반복 평가 (서버 실행 중일 때)
```

환경변수: `OPENAI_API_KEY`(필수), `OPENAI_MODEL`(기본 `gpt-5-mini`), `OPENAI_REASONING_EFFORT`(선택)

## 기술
Next.js 16(App Router) · React 19 · TypeScript · three.js/@react-three/fiber · 직접 구현한 MLP(역전파·Adam, 사전학습 + 개인 보정) · OpenAI Chat Completions(Structured Outputs) · Vercel

## 보안 규칙
- API 키·토큰·DB 비밀번호는 코드·Git·README에 쓰지 않습니다. `.env.local`은 `.gitignore`에 있습니다.
- 얼굴 사진은 서버에 저장하지 않고 분석 후 버립니다.
- 의료 진단이 아니며, 5년 시나리오는 가상의 추정입니다.
