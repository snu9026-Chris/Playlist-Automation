# Loopify · Supabase 셋업 가이드

새 환경(다른 PC, 새로 클론한 상태 등)에서 Loopify를 돌릴 때, **Supabase 쪽에서 무엇을 준비해야 하는지** 정리한 체크리스트.

> Loopify는 **Loopdrop의 Supabase 프로젝트를 공유**해서 쓴다. 별도 프로젝트를 새로 만드는 게 아니라, 같은 프로젝트에 테이블만 추가하는 구조.

---

## 1. 필요한 환경변수 (`.env.local`)

`Loopify/app/.env.local.example`을 복사해서 `Loopify/app/.env.local`을 만들고, 아래 3개 키를 채운다.

| 키 | 어디서 받나 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → **Project URL** | 클라이언트/서버 공통 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → **anon public** | 브라우저용 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → **service_role** (🚨 절대 클라이언트 노출 금지) | API Routes 서버 전용 |

> ⚠️ `.env.local`은 `.gitignore`로 차단되어 있다. 절대 커밋하지 말 것.

---

## 2. 필요한 테이블 (4개 + 1개)

### Loopify가 새로 만드는 테이블 4개
- `track_bookmarks` — 영감 저장소 (Spotify 트랙 북마크)
- `playlist_projects` — 플레이리스트 프로젝트 본체 (테마, 상태, 결과 URL)
- `playlist_tracks` — 슬롯별 진행 상태 (mp3/이미지/숏폼/메타데이터)
- `scheduled_uploads` — 예약 발행 큐 (영상 파일 경로 + YouTube 메타)

### Loopdrop이 이미 만들어 둔 테이블 (재사용)
- `platforms` — YouTube OAuth 토큰 저장소 (Loopify가 직접 만들지 않음. 이미 존재한다고 가정)

### 적용 순서

Supabase Dashboard → SQL Editor → 새 쿼리 → 아래 파일들을 **순서대로** 한 번씩 실행.

| 순서 | 파일 | 설명 |
|---|---|---|
| 1 | `supabase-schema.sql` | 4개 테이블 + 인덱스 + `updated_at` 자동 갱신 트리거 |
| 2 | `supabase-migration-soft-delete.sql` | 프로젝트 소프트 삭제 (`deleted_at` 컬럼 + status `'deleted'`) |
| 3 | `supabase-migration-scheduled-uploads.sql` | 예약 업로드 컬럼 확장 + Storage `media` 버킷 + RLS 정책 |

> 모두 `IF NOT EXISTS` / `IF NOT NULL` 등으로 멱등하게 작성되어 있어, 이미 적용된 환경에서 다시 돌려도 안전.

---

## 3. Storage 버킷

| 버킷명 | 공개 여부 | 용도 |
|---|---|---|
| `media` | **public** | 이미지(슬롯 썸네일), 예약 업로드용 mp4 영상 파일 |

- 위 마이그레이션 #3을 실행하면 자동 생성됨.
- RLS 정책은 **single-user 사이드 프로젝트 가정**으로 anon 자유 select/insert/delete 허용. 다중 사용자 확장 시 `auth.uid()` 기반으로 좁힐 것.

### 디렉토리 컨벤션 (코드에서 사용 중)
- `images/{project_id}/{slot_index}-{timestamp}.png` — 슬롯별 이미지
- `scheduled/{uuid}.mp4` — 예약 업로드 영상

---

## 4. 코드에서 Supabase를 쓰는 곳 (참고용)

Loopify는 `src/lib/supabase.ts`의 두 클라이언트로 접근.

- **`createBrowserClient()`** — 브라우저, anon key
- **`createServerClient()`** — API Routes, service_role key

주요 사용처 (변경 시 영향 범위 파악용):

| 영역 | 파일 |
|---|---|
| 프로젝트 CRUD | `src/app/api/projects/**/*.ts` |
| 트랙 슬롯 | `src/app/api/projects/[id]/tracks/**/*.ts`, `images/**`, `climax/**` |
| 북마크 | `src/app/api/bookmarks/route.ts` |
| 예약 업로드 | `src/app/api/uploads/**/*.ts`, `src/app/api/cron/upload/route.ts` |
| YouTube OAuth | `src/app/api/auth/**/*.ts`, `src/lib/youtube-auth.ts` (← `platforms` 테이블) |
| 프론트 대시보드 | `src/app/page.tsx`, `src/app/uploads/page.tsx` |

---

## 5. 셋업 검증 체크리스트

새 환경 셋업 후 동작 확인용:

- [ ] `npm run dev` 실행 시 `Supabase URL/Key undefined` 같은 에러 없음
- [ ] 메인 페이지(`/`)에서 기존 프로젝트 목록이 로드됨 (없으면 빈 상태 UI)
- [ ] 영감 저장소(`/inspiration`)에서 Spotify 트랙 북마크 추가 → DB에 row 생김
- [ ] 새 프로젝트 생성 → `playlist_projects` + `playlist_tracks` 15개 row 생성
- [ ] 이미지 생성 1슬롯 → Storage `media` 버킷에 png 업로드, `playlist_tracks.image_url` 채워짐
- [ ] 예약 업로드 페이지(`/uploads`)에서 mp4 드롭 → `scheduled_uploads` row 생성, `media` 버킷에 영상 업로드

---

## 6. 자주 막히는 포인트

- **`platforms` 테이블 없음 에러** → Loopdrop 프로젝트 SQL이 먼저 적용되어 있어야 함. Loopdrop 쪽 README/스키마 먼저 확인.
- **YouTube 업로드 시 401/403** → `platforms` 테이블에 토큰이 없거나 만료. `/setup` 또는 OAuth 재연결 플로우 필요.
- **Storage 업로드 403** → 마이그레이션 #3의 RLS 정책이 미적용. `media` 버킷 정책 다시 확인.
- **`service_role` 키를 `NEXT_PUBLIC_*`에 넣은 경우** → 브라우저로 노출되니 즉시 키 회전(rotate) 후 서버 전용으로 다시 분리.
