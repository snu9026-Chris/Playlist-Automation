# OAuth 플랫폼별 함정 가이드

> LoopDrop 프로젝트에서 5개 플랫폼(YouTube, Instagram, Threads, TikTok, X) OAuth 연동하면서 겪은 시행착오 정리. 다음에 OAuth 작업할 때 **반드시 먼저 읽고** 시작할 것.

---

## 공통 주의사항

### 1. Vercel 환경변수 개행(`%0A`) 주의
- `vercel env add NAME production <<< "value"` 처럼 here-string을 쓰면 bash가 끝에 개행 추가 → URL에 `%0A` 섞임 → `param_error` 발생
- **반드시 `printf '%s' "value" | vercel env add NAME production` 패턴 사용**
- 증상: `client_id=xxxxxx%0A&redirect_uri=https://...%0A/api/...` 형태로 URL이 깨짐
- **코드 측 방어막**: env 읽는 모든 진입점에 `.trim()` 박아두기 (이미 `oauth-config.ts`, `api/auth/[platform]/route.ts`, `api/auth/callback/route.ts` 세 곳에 적용됨)

#### 실제 사고 — 2026-05-14: 5개 플랫폼 OAuth 동시 실패

**증상**
- `loopdrop.vercel.app/accounts`에서 YouTube/Instagram/Threads/TikTok/X 5개 모두 OAuth 시작 즉시 거부
- 각 플랫폼별 에러 메시지:
  - Facebook: "Invalid App ID"
  - Threads: `error_code=1, "An unknown error has occurred"`
  - TikTok: "문제가 발생했습니다 — code_challenge"
  - X: "Something went wrong"
  - Google: `400 잘못된 요청`

**진단 결정타**
OAuth dialog URL 자세히 보니:
```
client_id=931853832985831%0A&redirect_uri=http%3A%2F%2Flocalhost%3A3001%0A%2Fapi%2Fauth%2Fcallback
                          ^^^                                    ^^^
                       client_id 끝              redirect_uri 한가운데
```
- `%0A`(URL-encoded `\n`)가 **client_id 끝과 `localhost:3001` 직후** 두 군데에 박힘
- 즉 `process.env.META_APP_ID` 와 `process.env.NEXT_PUBLIC_BASE_URL` 두 값 모두 끝에 `\n` 보유

**범위 확인 — `vercel env pull` 후 hex dump**
```bash
vercel env pull .env.check --environment=production --yes
grep "^NEXT_PUBLIC_BASE_URL=" .env.check | od -c
# 0000040   a   l   h   o   s   t   :   3   0   0   1   \   n   "  \n
#                                                          ^^^
#                                              저장된 값 끝에 literal \n
```
- production env 22개 중 **21개에 trailing `\n`** 박혀 있었음
- 깨끗했던 3개: `AUTH_USER`, `AUTH_PASS`, `CRON_SECRET` (UI에서 직접 타이핑하거나 자체 생성한 짧은 값들)
- 더러웠던 21개: OAuth 키 11개 + BASE_URL + Supabase/OPENAI/YOUTUBE/N8N 등 모두 **외부 콘솔에서 복사한 값들**

**추가 발견 — `NEXT_PUBLIC_BASE_URL` 값 자체가 잘못**
- 프로덕션 env인데 값이 `http://localhost:3001`로 박혀있었음 (게다가 끝에 `\n`)
- 그래서 redirect_uri가 `http://localhost:3001%0A/api/auth/callback`로 깨진 채 OAuth 프로바이더에 전달됨
- Google 콘솔에 URI 1로 등록된 `http://localhost:3001/api/auth/callback`과도 `\n` 때문에 매치 실패

**근본 원인 추정**
17일 전 env 일괄 등록 시점에 박힌 것. 정확한 메커니즘은 셋 중 하나:
1. **Vercel UI "Import .env File" / "Paste .env"** — `.env.local` 일괄 등록 시 마지막 줄 EOL까지 값에 포함시킨 케이스
2. **Bash here-string 스크립트** — `vercel env add NAME prod <<< "값"` (이 가이드 #1에 이미 경고된 패턴)
3. **외부 콘솔 "Copy" 버튼** — Google Cloud / Meta 콘솔 일부가 `<code>` 끝 줄바꿈까지 클립보드에 담는 케이스

깨끗한 3개가 모두 "직접 입력/생성한 값"이고 더러운 21개가 모두 "외부에서 복사한 값"이라는 패턴이 ①·③ 가능성에 무게.

**"예전엔 됐었다"의 미스터리**
사용자는 과거에 동일한 코드/env로 OAuth가 동작했다고 확인. 가능한 시나리오:
- Meta/Google이 OAuth 파라미터 validation을 최근에 strict로 변경 (예전엔 trailing `\n` silent하게 무시 → 어느 시점부터 거부)
- 또는 `NEXT_PUBLIC_BASE_URL`이 원래 `https://loopdrop.vercel.app`였다가 누군가 수정해서 localhost로 바뀜
어느 쪽이든 코드 변경은 아님(17일간 OAuth 관련 코드 무변동).

**조치**
1. **Vercel env 12개 재등록** (`vercel env rm` → `printf '%s' "값" | vercel env add`)
   - `NEXT_PUBLIC_BASE_URL`: 값 자체 교체 → `https://loopdrop.vercel.app`
   - 나머지 11개 OAuth 키 (META/INSTAGRAM/THREADS/TIKTOK/X × ID/SECRET + GOOGLE × 2): 값 그대로 `\n`만 제거
2. **코드 방어막 추가** (commit `b065cd3`):
   ```ts
   // src/lib/oauth-config.ts
   const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001').trim();

   // src/app/api/auth/[platform]/route.ts
   const clientId = process.env[config.clientIdEnv]?.trim();

   // src/app/api/auth/callback/route.ts
   const clientId = process.env[config.clientIdEnv]!.trim();
   const clientSecret = process.env[config.clientSecretEnv]!.trim();
   ```
3. **재배포** → 5개 플랫폼 OAuth 모두 정상 동작 복구 확인

**남은 폭탄 (당장은 작동하므로 미수정)**
- `OPENAI_API_KEY`, `YOUTUBE_API_KEY` 둘은 아직 `\n` 보유. AI 캡션/유튜브 트렌딩 호출 시 401 또는 invalid_key 가능성. 해당 기능 실패 시 같은 방식으로 정리.
- `N8N_API_KEY`, `N8N_WEBHOOK_URL`: 코드 미사용. 무해.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `\n` 있지만 Supabase SDK가 내부 처리하는 듯 (실제 동작 중).

**교훈 / 재발 방지**
- `.env.local`이든 Vercel UI든 **paste한 값 끝 글자가 진짜 마지막 글자인지** 매번 확인. 의심되면 텍스트 에디터에서 "보이지 않는 문자 표시" 켜고 확인
- 새 env 등록은 **반드시 `printf '%s' "값" | vercel env add NAME production`** 패턴
- 코드 모든 env 읽기 지점에 `.trim()` 박는 습관 (이미 박힘)
- 디버깅 신호: OAuth dialog URL이나 토큰 교환 요청 body에서 `%0A`, `%0D` 보이면 1순위 의심

### 2. Redirect URI는 https 필수인 플랫폼 多
- Threads, TikTok은 localhost(http)로 OAuth 불가 → Vercel 배포 후 https URL에서 테스트
- Google(YouTube), Meta(Instagram), X는 localhost(http)도 허용

### 3. 환경변수는 `.env.local`과 Vercel 둘 다 관리
- 개발: `.env.local`
- 프로덕션: Vercel 대시보드 또는 `vercel env add`
- 둘이 틀리면 버그 원인 찾기 힘듦

### 4. 배포 후 alias 수동 설정 필요할 수 있음
- `vercel --prod` 후 고유 배포 URL이 생기면 `vercel alias set <deploy-url> loopdrop.vercel.app`으로 커스텀 도메인 연결

### 5. 한 OAuth client를 여러 앱이 공유 가능 (A안: 자격증명 공유)
- 같은 Google Cloud(또는 Meta) OAuth client_id/secret을 **여러 Next.js 프로젝트가 동시에** 써도 됨
- 각 앱의 redirect URI만 모두 "승인된 리디렉션 URI"에 추가:
  ```
  http://localhost:3001/api/auth/callback   ← Loopdrop dev
  http://localhost:3002/api/auth/callback   ← Loopify dev
  https://loopdrop.vercel.app/api/auth/callback
  https://myloopify.vercel.app/api/auth/callback
  ```
- 토큰은 각 앱이 **자기 DB에 따로 저장** → 한 쪽 DB가 죽어도 다른 쪽 영향 없음
- 사용자는 앱마다 한 번씩 "연결" 클릭. Google이 이미 동의한 앱이라 클릭 1~2번이면 끝
- **비교 — B안(cross-DB로 다른 앱 토큰 직접 읽기) 비추:**
  - 양방향 갱신 race condition (두 앱이 동시에 refresh → DB row 충돌)
  - 결합도 폭발 (한쪽 스키마 바뀌면 다른 쪽 깨짐)
  - 한쪽 service_role 키가 다른 앱 코드에 들어가는 보안 문제
  - A안 한 번의 "다시 연결" 클릭 비용 vs B안의 시스템 결합 비용 → A안이 압승

### 6. 사이드 프로젝트마다 dev 포트 다르면 redirect URI 모두 등록
- 같은 시스템에서 여러 프로젝트 동시 실행 시 포트는 분리(Loopdrop=3001, Loopify=3002 등)
- Google Cloud Console 등에 모든 포트의 redirect URI를 다 등록해두면 한 번 등록 후 새 프로젝트 쓸 때 추가 작업 없음
- 등록 안 했으면 "Error 400: redirect_uri_mismatch" 발생

---

## 플랫폼별 가이드

### YouTube (Google OAuth 2.0)

**앱 생성:** [console.cloud.google.com](https://console.cloud.google.com)
- APIs & Services → OAuth consent screen → External 선택
- OAuth client → Web application → Authorized redirect URIs 추가

**Redirect URI:** http/https 둘 다 OK
```
http://localhost:3001/api/auth/callback
https://loopdrop.vercel.app/api/auth/callback
```

**Scopes:**
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.force-ssl` ← **댓글 작성에 필수! 빠트리면 `insufficient authentication scopes` 에러**
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/userinfo.profile`

**Extra auth params:** `access_type=offline`, `prompt=consent` (refresh token 받으려면 필수)

**주의사항:**
- 앱이 테스트 모드면 **Test users**에 본인 계정 이메일 추가 필수 (Audience 탭)
- `expires_in`이 3600(1시간)이지만 refresh token으로 계속 갱신 가능 → DB에 저장할 때 60일로 표시하는 게 UX 좋음

**Loopify에서 겪은 YouTube 연동 에러 & 해결 (2026-04-24~25):**

1. **댓글 작성 실패 — `Request had insufficient authentication scopes`**
   - **원인:** OAuth scope에 `youtube.force-ssl`이 빠져있었음. `youtube.upload`만으로는 업로드만 가능하고 댓글은 못 씀.
   - **해결:** scope에 `youtube.force-ssl` 추가 → YouTube 재연결 (새 scope로 토큰 재발급 필요)

2. **댓글 작성 실패 — 브라우저 CORS 차단**
   - **원인:** 브라우저에서 직접 `googleapis.com/youtube/v3/commentThreads`를 호출하면 CORS 에러. 업로드(Resumable Upload)는 CORS 허용되지만 댓글 API는 안 됨.
   - **해결:** 댓글만 서버 경유 API Route (`/api/youtube/comment`)로 분리. 업로드는 브라우저 직접.

3. **업로드 실패 — Vercel body 4.5MB 제한**
   - **원인:** mp4 파일을 base64로 서버에 보내면 6~8MB → Vercel 제한 초과
   - **해결:** 업로드를 브라우저에서 직접 YouTube API로 보냄 (서버는 토큰만 제공). 파일 크기 제한 없음.

4. **업로드 직후 댓글 실패 — 영상 processing 중**
   - **원인:** 업로드 직후에는 YouTube가 영상을 처리 중이라 댓글 API가 404 반환
   - **해결:** 서버 댓글 API에서 최대 3회 재시도 (5초 간격 대기)

5. **YouTube 연결 후 scope 변경 시 기존 토큰 무효**
   - **원인:** scope를 추가하면 기존 refresh token으로 받은 access token에 새 scope가 없음
   - **해결:** 반드시 `prompt=consent`로 재연결해서 새 토큰 발급 필요. 단순 refresh로는 안 됨.

6. **`connected` 판정 버그 — `expires_at`만 보면 안 됨 (Loopify 2026-05-04)**
   - **증상:** Header가 자꾸 "미연결"로 떠서 OAuth 재인증을 시도하는데, 실제로는 refresh_token이 살아있어서 갱신만 하면 되는 상태
   - **원인:** status API가 `expires_at < now()` 만으로 connected 판정. access_token은 1시간 만료라 시간 지나면 무조건 false. refresh_token으로 1초만에 갱신 가능한 토큰까지 미연결로 표시
   - **해결:** status 라우트 안에서 **검증용 토큰 함수 호출**. 만료면 자동 refresh, 성공하면 connected:true:
     ```ts
     export async function GET() {
       try {
         await getValidYouTubeToken(); // refresh 자동 시도, 실패 시 throw
         return NextResponse.json({ connected: true });
       } catch {
         return NextResponse.json({ connected: false });
       }
     }
     ```
   - **교훈:** "토큰이 살아있는가"의 단일 진실 원천을 `getValidXxxToken()` 한 함수로 모아라. status / upload / comment 모두 그 함수만 호출하면 expiry 로직이 한 곳에서 관리됨

**최종 YouTube 업로드 구조 (Loopify 방식):**
```
브라우저:
  1. GET /api/youtube/token → 서버에서 refresh된 access_token 반환
  2. POST googleapis.com/.../videos?uploadType=resumable (init) ← 브라우저 직접
  3. PUT {uploadUrl} with mp4 file body ← 브라우저 직접
  4. POST /api/youtube/comment (videoId, comment) ← 서버 경유 (CORS 회피)
```

---

### Instagram (Meta / Facebook Graph API)

**앱 생성:** [developers.facebook.com](https://developers.facebook.com)
- Use case: "Manage messaging & content on Instagram"
- Facebook Login for Business → Settings → Valid OAuth Redirect URIs

**Redirect URI:**
```
http://localhost:3001/api/auth/callback  (localhost는 http도 OK)
https://loopdrop.vercel.app/api/auth/callback
```

**Scopes:**
- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list`
- `pages_read_engagement`
- `business_management` (페이지/비즈니스 선택 화면에 나오게 하려면 필수)

**치명적 요구사항:**
- **개인 IG 계정만으로는 API 사용 불가**
- 반드시 다음 순서로 연결되어야 함:
  1. Facebook 페이지 생성
  2. Instagram을 **비즈니스/크리에이터 계정**으로 전환
  3. Facebook 페이지 설정 → **Connected Instagram** → IG 비즈니스 계정 연결
- OAuth 시 "Choose the Pages" 화면에서 **해당 페이지 꼭 선택**. 선택 안 하면 `pages_show_list` scope는 부여되지만 `target_ids`가 비어서 API에서 페이지가 안 보임.

**토큰 확인:**
```bash
# 토큰 debug로 granular_scopes의 target_ids 확인
curl "https://graph.facebook.com/v21.0/debug_token?input_token=TOKEN&access_token=TOKEN"
```

**해시태그 검색 (ig_hashtag_search):**
- `Instagram Public Content Access` 권한 필요 → **Meta 앱 리뷰 심사 통과 필수** (1~5일)
- 심사 통과 전에는 개발 모드에서도 사용 불가 ("(#10) To use 'Instagram Public Content Access', your use of this endpoint must be reviewed" 에러)
- 발행 기능(`instagram_content_publish`)은 앱 리뷰 없이도 개발 모드에서 본인 계정 대상으로 작동

**발행 흐름:**
```
token → /me/accounts (Facebook Pages)
     → {pageId}?fields=instagram_business_account  (IG Business Account ID)
     → {igAccountId}/media  (미디어 컨테이너 생성)
     → (영상이면 status_code=FINISHED 될 때까지 폴링)
     → {igAccountId}/media_publish  (발행)
```

---

### Threads (Meta)

**앱 생성:** Meta 개발자 콘솔 (Instagram과 같은 앱 안에서 관리)
- Use case: "Access the Threads API"
- Customize → Settings → Redirect Callback URLs

**Redirect URI:**
```
http://localhost:3001/api/auth/callback
https://loopdrop.vercel.app/api/auth/callback
```
- Uninstall Callback URL / Delete Callback URL도 같이 설정

**Scopes:**
- `threads_basic`
- `threads_content_publish`
- `threads_manage_replies`

**치명적 요구사항:**
- **https 필수** — localhost(http)로는 OAuth 시도 시 "안전하지 않은 로그인이 차단되었습니다" (`error_code: 1349187`)
- Tester 추가 프로세스:
  1. Meta 앱 → App roles → Roles → Add People
  2. **Threads Tester** role 선택
  3. **Threads username 입력란을 반드시 채워야** 초대 발송됨 (공백으로 두면 초대 자체가 안 감)
  4. Threads 앱에서 초대 수락 (삭제 버튼만 보이고 수락 버튼 없으면 username 오타이거나 기존 꼬임)
- **관리자(Administrator) 권한이 있으면 Tester 수락 없이도 OAuth 가능**

**발행 흐름:**
```
token → /me (Threads user ID)
     → /{userId}/threads  (스레드 컨테이너 생성, TEXT/IMAGE/VIDEO)
     → (영상이면 status=FINISHED 폴링)
     → /{userId}/threads_publish  (발행)
```

---

### TikTok

**앱 생성:** [developers.tiktok.com](https://developers.tiktok.com)
- App type: Other
- Products: Login Kit + Content Posting API

**Redirect URI:** **https만 허용**
```
https://loopdrop.vercel.app/api/auth/callback
```

**Scopes:**
- `user.info.basic`
- `video.publish` (Content Posting API에서 Direct Post 토글 ON)
- `video.upload`

**파라미터 주의 (OAuth 표준과 다름):**
- **TikTok은 `client_id` 대신 `client_key` 사용**
- Authorization URL과 Token exchange body 둘 다 `client_key`로 보내야 함

```typescript
// 일반 플랫폼
const authParams = new URLSearchParams({ client_id: clientId, ... });

// TikTok
const authParams = new URLSearchParams({ client_key: clientId, ... });
```

**치명적 요구사항 — Sandbox Credentials 별도:**
- TikTok 앱은 Draft → Sandbox → Production 단계가 있음
- **Sandbox에는 Production과 다른 별도의 client_key/client_secret이 존재**
- Production credentials로 OAuth 시도하면 `unauthorized_client` 에러
- 개발/테스트 중에는 반드시 **Sandbox credentials** 사용
  - Sandbox 탭 → Credentials 확인
  - Sandbox → Target users에 본인 TikTok 계정 추가 필수

**프로덕션 배포 시:**
- Submit for review 필요 (데모 영상 포함 필수)
- 앱 정보: Category, Description, Terms of Service URL, Privacy Policy URL, App Icon
- URL 인증: URL prefix 방식으로 signature file(`tiktokXXXXX.txt`)을 public 폴더에 배치 후 Verify
- Web/Desktop URL에 **trailing slash 필수** (`https://loopdrop.vercel.app/` — 슬래시 없으면 unverified 에러)

**Verify domains:**
- **불필요**: `push_by_file` 방식(파일 직접 업로드) 사용
- **필요**: `pull_by_url` 방식(URL로 영상 전달) 사용 시

**발행 흐름:**
```
token → /v2/post/publish/video/init  (업로드 초기화, 파일 크기 전달)
     → PUT {upload_url}  (영상 파일 PUT 업로드)
     → /v2/post/publish/status/fetch  (status=PUBLISH_COMPLETE 폴링)
```

---

### X (Twitter)

**앱 생성:** [developer.x.com](https://developer.x.com)
- User authentication settings → Set up
- 앱 권한: 읽기 및 쓰기
- 앱 유형: **웹 앱, 자동화 앱 또는 봇** (기밀 클라이언트)

**Redirect URI:**
```
http://localhost:3001/api/auth/callback
https://loopdrop.vercel.app/api/auth/callback
```
- 조직 URL / 서비스 약관 / 개인정보 보호정책도 같이 설정

**Scopes (OAuth 2.0):**
- `tweet.read`
- `tweet.write`
- `users.read`
- `offline.access` (refresh token)

**PKCE 주의:**
- `code_challenge_method=plain` 사용
- **RFC 7636 표준: code_verifier는 43~128자 필수**
- 초기 버그: `crypto.randomBytes(16).toString('hex')` = 32자 → **43자 미만이라 실패**
- 수정: `crypto.randomBytes(32).toString('hex')` = 64자
- state는 `"x:{randomPart}"` 형태, verifier는 randomPart만 사용

```typescript
const randomPart = crypto.randomBytes(32).toString('hex'); // 64자
const state = `x:${randomPart}`;

// Auth URL
authParams.set('code_challenge', randomPart);

// Token exchange
tokenBody.code_verifier = state.split(':').slice(1).join(':');
```

**Token exchange 특이사항:**
- `Authorization: Basic {base64(clientId:clientSecret)}` 헤더 필수

**Client ID 복사 시 대소문자 주의:**
- UI에서 `X0pqb1BCWW81...`처럼 보이는 문자가 W/w 구분 헷갈림
- **반드시 X Console의 복사 버튼으로 복사** (수동 입력 금지)
- 실제 겪은 버그: `BCwW` vs `BCWW` 한 글자 차이로 "Something went wrong" 계속 발생

**토큰 갱신:**
- 1시간 만료, refresh token으로 갱신
- Basic Auth 헤더 포함해서 `/2/oauth2/token` 호출

---

## OAuth 디버깅 도구 (MCP / CLI)

OAuth 작업 시 DB 상태와 환경변수를 빠르게 확인할 수 있는 도구. 매번 Supabase 대시보드 / Vercel 대시보드를 브라우저로 열지 말고 Claude Code 안에서 처리.

### Supabase MCP — DB 상태 즉시 확인
**셋업 (1회):**
```bash
claude mcp add --user --scope user supabase \
  npx -y @supabase/mcp-server-supabase \
  --project-ref=<프로젝트_ref> \
  --read-write
```
- `<프로젝트_ref>`는 Supabase URL의 서브도메인 (예: `https://rmpqsqpibsuxtlbmimgv.supabase.co` → `rmpqsqpibsuxtlbmimgv`)
- 프로젝트별로 따로 등록해서 다른 프로젝트 실수 방지
- 등록 후 Claude Code 재시작 → `/mcp` → supabase Authenticate (OAuth)

**자주 쓰는 패턴 (OAuth 디버깅):**
- `mcp__supabase__list_tables` — `platforms`/`youtube_tokens` 같은 토큰 테이블이 실제로 존재하는지
- `mcp__supabase__execute_sql` — 토큰 row 상태 한 줄 검사:
  ```sql
  SELECT name, status, account_name,
         expires_at < NOW() AS expired,
         refresh_token IS NOT NULL AS can_refresh,
         EXTRACT(EPOCH FROM (expires_at - NOW())) AS seconds_left
  FROM platforms WHERE name = 'youtube';
  ```
  → access_token 만료 여부 + refresh로 살릴 수 있는지를 한 번에 판단
- `mcp__supabase__apply_migration` — 컬럼 추가/스키마 변경. SQL 에디터에 사용자가 직접 붙여넣을 필요 없음

### Vercel MCP — 프로젝트/배포 정보 조회
**인증:** `/mcp`에서 vercel Authenticate (OAuth, 브라우저 한 번)

**자주 쓰는 패턴:**
- `mcp__plugin_vercel_vercel__list_projects` — 프로젝트 ID/slug 찾기
- `mcp__plugin_vercel_vercel__get_project` — 프로젝트 상세

**한계 — 환경변수 조회는 막힐 수 있음:**
- 인증된 계정이 해당 team의 멤버가 아니면 `403 Forbidden` 반환
- 환경변수 조회는 MCP 스코프에 안 들어있을 때도 있음
- → 이때는 **Vercel CLI로 폴백**

### Vercel CLI — 환경변수 확인 (MCP 안 될 때 폴백)
```bash
cd <프로젝트 루트>
npx vercel env ls
```
- 출력: 변수 이름 / 값(Encrypted) / Production·Preview·Development 어디에 있는지 / 등록 시각
- OAuth 디버깅 핵심 체크: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL` 셋이 Production에 들어있나
- **Production에만 있고 Preview/Development엔 없는 경우가 흔함** — vercel preview 배포에서 OAuth가 안 되는 원인이 보통 이거

### 워크플로 — OAuth가 동작 안 한다고 신고 들어왔을 때 (3분 진단)
1. Supabase MCP로 토큰 row 상태 SQL 한 방 → access_token 만료/refresh 가능 여부 확인
2. Vercel CLI로 `vercel env ls` → client_id/secret 빠진 환경 없나 확인
3. status 라우트가 `expires_at`만 보고 connected 판정하는지 코드 확인 (위 #6 케이스)
4. 위 셋 다 OK면 Google Cloud Console redirect URI 직접 확인 (사용자가 브라우저로)

---

## 디버깅 체크리스트

OAuth 연결 실패 시 순서대로 확인:

### 1. URL 파라미터 확인
- 브라우저 주소창에서 파라미터 확인
- `%0A`, `%0D` 등 개행 문자 섞여 있나? → Vercel env 재설정
- `client_id` vs `client_key`? (TikTok은 후자)
- Client ID 대소문자 일치?

### 2. Redirect URI 정확히 일치하나?
- http vs https
- trailing slash 유무 (`callback` vs `callback/`)
- 포트 번호 일치
- 콘솔에 등록된 URI와 코드의 `OAUTH_REDIRECT_URI`가 **완전히 동일**해야 함

### 3. Scope / 권한 문제
- 토큰 debug API로 `granular_scopes` 확인
- Instagram이면 `target_ids` 비어있는지? → Pages 선택 안 된 상태
- TikTok이면 Sandbox Target Users 등록됐나?

### 4. 앱 상태
- Draft/Sandbox면 Tester 추가했나?
- Production이라면 심사 통과했나?

### 5. 환경변수
- `.env.local` 값 = Vercel env 값?
- 둘 다 개행 없이 깨끗한가?

---

## 참고 코드 위치

- OAuth config: `src/lib/oauth-config.ts` (플랫폼별 authUrl, tokenUrl, scopes)
- OAuth 시작: `src/app/api/auth/[platform]/route.ts`
- OAuth 콜백: `src/app/api/auth/callback/route.ts`
- 발행 로직: `src/lib/publishers/{platform}.ts`
