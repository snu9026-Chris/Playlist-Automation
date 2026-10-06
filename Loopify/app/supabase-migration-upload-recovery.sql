-- Apply after the existing four migrations. Queue credentials stay server-only.
ALTER TABLE scheduled_uploads ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE scheduled_uploads ADD COLUMN IF NOT EXISTS upload_session_url TEXT;
ALTER TABLE scheduled_uploads ADD COLUMN IF NOT EXISTS upload_started_at TIMESTAMPTZ;

ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platforms, scheduled_uploads FROM anon, authenticated;

-- One row per worker. The lease exceeds the route's 60-second lifetime.
CREATE OR REPLACE FUNCTION claim_scheduled_upload()
RETURNS SETOF scheduled_uploads
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE scheduled_uploads SET status = 'pending', locked_at = NULL
  WHERE status = 'processing' AND (locked_at IS NULL OR locked_at < now() - interval '2 minutes');

  RETURN QUERY
  UPDATE scheduled_uploads AS q SET status = 'processing', locked_at = now()
  WHERE q.id = (
    SELECT id FROM scheduled_uploads
    WHERE status = 'pending' AND scheduled_at <= now() + interval '24 hours'
    ORDER BY scheduled_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) RETURNING q.*;
END;
$$;
REVOKE ALL ON FUNCTION claim_scheduled_upload() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_scheduled_upload() TO service_role;

ALTER TABLE playlist_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_bookmarks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON playlist_projects, playlist_tracks, track_bookmarks FROM anon, authenticated;

ALTER TABLE scheduled_uploads ADD COLUMN IF NOT EXISTS comment_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (comment_status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE scheduled_uploads ADD COLUMN IF NOT EXISTS comment_locked_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION claim_scheduled_comment()
RETURNS SETOF scheduled_uploads
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- An interrupted POST may already have created the comment. Require manual inspection.
  UPDATE scheduled_uploads SET comment_status = 'failed'
  WHERE comment_status = 'processing' AND comment_locked_at < now() - interval '2 minutes';
  RETURN QUERY
  UPDATE scheduled_uploads AS q SET comment_status = 'processing', comment_locked_at = now()
  WHERE q.id = (
    SELECT id FROM scheduled_uploads
    WHERE status = 'completed' AND scheduled_at <= now() AND youtube_video_id IS NOT NULL
      AND first_comment IS NOT NULL AND first_comment <> '' AND comment_status = 'pending'
    ORDER BY scheduled_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) RETURNING q.*;
END;
$$;
REVOKE ALL ON FUNCTION claim_scheduled_comment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_scheduled_comment() TO service_role;

-- Browsers upload only with path-scoped signatures issued by the administrator API.
DROP POLICY IF EXISTS "anon_insert_media" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_media" ON storage.objects;
