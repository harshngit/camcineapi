-- ============================================================
-- CAMCINE OTT — Schema Migration
-- File   : db/migrations/20260517_camcine_new_columns.sql
-- Run once against your existing DB:
--
--   psql $DATABASE_URL -f db/migrations/20260517_camcine_new_columns.sql
--
-- Safe to re-run: every ALTER uses IF NOT EXISTS
-- ============================================================

BEGIN;

-- ── 1. content table ─────────────────────────────────────────
-- video_url     = raw video file URL (before HLS transcoding)
-- thumbnail_url = cover / thumbnail image (separate from poster_url)

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS video_url     TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- ── 2. episodes table ────────────────────────────────────────
-- video_url  = raw episode video file URL
-- aired_date = date the episode originally aired / was released

ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS video_url   TEXT,
  ADD COLUMN IF NOT EXISTS aired_date  DATE;

-- ── 3. songs_metadata table ──────────────────────────────────
-- video_url = music video / song video file URL

ALTER TABLE songs_metadata
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- ── 4. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_episodes_aired_date ON episodes (aired_date DESC);

COMMIT;

SELECT 'Migration 20260517_camcine_new_columns applied successfully.' AS result;
