# LoopDrop — 멀티플랫폼 콘텐츠 발행 커맨드 센터

> **프로젝트 기획 문서 · v2.0**
> 작성일: 2026-04-13 · 최종 수정: 2026-04-17

---

## 프로젝트 개요

**LoopDrop**(구 Spread)은 하나의 영상/이미지 콘텐츠를 유튜브·인스타그램·쓰레드·틱톡·X 5개 플랫폼에 한 번에 발행할 수 있는 1인 크리에이터 전용 커맨드 센터 웹 서비스다.

영상 하나를 각 플랫폼에 개별 업로드하는 반복 작업을 제거하고, AI 추천·트렌드 탐색·영상 편집까지 통합 제공한다.

---

# Phase 1 — 리서치 (Context Priming)

## 문제 정의

1인 크리에이터가 하나의 숏폼 영상을 여러 SNS 플랫폼에 올릴 때, 각 플랫폼에 직접 접속해 개별적으로 업로드·메타데이터 입력을 반복해야 하는 비효율이 발생한다. 이 반복 작업은 콘텐츠 제작보다 운영에 더 많은 시간을 쓰게 만든다.

## 서비스 가치

**"한 곳에서 한 번에 끝낸다."**

하나의 대시보드에서 영상을 업로드하고, 각 플랫폼에 맞는 정보를 AI가 추천하고, 원하는 플랫폼 전부에 동시 발행까지 끝낸다.

## 타겟 사용자

- **Primary:** 본인(운영자) — 1인 숏폼 크리에이터
- **Profile:** 5개 플랫폼(유튜브, 인스타, 쓰레드, 틱톡, X)에 동시 운영하며 반복 업로드 작업을 자동화하고 싶은 사용자

## 기술 스택 (확정)

| 영역 | 선정 기술 | 비고 |
|---|---|---|
| 프론트엔드 | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 | UI + API Routes |
| DB / 스토리지 | Supabase (PostgreSQL + Storage) | 무료 플랜 (Storage 50MB) |
| 호스팅 | Vercel | 무료 Hobby 플랜 |
| 발행 엔진 | Next.js API Routes (JS 직접 호출) | n8n 제거, 직접 구현 |
| AI 추천 | OpenAI GPT API (gpt-4o-mini) | 플랫폼별 메타데이터 추천 |
| 영상 편집 (Phase 2) | Remotion | 로컬 PC에서 렌더링 |
| 로컬 연결 (Phase 2) | Cloudflare Tunnel | Vercel ↔ 집 PC 연결 |

**아키텍처 (현재 구현)**

```
사용자 브라우저 (어디서든 접속)
         ↓ HTTPS
Vercel (Next.js — UI + API Routes)
  ├── Supabase: OAuth 토큰, 발행 이력, 플랫폼 상태
  ├── Supabase Storage: 업로드된 미디어 파일 (공개 URL)
  ├── Next.js API Routes: 각 플랫폼 API 직접 호출 (발행)
  ├── OpenAI GPT API: AI 추천
  └── 각 플랫폼 OAuth + 발행 API
      └── YouTube / Instagram / Threads / TikTok / X
```

**Phase 2 추가 아키텍처 (영상 편집)**

```
Vercel → Cloudflare Tunnel → 집 PC
  ├── Node.js 서버: POST /render 엔드포인트
  ├── Remotion 렌더링 엔진
  └── 로컬 폴더: 완성된 mp4 저장
```

**비용 구조**

| 항목 | 월 비용 |
|---|---|
| Vercel (Hobby) | 0원 |
| Supabase (Free) | 0원 |
| Cloudflare Tunnel | 0원 |
| Remotion (개인용) | 0원 |
| GPT API | 사용량 기반 |
| **총 고정비** | **0원** |

## 레퍼런스

- **기존 Spread 프로토타입** — 좌측 사이드바 + 우측 콘텐츠 패널의 깔끔한 섹션 분리 구조 유지
- **playboard.co** — 숏폼 트렌드 탐색 UI 방향 참고

## MVP 범위

**Phase 1 (MVP) — 완료 ✅**
- 콘텐츠 발행 (즉시 발행) ✅
- SNS 계정 연결 (OAuth 5개 플랫폼) ✅
- 발행 히스토리 ✅
- 대시보드 ✅
- 트렌드 탐색 — 유튜브(공식 차트) + 인스타(해시태그 기반, 앱 리뷰 후) ✅
- AI 추천 (플랫폼별 해시태그·설명·첫 댓글) ✅
- 파일 업로드 (Supabase Storage) ✅
- Vercel 배포 (https://loopdrop.vercel.app) ✅

**Phase 2**
- 영상 편집 (Remotion) — 사진 + 자막 + 음악 → 숏폼 mp4 생성, 로컬 저장
- 콘텐츠 캘린더 + Vercel Cron Jobs 예약 발행
- Instagram 캐러셀 (다중 이미지) 발행
- CSV 대량 업로드

---

# Phase 2 — 기능 기획 (Feature Spec)

## 핵심 기능 체계

서비스는 크게 **7개 섹션**으로 구성되며, 각 섹션은 사이드바의 메뉴에 1:1로 매핑된다.

### 섹션 1. 대시보드 ✅

서비스 접속 후 첫 화면. 전체 운영 현황을 한눈에 파악하는 용도.

- **SNS 계정 연결 상태 카드** — 5개 플랫폼의 연결/만료 상태 표시
- **플랫폼별 최근 발행 이력** — 각 플랫폼의 최근 업로드 목록
- **API 할당량 / 잔여량** — 각 플랫폼 API의 사용량 및 남은 호출 표시

### 섹션 2. 트렌드 탐색 ✅

유튜브·인스타그램 인기 콘텐츠를 조회하여 콘텐츠 기획에 참고.

- **유튜브 인기 영상 카드 그리드** — YouTube Data API v3 `mostPopular` 차트 실시간 조회 (1시간 캐시)
- **인스타 해시태그 인기 게시물** — Instagram Graph API `ig_hashtag_search` + `top_media` (앱 리뷰 통과 후 사용 가능)
- **카테고리/플랫폼 필터** — 유튜브 10개 카테고리 + 인스타 8개 카테고리
- **인스타 API 제약:**
  - `Instagram Public Content Access` 앱 리뷰 통과 필수
  - 한 번에 하나의 해시태그만 검색 가능
  - 7일 이내 쿼리당 30개 고유 해시태그 제한
  - Facebook 페이지 + IG 비즈니스 계정 연결 필수

### 섹션 3. 영상 편집 (Phase 2 — Remotion)

여러 장의 사진과 각 장면별 자막, 배경 음악을 조합하여 숏폼 mp4를 생성하는 **독립 기능**.

- **이 기능은 발행 기능과 완전히 분리된 독립 모듈이다.** 영상 편집이 끝나면 결과물 mp4가 **로컬 폴더에 저장**되며, 사용자가 나중에 `콘텐츠 발행` 섹션에서 해당 영상을 수동으로 업로드하여 각 플랫폼에 발행한다. 자동 연결은 없다.
- **발행 섹션에서 여러 장 사진을 영상으로 묶는 기능은 만들지 않는다.** 그 역할은 편집 섹션이 담당하며, 인스타/틱톡 자체의 릴스(슬라이드) 기능도 있으므로 발행 쪽에서는 불필요.
- **입력:** 사진 여러 장 업로드 (드래그 & 드롭), 장면별 자막 텍스트, 배경 음악, (옵션) 장면 표시 시간 및 전환 효과 선택
- **프리뷰:** `@remotion/player`로 웹페이지 내 실시간 미리보기
- **렌더링:** Vercel → Cloudflare Tunnel → 집 PC의 Node.js 서버(`POST /render`) → Remotion 렌더링 → 로컬 폴더 저장
- **완료 후:** 로컬 폴더에 mp4 저장 + 완료 알림. 발행 단계로 자동 이동 없음.
- **인스타/틱톡의 릴스 편집 UI를 LoopDrop에 가져다 쓸 수는 없다** — 각 플랫폼 API는 완성된 파일만 받고, 편집 UI를 외부에 노출하는 API는 없음.

> **참고:** Instagram은 완성된 영상 1개(릴스) 또는 이미지 여러 장(캐러셀/슬라이드)을 업로드할 수 있다. TikTok/YouTube는 완성된 영상 1개만 가능.

### 섹션 4. 콘텐츠 발행 ⭐ 핵심 ✅

서비스의 중심 기능. 하나의 영상/이미지를 다수 플랫폼에 동시 배포.

- **미디어 업로드** — 드래그앤드롭으로 파일 선택 → Supabase Storage에 즉시 업로드 → 공개 URL 생성
- **플랫폼 선택 토글** — 연결된 플랫폼만 선택 가능
- **AI 추천 입력** — 체크된 플랫폼별로 해시태그, 설명문, 첫 댓글을 GPT가 자동 생성
- **플랫폼별 미리보기** — 각 플랫폼에서 실제로 어떻게 보일지 카드 형태로 렌더링
- **즉시 발행 버튼** — Next.js API Route에서 5개 플랫폼 API 동시 호출 (`Promise.allSettled`)
- **발행 후** → 발행 히스토리 페이지로 자동 이동

**발행 구조 (n8n 제거 후):**
```
프론트 → POST /api/publish
  ├── Supabase에 post + publish_logs 저장 (pending)
  ├── publishToPlatform() 동시 호출 (5개)
  │   ├── instagram.ts  — FB Pages → IG Account → 컨테이너 → 발행
  │   ├── youtube.ts    — Google OAuth 갱신 → Resumable Upload
  │   ├── threads.ts    — Threads API 컨테이너 → 발행
  │   ├── tiktok.ts     — Direct Post API → 청크 업로드
  │   └── x.ts          — 미디어 업로드 (INIT/APPEND/FINALIZE) → 트윗
  └── 결과로 publish_logs 업데이트 (success/failed)
```

### 섹션 5. 콘텐츠 캘린더 (Phase 2)

예약 발행 관리 화면.

- **캘린더 뷰** — 예약된 콘텐츠를 날짜별로 시각화
- **Vercel Cron Jobs 연동** — 예약 시간에 자동 발행 (같은 `publishToPlatform()` 함수 재사용)
- **편집/취소 기능**

> n8n 예약 발행 → Vercel Cron Jobs로 대체. 컴퓨터 꺼져도 클라우드에서 동작.

### 섹션 6. 발행 히스토리 ✅

과거 발행 기록 조회 및 재시도.

- **날짜순 리스트** — 썸네일, 제목, 플랫폼 아이콘, 상태(성공/실패/대기)
- **필터** — 플랫폼별, 상태별
- **실패 시 에러 사유 노출 및 재시도 버튼**
- **각 플랫폼 게시물 링크 바로가기**

### 섹션 7. SNS 계정 연결 ✅

각 플랫폼 OAuth 연동 관리. 5개 플랫폼 모두 연결 완료.

- **플랫폼별 연동/해제 카드** — 연결 상태, 계정명, 토큰 만료일 표시
- **토큰 만료 감지 및 재연결**
- **OAuth 구현 세부사항:** `docs/oauth-document.md` 참조

## 우선순위

| 기능 | 우선순위 | 상태 | 비고 |
|---|---|---|---|
| SNS 계정 연동 (OAuth) | **Must** | ✅ 완료 | 5개 플랫폼 |
| 콘텐츠 발행 (즉시) | **Must** | ✅ 완료 | JS 직접 호출 |
| 발행 히스토리 | **Must** | ✅ 완료 | |
| 대시보드 | **Must** | ✅ 완료 | |
| AI 추천 (GPT) | Should | ✅ 완료 | gpt-4o-mini |
| 트렌드 탐색 — 유튜브 | Should | ✅ 완료 | 10개 카테고리 |
| 트렌드 탐색 — 인스타 | Should | ⏳ 앱 리뷰 대기 | |
| 영상 편집 (Remotion) | **Must** | Phase 2 | 사진+자막+음악 → mp4 |
| 콘텐츠 캘린더 + 예약 발행 | Could | Phase 2 | Vercel Cron |
| Instagram 캐러셀 | Could | Phase 2 | 다중 이미지 슬라이드 |
| CSV 대량 업로드 | Could | Phase 2 | |

## 외부 연동

- **YouTube Data API v3** — 발행, 인기 영상 트렌드 수집 (mostPopular) ✅
- **Instagram Graph API** — 발행 (비즈니스 계정), 해시태그 인기 게시물 수집 (앱 리뷰 후) ✅
- **Threads API** — 발행 ✅
- **TikTok Content Posting API** — 발행 (Sandbox 모드) ✅
- **X API v2** — 발행 (OAuth 2.0 PKCE) ✅
- **OpenAI GPT API** — 플랫폼별 메타데이터 추천 ✅

## 데이터 모델 (현재 구현)

**저장 위치:** Supabase (PostgreSQL) + Supabase Storage (미디어 파일)

| 엔티티 | 주요 필드 | 저장 위치 | 설명 |
|---|---|---|---|
| `platforms` | id, name, status, oauth_token, refresh_token, expires_at, account_name | Supabase DB | 각 SNS 계정 연동 정보 |
| `posts` | id, title, description, first_comment, media_urls, media_type | Supabase DB | 발행 원본 콘텐츠 |
| `publish_logs` | id, post_id, platform, status, error_message, platform_post_url, published_at | Supabase DB | 플랫폼별 발행 이력 |
| `api_usage` | id, platform, quota_used, quota_total | Supabase DB | API 사용량 |
| (미디어) | uploads/{timestamp}_{filename} | Supabase Storage (`media` 버킷, public) | 업로드된 영상/이미지 |

**Phase 2 추가 테이블:**

| 엔티티 | 주요 필드 | 설명 |
|---|---|---|
| `scheduled_posts` | id, post_id, scheduled_at, status | 예약 발행 |
| `rendered_videos` | id, title, scene_data(json), local_file_path, duration, status | Remotion 렌더링 결과물 |

---

# Phase 3 — 화면 기획 (Screen Structure)

## (a) 스키매틱 — 전체 구조

### 페이지 목록 (사이드바 순서)

1. **대시보드** ✅
2. **트렌드 탐색** ✅
3. **콘텐츠 발행** ✅
4. **콘텐츠 캘린더** (Phase 2)
5. **발행 히스토리** ✅
6. **SNS 계정 연결** ✅
7. **영상 편집** (Phase 2, Remotion)

### 페이지 간 연결 구조

```
대시보드 ──→ 콘텐츠 발행 (새 발행 버튼)
   │────→ 발행 히스토리 (최근 이력 클릭)
   │────→ SNS 계정 연결 (플랫폼 카드 클릭)
트렌드 탐색 ──→ 콘텐츠 발행 (영감 확보 후 이동)
영상 편집 ───→ (mp4 로컬 저장만, 발행 단계로 자동 이동 없음)
콘텐츠 발행 ──→ 파일 업로드 (Supabase Storage) → 5개 플랫폼 동시 발행
콘텐츠 발행 ──→ 발행 히스토리 (발행 완료 후)
발행 히스토리 ──→ 콘텐츠 발행 (재시도 시)
SNS 계정 연결 ←→ 대시보드 (연결 상태 반영)
```

> **영상 편집과 발행은 완전히 분리된 독립 기능.** 영상 편집 완료 시 자동으로 발행 단계로 넘어가지 않는다. 사용자가 편집한 영상을 로컬에서 가져와 발행 섹션에서 수동으로 업로드한다.

### 네비게이션 방식

- **왼쪽 사이드바 고정형** — 항상 노출, 접기 없음
- **오른쪽 콘텐츠 영역만 스크롤**
- **데스크톱 전용** (모바일 미지원)

## (b) 와이어프레임 — 페이지별 레이아웃

### 공통 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│ [Header] LoopDrop 아이콘 + 5개 SNS 로고 마키 애니메이션   │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ Sidebar  │  Content Area (스크롤 영역)                   │
│ (고정)   │                                               │
│ 보라테마  │                                               │
│          │                                               │
│ - 대시보드 │                                               │
│ - 트렌드  │                                               │
│ - 발행   │                                               │
│ - 캘린더  │                                               │
│ - 히스토리│                                               │
│ - 연결   │                                               │
└──────────┴───────────────────────────────────────────────┘
```

### 화면별 세부 사항은 구현 코드 참조

- 대시보드: `src/app/page.tsx`
- 트렌드: `src/app/trend/page.tsx`
- 발행: `src/app/publish/page.tsx`
- 히스토리: `src/app/history/page.tsx`
- 계정 연결: `src/app/accounts/page.tsx`

## (c) 플로우 설계 — 사용자 경로

### 메인 플로우 A: 영상 편집 (Phase 2, 독립)

```
① 영상 편집 섹션 진입
  ↓
② 사진 여러 장 업로드 (드래그 앤 드롭)
  ↓
③ 각 장면별 자막 입력 + 배경 음악 선택 + 시간/전환 설정
  ↓
④ 실시간 프리뷰 확인
  ↓
⑤ "영상 만들기" 클릭 → Cloudflare Tunnel → 집 PC → Remotion 렌더링
  ↓
⑥ 로컬 폴더에 mp4 저장 + 완료 알림
  ↓
⑦ 여기서 끝. 필요하면 나중에 발행 섹션에서 수동 업로드.
```

### 메인 플로우 B: 콘텐츠 발행 ✅

```
① 콘텐츠 발행 진입
  ↓
② 완성된 영상/이미지 파일 드래그앤드롭 → Supabase Storage 즉시 업로드
  ↓
③ 발행할 플랫폼 체크 (연결된 것만)
  ↓
④ 체크된 플랫폼별 AI 추천 → 제목·설명·첫 댓글 입력
  ↓
⑤ 미리보기 확인
  ↓
⑥ "지금 발행" 클릭 → API Route에서 5개 플랫폼 동시 호출
  ↓
⑦ 발행 히스토리로 자동 이동, 결과 확인
```

> 두 플로우는 **완전히 분리**되어 있다. 편집 섹션에서 만든 영상을 발행하려면 사용자가 발행 섹션에서 해당 파일을 수동으로 업로드해야 한다.

---

# Phase 4 — UI 디자인 방향 (Design Spec)

## 컬러 방향

- **메인:** 인디고~바이올렛 그라데이션 (`from-indigo-500 to-violet-500`)
- **베이스:** 화이트 + 펄(pearl) 효과
- **Sidebar 활성 메뉴:** `bg-indigo-50 text-indigo-700`
- **Button primary:** 보라 그라데이션
- **상태 컬러:** 성공(에메랄드), 실패(레드), 대기(그레이)

## 폰트

- 한글: Pretendard (CDN)
- 영문: Inter (Google Fonts)
- 묵직하고 안정적인, 부드러운 느낌

## 브랜딩

- **앱 아이콘:** 보라색 배경 + 무한(∞) 심볼 + 물방울 (`public/loopdrop-icon.png`)
- **로고 텍스트:** 보라 그라데이션

## 반응형

- **데스크톱 전용** (min-width: 1280px)
- 모바일 미지원

---

# 전체 요약

| 항목 | 내용 |
|---|---|
| **프로젝트명** | LoopDrop (구 Spread) |
| **목적** | 1인 크리에이터용 멀티 SNS 발행 커맨드 센터 |
| **대상** | 본인 (추후 확장 가능) |
| **Phase 1 (완료)** | 즉시 발행, 계정 연동(5개), 히스토리, 대시보드, 트렌드(YouTube), AI 추천, 파일 업로드 |
| **Phase 2** | 영상 편집(Remotion), 예약 발행(Vercel Cron), Instagram 캐러셀, CSV 업로드 |
| **기술 스택** | Next.js 16 (Vercel) + Supabase + JS Publishers + GPT API |
| **배포** | https://loopdrop.vercel.app |
| **월 고정비** | **0원** (GPT API는 사용량 기반) |
| **플랫폼** | 유튜브 / 인스타 / 쓰레드 / 틱톡 / X (5개) |
| **UI 방향** | 보라 테마 + 펄 효과, Pretendard 폰트, 데스크톱 전용 |
| **OAuth 참조** | `docs/oauth-document.md` |

---

# 남은 작업

### Phase 1 마무리
1. 전체 E2E 테스트 (파일 업로드 → AI 추천 → 5개 플랫폼 동시 발행)
2. Instagram `Instagram Public Content Access` 앱 리뷰 심사 제출
3. 각 플랫폼 실제 발행 테스트

### Phase 2
4. 영상 편집 (Remotion + Cloudflare Tunnel + 로컬 Node.js 서버)
5. 콘텐츠 캘린더 + Vercel Cron Jobs 예약 발행
6. Instagram 캐러셀 (다중 이미지 슬라이드) 발행
7. CSV 대량 업로드
8. TikTok Production Submit for review (데모 영상 포함)

---

*본 문서는 project-kickoff 스킬에 따라 작성, v2.0에서 실제 구현 상태 반영 및 n8n→JS 전환, 편집/발행 분리 구조 확정.*
