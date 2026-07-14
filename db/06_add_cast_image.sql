-- Migration: Add cast_image to content_cast and episode_cast
-- Date: 2026-05-13

ALTER TABLE content_cast ADD COLUMN IF NOT EXISTS cast_image TEXT;
ALTER TABLE episode_cast ADD COLUMN IF NOT EXISTS cast_image TEXT;
