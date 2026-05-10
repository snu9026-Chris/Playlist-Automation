-- ═══════════════════════════════════════════
-- Migration: Scheduled Uploads — 영상 파일/메타 컬럼 + Storage 정책
-- ═══════════════════════════════════════════
-- 적용: Supabase MCP `apply_migration` 또는 SQL Editor에서 한 번 실행
-- 변경점:
--   1. scheduled_uploads 컬럼 추가 (영상 파일 경로 + YouTube 메타데이터)
--   2. project_id / track_id NULL 허용 (드롭한 파일이 매칭 안 된 경우)
--   3. media bucket Storage RLS — single-user 환경 anon 자유 업로드/삭제

-- 1. 컬럼 추가 + NOT NULL 제약 완화
ALTER TABLE scheduled_uploads
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN track_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS video_path TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS first_comment TEXT,
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;

-- 2. media bucket 보장 (없으면 생성)
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. media bucket Storage 정책
-- ⚠️ single-user 사이드 프로젝트 가정. 다중 사용자 확장 시 auth.uid() 기반으로 좁힐 것.
DROP POLICY IF EXISTS "anon_select_media" ON storage.objects;
CREATE POLICY "anon_select_media"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "anon_insert_media" ON storage.objects;
CREATE POLICY "anon_insert_media"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "anon_delete_media" ON storage.objects;
CREATE POLICY "anon_delete_media"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'media');

-- 4. RLS 활성화 (이미 켜져 있으면 noop)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
