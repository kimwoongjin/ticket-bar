# TicketBar — 데이터 모델 (ERD)

---

## 테이블 관계도

```
users ──< couple_members >── couples ──── rules
                                   └──< tickets ──< ticket_requests ──< ticket_logs
users ──< push_subscriptions
users ──< tickets (issued_by)
users ──< ticket_requests (requested_by)
```

---

## 테이블 정의

### users
Supabase Auth와 연동되는 유저 정보 테이블.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | Supabase Auth uid |
| email | string | 이메일 |
| name | string | 표시 이름 |
| avatar_url | string | 프로필 이미지 URL |
| auth_provider | string | `google` \| `email` |
| created_at | timestamp | 가입일 |

---

### couples
커플 단위 룸. 두 유저가 하나의 couple을 공유한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | — |
| invite_code | string UK | 초대 코드 (예: TB-4829) |
| status | string | `pending` \| `active` \| `inactive` |
| created_at | timestamp | — |

---

### couple_members
유저와 커플의 다대다 연결 테이블. 역할 정보 포함.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | — |
| couple_id | uuid FK | couples.id |
| user_id | uuid FK | users.id |
| role | string | `issuer` \| `receiver` |
| joined_at | timestamp | — |

---

### rules
커플별 룰 설정. issuer가 단독으로 설정.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | — |
| couple_id | uuid FK | couples.id |
| timeout_hours | int | 요청 응답 대기 시간 |
| timeout_action | string | `auto_approve` \| `auto_reject` \| `return` |
| auto_issue_cycle | string | `weekly` \| `monthly` \| `none` |
| auto_issue_count | int | 주기당 발급 장수 |
| updated_at | timestamp | — |

---

### tickets
발급된 티켓. 유효기간 및 상태 관리.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | — |
| couple_id | uuid FK | couples.id |
| issued_by | uuid FK | users.id (발급자) |
| status | string | `available` \| `requested` \| `used` \| `expired` |
| expires_at | timestamp | 유효기간 |
| used_at | timestamp | 사용 확정 시각 |
| created_at | timestamp | 발급 시각 |

**상태 흐름:**
```
available → requested → used
                      → expired
         → expired (유효기간 초과 시 cron 처리)
```

---

### ticket_requests
티켓 사용 요청. 승인 플로우의 핵심 테이블.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | — |
| ticket_id | uuid FK | tickets.id |
| requested_by | uuid FK | users.id (수신자) |
| status | string | `pending` \| `approved` \| `rejected` \| `returned` |
| memo | string | 요청 메모 |
| expires_at | timestamp | 타임아웃 시각 (rules.timeout_hours 기준) |
| responded_at | timestamp | 파트너 응답 시각 |
| created_at | timestamp | 요청 시각 |

**상태 흐름:**
```
pending → approved  → (ticket_logs 생성, ticket.status = used)
        → rejected  → (ticket.status = available 복구)
        → returned  → (ticket.status = available 복구, 재요청 가능)
```

---

### ticket_logs
사용 확정된 기록. 로그 타임라인의 데이터 소스.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | — |
| ticket_id | uuid FK | tickets.id |
| request_id | uuid FK | ticket_requests.id |
| memo | string | 사용 메모 |
| emoji_reaction | string | 파트너 이모지 반응 (V2) |
| created_at | timestamp | 확정 시각 |

---

### push_subscriptions
Web Push 구독 정보.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | — |
| user_id | uuid FK | users.id |
| endpoint | text | Push 엔드포인트 URL |
| p256dh | text | 암호화 키 |
| auth | text | 인증 시크릿 |
| created_at | timestamp | — |

---

## 주요 쿼리 패턴

### 이번 달 잔여 티켓 수
```sql
SELECT COUNT(*)
FROM tickets
WHERE couple_id = $couple_id
  AND status = 'available'
  AND expires_at > NOW()
  AND created_at >= date_trunc('month', NOW());
```

### 대기 중인 요청 조회
```sql
SELECT tr.*, t.expires_at as ticket_expires_at
FROM ticket_requests tr
JOIN tickets t ON t.id = tr.ticket_id
WHERE t.couple_id = $couple_id
  AND tr.status = 'pending'
  AND tr.expires_at > NOW();
```

### 타임아웃된 요청 처리 (cron)
```sql
UPDATE ticket_requests
SET status = (
  SELECT timeout_action FROM rules
  WHERE couple_id = (
    SELECT couple_id FROM tickets WHERE id = ticket_id
  )
)
WHERE status = 'pending'
  AND expires_at < NOW();
```
