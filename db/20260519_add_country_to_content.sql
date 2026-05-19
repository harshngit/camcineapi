-- Migration: Add country to content records
-- Used by /api/v1/movies for movie create, update, list, detail, and filtering.

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS country VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_content_country ON content(country);

SELECT 'Migration 20260519_add_country_to_content applied successfully.' AS result;
