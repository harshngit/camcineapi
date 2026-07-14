-- ============================================================
-- Migration: Add video_url to songs_metadata
-- File: db/migrations/20260517_add_song_video_url.sql
--
-- Run ONCE:
--   psql $DATABASE_URL -f db/migrations/20260517_add_song_video_url.sql
-- ============================================================

-- video_url on songs_metadata stores the music video / song video file URL
-- (separate from the HLS stream; this is the raw/direct video file)
ALTER TABLE songs_metadata
  ADD COLUMN IF NOT EXISTS video_url TEXT;

SELECT 'Migration 20260517_add_song_video_url applied successfully.' AS result;
