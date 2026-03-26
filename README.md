# TicketBar

커플 간 약속을 티켓으로 관리하는 룰 기반 협약 플랫폼입니다.

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

`http://localhost:3000` 에 접속해 초기 화면을 확인할 수 있습니다.

## Environment Variables

`.env.local` 파일에 아래 값을 설정하세요.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Supabase Migration

### npm dev dependency로 사용
```bash
npm install supabase --save-dev
npx supabase --help
npx supabase init

npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```
docker desktop이 실행돼야 합니다.

초기 스키마/정책은 `supabase/migrations/20260325090000_init_schema.sql`에 정의되어 있습니다.

## Project Structure

```text
src/
├── app/
├── components/
├── hooks/
├── utils/
├── types/
├── api/
└── constants/
```

## Planning Docs

| 문서 | 설명 |
| --- | --- |
| [overview.md](./docs/overview.md) | 서비스 개요 · 기능 목록 · 기술 스택 · 로드맵 |
| [erd.md](./docs/erd.md) | 데이터 모델 · 테이블 정의 · 주요 쿼리 |
| [ia.md](./docs/ia.md) | 화면 구조 · 라우트 목록 · 라우팅 규칙 |
| [wireframes.md](./docs/wireframes.md) | 와이어프레임 · 화면별 설계 포인트 |
| [sprint.md](./docs/sprint.md) | 스프린트 계획 · 태스크 체크리스트 |
