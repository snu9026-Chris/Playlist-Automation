# LoopDrop 개발 히스토리

> 프로젝트: LoopDrop (구 Spread) — 멀티플랫폼 콘텐츠 발행 커맨드 센터
> 시작일: 2026-04-13
> 기록일: 2026-04-14

---

## 세션 1 — 기획 + 초기 구현

### 1. 프로젝트 기획 (project-kickoff 스킬 사용)

- Q&A 세션을 통해 4개 Phase 기획 문서 작성 → `Spread_기획문서.md`
- **Phase 1 (리서치):** 문제 정의, 서비스 가치, 타겟 사용자, 기술 스택 선정
- **Phase 2 (기능 기획):** 6개 섹션(대시보드, 트렌드, 발행, 캘린더, 히스토리, 계정연결) 정의
- **Phase 3 (화면 기획):** 와이어프레임, 페이지 간 연결 구조, 사용자 플로우
- **Phase 4 (UI 디자인):** 화이트 + 펄 효과, 묵직한 폰트, 데스크톱 전용

### 2. 기술 스택 확정

| 영역 | 기술 |
|---|---|
| 프론트엔드 | Next.js (App Router) + TypeScript + Tailwind CSS 4 |
| DB / 인증 / 스토리지 | Supabase (PostgreSQL + Auth + Storage) |
| 호스팅 | Vercel |
| 발행 엔진 / 예약 / 트렌드 수집 | n8n (셀프호스팅) |
| AI 추천 | GPT API (gpt-4o-mini) |

### 3. 프로젝트 초기화 (start.project 스킬 사용)

- `npx create-next-app@latest` 으로 Next.js 프로젝트 생성
- 포트 3001로 고정 (package.json의 dev/start 스크립트에 `-p 3001`)
- `start.bat` 생성 (더블클릭으로 dev 서버 실행)
- Supabase 클라이언트 설정 (`.env.local`에 URL + anon key)

### 4. UI 전체 구현

- **공통 레이아웃:** Header (LoopDrop 로고 + 5개 SNS 로고 마키 애니메이션) + Sidebar (6개 메뉴)
- **대시보드 (`/`):** SNS 연결 상태 카드 5개, 최근 발행 이력, API 할당량 위젯
- **트렌드 탐색 (`/trend`):** YouTube 인기 영상 카드 그리드, 카테고리 필터 (10개)
- **콘텐츠 발행 (`/publish`):** 드래그앤드롭 업로드, 플랫폼 선택 토글, 2컬럼(입력+미리보기), AI 추천 버튼
- **콘텐츠 캘린더 (`/calendar`):** Phase 2 플레이스홀더
- **발행 히스토리 (`/history`):** 필터(플랫폼/상태), 날짜순 리스트, 실패 시 에러 사유 + 재시도
- **SNS 계정 연결 (`/accounts`):** 5개 플랫폼 카드, 연결/해제/재연결 버튼, 토큰 만료일

### 5. 컴포넌트 구현

- `PlatformPreview.tsx`: 5개 플랫폼별 실제 미리보기 (YouTube Shorts, Instagram Reels, Threads, TikTok, X)
- `PlatformIcon.tsx`: 5개 플랫폼 SVG 아이콘
- `Card.tsx`, `Button.tsx`, `Badge.tsx`, `ProgressBar.tsx`: 공통 UI 컴포넌트

### 6. Supabase DB 스키마 설계 및 적용

- `supabase/schema.sql` 작성
- 7개 테이블: platforms, posts, publish_logs, templates, trending_videos, scheduled_posts, api_usage
- RLS 정책: 1인 사용이므로 anon 전체 허용
- 초기 데이터: 5개 플랫폼 + API 사용량 (claude, gpt)

### 7. YouTube 트렌드 API 구현

- `/api/youtube/trending` (GET): YouTube Data API v3 `mostPopular` 차트 연동
- 카테고리 필터링 (10개 카테고리 → YouTube videoCategoryId 매핑)
- 트렌드 페이지에서 실시간 API 호출 (1시간 캐시)

### 8. GPT AI 추천 API 구현

- `/api/ai/recommend` (POST): OpenAI GPT-4o-mini 연동
- 플랫폼별 프롬프트 가이드 (YouTube: 100자 제목, Instagram: 15 해시태그, X: 280자 등)
- JSON 파싱 + 실패 시 raw text fallback
- 발행 페이지에서 "AI 추천" 버튼으로 호출

---

## 세션 2 — API 연동 + 인프라 구축

### 9. YouTube 트렌드 에러 수정

- **문제:** "여행"(카테고리 19), "교육"(카테고리 27) 클릭 시 "Requested entity was not found" 에러
- **원인:** YouTube `mostPopular` 차트가 한국(KR) 리전에서 해당 카테고리를 지원하지 않음
- **해결:** 미지원 카테고리는 YouTube Search API(`search`)로 자동 대체
  - `SEARCH_QUERY_MAP`에 '여행': '여행 브이로그', '교육': '교육 강의' 매핑
  - search API는 statistics를 안 줌 → video ID로 다시 videos API 조회하여 조회수 확보
  - 다른 카테고리에서도 404 발생 시 동적으로 search fallback

### 10. GPT API 실동작 확인

- `.env.local`에 OpenAI API 키 설정 확인
- 처음 테스트 시 429 할당량 초과 → 사용자가 크레딧 충전
- 5개 플랫폼 모두 GPT API 테스트 성공:
  - YouTube: 제목 + 해시태그 5개 + 구독 유도 첫 댓글 ✅
  - Instagram: 설명 + 해시태그 15개 + 소통 유도 첫 댓글 ✅
  - TikTok: 설명 + #fyp #foryou + 질문형 첫 댓글 ✅
  - X: 280자 이내 + 해시태그 2개 ✅
  - Threads: 500자 이내 + 해시태그 3개 ✅

### 11. Supabase DB 실연동 확인

- 4개 테이블(platforms, posts, publish_logs, api_usage) 연결 정상 확인
- 초기 데이터 존재 확인: 5개 플랫폼 disconnected, API 사용량 0

### 12. SNS 계정 연결 — OAuth 인프라 구현

- `/src/lib/oauth-config.ts`: 5개 플랫폼별 OAuth 설정 (authUrl, tokenUrl, scopes, 환경변수명)
- `/api/auth/[platform]` (GET): OAuth 인증 시작 → 해당 플랫폼 로그인 페이지로 리다이렉트
  - state 파라미터에 platform 정보 포함 (콜백에서 식별용)
  - X(Twitter)는 PKCE 지원
- `/api/auth/callback` (GET): OAuth 콜백 처리
  - Authorization code → Access token 교환
  - 플랫폼별 사용자 정보 조회 (accountName)
  - DB에 토큰 + 만료일 + 계정명 저장
  - 성공/실패 시 `/accounts` 페이지로 리다이렉트
- 계정 연결 페이지 업데이트:
  - "연결하기" 클릭 → `/api/auth/{platform}`으로 리다이렉트 (실제 OAuth flow)
  - "연결 해제" → DB에서 status를 disconnected로 변경
  - OAuth 콜백 결과 토스트 알림 (성공/실패)
  - `useSearchParams` → Suspense boundary 추가 (Next.js 빌드 요구사항)

### 13. n8n 발행 엔진 구축

#### n8n 설치 및 시작
- `npm install -g n8n` (글로벌 설치)
- `n8n start` → `http://localhost:5678`에서 실행
- owner 계정 생성, API 키 발급

#### 발행 API 라우트 구현
- `/api/publish` (POST): 발행 요청 처리
  1. posts 테이블에 원본 콘텐츠 저장
  2. 각 플랫폼별 publish_logs를 pending으로 생성
  3. n8n 웹훅 호출 (비동기 발행 트리거)
- `/api/publish/callback` (POST): n8n에서 발행 결과 수신
  - publish_logs 상태를 success/failed로 업데이트
  - platformPostUrl, errorMessage 저장

#### n8n 워크플로우 생성 (API 자동 생성)
- **1차 시도:** Webhook → Split by Platform → Switch (Route by Platform) → Publish → Callback
  - 문제: Switch 노드가 "or" combinator로 첫 번째 매칭만 통과 → instagram/x가 pending에 머무름
- **2차 시도:** Switch 제거, 단순화
  - 문제: Publish 노드가 `$input.first()`로 첫 아이템만 처리
- **3차 (최종):** `$input.all()`로 모든 아이템 처리
  - Webhook → Split Platforms (Code) → Publish (Code, all items) → Callback (HTTP Request)
  - 4개 플랫폼 동시 발행 테스트: youtube ✅ instagram ✅ threads ✅ x ✅ 모두 success

#### 발행 페이지 연동
- `publish/page.tsx` 수정: 직접 DB 호출 → `/api/publish` API 호출로 변경
- 사용하지 않는 import 제거 (createPost, createPublishLog)

### 14. 명칭 변경: Spread → LoopDrop

- n8n 웹훅 경로: `spread-publish` → `loopdrop-publish`
- `.env.local`의 N8N_WEBHOOK_URL 업데이트
- `/api/publish/route.ts` fallback URL 업데이트
- mock 데이터: `@spread_creator` → `@loopdrop_creator`, `@spread.official` → `@loopdrop.official`
- n8n 워크플로우 재생성: "LoopDrop Publish" 이름으로

### 15. Meta 개발자 앱 생성 (LoopDrop)

#### Threads API 설정
- developers.facebook.com에서 앱 생성 (이름: LoopDrop)
- Use case: "Access the Threads API" 선택
- Business portfolio: 연결 안 함 (나중에)
- App ID: 931853832985831 / App Secret: 5b5dafd035148e53453cda9b9dd134d6
- Threads App ID: 3322385477941508 / Threads App Secret: 9bf15a906c385fb47d8576c056e46e63
- Redirect Callback URL: `https://localhost:3001/api/auth/callback` (+ Uninstall/Delete 콜백 동일)
- Threads Tester 추가 → Threads 앱에서 초대 수락 완료

#### Instagram API 설정
- Use case 추가: "Manage messaging & content on Instagram"
- Instagram App ID: 2427418151078862 / Instagram App Secret: b1367858d6919f5bbc6d998d496be66a
- "API setup with Instagram login" — required permissions 추가 (instagram_business_basic, instagram_manage_comments, instagram_business_manage_messages)
- "API setup with Facebook login" — required content permissions 추가 (instagram_basic, instagram_content_publishing, pages_read_engagement, business_management, pages_show_list)
  - 해시태그 트렌드 기능에 필요 (ig_hashtag_search API)
- Facebook Login for Business > Settings > Valid OAuth Redirect URIs: `https://localhost:3001/api/auth/callback`

### 16. Instagram 해시태그 트렌드 기능 구현

#### API 라우트
- `/api/instagram/trending` (GET): Instagram Graph API 연동
  - 카테고리별 추천 해시태그 매핑 (전체, 일상, 음식, 뷰티, 패션, 여행, 운동, 반려동물)
  - 사용자 직접 해시태그 검색 지원
  - 흐름: DB에서 Instagram 토큰 조회 → Facebook Pages → Instagram Business Account ID → ig_hashtag_search → top_media
  - 좋아요 수 기준 정렬, 상위 20개 반환
  - 미연결 시 needsAuth 응답

#### 트렌드 페이지 리팩토링
- 플랫폼 탭 추가: YouTube / Instagram 전환
- YouTube 탭: 기존 기능 유지 (카테고리 필터 + 인기 영상 그리드)
- Instagram 탭:
  - 해시태그 검색 바 (직접 입력 + Enter/검색 버튼)
  - 카테고리 필터 (8개)
  - 활성 해시태그 뱃지 표시
  - 인기 게시물 카드 그리드 (사진/동영상, 캡션, 좋아요, 댓글, 해시태그 뱃지)
  - 미연결 시 안내 화면 + 계정 연결 링크

#### constants.ts 업데이트
- `INSTAGRAM_CATEGORIES` 추가 (8개 카테고리)

### 17. Google OAuth 설정

- Google Cloud Console (프로젝트: snsautomation)에서 OAuth 동의 화면 설정
  - 앱 이름: LoopDrop, 이메일: snu9026@gmail.com
  - 대상: 외부(External)
- OAuth 클라이언트 생성 (웹 애플리케이션)
  - 승인된 리디렉션 URI: `http://localhost:3001/api/auth/callback`
  - Client ID: [.env.local 참조]
  - Client Secret: [.env.local 참조]
- `.env.local`에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 저장

---

## 세션 3 — OAuth 연결 + 발행 로직 + Vercel 배포 (현재 세션)

### 18. YouTube OAuth 연결 테스트

- Google OAuth 테스트 사용자 등록 필요 (앱이 테스트 모드)
  - Google Cloud Console → OAuth consent screen → Audience → Test users → `snu9026@gmail.com` 추가
- 연결 성공: 계정명 "Chris Lee" 표시 확인
- **토큰 만료 1일 문제 수정:**
  - Google은 `expires_in=3600` (1시간)을 반환하지만 refresh token으로 갱신 가능
  - `callback/route.ts` 수정: refresh token이 있고 rawExpiresIn < 86400이면 60일(5184000초)로 표시
- accounts 페이지 가로 스크롤 문제 수정:
  - `layout.tsx`의 `<main>`에 `min-w-0` 추가 → flex 자식 overflow 해결

### 19. Meta(Instagram/Threads) OAuth 연결 테스트

- Instagram 연결 성공 ✅
- Threads 연결 — 미연결 상태 (추후 연결)

### 20. TikTok 개발자 앱 생성

- developers.tiktok.com에서 앱 생성 (이름: Loopdrop, 유형: Other)
- Client Key: awplahnjxjsmkco7
- Client Secret: 7CG9lhHfqn8BGoiBoNT8PCbBZ7j4P4Gk
- `.env.local`에 TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET 저장
- Products 추가: Login Kit + Content Posting API
- Scopes: user.info.basic, video.upload, video.publish (Direct Post 활성화)
- **LoopDrop 앱 아이콘 생성:**
  - `public/loopdrop-icon.png` (1024x1024 PNG)
  - 보라색 그라데이션 배경 + 무한(∞) 심볼 + 물방울
  - sharp 라이브러리로 SVG → PNG 변환
- **TikTok URL 인증:**
  - URL prefix 방식으로 `https://loopdrop.vercel.app/` 인증
  - signature file(`tiktokrJKVrv5AbQghEdx34nva3ZkO7enHdo1J.txt`)을 `public/`에 배치
  - Web/Desktop URL에 trailing slash 필요: `https://loopdrop.vercel.app/` (슬래시 없으면 unverified 에러)
- TikTok 앱 설정 완료: Category(Entertainment), Description, Terms/Privacy URL, Platforms(Web), App review 설명 입력
- Redirect URI: `https://loopdrop.vercel.app/api/auth/callback` (TikTok은 https만 허용)

### 21. X(Twitter) 개발자 앱 설정

- developer.x.com에서 기존 앱 사용 (ID: 32768168)
- User authentication settings:
  - 앱 권한: 읽기 및 쓰기
  - 앱 유형: 웹 앱, 자동화 앱 또는 봇 (기밀 클라이언트)
  - Callback URL: `http://localhost:3001/api/auth/callback`
  - Website URL: `https://loopdrop.vercel.app`
  - 조직 URL / 서비스 약관 / 개인정보 보호정책: `https://loopdrop.vercel.app/...`
- OAuth 2.0 Client ID: X0pqb1BCwW81VFNRRnZKZmxjeUQ6MTpjaQ
- Client Secret: v3sKxKzL3khRJ8vJ0_d7edwpy1CPMehHxlvM2_ojeDDLNi2hlp
- `.env.local`에 X_CLIENT_ID, X_CLIENT_SECRET 저장

### 22. Vercel 배포 (초기)

- Vercel CLI 설치: `npm install -g vercel`
- `vercel login` → 브라우저 인증
- `vercel project add loopdrop` → 프로젝트 URL 확정: **https://loopdrop.vercel.app**
- **1차 빌드 실패:** OpenAI API 키 미설정 → `getOpenAI()` lazy 초기화로 수정
- **2차 빌드 실패:** Supabase URL 미설정 → Vercel에 모든 환경변수 등록 (16개)
- **3차 빌드 성공:** `vercel --prod --yes` → `spread-ten.vercel.app`으로 배포
- `vercel alias set ... loopdrop.vercel.app` → **https://loopdrop.vercel.app** 활성화

### 23. UI 브랜딩 변경 — 보라색 테마 적용

- **Header 로고:** "LD" 텍스트 박스 → `loopdrop-icon.png` 이미지로 교체
- **Header 로고 텍스트:** gray → `bg-gradient-to-r from-indigo-500 to-violet-500` 보라 그라데이션
- **Header 하단 보더:** 은회색 → 보라색 라인 (`#c7c3f7`, `#a78bfa`)
- **Sidebar 활성 메뉴:** gray 배경 → `bg-indigo-50 text-indigo-700`
- **Sidebar 활성 좌측 바:** gray → `from-indigo-400 to-violet-500` 그라데이션
- **Sidebar 아이콘:** active 시 `text-indigo-500`
- **Sidebar Phase 1 MVP 텍스트:** gray-300 → indigo-300
- **Button primary:** `bg-gray-900` → `bg-gradient-to-r from-indigo-500 to-violet-500`
- **Pearl card 보더:** 보라 톤 강화 (`#e0e0f0`, `#e0d4f5`)

### 24. 발행 아키텍처 변경: n8n → JS 직접 호출

- **결정:** n8n 웹훅 방식 → Next.js API Route에서 직접 각 플랫폼 API 호출로 변경
- **이유:** 발행 로직이 두 곳(JS + n8n)에 있으면 유지보수/에러핸들링 이중 관리 문제
- **예약발행:** n8n 대신 Vercel Cron Jobs로 대체 가능 (컴퓨터 꺼져도 클라우드에서 동작)
- **구현:**
  - `src/lib/publishers/` 디렉토리 신규 생성
  - 5개 플랫폼별 발행 모듈:
    - `instagram.ts`: Facebook Pages → IG Business Account → 미디어 컨테이너 → 영상 처리 대기 → 발행
    - `youtube.ts`: Google OAuth 토큰 갱신 → Resumable Upload API → 메타데이터 설정
    - `threads.ts`: Threads API 유저 ID 조회 → 스레드 컨테이너 → 영상 처리 대기 → 발행
    - `tiktok.ts`: TikTok 토큰 갱신 → Direct Post API → 청크 업로드 → 상태 폴링
    - `x.ts`: X OAuth2 토큰 갱신 → 미디어 청크 업로드 (INIT/APPEND/FINALIZE) → 트윗 생성
  - `index.ts`: 플랫폼 라우터 — `publishToPlatform()` 함수에서 switch로 분기
  - `/api/publish/route.ts` 수정: n8n 웹훅 호출 제거 → `Promise.allSettled()`로 동시 발행 + DB 업데이트

### 25. 파일 업로드 — Supabase Storage 연동

- **문제:** 프론트에서 파일 선택은 되지만 실제 업로드/URL 생성이 없어 발행 시 100% 실패
- **해결:**
  - Supabase 대시보드에서 `media` 버킷 생성 (Public, 50MB 글로벌 제한)
  - `/api/upload` (POST) 라우트 생성:
    - FormData로 파일 수신 → 고유 파일명 생성 → Supabase Storage 업로드
    - 공개 URL 반환
    - 버킷 미존재 시 자동 생성 시도 (fallback)
  - `publish/page.tsx` 수정:
    - `UploadedFile` 인터페이스에 `url`, `uploading` 필드 추가
    - `addFiles()`: 파일 선택 시 즉시 `/api/upload`로 업로드 → URL 저장
    - 업로드 상태 표시: "업로드 중..." / "업로드 완료" / "업로드 실패"
    - `handlePublish()`: 파일 이름 대신 실제 Supabase URL 전달
    - 발행 버튼: 업로드 중이거나 URL 없으면 비활성화

### 26. Phase 1 전체 점검 결과

| 기능 | 상태 | 완성도 |
|---|---|---|
| 대시보드 | ✅ 완료 | 100% |
| 트렌드 탐색 (YouTube) | ✅ 완료 | 100% |
| 트렌드 탐색 (Instagram) | ✅ 완료 | 100% |
| 콘텐츠 발행 | ✅ 완료 | 100% (Storage 연동 완료) |
| 발행 히스토리 | ✅ 완료 | 95% (재시도 버튼 핸들러 미연결) |
| SNS 계정 연결 | ✅ 완료 | 100% (5개 플랫폼 OAuth) |
| AI 추천 | ✅ 완료 | 100% |
| 5개 플랫폼 발행 로직 | ✅ 완료 | 100% |
| 파일 업로드 (Supabase Storage) | ✅ 완료 | 100% |
| 콘텐츠 캘린더 | ⏳ Phase 2 | 플레이스홀더 |

**남은 작업:**
- Threads, TikTok, X OAuth 실제 연결 테스트
- YouTube, Instagram 연결 상태 재확인
- 전체 E2E 테스트 (파일 업로드 → AI 추천 → 발행)

---

## 현재 환경변수 (.env.local) 요약

| 키 | 용도 | 상태 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 연결 | ✅ 설정됨 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase 인증 | ✅ 설정됨 |
| OPENAI_API_KEY | GPT AI 추천 | ✅ 설정됨 |
| YOUTUBE_API_KEY | YouTube 트렌드 | ✅ 설정됨 |
| N8N_WEBHOOK_URL | n8n 발행 웹훅 | ✅ 설정됨 (deprecated, JS 직접 호출로 전환) |
| N8N_API_KEY | n8n API 접근 | ✅ 설정됨 (deprecated) |
| NEXT_PUBLIC_BASE_URL | OAuth 콜백 베이스 | ✅ 설정됨 (localhost:3001) |
| GOOGLE_CLIENT_ID | YouTube OAuth | ✅ 설정됨 |
| GOOGLE_CLIENT_SECRET | YouTube OAuth | ✅ 설정됨 |
| META_APP_ID | Instagram OAuth (Facebook Login) | ✅ 설정됨 |
| META_APP_SECRET | Instagram OAuth (Facebook Login) | ✅ 설정됨 |
| INSTAGRAM_APP_ID | Instagram OAuth (Instagram Login) | ✅ 설정됨 |
| INSTAGRAM_APP_SECRET | Instagram OAuth (Instagram Login) | ✅ 설정됨 |
| THREADS_APP_ID | Threads OAuth | ✅ 설정됨 |
| THREADS_APP_SECRET | Threads OAuth | ✅ 설정됨 |
| TIKTOK_CLIENT_KEY | TikTok OAuth | ✅ 설정됨 |
| TIKTOK_CLIENT_SECRET | TikTok OAuth | ✅ 설정됨 |
| X_CLIENT_ID | X(Twitter) OAuth | ✅ 설정됨 |
| X_CLIENT_SECRET | X(Twitter) OAuth | ✅ 설정됨 |

---

## 현재 파일 구조

```
spread/
├── .env.local                          # 환경변수
├── .vercel/                            # Vercel 프로젝트 설정
├── AGENTS.md                           # Next.js 주의사항
├── CLAUDE.md                           # → AGENTS.md 참조
├── history.md                          # 이 파일
├── package.json                        # Next.js 16.2.3, React 19
├── start.bat                           # dev 서버 런처
├── supabase/
│   └── schema.sql                      # DB 스키마 (7개 테이블)
├── public/
│   ├── loopdrop-icon.png               # 앱 아이콘 (1024x1024)
│   └── tiktokrJKVrv5AbQghEdx34nva3ZkO7enHdo1J.txt  # TikTok URL 인증 파일
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # 공통 레이아웃 (Header + Sidebar)
│   │   ├── globals.css                 # 글로벌 CSS (보라 테마)
│   │   ├── page.tsx                    # 대시보드
│   │   ├── trend/page.tsx              # 트렌드 탐색 (YouTube + Instagram 탭)
│   │   ├── publish/page.tsx            # 콘텐츠 발행 (Supabase Storage 업로드)
│   │   ├── calendar/page.tsx           # 콘텐츠 캘린더 (Phase 2)
│   │   ├── history/page.tsx            # 발행 히스토리
│   │   ├── accounts/page.tsx           # SNS 계정 연결
│   │   └── api/
│   │       ├── ai/recommend/route.ts   # GPT AI 추천
│   │       ├── auth/
│   │       │   ├── [platform]/route.ts # OAuth 시작
│   │       │   └── callback/route.ts   # OAuth 콜백
│   │       ├── instagram/trending/route.ts  # Instagram 해시태그 트렌드
│   │       ├── publish/
│   │       │   ├── route.ts            # 발행 요청 (직접 플랫폼 API 호출)
│   │       │   └── callback/route.ts   # n8n 콜백 (deprecated)
│   │       ├── upload/route.ts         # 파일 업로드 (Supabase Storage)
│   │       └── youtube/trending/route.ts    # YouTube 트렌드
│   ├── components/
│   │   ├── icons/PlatformIcon.tsx      # 5개 플랫폼 SVG 아이콘
│   │   ├── layout/
│   │   │   ├── Header.tsx              # 헤더 (LoopDrop 아이콘 + 마키)
│   │   │   └── Sidebar.tsx             # 사이드바 (보라 테마)
│   │   ├── publish/PlatformPreview.tsx # 5개 플랫폼별 미리보기
│   │   └── ui/
│   │       ├── Badge.tsx               # 상태 뱃지
│   │       ├── Button.tsx              # 버튼 (보라 그라데이션 primary)
│   │       ├── Card.tsx                # 카드 컨테이너
│   │       └── ProgressBar.tsx         # 프로그레스 바
│   ├── data/mock.ts                    # 목업 데이터 (fallback용)
│   ├── lib/
│   │   ├── constants.ts                # 플랫폼 설정, 네비게이션, 카테고리
│   │   ├── oauth-config.ts             # 5개 플랫폼 OAuth 설정
│   │   ├── publishers/                 # 플랫폼별 발행 모듈
│   │   │   ├── index.ts               # 라우터 (publishToPlatform)
│   │   │   ├── instagram.ts           # Instagram 릴스/이미지 발행
│   │   │   ├── youtube.ts             # YouTube 영상 업로드
│   │   │   ├── threads.ts             # Threads 포스팅
│   │   │   ├── tiktok.ts              # TikTok 영상 업로드
│   │   │   └── x.ts                   # X 트윗/미디어 포스팅
│   │   ├── queries.ts                  # Supabase 쿼리 함수
│   │   ├── supabase.ts                 # Supabase 클라이언트
│   │   └── utils.ts                    # 유틸리티
│   └── types/index.ts                  # TypeScript 타입 정의
└── e2e/                                # Playwright 테스트
```

---

## 세션 4 — Vercel 배포 + 5개 플랫폼 OAuth 완성 (2026-04-16)

### 27. Instagram 해시태그 트렌드 — Facebook Page 연결 이슈

- **문제:** Instagram 연결됐는데 트렌드 페이지에 "Facebook 페이지를 찾을 수 없습니다" 에러
- **원인:** Instagram Graph API는 Facebook 페이지에 연결된 Instagram 비즈니스 계정 필요. 개인 IG 계정만으로는 안 됨.
- **해결:**
  1. Facebook에서 "Loopdrop" 페이지 생성
  2. Facebook 페이지 설정 → Connected Instagram → 본인 IG 비즈니스 계정(@hwanleeyong) 연결
  3. WhatsApp 본인 확인 완료
  4. LoopDrop OAuth 재연결 시 "Choose the Pages" 및 "Choose the Businesses" 화면에서 Loopdrop 페이지/비즈니스 선택
- **추가 scope:** `business_management` 권한 추가 (oauth-config.ts)
- **결과:** Instagram Business Account(@hwanleeyong) API 호출 정상 작동. account_name 수동 업데이트.
- **해시태그 검색은 실패:** `Instagram Public Content Access` 권한 필요 → Meta 앱 리뷰 심사 제출해야 함 (1~5일 소요). 발행 기능은 정상 작동.

### 28. Privacy / Terms 페이지 신규 작성

- **문제:** OAuth 설정 시 `https://loopdrop.vercel.app/privacy`, `/terms` 링크를 참조했으나 실제 페이지가 존재하지 않아 404 에러
- **해결:** `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` 생성
  - Privacy Policy: 수집 정보, 사용 목적, 저장, 데이터 삭제, 제3자 서비스, 연락처
  - Terms of Service: 서비스 사용, 계정 책임, 금지 사항, 면책 조항, 변경, 연락처

### 29. Vercel 환경변수 개행 문자(`%0A`) 버그

- **문제:** TikTok, X OAuth URL에 `client_id=sbawu7v79p6vjezsbw%0A` 처럼 `%0A`(개행) 섞여서 `param_error` 발생
- **원인:** 초기 `vercel env add` 명령에서 `<<<` here-string을 사용했는데 bash가 끝에 개행을 붙임
- **해결:** `printf '%s'`로 개행 없이 다시 모든 환경변수 재설정 (BASE_URL, GOOGLE_*, META_*, INSTAGRAM_*, THREADS_*, TIKTOK_*, X_*, YOUTUBE_API_KEY)

### 30. TikTok OAuth — `client_key` 파라미터 + Sandbox 전용 credentials

- **문제 1:** TikTok은 OAuth 표준의 `client_id`가 아닌 `client_key`를 파라미터명으로 사용 → `/api/auth/[platform]/route.ts` 수정으로 플랫폼별 분기
- **문제 2:** Production credentials로 OAuth 시도 시 `unauthorized_client` 에러
- **원인:** TikTok 앱이 Draft/Sandbox 상태. **Sandbox에는 별도의 client_key/client_secret이 존재**. Production 값은 심사 전에는 쓸 수 없음.
- **해결:**
  - Sandbox 생성 → Target users에 본인 TikTok 계정 추가
  - Sandbox Credentials 확인: Client key/secret은 `.env.local`에서 관리
  - `.env.local` 및 Vercel env vars 전부 Sandbox 값으로 교체
  - Production은 서비스 공개 시 Submit for review (데모 영상 포함)
- **Verify domains:** 불필요 (우리는 `push_by_file` 방식 사용, `pull_by_url` 할 때만 필요)

### 31. X(Twitter) OAuth — PKCE 길이 + Client ID 오타

- **문제 1:** X OAuth 연결 시 "Something went wrong" (`code_challenge` 길이 부족)
- **원인:** 코드에서 `crypto.randomBytes(16).toString('hex')` = 32자. RFC 7636은 PKCE `code_verifier`를 43~128자 요구.
- **해결:** `randomBytes(32)` = 64자로 변경 (oauth-config.ts)
- **문제 2:** PKCE 수정 후에도 여전히 실패
- **원인:** Client ID 오타 — 저장된 값은 `X0pqb1BCwW81...` (소문자 w + 대문자 W)인데, X Developer Console의 실제 값은 `X0pqb1BCWW81...` (**대문자 W 두 개**)
- **해결:** `.env.local` 및 Vercel env vars 수정 → `X_CLIENT_ID=X0pqb1BCWW81VFNRRnZKZmxjeUQ6MTpjaQ`

### 32. Threads OAuth — Tester 초대 + 수락 프로세스

- **문제:** Threads 연결 시 "안전하지 않은 로그인이 차단되었습니다" (`error_code: 1349187`) — https 필수이므로 localhost에서는 불가
- **해결:** Vercel 배포 후 https://loopdrop.vercel.app 에서 연결 시도
- **추가 문제:** Tester 초대가 Threads 앱에서 "삭제" 버튼만 보이고 "수락" 버튼 안 보임
- **우회:** 관리자(Administrator) 권한으로 OAuth 시도하니 바로 연결 성공 — Tester 수락 없어도 됨
- **학습:** Meta 개발자 콘솔 → App roles → Roles → Add People 할 때, Threads Tester는 **username 입력란을 반드시 채워야** 초대가 정상 발송됨 (memory 저장)

### 33. 더미 데이터 정리

- 한글 인코딩 깨진 publish_logs, posts 전부 삭제 (Supabase)
- 깨끗한 상태로 히스토리 페이지 초기화

### 34. UI / UX 개선

- **accounts 페이지 카드 가로 스크롤 버그 수정:**
  - `layout.tsx`의 `<main>`에 `min-w-0` 추가 → flex 자식 overflow 해결
  - 결과: "연결하기" 버튼이 정상 표시됨
- **Header 로고 변경:**
  - "LD" 텍스트 박스 → `loopdrop-icon.png` 이미지 교체
  - LoopDrop 텍스트 보라 그라데이션 적용
- **전체 보라 테마 적용:**
  - Sidebar 활성 메뉴, Button primary, Card border 모두 인디고~바이올렛 계열로 통일

### 35. 홈페이지 프로젝트 관리 정리

- **auto-session-upload SessionEnd 훅 제거**: update.recent 스킬과 중복되어 ~/.claude/settings.json에서 hooks 비움
- **Supabase `projects` 테이블 정리**: 잘못 생성된 "loopdrop" 프로젝트의 로그를 "sns automation" 프로젝트로 이동 후 삭제
- **update-recent.mjs 수정**: 프로젝트명 도출 로직을 "Desktop 바로 아래 폴더명 기준"으로 변경
  - `C:\Users\USER\Desktop\SNS Automation\spread` → `"sns automation"` (전)
  - 이전: `findProjectRoot` 기반 (package.json 있는 폴더명) → `"spread"`가 될 수 있었음
  - 이제: Desktop 하위 폴더를 정규식으로 매칭해 항상 상위 폴더명 반환

### 36. Vercel 배포 + alias 설정 반복

- 세션 중 여러 번 재배포:
  - 1차: 초기 OAuth 코드 → 빌드 에러 (OpenAI, Supabase env 미설정)
  - 2차: env 추가 후 성공 → `https://loopdrop.vercel.app` 활성화
  - 3차: Privacy/Terms 페이지 추가
  - 4차: env `%0A` 개행 수정
  - 5차: TikTok `client_key` 파라미터 분기 + Sandbox credentials
  - 6차: X PKCE 길이 수정 (32바이트)
  - 7차: X Client ID 오타 수정 (WW)
- 각 배포 후 `vercel alias set ... loopdrop.vercel.app` 수동 연결

### 37. 5개 플랫폼 OAuth 전부 연결 완료 ✅

| 플랫폼 | 상태 | 비고 |
|---|---|---|
| YouTube | ✅ 연결 | Google OAuth + refresh token |
| Instagram | ✅ 연결 | @hwanleeyong, FB Page 연동 |
| Threads | ✅ 연결 | Administrator 권한으로 OAuth |
| TikTok | ✅ 연결 | Sandbox credentials |
| X | ✅ 연결 | OAuth 2.0 PKCE |

---

## 세션 5 — E2E 발행 테스트 + 발행 UI 고도화 (2026-04-17)

### 38. E2E 발행 테스트 결과

**이미지 발행 테스트 (1차 — 전체 실패):**
- YouTube: `Media type 'image/jpeg' is not supported` → 이미지 미지원, 영상만 가능
- Instagram: `Only photo or video can be accepted as media type` → 이미지를 릴스(REELS)로 보내서 실패
- TikTok: 가이드라인 리뷰 에러 → Sandbox 설정 미완 + 이미지 미지원
- Threads: `Failed to get Threads user ID` → 토큰 만료 (1시간짜리)
- X: `Unexpected end of JSON input` → 미디어 업로드 API 403 (Free tier 제한)

**수정 후 2차 테스트:**
- Instagram 게시물 ✅ 성공 + 첫 댓글 ✅ 성공
- Threads ✅ 성공 (장기 토큰 교환 후)
- YouTube/TikTok — 이미지 업로드 시 자동 스킵 (영상만 가능 안내)
- X — 크레딧 소진 (`CreditsRepleted`), Free tier 월 50 트윗 한도 초과

### 39. Threads 토큰 만료 문제 — 장기 토큰 교환 구현

- **문제:** Threads 단기 토큰이 1시간 만료 → 발행 시 `Failed to get Threads user ID`
- **해결:** OAuth 콜백에서 `th_exchange_token` API로 단기 토큰(1시간) → 장기 토큰(60일) 자동 교환
- `callback/route.ts`에 Threads 전용 장기 토큰 교환 로직 추가

### 40. Instagram 첫 댓글 — scope 누락 수정

- **문제:** `(#10) Application does not have permission for this action` → 댓글 작성 거부
- **원인:** OAuth scope에 `instagram_manage_comments` 누락 (앱 리뷰 문제가 아님)
- **해결:** `oauth-config.ts`의 Instagram scopes에 `instagram_manage_comments` 추가 → 재연결 후 댓글 정상 작동
- **참고:** 앱 리뷰 없이 개발 모드에서 관리자 계정으로 댓글 작성 가능 확인

### 41. 플랫폼별 미디어 제한 UI

- **YouTube/TikTok:** 이미지 업로드 시 "(영상만 가능)" 표시 + 비활성화 + 자동 해제
- **X:** 파일 업로드 시 "(텍스트만 가능)" 표시 + 비활성화. 파일 없이 텍스트만 발행 가능
- **Instagram 릴스:** 이미지 업로드 시 릴스 버튼 비활성화 + "(영상만)" 표시
- **X 텍스트 전용 발행:** 파일 없이 X만 선택 → 발행 버튼 활성화 → 텍스트만 포스팅

### 42. 콘텐츠 유형 선택 + GPT 프롬프트 고도화

- **콘텐츠 유형 칩 버튼 5개:** 일상/브이로그, 정보/팁, 홍보/광고, 리뷰/후기, 밈/유머
- **유형별 GPT 프롬프트 분기:** 톤, CTA, 해시태그 전략이 유형에 따라 변경
  - 일상: 편안한 톤, 공감 질문형 CTA
  - 홍보: 혜택 중심, 행동 유도 CTA
  - 밈: 가볍고 재미, 친구 태그 CTA 등
- **플랫폼별 성격 반영:** Instagram(정제된 ~요 체), Threads(캐주얼 반말), TikTok(짧은 훅), X(강한 한 줄)
- **시스템 프롬프트:** `SYSTEM_PROMPT` 상수로 분리, 유형별 전략 포함

### 43. 제목/첫 댓글 다중 옵션

- **제목:** YouTube에서 AI 추천 시 2개 옵션 생성 → 옵션 버튼으로 선택
- **첫 댓글:** Instagram/YouTube에서 3개 옵션 생성 → 옵션 버튼으로 선택 (30자 미리보기)
- API 응답: `titles: string[]`, `firstComments: string[]` 배열로 반환

### 44. Instagram 게시물/릴스 선택 토글

- Instagram 카드에 📷 게시물 / 🎬 릴스 토글 추가
- 이미지 업로드 시 릴스 비활성화 (릴스는 영상만 가능)
- `instagramFormat` 값이 publisher까지 전달되어 API 호출 시 분기

### 45. YouTube 고정 댓글 토글

- YouTube 첫 댓글 옆에 📌 고정 댓글 / 일반 댓글 토글 버튼
- 기본값: 고정 댓글. 클릭하면 일반 댓글로 전환

### 46. X 플랫폼명 수정

- constants.ts: `name: 'X'` → `name: '(Twitter)'` (아이콘과 텍스트 중복 방지)
- PlatformPreview: X 헤더 "(Twitter)"로 변경

### 47. 대시보드/히스토리 썸네일 + 설명 표시

- `queries.ts`: publish_logs 조회 시 `posts.media_urls`, `posts.description` JOIN 추가
- `thumbnailUrl`: `media_urls[0]` 사용 → 업로드된 이미지/영상 썸네일 표시
- `postTitle`: title 없으면 description 앞 50자 사용
- 대시보드 + 히스토리 페이지에 `<img>` 썸네일 렌더링

### 48. 비밀번호 보호 (Basic Auth)

- `src/middleware.ts` 생성: Basic Auth 미들웨어
- 아이디/비번: 환경변수(`AUTH_USER`, `AUTH_PASS`)로 관리
- API routes, static 파일은 인증 제외
- 브라우저에서 한 번 입력하면 세션 동안 유지

### 49. 발행 페이지 UI 리뉴얼

- **미디어 업로드 + 프리뷰 2컬럼:** 왼쪽 업로드, 오른쪽 이미지 프리뷰
- **콘텐츠 설명 입력란:** AI 추천이 이 설명 기반으로 생성
- **입력:미리보기 비율:** flex-[2] : w-[440px]
- **미리보기에 실제 업로드 이미지 반영:** 모든 플랫폼 프리뷰 카드에 이미지 표시
- **플랫폼 선택 버튼:** 보라 그라데이션 테마

### 50. 기획문서 v2.0 업데이트

- `Spread_기획문서.md` 전면 개정: n8n 제거, JS 직접 호출, Supabase, 편집/발행 분리 구조 반영
- Phase 1 완료 상태 표시, Phase 2 남은 작업 정리

### 51. OAuth 가이드 문서 + 스킬 등록

- `docs/oauth-document.md` 생성: 5개 플랫폼 OAuth 함정 + 디버깅 체크리스트
- `AGENTS.md`에 "OAuth 작업 전 docs 읽기" 지시 추가
- Personal Management 홈페이지 skills 테이블에 `oauth-document` 스킬 등록

### 52. Instagram 트렌드 이미지 수정

- `next.config.ts`에 `**.fbcdn.net`, `**.cdninstagram.com` 도메인 추가
- Next.js Image → `<img>` 태그로 변경 (외부 CDN 이미지 호환)

---

## 세션 6 — 로그인 UI 개선, API 할당량, 발행 버그 수정 (2026-04-17)

### 53. 로그인 방식 변경: Basic Auth → 커스텀 모달

- **변경:** 브라우저 Basic Auth 팝업 제거 → 보라 테마 로그인 모달
- **구현:**
  - `middleware.ts`: Basic Auth 제거, 쿠키 기반으로 변경 (인증 안 되어도 통과)
  - `/api/auth/login` (POST/DELETE): 로그인/로그아웃 API, `loopdrop-session` httpOnly 쿠키 + `loopdrop-ui` 클라이언트 판별 쿠키
  - `/api/auth/check` (GET): 인증 상태 확인
  - `AuthProvider.tsx`: 클라이언트 쿠키(`loopdrop-ui`)로 즉시 판별 (API 호출 대기 없음)
  - `LoginModal.tsx`: 보라 그라데이션 헤더 + LoopDrop 아이콘 + 아이디/비번 폼
  - `AppShell.tsx`: 비로그인 시 히어로 랜딩 페이지, 로그인 시 사이드바+콘텐츠
  - `Header.tsx`: 오른쪽에 로그인/로그아웃 버튼 추가
  - 로그인 성공 시 `window.location.reload()`로 확실히 모달 닫힘

### 54. 영상 업로드 시 X 플랫폼 숨기기

- 영상 파일 업로드 시 X 토글 버튼 완전히 숨김 (filter로 제거)
- 영상 업로드 시 X 자동 선택 해제

### 55. YouTube 고정 댓글 → 일반 댓글

- **발견:** YouTube Data API v3에는 댓글 고정 기능 없음 (YouTube Studio에서만 가능)
- 기존 코드의 잘못된 `moderationStatus: 'heldForReview'` 로직 제거
- UI: "일반 댓글" 활성 표시 + "고정 댓글" 취소선+비활성으로 API 미지원 안내

### 56. TikTok 발행 에러 원인 파악

- 에러: `Please review our integration guidelines`
- **원인:** Sandbox 모드 + UX 가이드라인 미준수
- TikTok Production 전환에 필요한 필수 UI 요소 확인:
  - 크리에이터 정보 표시, 프라이버시 드롭다운(기본값 없음), 상호작용 토글, 상업적 콘텐츠 공개, 음악 사용 동의
- 앱 리뷰 제출 시 UX 목업 PDF + 화면 녹화 필요 (5~10 영업일)

### 57. Threads 토큰 자동 갱신 로직

- `publishers/threads.ts`: 만료 7일 전이면 `th_refresh_token` API로 60일 자동 연장
- `expires_at` 필드도 함께 갱신

### 58. 히스토리 영상 썸네일 처리

- 영상 URL이 `<img>` 태그에 들어가서 깨지던 문제 수정
- `mediaType === 'video'`이면 `<video>` 태그로 렌더링 (muted, preload=metadata)
- `PublishLog` 타입에 `mediaType` 필드 추가
- `queries.ts`: `posts.media_type` JOIN 추가

### 59. API 할당량 추적 시스템

- **발행 시 사용량 증가:**
  - YouTube: +1,600 units/업로드 (일일 10,000)
  - Instagram/Threads/TikTok/X: +1/발행
  - GPT: +실제 total_tokens (completion.usage에서)
- **대시보드 개선:**
  - 플랫폼별 실제 한도 + 주기 표시 (/일, /월)
  - GPT: 토큰 사용량 + 원화 환산 (~₩X) + gpt-4o-mini 단가
  - GPT 잔액 조회 API (`/api/quota/balance`)
- **Vercel Cron Job:**
  - `vercel.json`: 매일 자정(UTC) `/api/quota/reset` 호출
  - 일단위 리셋: YouTube, Instagram, Threads, TikTok
  - 월단위 리셋: X (매월 1일)
  - `CRON_SECRET` 환경변수로 인증

### 60. 폴더/프로젝트명 정리

- `package.json` name: `spread` → `loopdrop`
- 폴더명 `spread` → `loopdrop` 변경 예정 (사용자 직접 진행)

---

## 남은 작업

### Phase 1 마무리
1. 폴더명 spread → loopdrop 변경
2. 영상 발행 테스트 (YouTube Shorts, TikTok, Instagram 릴스)
3. X 크레딧 리셋 후 텍스트 발행 재테스트
4. Threads 재연결 (토큰 만료)

### Phase 2
5. TikTok Production 앱 리뷰 (가이드라인 준수 UI 구현 + 제출)
6. 콘텐츠 캘린더 + Vercel Cron Jobs 예약 발행
7. 영상 편집 섹션 (Remotion + Cloudflare Tunnel + 로컬 Node.js 서버)
8. GitHub 레포 연동 → git push 자동 배포 전환
9. Instagram 앱 리뷰 (해시태그 트렌드 공개용)

---

## 메모

- **로그인:** 쿠키 기반 인증 (`loopdrop-session` httpOnly + `loopdrop-ui` 클라이언트용). 30일 유지.
- **X Free tier 제한:** 월 500 트윗 작성 한도. 미디어 업로드 API 403 → 텍스트 전용 발행.
- **Instagram 댓글:** `instagram_manage_comments` scope 필수. 앱 리뷰 없이 개발 모드에서 관리자 계정으로 작동 확인.
- **Threads 토큰:** 장기 토큰(60일) + 자동 갱신 로직. 만료 시 계정 재연결 필요.
- **YouTube 고정 댓글:** API 미지원. 일반 댓글만 작성 가능, 고정은 YouTube Studio에서.
- **TikTok Sandbox:** PUBLIC_TO_EVERYONE 불가. Production 전환에 UX 가이드라인 준수 필수.
- **API 할당량:** Vercel Cron으로 매일 자정 리셋 (YouTube/IG/Threads/TikTok 일단위, X 월단위).
- **n8n → JS 전환:** n8n 발행 엔진은 deprecated. n8n 관련 코드는 아직 남아있으나 사용하지 않음.
- **Vercel 프로젝트:** 프로젝트명 "spread", alias `loopdrop.vercel.app`. 배포: `vercel --prod` + alias 수동.
- **환경변수 주의:** Vercel CLI에서 `printf '%s'` 패턴 사용 (개행 방지).
- **OAuth 가이드:** `docs/oauth-document.md` 참조 (플랫폼별 함정 정리).
- **update.recent:** Desktop 바로 아래 폴더명 기준 → "sns automation"으로 기록.

---

## 세션 5 — Phase 2 완료 + UI 개선 (2026-04-18)

> 이 섹션은 LoopDrop 프로젝트 세션입니다.


### Threads 재연결
- 토큰 만료 → 재연결 완료 (@hwanleeyong, 만료: 2026-06-16)

### TikTok Production 앱 리뷰
- 발행 UI에 TikTok 전용 옵션 추가 (프라이버시, 상호작용 토글, 상업적 콘텐츠 공개, 음악 경고)
- TikTok Developer Portal에서 Submit for review 제출

### 영상 편집 섹션 (Phase 2)
- ffmpeg.wasm 브라우저 전용 방식 채택 (Remotion + Cloudflare Tunnel 방식 폐기)
- 이미지 드래그앤드롭 → 장면별 자막(AI 추천) → 배경음악(크롭 기능) → mp4 렌더링/다운로드
- Canvas 렌더러로 이미지+자막 합성, ffmpeg concat으로 영상 생성

### 예약 발행 (Phase 2)
- 캘린더 UI + DayPanel + 시간 선택 UI
- Vercel Cron Jobs (매일 UTC 00:00 = KST 09:00) 자동 발행
- `scheduled_posts` 테이블 확장 (platforms, platform_data, media_type 컬럼 추가)
- 발행 히스토리 → "발행/예약 현황"으로 변경, 탭 분리 (발행 완료 / 예약 현황)
- 수동 발행 트리거 ("지금 발행" 버튼)

### UI 개선
- 헤더 h-16→h-20, 로고/텍스트 확대
- 사이드바 w-72, 아이콘 w-6, 텍스트 text-base
- 히어로 섹션 전체 비례 확대 (아이콘 w-28, 제목 6xl)
- 사이드바 마스코트: 페이지별 다른 캐릭터 + 기능 설명 말풍선 순환
- 메뉴명 변경: 콘텐츠 캘린더→예약 발행, 발행 히스토리→발행/예약 현황

### GitHub
- 첫 푸시: https://github.com/snu9026-Chris/snsautomation
- .gitignore: .env*, .claude/, .vercel/, public/lottie/ 제외
- Google OAuth 시크릿 제거 후 클린 커밋

---

## Loopify 세션 1 — 프로젝트 생성 + 전체 파이프라인 (2026-04-20~21)

### 프로젝트 초기화
- Next.js 16 + TypeScript + Tailwind 4, 포트 3002
- Loopdrop 수준 디자인 전면 적용 (pearl shimmer, marquee, 마스코트, 그라데이션 아이콘)
- Vercel 배포: https://myloopify.vercel.app

### UX 플로우 구축
- 4개 페이지: 대시보드, 트렌드 탐색, 새 프로젝트 마법사, 프로젝트 상세
- 사이드바 구조: 대시보드 → 트렌드 탐색 → 새 프로젝트 → 프로젝트 관리 → 숏폼 만들기 → 업로드/예약 → 롱폼 만들기 → 북마크 → 설정
- 북마크 페이지에 달력 뷰 추가
- 프로젝트 상세는 프롬프트까지만, 이후 작업은 숏폼 만들기로 분리

### Spotify 연동
- client_credentials 플로우
- 신규 앱 limit 제한 대응 (limit=10, 플레이리스트 403 → 검색 fallback)
- 국가별 + 카테고리별 검색 + year:2025-2026 필터

### GPT 분석
- 곡별 개별 심층 분석 (9가지 관점: Hook, Structure, Chord, Melody, Repetition, Production, Energy, Vocal, Trend)
- 슬라이드 캐러셀 UI
- Suno 프롬프트: Style 태그 8개+ / 가사 [Intro][Verse][Chorus] 구조 / 3분 분량

### 숏폼 파이프라인
- mp3 브라우저 로컬 처리 (Web Audio API, 서버 업로드 없음)
- 클라이맥스 20초 추출 (RMS 에너지 피크)
- Gemini 가사 기반 테마 분석 → Imagen 4.0 앨범 커버 이미지 생성
- ffmpeg-static Vercel 렌더링 (이미지 + 오디오 + 이퀄라이저)
- 파일 드래그 정렬 (프롬프트 매칭)

### 기술 결정
- Supabase Storage 안 씀 (50MB 제한) → 브라우저 RAM + 메타데이터만 DB
- 렌더링: Vercel Functions ffmpeg-static (20초 쇼츠) / 로컬 서버는 롱폼용 예비
- 글로벌 디자인/UX 품질 기준 CLAUDE.md에 저장


## Loopify 세션 2 — 렌더링 파이프라인 + 업로드 페이지 (2026-04-23~24)

### ffmpeg 렌더링
- Vercel Hobby에서 ffmpeg 불가 확인 → 로컬 Node 서버 + Cloudflare Tunnel 구조 확정
- ffmpeg 설치 (winget), cloudflared 설치
- render-server.mjs: 이미지 + 오디오 + 이퀄라이저 → mp4 합성
- 이퀄라이저: showfreqs 바 → showwaves 중앙 하단 컴팩트 웨이브폼으로 변경

### 이미지 생성 개선
- 가사 → Gemini 테마 분석 → Imagen 4.0 앨범 커버 생성 (원버튼 파이프라인)
- 앨범 커버 아트 스타일 프롬프트 강화 (실루엣/추상, 실제 얼굴 회피)
- 곡별 재생성 버튼, 세로 크게 이미지 그리드

### 파일명 매칭 구조
- 렌더링 시 파일명 = 곡 제목 기반 (Silver_Moon_Above_The_Walls_highlight.mp4)
- 업로드 시 파일명으로 Supabase playlist_tracks.title 매칭
- 메타데이터(제목/설명/태그) 자동 로드

### 업로드/예약 페이지
- 왼쪽: mp4 드롭존 + 파일 리스트 (매칭 상태 표시)
- 오른쪽: 즉시 발행 / 예약 발행 패널
- YouTube API 연동 전 placeholder

### 기술 결정
- Supabase Storage 안 씀 → 브라우저 RAM + 로컬 서버
- 메타데이터: 렌더링 시 자동 생성 (별도 Step 제거)
- localStorage에 Tunnel URL 저장


## Loopify 세션 3 — Remotion 마이그레이션 + 프리셋 + 리팩토링 (2026-04-28~29)

### FFmpeg → Remotion 렌더링 전환
- FFmpeg CLI 기반 렌더링 → Remotion renderMedia() 기반으로 전면 교체
- render-server.mjs 재작성: @remotion/renderer + @remotion/bundler + @remotion/media-utils
- MP3 concat만 FFmpeg 유지 (하이브리드)
- Remotion Composition 구조: Root.tsx → Shorts/Longform 컴포지션 2개
- 컴포넌트 5개: ImageSlideshow, Equalizer, OverlayLayer, Waveform, BuiltInOverlays

### 이퀄라이저 시스템
- 초기 8종 → 정리하여 4종 확정 (글래스, 대칭 스펙트럼, 원형, 펄스)
- 파동 진폭 2.5배 부스트 (visualizeAudio 값이 너무 작아서)
- numberOfSamples 48 → 32 수정 (2의 거듭제곱 제약)
- 대칭 스펙트럼: 가운데 글로우 줄 + 위아래 대칭 파동 신규 추가

### 프리셋 오버레이 시스템
- YouTube 세트 (로고+구독+벨+좋아요/댓글/공유) — 글래스 카드 + 순차 눌림 이펙트
- 워터마크 — 캡슐형 글래스 배지 + 영문 감성 문구 (기획사 스타일)
- 엔드 스크린 — 글래스 카드 + 감성 한글 문구
- 컨트롤바 (풀/미니) — 글래스박스 + 되감기/빨리감기/일시정지 + 프로그레스 바
- 모든 프리셋: 위치(9칸)/크기/투명도/타이밍 설정 가능

### 롱폼 만들기 개선
- 이미지 업로드 지원 (16:9 자동 크롭, 1920x1080)
- AI 생성 이미지 저장 버튼 (hover시 다운로드/삭제)
- 이퀄라이저 + 프리셋 선택 UI 복원
- Canvas 미리보기 레티나(2x) 해상도 업그레이드

### 숏폼 만들기 개선
- Step 3.5 추가: 프리셋 설정 + 미리보기 (이미지 생성 후, 렌더링 전)
- 이퀄라이저 스타일 선택 (글래스/대칭/원형/펄스)
- 오버레이 프리셋 토글 (이퀄라이저/컨트롤러/가사)
- 가사 입력 (곡별 텍스트, 줄바꿈 구분)
- 9:16 세로 Canvas 미리보기 (270x480, 10초, 오디오 재생)

### 전체 리팩토링 (3단계)

**Phase 1: 공통 유틸리티 + 타입 추출**
- `lib/types.ts` (106줄): EqualizerType, PresetType, OverlayItem 등 17개 타입 + 3개 상수
- `lib/image-utils.ts` (88줄): fileToBase64, blobToBase64, compressImage, cropTo16x9 등
- `lib/canvas-draw.ts` (412줄): drawEqualizer, drawPresetOverlay, boostFreqData 등
- `lib/api-error.ts` (30줄): withErrorHandler 래퍼

**Phase 2: 컴포넌트 분리**
- `components/shared/StepBadge.tsx` (20줄)
- `components/longform/PreviewCanvas.tsx` (167줄)
- `components/longform/OverlayEditor.tsx` (143줄)
- longform/page.tsx: 1,337줄 → 418줄 (-69%)
- shorts/page.tsx: 1,245줄 → 992줄 (-20%, MetadataStep 데드코드 111줄 제거)

**Phase 3: API 에러 핸들러**
- 7개 API 라우트, 11개 핸들러에 withErrorHandler 래퍼 적용
- bookmarks, projects, tracks, youtube/comment 등

### 기타
- 사이드바 메뉴 순서 변경: 숏폼 → 롱폼 → 업로드/예약
- 프리셋 그리드 항상 표시 (토글 제거)


---

## 세션 (2026-04-30) — 4.7 리팩토링: 안정성·보안·모듈화·상태 일원화

### 🗂 기획 / 결정
- 4.6의 Phase 1~3 완료(types/utils/components/api-error 추출) 위에서 4.7이 추가로 손볼 수 있는 6개 영역 도출 → 전부 진행 결정
- 외부 의존성 추가(zustand 등) 없이 Next.js 16 기본 스택만 사용하기로
- TrackSlot에 안정 id를 도입해서 slotIndex 재정렬 시 가사/이미지 매핑 깨지던 구조적 결함 해소

### 🐛 문제 → 해결
> **문제**: shorts 페이지 클립 분석 결과가 Supabase에 저장 안 됨
> **원인**: analyzeAll 안에서 `slots.find(...)` 가 stale closure를 잡아 항상 분석 전 상태를 반환
> **해결**: `analyzeAudioPeak` 직후 받은 로컬 `clip` 변수로 즉시 PATCH

> **문제**: projects-manage 인터벌 누수 + 재진입 시 다중 setInterval
> **원인**: 컴포넌트 unmount 시 cleanup 없는 1초 setInterval × N개
> **해결**: id별 단일 setTimeout(영구 삭제용) + 표시용 1초 ticker 1개. unmount 시 모두 정리

> **문제**: YouTube access_token이 브라우저로 노출 (uploads/page.tsx)
> **원인**: 큰 파일 우회 위해 GET /api/youtube/token으로 토큰 받아 직접 googleapis.com 호출
> **해결**: 서버에서 resumable session URL만 발급(/api/youtube/upload-init), 브라우저는 인증 헤더 없이 PUT만 수행. /api/youtube/token은 410 deprecated

> **문제**: SortableFileList 드래그 정렬 시 lyrics/이미지 매핑 깨짐
> **원인**: slotIndex를 키로 사용 → 재정렬 시 같은 slotIndex가 다른 곡을 가리킴
> **해결**: TrackSlot에 안정 id 필드 추가. lyrics, themes, errors 모두 id 기반으로 키잉

> **문제**: Header와 uploads/page.tsx가 ytConnected를 각자 보유 → 한쪽 disconnect해도 다른 쪽 stale
> **원인**: 같은 데이터를 두 군데에서 fetch
> **해결**: YouTubeAuthProvider Context로 단일화. layout.tsx에서 감쌈

> **문제**: 11개 API 라우트가 OpenAI/Gemini/Imagen/YouTube refresh 호출을 거의 그대로 복붙
> **원인**: Phase 1은 클라이언트 유틸만 뽑아냄
> **해결**: lib/openai.ts (callGpt), lib/gemini.ts (callGemini), lib/imagen.ts (generateImage), lib/youtube-auth.ts (getValidYouTubeToken/exchangeAuthCode) 4모듈로 통합

> **문제**: ShortsPreview(992줄 page 안)와 PreviewCanvas가 AudioContext+Analyser+RAF 셋업/정리를 거의 동일하게 가짐 + shorts에는 메모리 누수 우려
> **원인**: 미리보기 로직이 두 페이지에 인라인
> **해결**: hooks/useAudioVisualizer 훅으로 통합. ShortsPreview를 components/shorts/ShortsPreview.tsx 분리. 둘 다 같은 훅 사용

> **문제**: projects/[id]/page.tsx에 사용 안 되는 컴포넌트 7개(~400줄)
> **원인**: STEPS 배열엔 prompts만 남았는데 Upload/Climax/Image/Render/Metadata/Publish 섹션이 함수만 정의됨
> **해결**: 전부 제거, 742줄 → 220줄

### 📌 진행 상황
- 6개 페이즈 전부 완료, npm run build 통과
- 새 파일: lib/api/{client,projects,bookmarks,youtube,images}.ts, lib/{openai,gemini,imagen,youtube-auth}.ts, hooks/{useAudioVisualizer,useShorts,useToggleSet,useLocalState,useYouTubeAuth}.tsx, components/shorts/ShortsPreview.tsx, app/api/youtube/upload-init/route.ts
- 마이그레이션: 11개 API 라우트, 8개 페이지(shorts/longform/uploads/new/explore/bookmarks/projects-manage/projects-id), Header/Sidebar
- 다음: Spotify 활성화 후 차트 전환, YouTube 메타데이터 매칭 SQL 최적화, render 로컬 서버 CORS 화이트리스트 적용

---

## 세션 — 2026-05-04 — 숏폼 프롬프트 수동화 + 프로젝트 소프트삭제 + Supabase MCP

### 🗂 기획 / 결정
- **숏폼 이미지 프롬프트를 자동 → 수동(추천+편집) 흐름**으로 전환. "그림 테마 자동 설정" 대신 사용자가 직접 한국어로 보고 편집하게. UX 결정: 비개발자가 읽기 쉬운 한국어 textarea로 추천 → 사용자가 수정 → 서버에서 영문 변환 후 Imagen
- **프로젝트 소프트 삭제 정책 정공법화**: 30분 카운트다운의 진실 소스를 메모리 setTimeout이 아니라 DB의 `deleted_at` 컬럼으로. 영구 삭제는 cron 없이 `/api/projects/recent` 호출 시점 lazy 청소. 페이지를 떠나도/새로고침해도 카운트다운 유지
- **Supabase MCP 셋업** — Vercel처럼 Claude Code에서 SQL/스키마를 직접 다룰 수 있도록. read-write 모드, Loopify 프로젝트(`rmpqsqpibsuxtlbmimgv`)로 한정해 다른 Supabase 프로젝트 실수 방지

### 🐛 문제 → 해결

> **문제**: 프로젝트 관리에서 삭제해도 회색 카드도 안 뜨고 30분 후 영구 삭제도 안 됨
> **원인**: (1) `softDelete`가 `status='deleted'`로 update하려 했지만 DB CHECK 제약에 'deleted'가 없어서 거부됨 (2) 30분 영구삭제가 클라이언트 setTimeout이라 페이지 이탈/새로고침 시 사라짐 (3) `deleted_at` 컬럼이 schema에 없어서 서버가 삭제 시각을 모름
> **해결**: 마이그레이션으로 status에 'deleted' 추가 + `deleted_at TIMESTAMPTZ` 컬럼 + 부분 인덱스. delete 라우트가 deleted_at도 함께 세팅. recent 라우트가 호출 시점에 만료(>30분) row를 lazy 청소. 클라이언트는 메모리 timer 제거하고 서버에서 받은 `p.deleted_at` 만 진실 소스로 사용

> **문제**: `/api/projects/recent`가 다른 페이지(shorts, sidebar)에서도 쓰이는데 deleted row를 함께 내려보내면 거기서도 삭제된 프로젝트가 보임
> **원인**: 단일 라우트가 두 가지 용도(살아있는 것만 / 회색 카드 포함)를 분기 없이 처리
> **해결**: `?include_deleted=1` 쿼리 파라미터 추가. 기본은 `deleted_at IS NULL` 필터. projectsApi.recent에 `{ includeDeleted }` 옵션 추가하고 projects-manage에서만 활성화

> **문제**: Supabase SQL Editor에 마이그레이션 SQL 붙여넣을 때 한국어 안내 문구도 같이 들어가서 syntax error
> **원인**: 코드블럭과 안내 텍스트를 한 메시지에 같이 줘서 사용자가 통째로 복붙
> **해결**: 순수 SQL만 별도 코드블럭으로 다시 제공

### 📌 진행 상황
- 배포 완료: `https://myloopify.vercel.app` alias 갱신
- Supabase 마이그레이션 사용자 직접 실행 완료 (status에 'deleted' 추가, deleted_at 컬럼)
- 새 파일: `app/src/app/api/images/recommend-prompt/route.ts`, `app/supabase-migration-soft-delete.sql`
- 삭제: `app/src/app/api/images/auto-generate/`
- 수정: `app/src/app/api/images/generate/route.ts`(한국어→영문 변환), `app/src/app/api/projects/[id]/delete/route.ts`(deleted_at 세팅), `app/src/app/api/projects/recent/route.ts`(lazy 청소+include_deleted), `app/src/lib/api/images.ts`, `app/src/lib/api/projects.ts`, `app/src/app/projects-manage/page.tsx`, `app/src/app/shorts/page.tsx`(ImageGenStep 두 단계 UI), `app/supabase-schema.sql`
- Supabase MCP user scope 등록(`~/.claude.json` 갱신). 인증은 사용자가 Claude Code 재시작 후 `/mcp`에서 진행 예정
- ✅ Supabase MCP OAuth 인증 완료 — `/mcp` Connected 확인
- 다음: 사이트에서 두 기능(숏폼 프롬프트 수동 흐름 + 프로젝트 소프트삭제) 실제 동작 확인 → Remotion 렌더링에 가사/컨트롤러 프리셋 반영
