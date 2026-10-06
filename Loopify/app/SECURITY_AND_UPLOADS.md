# 관리자 인증 및 예약 업로드 적용

Next.js는 알려진 Proxy 인증 우회와 원격 코드 실행 취약점을 수정한 16.3.8로 갱신했습니다. 다른 기존 의존성의 npm audit 경고 18개는 별도 의존성 정리가 필요합니다.

이 앱은 한 명의 관리자가 하나의 YouTube 채널을 운영하는 구조입니다. 페이지와 API는 HTTP Basic 인증을 요구하고, Cron은 별도 Bearer secret을 요구합니다. 운영 도메인에는 HTTPS를 사용하세요.

## 배포 전 적용 순서

1. 이전 네 SQL 마이그레이션 이후 `Loopify/app/supabase-migration-upload-recovery.sql`을 적용합니다. 새 SQL은 행 선점 RPC와 업로드 세션/댓글 상태 컬럼을 추가하고 anon/authenticated의 앱 테이블 접근을 차단합니다. `platforms`는 Loopdrop과 공유될 수 있으므로, 공유 앱이 이 테이블을 브라우저에서 읽는다면 서버 경유로 먼저 변경해야 합니다.
2. 서버 환경변수 `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL`을 설정합니다. 관리자 비밀번호는 충분히 긴 임의 문자열을 사용하세요. 관리자 설정이 없으면 페이지와 API는 503으로 차단됩니다. Cron secret이 없으면 Cron도 차단됩니다.
3. 새 코드와 DB 변경을 함께 배포합니다. 마이그레이션 적용 후 이전 앱의 익명 Storage 업로드는 더 이상 동작하지 않습니다. 새 앱은 인증된 API에서 경로별 서명 URL을 받아 파일을 업로드합니다.
4. 로컬 렌더 서버는 127.0.0.1에서만 수신합니다. `RENDER_ALLOWED_ORIGINS`에 사용할 앱 origin을 쉼표로 구분해 지정하세요. 기본값은 localhost:3002와 127.0.0.1:3002입니다. 이 값은 렌더 서버 프로세스의 환경변수로 전달해야 합니다.
5. `vercel.json`은 매분 실행합니다. Vercel Pro/Enterprise가 필요합니다. Hobby에서는 이 설정으로 배포가 실패하므로, 외부 스케줄러가 매분 `GET /api/cron/upload`를 `Authorization: Bearer <CRON_SECRET>`로 호출하도록 구성하고 Vercel cron 항목을 제거하세요. 플랜을 자동으로 변경하지 않습니다.

## 예약 및 복구 동작

- Cron은 호출당 영상 하나를 원자적으로 선점합니다. 24시간 이내 발행할 영상을 먼저 비공개 업로드하고 YouTube `publishAt`으로 발행 시각을 지정합니다. 이미 지연된 작업은 공개 업로드합니다. YouTube 처리시간이나 업로드 쿼터에 따라 실제 발행은 지연될 수 있습니다.
- 업로드 세션 URL은 영상 바이트를 보내기 전에 DB에 저장합니다. 재시도는 기존 세션의 완료 여부와 수신 범위를 확인한 뒤 이어서 전송합니다.
- 실행 중단 후 2분이 지난 작업은 다시 선점할 수 있습니다. 과거 코드가 남긴 세션 없는 `processing` 작업은 채널의 중복 영상 여부를 먼저 확인한 뒤 새 worker를 실행하세요.
- 세션이 만료되면 자동으로 새 영상을 만들지 않고 `failed`로 둡니다. 채널을 확인한 다음, 영상이 이미 존재하면 해당 ID와 `completed` 상태를 저장하세요. 영상이 없다면 `upload_session_url`, `upload_started_at`을 NULL로 하고 `retry_count=0`, `status='pending'`으로 돌릴 수 있습니다.
- 실패한 영상 원본은 보존합니다. 성공 결과가 DB에 저장된 뒤에만 원본 파일을 삭제합니다. 작업 완료는 업로드 및 예약 등록 완료를 뜻하며, 공개 시각은 `scheduled_at`입니다.
- 첫 댓글은 영상 공개 이후 별도 worker가 처리합니다. 댓글 POST 도중 실행이 끊기거나 실패한 경우 중복 댓글을 피하려고 `comment_status='failed'`로 남깁니다. 채널을 확인한 후 필요하면 `comment_status='pending'`으로 재시도하세요.
- 이 마이그레이션은 기존에 알려진 `anon_insert_media`, `anon_delete_media` 정책을 제거합니다. 별도로 추가한 익명 쓰기 정책은 운영 DB에서 확인해야 합니다. 기존 media 버킷의 공개 파일 읽기는 유지됩니다.

## 검증

`Loopify/app`에서 `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run build`를 실행합니다. SQL 테스트는 PGlite PostgreSQL 엔진에서 마이그레이션, 작업 선점, 만료 복구, 권한을 검증합니다. HTTP 인증 및 OAuth callback 검사는 실제 Next.js production 서버에서도 확인했습니다. 실제 운영 DB나 YouTube 채널에는 테스트 업로드를 수행하지 않았습니다.

공식 문서: [Vercel Cron 플랜 제한](https://vercel.com/docs/cron-jobs/usage-and-pricing), [YouTube 재개 가능한 업로드](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol), [YouTube 예약 발행](https://developers.google.com/youtube/v3/docs/videos#status.publishAt).
