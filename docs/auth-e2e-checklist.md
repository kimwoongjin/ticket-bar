# TicketBar — Auth E2E 체크리스트 (Week 1)

> 범위: Google OAuth + 이메일 회원가입/로그인 + 미들웨어 라우트 보호

---

## 1) 테스트 전 준비

### 앱 실행

```bash
npm install
npm run dev
```

- 앱 URL: `http://localhost:3000`

### 환경 변수

`.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Supabase 설정 확인

1. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs:
     - `http://localhost:3000/auth/callback`

2. **Authentication → Providers → Google**
   - Enable sign in with Google: ON
   - Client ID / Secret 입력 완료

3. **Authentication → Providers → Email**
   - 테스트 중: `Confirm email` ON/OFF를 명확히 기록
   - 배포 전: 반드시 ON

4. **Google Cloud Console (OAuth Client - Web)**
   - Authorized redirect URI:
     - `https://<project-ref>.supabase.co/auth/v1/callback`
   - Authorized JavaScript origins:
     - `http://localhost:3000`

---

## 2) 테스트 계정/데이터 준비

- 테스트 계정 2개 권장
  - issuer 역할 계정
  - receiver 역할 계정
- `couple_members`에 역할/커플 연결 데이터가 들어가 있어야 미들웨어 분기 검증 가능

---

## 3) 시나리오별 체크리스트

## A. 이메일 회원가입

### A-1. 정상 회원가입 (Confirm email OFF)

- [ ] `/signup`에서 이름/이메일/비밀번호(8자 이상) 입력 후 가입
- [ ] 성공 후 홈(`/`) 또는 후속 경로로 이동
- [ ] Supabase Auth Users에 유저 생성 확인

기대결과:

- API 200 응답, 가입 성공 메시지/리다이렉트 정상

### A-2. 정상 회원가입 (Confirm email ON)

- [ ] `/signup` 가입 요청
- [ ] 이메일 인증 안내 메시지 노출 확인
- [ ] 메일 수신/인증 링크 동작 확인

기대결과:

- `emailConfirmationRequired` 흐름 정상

### A-3. 유효성 검증

- [ ] 잘못된 이메일 형식 입력
- [ ] 비밀번호 8자 미만 입력
- [ ] 비밀번호 확인 불일치

기대결과:

- 각 케이스에 맞는 검증 메시지 노출

---

## B. 이메일 로그인

### B-1. 정상 로그인

- [ ] `/login`에서 유효한 이메일/비밀번호로 로그인
- [ ] 로그인 성공 후 리다이렉트 확인

기대결과:

- API 200 응답, 세션 생성

### B-2. 실패 로그인

- [ ] 잘못된 비밀번호 입력
- [ ] 존재하지 않는 계정 입력

기대결과:

- 에러 메시지 노출, 세션 미생성

---

## C. Google OAuth 로그인

### C-1. 정상 OAuth

- [ ] `/login` → Google 로그인 클릭
- [ ] Google 동의 화면 이동
- [ ] `/auth/callback` 복귀 후 로그인 완료

기대결과:

- callback code exchange 성공
- `/auth/error`로 가지 않고 정상 경로로 이동

### C-2. OAuth 설정 오류 케이스

- [ ] Redirect URL 일부러 누락 후 시도

기대결과:

- 로그인 실패 재현
- Supabase Auth Logs / Google 콘솔에서 원인 식별 가능

---

## D. 미들웨어 라우트 보호 규칙

### D-1. 비로그인 보호 라우트 차단

- [ ] 비로그인 상태에서 `/home`, `/tickets`, `/settings` 접근

기대결과:

- `/login?next=...`로 리다이렉트

### D-2. 로그인 사용자의 auth 페이지 접근 제한

- [ ] 로그인 상태에서 `/login`, `/signup` 접근

기대결과:

- `/`로 리다이렉트

### D-3. 커플 미연결 분기

- [ ] 로그인 + 커플 미연결 상태로 `/home` 접근

기대결과:

- `/onboarding` 리다이렉트

### D-4. 커플 연결 분기

- [ ] 로그인 + 커플 연결 상태로 `/onboarding` 접근

기대결과:

- `/home` 리다이렉트

### D-5. issuer 전용 경로 검증

- [ ] receiver 계정으로 `/settings/rules` 접근

기대결과:

- `/settings` 리다이렉트

---

## 4) 장애 발생 시 빠른 점검 순서

1. Supabase Auth Logs에서 에러 코드 확인
2. URL Configuration의 Redirect URL 오탈자 확인
3. Google OAuth Client의 redirect URI 불일치 확인
4. `couple_members` 데이터(역할/커플연결) 존재 확인
5. 브라우저 쿠키 차단/서드파티 로그인 팝업 차단 확인

---

## 5) 배포 전 체크 (필수)

- [ ] `Confirm email`을 ON으로 복구
- [ ] 운영 도메인을 Site URL/Redirect URLs에 반영
- [ ] Google OAuth Client에 운영 origin/redirect URI 반영
- [ ] 운영 환경변수 재확인
