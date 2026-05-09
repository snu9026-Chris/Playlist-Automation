# OAuth 플랫폼별 함정 가이드

> LoopDrop 프로젝트에서 5개 플랫폼(YouTube, Instagram, Threads, TikTok, X) OAuth 연동하면서 겪은 시행착오 정리. 다음에 OAuth 작업할 때 **반드시 먼저 읽고** 시작할 것.

---

## 공통 주의사항

### 1. Vercel 환경변수 개행(`%0A`) 주의
- `vercel env add NAME production <<< "value"` 처럼 here-string을 쓰면 bash가 끝에 개행 추가 → URL에 `%0A` 섞임 → `param_error` 발생
- **반드시 `printf '%s' "value" | vercel env add NAME production` 패턴 사용**
- 증상: `client_id=xxxxxx%0A&redirect_uri=https://...%0A/api/...` 형태로 URL이 깨짐

### 2. Redirect URI는 https 필수인 플랫폼 多
- Threads, TikTok은 localhost(http)로 OAuth 불가 → Vercel 배포 후 https URL에서 테스트
- Google(YouTube), Meta(Instagram), X는 localhost(http)도 허용

### 3. 환경변수는 `.env.local`과 Vercel 둘 다 관리
- 개발: `.env.local`
- 프로덕션: Vercel 대시보드 또는 `vercel env add`
- 둘이 틀리면 버그 원인 찾기 힘듦

### 4. 배포 후 alias 수동 설정 필요할 수 있음
- `vercel --prod` 후 고유 배포 URL이 생기면 `vercel alias set <deploy-url> loopdrop.vercel.app`으로 커스텀 도메인 연결

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
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/userinfo.profile`

**Extra auth params:** `access_type=offline`, `prompt=consent` (refresh token 받으려면 필수)

**주의사항:**
- 앱이 테스트 모드면 **Test users**에 본인 계정 이메일 추가 필수 (Audience 탭)
- `expires_in`이 3600(1시간)이지만 refresh token으로 계속 갱신 가능 → DB에 저장할 때 60일로 표시하는 게 UX 좋음

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
