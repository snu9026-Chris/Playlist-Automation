# Loopify — Next.js 16 (App Router)

플레이리스트 자동화 파이프라인의 메인 웹앱. 트렌드 수집·AI 분석·앨범아트 생성·영상 렌더·YouTube 업로드를 한 곳에서.

> 전체 셋업 가이드: **레포 루트의 `SUPABASE_SETUP.md` · `Loopify/app/env.local.md`** 참조.

---

## 빠른 시작 (로컬)

```bash
# 레포 루트에서
cd Loopify/app
npm install
cp .env.local.example .env.local   # 키 값들 채워 넣기
npm run dev                         # → http://localhost:3002
```

- 포트는 **3002 고정** (`package.json` scripts).
- 영상 렌더(롱폼)는 Vercel에서 안 돌아갑니다. 로컬 렌더 서버를 같이 띄워야 합니다.
  - 한 번에: 레포 루트의 `start.bat` 더블클릭 (Windows)
  - 따로: `node local-server/render-server.mjs` (포트 4100)
  - FFmpeg 필요 — 시스템 PATH에 잡혀있으면 자동 인식. 다른 경로면 `FFMPEG_PATH` 환경변수.
- 숏폼은 브라우저 ffmpeg.wasm으로 렌더 → 로컬 렌더 서버 없이도 OK.

---

## 핵심 환경변수

`Loopify/app/.env.local`에 넣습니다. 자세한 발급 방법은 `env.local.md` 참조.

| 키 | 용도 |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | 앱 자신의 도메인 (OAuth 콜백 redirect). 로컬 `http://localhost:3002`, 배포 `https://<본인 도메인>`. **클론 사용자 필수** |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 클라이언트 접근 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서버 전용 (RLS 우회). 절대 브라우저 노출 금지 |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify 트렌드·메타 조회 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | YouTube OAuth (Redirect URI: `<BASE_URL>/api/auth/callback`) |
| `GOOGLE_AI_API_KEY` | Gemini 분석 + Imagen 4 Fast 앨범아트 |
| `OPENAI_API_KEY` | (옵션) GPT 일부 라우트 — Gemini로 통합 가능 |
| `CRON_SECRET` | Vercel Cron (`/api/cron/upload`) 인증 |

---

## DB 셋업 — 마이그레이션 4개

Supabase SQL Editor에 순서대로 실행:

1. `supabase-schema.sql` — 메인 4개 테이블 (`playlist_projects` · `playlist_tracks` · `track_bookmarks` · `scheduled_uploads`)
2. `supabase-migration-soft-delete.sql` — 프로젝트 소프트 삭제
3. `supabase-migration-scheduled-uploads.sql` — 예약 업로드 확장 + Storage `media` 버킷
4. `supabase-migration-platforms.sql` — **YouTube OAuth 토큰 저장 (외부 클론 사용자 필수)**

> Supabase MCP가 연결돼 있으면 클로드한테 "@SUPABASE_SETUP.md 보고 다 적용해줘"로 한 번에.

---

## 구조

```
Loopify/app/
├── src/app/              # Next.js App Router (페이지 + API 라우트)
│   ├── api/auth/         # YouTube OAuth (callback, disconnect, youtube)
│   ├── api/projects/     # 프로젝트 CRUD + 트랙 슬롯
│   ├── api/images/       # Imagen 앨범아트 생성
│   ├── api/spotify/      # 트렌드·차트
│   ├── api/cron/         # Vercel Cron — 예약 발행
│   └── api/uploads/      # 예약 업로드 큐
├── src/lib/              # 클라이언트·서버 공통 헬퍼
├── local-server/         # 로컬 Remotion 렌더 서버 (포트 4100)
├── supabase-*.sql        # DB 마이그레이션 4개
└── vercel.json           # 예약 발행 cron (매일 KST 18:00)
```

---

## 자주 막히는 곳

- **OAuth가 원본 사이트로 redirect됨** → `NEXT_PUBLIC_BASE_URL` 미설정. `.env.local`과 Vercel 환경변수 둘 다 채우기.
- **YouTube 연결 시 `platforms` 테이블 없음 에러** → 마이그레이션 #4 안 돌림. `supabase-migration-platforms.sql` 실행.
- **롱폼 렌더 실패** → 로컬 렌더 서버 안 띄움 (`node local-server/render-server.mjs`) 또는 FFmpeg가 PATH에 없음 (`FFMPEG_PATH` 환경변수로 절대경로 지정).
- **Vercel Cron 401** → `CRON_SECRET`이 로컬·Vercel 사이에서 일치하는지 확인.
