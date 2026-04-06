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
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY`는 온보딩 생성/연결 API에서 서버 측 DB 작업에 사용됩니다.
절대 `NEXT_PUBLIC_` 접두사로 노출하지 마세요.

`CRON_SECRET`은 타임아웃 스케줄러 API(`/api/cron/ticket-requests/timeout`) 호출 인증에 사용됩니다.

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

## Ticket Request Timeout Scheduler

만료된 `pending` 요청을 `rules.timeout_action` 기준으로 자동 처리하는 API가 추가되어 있습니다.

- Endpoint: `POST /api/cron/ticket-requests/timeout`
- Header: `Authorization: Bearer <CRON_SECRET>` 또는 `x-cron-secret: <CRON_SECRET>`

처리 규칙:

- `auto_approve` → 요청 `approved`, 티켓 `used`, `ticket_logs` 생성
- `auto_reject` → 요청 `rejected`, 티켓 `available`
- `return` → 요청 `returned`, 티켓 `available`

### Supabase에서 스케줄 등록 예시 (HTTP 호출)

프로젝트 SQL Editor에서 `pg_cron`, `pg_net` 확장 활성화 후 아래처럼 잡을 등록할 수 있습니다.

```sql
select cron.schedule(
  'ticket-requests-timeout-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://<your-app-domain>/api/cron/ticket-requests/timeout',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <CRON_SECRET>'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

> 운영 환경에서는 스케줄 호출 URL을 실제 배포 주소(예: Vercel 도메인 + `/api/cron/ticket-requests/timeout`)로 설정하고,
> `CRON_SECRET`은 SQL에 하드코딩하지 말고 Vault/Secret 관리 기능을 사용하세요.

### 참고: SQL Cron 방식

타임아웃 처리 로직을 SQL 함수로 옮기면(네트워크 호출 없이) 더 단순하고 보안 표면이 작아집니다.
현재 코드베이스는 TypeScript API에서 상태 전이/롤백을 처리하도록 구현되어 있어 HTTP 스케줄 방식으로 먼저 제공했습니다.

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

| 문서                                                  | 설명                                         |
| ----------------------------------------------------- | -------------------------------------------- |
| [overview.md](./docs/overview.md)                     | 서비스 개요 · 기능 목록 · 기술 스택 · 로드맵 |
| [erd.md](./docs/erd.md)                               | 데이터 모델 · 테이블 정의 · 주요 쿼리        |
| [ia.md](./docs/ia.md)                                 | 화면 구조 · 라우트 목록 · 라우팅 규칙        |
| [wireframes.md](./docs/wireframes.md)                 | 와이어프레임 · 화면별 설계 포인트            |
| [sprint.md](./docs/sprint.md)                         | 스프린트 계획 · 태스크 체크리스트            |
| [auth-e2e-checklist.md](./docs/auth-e2e-checklist.md) | 인증 플로우 수동 E2E 점검 체크리스트         |
