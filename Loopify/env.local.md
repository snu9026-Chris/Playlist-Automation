# Loopify (루트) — `.env.local` 발급 가이드

이 폴더의 `.env.local`은 **SNS 자동 발행** 쪽에서 사용하는 키들입니다. 각 항목별로 어디서 받는지 / 어디에 쓰는지 정리했어요. 실제 키는 `.env.local`에 넣고, 이 파일은 가이드용으로만 커밋합니다.

> 빠른 시작은 `.env.local.example`(있으면 복사해서 채우기). 키 발급 함정은 `~/.claude/skills/oauth-guide/SKILL.md` 참고.

---

## 1. Supabase

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- **용도**: DB 연결 (브라우저에서 직접 호출되는 키)
- **발급**: https://supabase.com → 프로젝트 → Settings → API
  - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **주의**: anon key는 RLS 정책으로 보호되어야 함. `service_role` 키는 절대 `NEXT_PUBLIC_*`에 넣지 말 것.

## 2. OpenAI

```
OPENAI_API_KEY=
```

- **용도**: 캡션·해시태그 생성 (gpt-4o-mini 등)
- **발급**: https://platform.openai.com/api-keys → "Create new secret key"
- **주의**: 결제 카드 등록 + 사용량 한도 설정 권장.

## 3. YouTube Data API

```
YOUTUBE_API_KEY=
```

- **용도**: 영상 메타데이터 조회 (조회수, 댓글 등). **업로드/댓글 작성에는 안 씀** (그건 OAuth로).
- **발급**: https://console.cloud.google.com → API 라이브러리 → "YouTube Data API v3" 활성화 → 사용자 인증 정보 → API 키
- **주의**: 일일 쿼터 10,000 unit 기본. 영상 1개 조회 = 1 unit.

## 4. 앱 베이스 URL

```
NEXT_PUBLIC_BASE_URL=
```

- **용도**: OAuth redirect URI 조립, 절대 URL 생성 등
- **값 예시**: 로컬은 `http://localhost:3000`, 배포는 `https://myloopify.vercel.app`
- **주의**: trailing slash 없이.

## 5. Google OAuth (YouTube 업로드/댓글용)

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- **용도**: 사용자가 자기 YouTube 채널에 영상 올리고/댓글 다는 OAuth 인증
- **발급**: https://console.cloud.google.com → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 생성
- **Redirect URI** 등록: `{NEXT_PUBLIC_BASE_URL}/api/auth/callback/google`
- **Scopes 필수**: `youtube.upload`, `youtube.force-ssl` (댓글 작성 권한)
- **함정**: 댓글 scope 빼먹으면 업로드는 되는데 댓글이 403 나옴.

## 6. Meta (Instagram·Threads 부모 앱)

```
META_APP_ID=
META_APP_SECRET=
```

- **용도**: Meta 플랫폼 공통 (Instagram Graph API, Threads API의 부모)
- **발급**: https://developers.facebook.com → My Apps → Create App
- **주의**: 앱이 "개발 모드"면 본인 + 테스터로 추가된 계정만 사용 가능. 공개 배포는 App Review 필요.

## 7. Instagram (Graph API)

```
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
```

- **용도**: Instagram 비즈니스/크리에이터 계정에 게시
- **발급**: 위 Meta 앱 안에서 "Instagram Basic Display" 또는 "Instagram Graph API" 추가
- **전제 조건**: 사용자가 IG **비즈니스 계정**이어야 함 (개인 계정 X) + Facebook 페이지 연동
- **Redirect URI**: `{NEXT_PUBLIC_BASE_URL}/api/auth/callback/instagram`

## 8. Threads

```
THREADS_APP_ID=
THREADS_APP_SECRET=
```

- **용도**: Threads 자동 발행
- **발급**: Meta 앱에서 "Threads API" 제품 추가 (별도 신청 필요할 수 있음)
- **주의**: API 비교적 신규. 미디어 컨테이너 → 게시 두 단계 호출.

## 9. TikTok

```
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

- **용도**: TikTok 영상 업로드
- **발급**: https://developers.tiktok.com → Manage apps → Add app
- **Redirect URI**: `{NEXT_PUBLIC_BASE_URL}/api/auth/callback/tiktok`
- **주의**: Sandbox에서는 본인 계정 + 등록된 테스터만 사용 가능. Production은 검수 필요.

## 10. X (구 Twitter)

```
X_CLIENT_ID=
X_CLIENT_SECRET=
```

- **용도**: X에 트윗 자동 발행
- **발급**: https://developer.x.com → Project & Apps → 새 앱 → User authentication settings → OAuth 2.0 활성화
- **Redirect URI**: `{NEXT_PUBLIC_BASE_URL}/api/auth/callback/x`
- **주의**: Free tier는 월 1,500 게시 한도. PKCE 필수.

---

## 체크리스트

- [ ] `.env.local`이 `.gitignore`에 포함되어 있는지 확인
- [ ] 각 플랫폼의 **Redirect URI**를 로컬·배포 모두 등록 (둘 다 등록 가능)
- [ ] 키를 채팅·이슈·커밋에 절대 붙여넣지 말 것
- [ ] 배포 시 Vercel 환경변수에도 동일하게 넣기 (Production/Preview/Development 분리)
