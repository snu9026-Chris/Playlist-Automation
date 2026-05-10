# Loopify · Supabase 셋업 가이드

새 환경(다른 PC, 새로 클론한 상태 등)에서 Loopify를 돌릴 때, **Supabase 쪽에서 무엇을 준비해야 하는지** 정리한 체크리스트.

> Loopify는 원본 저자(@snu9026-Chris)는 **Loopdrop의 Supabase 프로젝트를 공유**해서 쓰지만, **외부 클론 사용자는 본인의 새 Supabase 프로젝트를 만들어** 아래 SQL을 적용하면 된다. (단, `platforms` 테이블은 Loopdrop 쪽 자료가 따로 필요 — 6번 섹션 참고)

---

## TL;DR — Vercel vs Supabase 자동화

| 항목 | Vercel | Supabase |
|---|---|---|
| 가입 | 자동으로 personal team 생성 | 자동으로 personal organization 생성 |
| **프로젝트 생성** | ✅ CLI/MCP가 자동 (`vercel deploy` 첫 호출 시 폴더 기준 새 프로젝트 생성) | ❌ **수동 1회** (대시보드에서 New Project 클릭) |
| 환경변수 등록 | ✅ `vercel env add` 또는 대시보드 | (해당 없음) |
| 테이블 / 인덱스 / RLS / Storage 정책 | (해당 없음) | ✅ MCP `apply_migration` 또는 SQL Editor에 SQL 붙여넣기 |
| TypeScript 타입 / Edge Function | (해당 없음) | ✅ MCP 자동 |

**결론**:
- **Vercel**: 가입만 하면 0 → 배포까지 풀 자동.
- **Supabase**: 가입 + **프로젝트 1번 수동 클릭** + project_ref 연결까지 한 번 해두면, 그 후엔 MCP가 다 처리.

새 환경에서 Supabase는 **딱 한 번 대시보드 들렀다 오는 단계**가 있다고 생각하면 됨.

---

## 0. 프로젝트 생성 (수동 1회, 5분)

> ⚠️ 자동화 안 되는 유일한 단계. 그 후엔 모든 게 SQL/MCP로 자동.

### 0-1. 가입
[supabase.com](https://supabase.com) 가입 — GitHub 연동 권장. personal organization 자동 생성됨.

### 0-2. New Project 클릭
대시보드에서 **New Project**:

| 항목 | 권장 값 |
|---|---|
| Name | `loopify` (자유) |
| Database Password | 강한 비밀번호 (별도 저장 — 분실 시 곤란) |
| Region | `Northeast Asia (Seoul)` (한국 사용자 latency 최소) |
| Plan | `Free` (시작용 충분, 500MB DB + 1GB Storage) |

생성 ~2분 대기.

### 0-3. (선택) project_ref 메모
"project_ref"는 Supabase가 프로젝트마다 자동 발급하는 고유 식별자 (20자 랜덤 영소문자, 예: `rmpqsqpibsuxtlbmimgv`).

```
https://supabase.com/dashboard/project/rmpqsqpibsuxtlbmimgv
                                       ^^^^^^^^^^^^^^^^^^^^
                                       project_ref
```

**언제 쓰나**: Supabase MCP를 Claude Code에 등록할 때만 (`--project-ref=...`). 그 외엔 안 씀.
**Dashboard SQL Editor로만 셋업하면 신경 안 써도 됨.**

### 0-4. 그래서 프로젝트 안에서 뭘 만들어야 하나?
**아무것도.** 프로젝트(=빈 DB 인스턴스) 자체만 만들면 끝.
- 테이블, 인덱스, 트리거, Storage 버킷, RLS 정책 → 모두 아래 섹션 2의 SQL 파일들이 만든다
- 사람이 직접 만들 건 0개

### 0-5. 왜 프로젝트 생성만 수동인가
Supabase MCP 도구 목록을 보면:
- ✅ `apply_migration`, `execute_sql`, `list_tables`, `deploy_edge_function`, `list_branches` 등
- ❌ `create_project` **없음** (의도적)

이유: 프로젝트 생성에 들어가는 결정 — **리전 / DB 비밀번호 / 요금제 / billing** — 이 자동화에 부적합. Supabase가 의도적으로 사람 손을 거치게 함.

### 0-6. 진짜 풀 스텝 (Dashboard만 쓰는 경우)

| # | 어디서 | 무엇을 |
|---|---|---|
| 1 | supabase.com | 가입 (GitHub login 권장) |
| 2 | 대시보드 | **New Project** 클릭 |
| 3 | 폼 | Name / DB Password(저장!) / Region(Seoul) / Plan(Free) |
| 4 | 폼 | **Create new project** → 2분 대기 |
| 5 | SQL Editor | New Query → `Loopify/app/supabase-schema.sql` 붙여넣고 **Run** |
| 6 | SQL Editor | New Query → `Loopify/app/supabase-migration-soft-delete.sql` 붙여넣고 **Run** |
| 7 | SQL Editor | New Query → `Loopify/app/supabase-migration-scheduled-uploads.sql` 붙여넣고 **Run** |
| 8 | Settings → API | **Project URL** 복사 → `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` |
| 9 | Settings → API | **anon public** 복사 → `.env.local`의 `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 10 | Settings → API | **service_role** (reveal) 복사 → `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY` |

**이게 전부.** 11단계 이후는 없음. 이 시점부터는 `npm run dev` 돌리면 동작.

---

## 🤖 Claude Code에 한 번에 시키는 방법 (클론 사용자용)

이 가이드를 직접 읽고 따라하기 귀찮다면, Claude Code(또는 Claude.ai)에 아래처럼 던지면 된다.

### 시나리오 A — Supabase MCP가 연결돼 있을 때 (Claude가 직접 적용)

> Supabase MCP 셋업: [공식 문서](https://supabase.com/docs/guides/getting-started/mcp) 참고. 본인 Supabase 프로젝트 access token을 Claude Code에 등록.

```
@SUPABASE_SETUP.md 보고 내 Supabase 프로젝트에 필요한
테이블·마이그레이션·Storage 버킷·RLS 정책을 다 적용해줘.

먼저 list_tables / list_migrations로 현재 상태 확인하고,
이미 적용된 건 건너뛰고 빠진 것만 apply_migration으로 추가해.
적용 후 list_tables로 결과 보여줘.
```

### 시나리오 B — Supabase MCP 없이 (Dashboard에 직접 붙여넣기)

```
@SUPABASE_SETUP.md 보고, 내가 Supabase Dashboard SQL Editor에
차례대로 붙여넣을 수 있게 SQL 블록을 순서대로 정리해줘.
어느 파일에서 가져온 건지도 같이 표시.
```

### 시나리오 C — `.env.local` 템플릿만 만들고 싶을 때

```
@SUPABASE_SETUP.md 보고 Loopify/app/.env.local 템플릿 파일을
만들어줘. 키 값은 빈 칸으로 두고, 각 키 옆에 어디서 받는지 한 줄 주석.
```

> 💡 `@` 멘션은 Claude Code에서 파일 첨부 syntax. 일반 Claude.ai에서는 이 파일 내용을 복사해서 붙여 넣으면 됨.

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

| 순서 | 파일 (위치: 레포 루트 기준) | 설명 |
|---|---|---|
| 1 | `Loopify/app/supabase-schema.sql` | 4개 테이블 + 인덱스 + `updated_at` 자동 갱신 트리거 |
| 2 | `Loopify/app/supabase-migration-soft-delete.sql` | 프로젝트 소프트 삭제 (`deleted_at` 컬럼 + status `'deleted'`) |
| 3 | `Loopify/app/supabase-migration-scheduled-uploads.sql` | 예약 업로드 컬럼 확장 + Storage `media` 버킷 + RLS 정책 |

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

Loopify는 `Loopify/app/src/lib/supabase.ts`의 두 클라이언트로 접근.

- **`createBrowserClient()`** — 브라우저, anon key
- **`createServerClient()`** — API Routes, service_role key

주요 사용처 (변경 시 영향 범위 파악용. 모두 `Loopify/app/` 하위):

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

- **`platforms` 테이블 없음 에러** → 이 레포에는 `platforms` DDL이 포함돼 있지 않다 (Loopdrop 쪽에서 만든 테이블 재사용 구조). 외부 클론 사용자는 임시로 아래 최소 스키마로 직접 만들 것:
  ```sql
  CREATE TABLE IF NOT EXISTS platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,            -- 예: 'youtube'
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
  > 정확한 컬럼 구조는 `Loopify/app/src/lib/youtube-auth.ts`와 `Loopify/app/src/app/api/auth/callback/route.ts`에서 사용 패턴 보고 맞출 것.
- **YouTube 업로드 시 401/403** → `platforms` 테이블에 토큰이 없거나 만료. `/setup` 또는 OAuth 재연결 플로우 필요.
- **Storage 업로드 403** → 마이그레이션 #3의 RLS 정책이 미적용. `media` 버킷 정책 다시 확인.
- **`service_role` 키를 `NEXT_PUBLIC_*`에 넣은 경우** → 브라우저로 노출되니 즉시 키 회전(rotate) 후 서버 전용으로 다시 분리.
- **새 Supabase 키 명칭 (`publishable` / `secret`)** → 최근 만든 프로젝트는 Dashboard에 `anon` 대신 `publishable`, `service_role` 대신 `secret`으로 표시될 수 있음. 같은 키니까 그대로 매핑하면 됨.
