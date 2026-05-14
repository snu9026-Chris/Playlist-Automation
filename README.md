# Playlist Automation

YouTube 플레이리스트 채널 자동화 파이프라인 — 트렌드 수집부터 영상 업로드까지 한 줄에.

> **메인 코드**: [`Loopify/app/`](./Loopify/app/) (Next.js 16 App Router)
> **셋업 가이드**: [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) · [`Loopify/app/env.local.md`](./Loopify/app/env.local.md)
> **파이프라인 정의(9단계)**: [`YouTube_AI_Music_Automation_Pipeline_Final.md`](./YouTube_AI_Music_Automation_Pipeline_Final.md)

---

## 한 줄 요약

- **프론트엔드 + 백엔드**: Next.js (Vercel 배포)
- **DB / Storage / Auth**: Supabase
- **AI**: Gemini (분석·가사·앨범아트) + (옵션) OpenAI
- **트렌드**: Spotify Web API
- **영상**: Remotion (롱폼, 로컬 렌더) + ffmpeg.wasm (숏폼, 브라우저)
- **배포 대상**: YouTube Data API v3 (자동 업로드 + 예약 발행)
- **곡 생성**: suno.com에서 수동 (mp3 직접 업로드) — API 자동화는 미구현

---

## 빠른 시작

```bash
# 1. 클론
git clone https://github.com/<본인>/Playlist-Automation
cd Playlist-Automation/Loopify/app

# 2. 의존성 + 환경변수
npm install
cp .env.local.example .env.local
# → .env.local의 키들을 본인 값으로 채우기 (env.local.md 참조)

# 3. Supabase 마이그레이션 4개를 Dashboard SQL Editor에 차례로 실행
#    (SUPABASE_SETUP.md 표 참조)

# 4. 로컬 dev 서버 + 렌더 서버 (Windows)
cd ../..                  # 레포 루트로
start.bat                 # dev 3002 + render 4100 동시 실행
# (macOS/Linux는 두 터미널에서 따로:
#   터미널 1: cd Loopify/app && npm run dev
#   터미널 2: cd Loopify/app && node local-server/render-server.mjs)
```

---

## 폴더 구조

```
Playlist-Automation/
├── Loopify/app/                  # 메인 웹앱 (Next.js)
│   ├── src/                      # 페이지 + API 라우트
│   ├── local-server/             # Remotion 렌더 서버 (포트 4100)
│   ├── supabase-*.sql            # DB 마이그레이션 4개
│   ├── .env.local.example        # 환경변수 템플릿
│   ├── env.local.md              # 키 발급·설정 가이드
│   └── README.md                 # 앱 레벨 README
├── planning-docs/                # 기획·전략 문서
├── SUPABASE_SETUP.md             # Supabase 셋업 풀스텝
├── YouTube_AI_Music_Automation_Pipeline_Final.md  # 9단계 파이프라인 정의
├── Loopdrop_기획문서.md          # 제품 기획서
├── TODO.md                       # 진행 상황
├── history.md                    # 변경 이력
└── start.bat                     # Windows 통합 런처 (dev + render)
```

---

## 외부 클론 사용자 필수 체크

1. **`NEXT_PUBLIC_BASE_URL`** — `.env.local`과 Vercel 환경변수 모두에 본인 도메인 등록. 안 하면 OAuth가 원본 저자 사이트로 redirect됨.
2. **`supabase-migration-platforms.sql`** — 마이그레이션 #4를 반드시 실행. YouTube OAuth 토큰 저장용 테이블.
3. **Google OAuth Redirect URI** — Google Cloud Console에 로컬(`http://localhost:3002/api/auth/callback`)과 본인 Vercel 도메인 둘 다 등록.
4. **FFmpeg** — 롱폼 렌더 쓸 거면 시스템 PATH에 ffmpeg 설치 (또는 `FFMPEG_PATH` 환경변수로 절대경로 지정).

---

## 라이선스 / 출처

원본: [@snu9026-Chris/Playlist-Automation](https://github.com/snu9026-Chris/Playlist-Automation)
