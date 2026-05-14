-- ─── platforms 테이블 — 외부 플랫폼 OAuth 토큰 저장소 ───
-- 원본 저자(@snu9026-Chris)는 Loopdrop 프로젝트에서 이 테이블을 미리 만들어 두고
-- Loopify와 공유하지만, 외부 클론 사용자는 본인 Supabase에 이 마이그레이션을 적용해야
-- YouTube 자동 업로드(OAuth)가 동작합니다.
--
-- 실제 코드에서 쓰는 컬럼:
--   - name           — 플랫폼 식별자 ('youtube' 등). UNIQUE.
--   - status         — 'connected' / 'disconnected' 등 상태 라벨
--   - oauth_token    — 액세스 토큰 (access_token이 아닙니다)
--   - refresh_token  — 리프레시 토큰
--   - expires_at     — 액세스 토큰 만료 시각
--   - account_name   — Google 사용자 이름 (UI 표시용)
--
-- 사용처:
--   - Loopify/app/src/lib/youtube-auth.ts
--   - Loopify/app/src/app/api/auth/callback/route.ts
--   - Loopify/app/src/app/api/auth/disconnect/route.ts

CREATE TABLE IF NOT EXISTS platforms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  status        TEXT,
  oauth_token   TEXT,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  account_name  TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신 트리거 (supabase-schema.sql의 동일 함수 재사용)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_platforms_updated_at ON platforms;
    CREATE TRIGGER trg_platforms_updated_at
      BEFORE UPDATE ON platforms
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;
