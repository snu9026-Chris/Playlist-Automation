-- Loopify: 프로젝트 소프트 삭제 + 30분 후 자동 영구삭제 마이그레이션
-- 실행 위치: Supabase Dashboard → SQL Editor → New query → 아래 전체 붙여넣기 → Run
--
-- 변경 요약:
--   1) playlist_projects.status CHECK 제약에 'deleted' 추가
--   2) playlist_projects.deleted_at TIMESTAMPTZ 컬럼 추가 (소프트 삭제 시각)
--   3) deleted_at 인덱스 (만료 row 빠르게 찾기 위함)

-- ───────── 1. status CHECK 제약 갱신 ─────────
ALTER TABLE playlist_projects
  DROP CONSTRAINT IF EXISTS playlist_projects_status_check;

ALTER TABLE playlist_projects
  ADD CONSTRAINT playlist_projects_status_check
  CHECK (status IN ('draft', 'in_progress', 'completed', 'failed', 'deleted'));

-- ───────── 2. deleted_at 컬럼 추가 ─────────
ALTER TABLE playlist_projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ───────── 3. 인덱스 (만료된 row 빨리 찾기 위함) ─────────
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at
  ON playlist_projects(deleted_at)
  WHERE deleted_at IS NOT NULL;
