# Loopify TODO

## 완료
- [x] Next.js 프로젝트 생성 (포트 3002)
- [x] Loopdrop 수준 디자인 (pearl shimmer, marquee, 마스코트, 그라데이션 아이콘)
- [x] Spotify 트렌드 탐색 + 북마크
- [x] 북마크 페이지 (달력 뷰)
- [x] 새 프로젝트 마법사 (곡 선택 → GPT 분석 슬라이드 → Suno 프롬프트 15개)
- [x] 프로젝트 관리 페이지
- [x] 숏폼 만들기 페이지 (mp3 로드 → 클라이맥스 추출 → 이미지 생성 → 렌더링)
- [x] 업로드/예약 페이지 (파일 드롭 + 메타데이터 매칭 + 발행 패널)
- [x] 설정 페이지
- [x] Vercel 배포 (myloopify.vercel.app)
- [x] Supabase 테이블 생성 (4개 테이블)
- [x] Gemini Imagen 4.0 이미지 생성 (가사 → 테마 → 앨범 커버 자동 파이프라인)
- [x] 파일 드래그 정렬 (프롬프트 매칭)
- [x] 브라우저 Web Audio API 클라이맥스 추출 (서버 업로드 없음)
- [x] 로컬 ffmpeg 렌더링 서버 + Cloudflare Tunnel
- [x] 렌더링 파일명 = 곡 제목 기반
- [x] 업로드 시 파일명으로 Supabase 메타데이터 자동 매칭
- [x] 글로벌 디자인/UX 품질 기준 메모리 저장
- [x] FFmpeg → Remotion 렌더링 마이그레이션
- [x] 이퀄라이저 8종 → 4종 정리 (글래스, 대칭, 원형, 펄스) + 파동 2.5배 부스트
- [x] 프리셋 오버레이 시스템 (YouTube 세트, 워터마크, 엔드스크린, 컨트롤바)
- [x] 롱폼 만들기 페이지 (이미지 슬라이드쇼 + 이퀄라이저 + 오버레이 + 프리셋)
- [x] 롱폼 이미지 업로드 (16:9 자동 크롭) + AI 생성 이미지 저장 버튼
- [x] 숏폼 프리셋 설정 (이퀄라이저/컨트롤러/가사) + 미리보기
- [x] 전체 리팩토링 Phase 1: 공통 유틸리티/타입 추출 (types.ts, image-utils.ts, canvas-draw.ts, api-error.ts)
- [x] 전체 리팩토링 Phase 2: 컴포넌트 분리 (StepBadge, PreviewCanvas, OverlayEditor)
- [x] 전체 리팩토링 Phase 3: API 에러 핸들러 적용 (11개 핸들러)
- [x] 데드코드 제거 (MetadataStep 111줄)
- [x] **4.7 리팩토링 Phase A** — stale closure 버그(클립 저장 누락) / 인터벌 누수 / dead code 400줄(projects/[id]/page.tsx) / spotify formatFeatures 제거 / publish allSettled rejected 누락 수정
- [x] **4.7 Phase B 보안** — YouTube access_token 브라우저 노출 차단. /api/youtube/upload-init 신설(서버에서 resumable session URL만 발급), /api/youtube/token 410 deprecated
- [x] **4.7 Phase C** — lib/openai.ts, lib/gemini.ts, lib/imagen.ts, lib/youtube-auth.ts 4개 SDK 모듈 추출. 11개 라우트 마이그레이션
- [x] **4.7 Phase D** — hooks/useAudioVisualizer.ts 훅으로 ShortsPreview/PreviewCanvas 70% 중복 제거. ShortsPreview를 components/shorts/ 컴포넌트로 분리
- [x] **4.7 Phase E** — lib/api/{client,projects,bookmarks,youtube,images}.ts 데이터 레이어. hooks/useShorts, useToggleSet, useLocalState. fetch 인라인 30+ 군데 제거
- [x] **4.7 Phase F** — YouTubeAuthProvider Context로 Header+uploads의 ytConnected 단일화. TrackSlot.id 안정 키 추가, lyrics/themes/errors 매핑을 id 기반으로 변경(드래그 정렬 시 매핑 깨지던 버그 수정)
- [x] **숏폼 이미지 프롬프트 수동화** — auto-generate 라우트 제거. recommend-prompt(한국어 추천) + generate(한국어 → 영문 변환 → Imagen) 두 단계로 분리. ImageGenStep UI 슬롯별 textarea + 재추천/다시 그리기 버튼
- [x] **프로젝트 소프트 삭제 + 30분 자동 영구삭제** — Supabase 마이그레이션(status에 'deleted', deleted_at 컬럼, 인덱스). 메모리 setTimeout 제거하고 DB의 deleted_at을 진실 소스로. 회색 카드 + 카운트다운이 새로고침 후에도 유지됨. recent 라우트가 호출 시점에 만료 row를 lazy 청소
- [x] **Supabase MCP 셋업** — claude mcp add로 user scope 등록. project_ref=rmpqsqpibsuxtlbmimgv로 Loopify 프로젝트 한정. read-write 모드
- [x] **Supabase MCP OAuth 인증** — `/mcp`에서 supabase Authenticate 완료. Connected 상태 확인됨
- [x] **숏폼 Remotion 렌더링 프리셋 반영** — ShortsComposition에 eqType/showPlayerBar 반영. Equalizer(롱폼과 공유) + PresetOverlay(player-bar-minimal) 재사용. render-server가 클라이언트의 eq/lyrics/player-bar 토글을 그대로 영상에 굽도록 수정. 자막 위치도 EQ 위로 이동(bottom 720)
- [x] **YouTube OAuth 연결 — A안(자격증명 공유)** — Loopdrop과 동일한 GOOGLE_CLIENT_ID/SECRET을 Loopify가 이미 사용 중. Loopify 자체 platforms 테이블에 이미 토큰 row 존재(account=Chris Lee, refresh_token 보유). Vercel prod env에도 자격증명 설정됨. Google Cloud Console redirect URI에 `https://myloopify.vercel.app/api/auth/callback` 등록 확인. (로컬 dev `localhost:3002`는 필요 시 사용자가 직접 추가)
- [x] **youtube-status 자동 refresh 버그 수정** — `/api/projects/youtube-status`가 expires_at만 보고 만료 판정해서 refresh 가능한 토큰도 미연결로 표시되던 버그. getValidYouTubeToken()을 호출해 자동 갱신하도록 수정
- [x] **YouTube Resumable Upload 검수** — TODO 미구현으로 적혀있었으나 실제로는 모두 구현 완료 상태였음. upload-init 라우트(서버에서 resumable session URL 발급, public 공개, Music 카테고리, 토큰 노출 0), uploads 페이지(파일명 자동 매칭 + AI 추천 + 직접 편집 + 첫 댓글 자동 등록), AI 추천 라우트(title/description/tags/firstComment GPT 추천) 다 동작. 발행 시 YouTube 미연동이면 버튼 비활성화도 이미 적용됨
- [x] **YouTube 예약 발행 완성 (2026-05-10)** — 미완성으로 남아있던 핵심 로직 2곳(uploads/page.tsx의 publish 함수 scheduled 분기, /api/cron/upload의 TODO)을 채워 end-to-end 동작. DB: scheduled_uploads에 video_path/title/description/tags/first_comment/youtube_video_id 컬럼 추가, project_id/track_id NULL 허용. Storage: media bucket RLS 정책 (anon SELECT/INSERT/DELETE). UI: publishInstant() / registerSchedules() 분리, "주기" select 제거(매일 1개 KST 18:00 고정), 시작일 + i일치 자동 계산. POST /api/uploads/scheduled 신설. Cron: Storage 다운로드 → Resumable Upload init → PUT → 첫 댓글(5초 대기 ×3 재시도) → status=completed + Storage 삭제. 실패 retry 3회, 최종 실패 시에도 Storage 삭제. 검증: TypeScript 통과, Vercel 빌드 클린, 스모크 테스트(GET /api/uploads/scheduled 200, GET /api/cron/upload 401), Supabase 마이그레이션 적용 검증, CRON_SECRET Vercel Production 등록 확인
- [x] **GitHub 레포 생성 + 모노레포 푸시 (2026-05-10)** — snu9026-Chris/Playlist-Automation 공개. .gitignore로 .env.local / 과외 자료 / inner .git(Loopify/app/.git → .git.backup으로 보존) 차단. env.local.md 가이드 2개 작성 (루트/app, 각 키 발급처·Redirect URI·함정 정리)

## 진행 중
- [ ] Spotify 앱 정식 활성화 대기 (플레이리스트 API 403 → 검색 fallback)
- [ ] 사용자 직접 검증: 숏폼 렌더링 결과 + Header "연결됨" 표시 + 실제 YouTube 발행 테스트
- [ ] **예약 발행 실서비스 검증** — myloopify.vercel.app/uploads에서 mp4 5개 미래 날짜로 예약 → Storage 업로드 확인 → KST 18:00 cron 실행 후 YouTube 영상/댓글 + Storage 삭제 확인
- [ ] Spotify 활성화 후 국가별 Top 50 차트 전환
- [ ] Cloudflare Tunnel Named Tunnel 설정 (고정 URL)

## Phase 3
- [ ] 성과 분석 대시보드 (YouTube Analytics)
- [ ] shorts 페이지 추가 컴포넌트 분리 (SortableFileList, ImageGenStep, RenderStep, ShortsPreview)
- [ ] API 이미지 생성 라우트 3개 → 1개 통합
