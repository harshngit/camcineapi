-- ============================================================
-- CAMCINE OTT - Runtime schema fixes for API controllers
--
-- Run once against existing databases that were created before
-- the latest content/view tracking fields were added.
-- ============================================================

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS country VARCHAR(100);

ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS aired_date DATE;

ALTER TABLE songs_metadata
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE video_views
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE user_daily_views
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_content_country ON content(country);
CREATE INDEX IF NOT EXISTS idx_episodes_aired_date ON episodes(aired_date DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_video_views_updated_at ON video_views;
CREATE TRIGGER trigger_video_views_updated_at
    BEFORE UPDATE ON video_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_point_trans_updated_at ON point_transactions;
CREATE TRIGGER trigger_point_trans_updated_at
    BEFORE UPDATE ON point_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_daily_views_updated_at ON user_daily_views;
CREATE TRIGGER trigger_daily_views_updated_at
    BEFORE UPDATE ON user_daily_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Migration 20260519_fix_api_runtime_schema applied successfully.' AS result;
