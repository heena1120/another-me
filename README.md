# Hackathon App

Next.js(App Router, TypeScript) + Supabase(DB) + Vercel(배포) 시작 틀입니다.

## 실행
```sh
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

## 연결 규칙
- 브라우저에 내려가는 값(`NEXT_PUBLIC_*`)에는 공개용 Publishable key만 넣습니다.
- secret / service_role 키, DB 비밀번호, 토큰은 코드·Git·README에 쓰지 않습니다.
- DB 변경은 `supabase/migrations`에 SQL로 만들고 Supabase CLI로 적용합니다.
- 코드 배포는 Vercel(CLI 또는 GitHub push)로 합니다. GitHub push가 DB를 바꾸지는 않습니다.
- 테이블마다 RLS를 켜고, 공개 쓰기 권한은 필요한 만큼만 엽니다.
