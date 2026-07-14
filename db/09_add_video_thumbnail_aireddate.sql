-- ============================================================
-- CAMCINE OTT — Migration: New URL fields for movies & episodes
-- File: db/migrations/20260517_add_video_thumbnail_aireddate.sql
--
-- Run ONCE against your existing DB:
--   psql $DATABASE_URL -f db/migrations/20260517_add_video_thumbnail_aireddate.sql
-- ============================================================

-- ── content table: add video_url and thumbnail_url ────────────
-- video_url   = direct video file URL (raw upload before HLS transcoding)
-- thumbnail_url = movie/series cover thumbnail (separate from poster_url)

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS video_url      TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url  TEXT;

-- ── episodes table: add video_url and aired_date ──────────────
-- video_url  = episode video file URL
-- aired_date = date the episode originally aired / was released

ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS video_url   TEXT,
  ADD COLUMN IF NOT EXISTS aired_date  DATE;

-- ── Indexes for aired_date (useful for ordering / filtering) ──
CREATE INDEX IF NOT EXISTS idx_episodes_aired_date ON episodes(aired_date DESC);

-- Done
SELECT 'Migration 20260517_add_video_thumbnail_aireddate applied successfully.' AS result;
