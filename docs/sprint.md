# TicketBar — 스프린트 계획

> MVP 기준 6주 / 사이드 프로젝트 페이스 (주당 4~5 태스크)

---

## 요약

| 항목 | 내용 |
|------|------|
| 총 기간 | 6주 |
| 총 태스크 | 28개 |
| FE 태스크 | 18개 |
| BE 태스크 | 10개 |
| 주당 목표 | 4~5개 |

---

## Week 1 — 프로젝트 셋업 + 인증

- [ ] **Next.js 14 + Supabase 초기 셋업** `인프라`
  - 프로젝트 생성, ESLint/Prettier, 폴더 구조, 환경변수
- [ ] **Supabase DB 스키마 마이그레이션** `BE`
  - ERD 기반 테이블 생성, RLS 정책 초안
- [ ] **Google OAuth + 이메일 인증 구현** `FE+BE`
  - Supabase Auth 연동, 세션 관리, 미들웨어 라우트 보호
- [ ] **/login · /signup 페이지** `FE`
  - UI 구현, 폼 유효성 검사, 에러 핸들링
- [ ] **PWA 기본 설정** `인프라`
  - manifest.json, next-pwa, 아이콘, 기본 Service Worker

---

## Week 2 — 온보딩 + 커플 연동

- [ ] **온보딩 플로우 UI** `FE`
  - 역할 선택 → 코드 생성/입력 스텝 구현
- [ ] **초대 코드 생성 · 검증 API** `BE`
  - couples 테이블, invite_code 생성, 24시간 만료 처리
- [ ] **커플 연결 완료 처리** `FE+BE`
  - couple_members 생성, 역할 저장, 홈으로 리다이렉트
- [ ] **룰 초기값 설정 UI (/settings/rules)** `FE`
  - 타임아웃 시간, 자동 처리 방식, 자동 발급 주기 설정 폼

---

## Week 3 — 티켓 발급 시스템

- [ ] **수동 티켓 발급 API + 모달 UI** `FE+BE`
  - 장수 · 유효기간 설정, tickets 테이블 insert, issuer 권한 체크
- [ ] **자동 발급 스케줄러** `BE`
  - Supabase pg_cron, 주기별 티켓 자동 생성
- [ ] **티켓 만료 처리** `BE`
  - expires_at 기준 상태 자동 업데이트 (cron)
- [ ] **/tickets 목록 페이지** `FE`
  - 상태별 필터, 월별 그룹핑, 티켓 카드 컴포넌트

> **주의**: 자동 발급 스케줄러는 Supabase `pg_cron` 사용 (무료 플랜 가능). Edge Function cron은 유료 플랜 필요.

---

## Week 4 — 티켓 요청 · 승인 플로우

- [ ] **티켓 사용 요청 API** `BE`
  - ticket_requests insert, expires_at 계산 (rules.timeout_hours 기준)
- [ ] **요청 바텀시트 UI** `FE`
  - 티켓 선택, 메모 입력, 요청 전송
- [ ] **승인 · 거절 · 반환 API** `BE`
  - request 상태 업데이트, ticket 상태 변경, ticket_logs 생성
- [ ] **승인/거절 바텀시트 UI** `FE`
  - 요청 정보 표시, 타임아웃 바, 거절 사유 입력, 완료 상태
- [ ] **타임아웃 자동 처리 스케줄러** `BE`
  - 만료된 pending 요청을 rules.timeout_action 기준으로 자동 처리

---

## Week 5 — 홈 + 로그 + Web Push

- [ ] **/home 페이지** `FE`
  - 잔여 티켓 히어로, 대기 요청 카드, 빠른 요청 CTA
- [ ] **Supabase Realtime 연동** `FE`
  - 요청 상태 실시간 반영 (홈 · 티켓 목록)
- [ ] **/logs 타임라인 페이지** `FE`
  - ticket_logs 기반 사용 기록, 날짜별 그룹핑
- [ ] **Web Push 구현** `FE+BE`
  - Service Worker, push_subscriptions 저장, 요청/승인/거절 시 알림 발송

> **주의**: Web Push는 HTTPS 환경에서만 동작. 로컬 테스트 대신 Vercel 프리뷰 배포 환경에서 테스트 권장.

---

## Week 6 — 마무리 + 배포

- [ ] **설정 페이지 완성** `FE`
  - /settings/profile · /settings/notifications · /settings/couple
- [ ] **에러 핸들링 · 로딩 상태 정비** `FE`
  - 전체 페이지 에러 바운더리, 스켈레톤 UI, 토스트 알림
- [ ] **RLS 정책 강화 · 보안 점검** `BE`
  - role 기반 접근 제어 검증, API 파라미터 검증
- [ ] **Vercel 배포 + 도메인 설정** `인프라`
  - 환경변수 설정, HTTPS 확인, PWA 설치 테스트
- [ ] **실사용 테스트 · 버그픽스** `FE+BE`
  - 실제 커플 시나리오 E2E 테스트, 엣지케이스 처리

---

## V2 백로그

- [ ] 통계 뷰 (/stats) — 월별 사용량, 잔여 티켓 추이, 승인율
- [ ] 패널티 / 보너스 시스템 — 룰 기반 자동 조정
- [ ] 이모지 반응 — 로그 항목에 파트너 반응
