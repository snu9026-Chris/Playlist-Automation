# Loopify/app — `.env.local` 발급 가이드

이 폴더의 `.env.local`은 **플레이리스트 영상 생성** 쪽에서 사용하는 키들입니다. Spotify/YouTube 메타 + AI 생성 + Supabase 저장 + Vercel Cron이 핵심.

> 빠른 시작: `.env.local.example`을 `.env.local`로 복사 후 채우기.

---

## 1. Supabase

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- **용도**: DB + Storage. anon은 클라이언트, service_role은 서버 전용 (RLS 우회 필요한 작업).
- **발급**: https://supabase.com → 프로젝트 → Settings → API
- **주의**:
  - `service_role`은 **절대 클라이언트 코드에 노출 금지** (서버 라우트 전용)
  - Loopdrop 프로젝트와 DB 공유 (스키마: `playlists`, `playlist_tracks`, `videos` 등)

## 2. Spotify Web API

```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

- **용도**: 곡 메타데이터(아티스트, 앨범, 길이) 조회. **사용자 OAuth 불필요** (client_credentials flow).
- **발급**: https://developer.spotify.com/dashboard → Create app
- **Redirect URI**: client_credentials 모드라 미사용. 그냥 `http://localhost:3000`이라도 등록해두면 됨.
- **주의**: 토큰 만료 1시간. 자동 갱신 로직 필요.

## 3. Google OAuth (YouTube 업로드)

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- **용도**: 생성한 영상을 사용자 YouTube에 자동 업로드
- **발급**: https://console.cloud.google.com → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID
- **Redirect URI**: `http://localhost:3000/api/auth/callback/google`, `https://<프로덕션>/api/auth/callback/google`
- **Scopes**: `youtube.upload` (필요 시 `youtube.force-ssl`)
- **공유**: Loopdrop과 같은 OAuth 클라이언트 재사용 가능 (Redirect URI만 추가)

## 4. YouTube Data API (메타용)

```
YOUTUBE_API_KEY=
```

- **용도**: 채널 정보·영상 검색 등 **읽기 전용** 호출. 업로드는 위 OAuth로.
- **발급**: 같은 GCP 프로젝트에서 API 키 추가 → "YouTube Data API v3" 허용
- **주의**: 키에 도메인/IP 제한 걸어두면 안전.

## 5. Google AI Studio (Gemini)

```
GOOGLE_AI_API_KEY=
```

- **용도**: 썸네일 생성 (Nano Banana / Gemini 2.5 Flash 이미지), 텍스트 보조
- **발급**: https://aistudio.google.com/apikey → Create API key
- **주의**: GCP의 Vertex AI와 **다름**. AI Studio는 더 단순한 API 키 방식.

## 6. OpenAI

```
OPENAI_API_KEY=
```

- **용도**: 플레이리스트 제목·설명·태그 생성 (gpt-4o-mini)
- **발급**: https://platform.openai.com/api-keys
- **주의**: 사용량 한도(spending limit) 설정 권장.

## 7. Instagram / Meta (선택)

```
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
META_APP_ID=
META_APP_SECRET=
```

- **용도**: 생성한 영상의 short clip을 Instagram Reels로 동시 발행
- **발급**: https://developers.facebook.com → 앱 생성 → Instagram Graph API 추가
- **전제**: Instagram **비즈니스 계정** + 연결된 Facebook 페이지
- **함정**: 개발 모드에서는 등록된 테스터 계정만 작동. 공개는 App Review.

## 8. Vercel Cron Secret

```
CRON_SECRET=
```

- **용도**: Vercel Cron이 호출하는 API 라우트 인증. 외부에서 임의 호출 차단.
- **생성**: 직접 랜덤 문자열 만들면 됨 (예: `openssl rand -hex 32`)
- **사용**: API 라우트에서 `Authorization: Bearer ${CRON_SECRET}` 헤더 검증
- **배포 시**: Vercel 환경변수에도 **동일 값** 등록. 안 그러면 Cron이 401.

---

## 체크리스트

- [ ] `.env.local`이 `.gitignore`에 포함되어 있는지 확인
- [ ] `service_role` 키는 서버 코드(`app/api/**`)에서만 import
- [ ] OAuth Redirect URI는 로컬 + 프로덕션 둘 다 콘솔에 등록
- [ ] 배포 시 Vercel 환경변수에 동일하게 넣기 (Production/Preview/Development)
- [ ] Cron이 401 나면 Vercel 환경의 `CRON_SECRET`이 로컬과 같은지 먼저 확인
