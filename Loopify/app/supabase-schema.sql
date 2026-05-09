-- Loopify 테이블 생성 SQL
-- Loopdrop Supabase 프로젝트에서 실행 (platforms 테이블은 이미 존재)
-- 실행: Supabase Dashboard → SQL Editor

-- ═══════════════════════════════════════════
-- 1. track_bookmarks — 영감 저장소
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS track_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_track_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  preview_url TEXT,
  image_url TEXT,
  audio_features JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookmarks_spotify_id ON track_bookmarks(spotify_track_id);
CREATE INDEX idx_bookmarks_created ON track_bookmarks(created_at DESC);

-- ═══════════════════════════════════════════
-- 2. playlist_projects — 프로젝트 본체
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS playlist_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'completed', 'failed', 'deleted')),
  reference_tracks JSONB DEFAULT '[]'::jsonb,
  prompts JSONB DEFAULT '[]'::jsonb,
  shorts_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (shorts_status IN ('pending', 'processing', 'completed', 'failed')),
  shorts_youtube_urls TEXT[] DEFAULT '{}',
  longform_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (longform_status IN ('pending', 'processing', 'completed', 'failed')),
  longform_youtube_url TEXT,
  -- 소프트 삭제 시각. NULL이면 살아있는 프로젝트. 30분 후 영구삭제 트리거 기준.
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_status ON playlist_projects(status);
CREATE INDEX idx_projects_created ON playlist_projects(created_at DESC);
CREATE INDEX idx_projects_deleted_at
  ON playlist_projects(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ═══════════════════════════════════════════
-- 3. playlist_tracks — 슬롯별 진행 상태
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES playlist_projects(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL CHECK (slot_index >= 0 AND slot_index < 15),
  prompt TEXT NOT NULL,
  mp3_url TEXT,
  image_url TEXT,
  clip_start REAL,
  clip_end REAL,
  short_mp4_url TEXT,
  short_youtube_url TEXT,
  thumbnail_url TEXT,
  title TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  upload_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, slot_index)
);

CREATE INDEX idx_tracks_project ON playlist_tracks(project_id);
CREATE INDEX idx_tracks_upload_status ON playlist_tracks(upload_status);

-- ═══════════════════════════════════════════
-- 4. scheduled_uploads — 예약 발행 큐
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS scheduled_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES playlist_projects(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES playlist_tracks(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_status ON scheduled_uploads(status, scheduled_at);
CREATE INDEX idx_scheduled_project ON scheduled_uploads(project_id);

-- ═══════════════════════════════════════════
-- updated_at 자동 갱신 트리거
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON playlist_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tracks_updated
  BEFORE UPDATE ON playlist_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
