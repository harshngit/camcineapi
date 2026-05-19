-- ============================================================
-- CAMCINE OTT — Content Module Schema
-- Table: content, episodes, songs_metadata
-- PREREQUISITES: Run schema.sql first
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── CONTENT TABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title             VARCHAR(500) NOT NULL,
    type              VARCHAR(20) NOT NULL
                          CHECK (type IN ('movie','show','short_film','song','news')),
    description       TEXT,
    language          VARCHAR(50),
    region            VARCHAR(100),
    country           VARCHAR(100),
    genre             JSONB NOT NULL DEFAULT '[]'::jsonb,
    cast_ids          JSONB NOT NULL DEFAULT '[]'::jsonb,
    director          VARCHAR(255),
    release_year      INTEGER CHECK (release_year BETWEEN 1900 AND 2100),
    rating            VARCHAR(10) CHECK (rating IN ('U','UA','A','S')),
    status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','processing','published','archived')),
    poster_url        TEXT,
    thumbnail_url     TEXT,
    trailer_url       TEXT,
    video_url         TEXT,
    stream_url_hls    TEXT,
    stream_url_dash   TEXT,
    duration_seconds  INTEGER CHECK (duration_seconds > 0),
    is_free           BOOLEAN NOT NULL DEFAULT FALSE,
    price_tvod        NUMERIC(8,2) DEFAULT 0.00 CHECK (price_tvod >= 0),
    imdb_id           VARCHAR(50),
    tags              JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_content_type       ON content(type);
CREATE INDEX IF NOT EXISTS idx_content_status     ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_language   ON content(language);
CREATE INDEX IF NOT EXISTS idx_content_region     ON content(region);
CREATE INDEX IF NOT EXISTS idx_content_country    ON content(country);
CREATE INDEX IF NOT EXISTS idx_content_is_free    ON content(is_free);
CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_title      ON content USING gin(to_tsvector('english', title));

-- ── EPISODES TABLE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS episodes (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id        UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    season            INTEGER NOT NULL DEFAULT 1 CHECK (season > 0),
    episode_number    INTEGER NOT NULL CHECK (episode_number > 0),
    title             VARCHAR(500),
    description       TEXT,
    duration_seconds  INTEGER CHECK (duration_seconds > 0),
    stream_url_hls    TEXT,
    stream_url_dash   TEXT,
    thumbnail_url     TEXT,
    video_url         TEXT,
    aired_date        DATE,
    price_tvod        NUMERIC(8,2) DEFAULT 0.00 CHECK (price_tvod >= 0),
    is_free           BOOLEAN NOT NULL DEFAULT FALSE,
    status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','published','archived')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(content_id, season, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episodes_content_id ON episodes(content_id);
CREATE INDEX IF NOT EXISTS idx_episodes_status     ON episodes(status);
CREATE INDEX IF NOT EXISTS idx_episodes_aired_date ON episodes(aired_date DESC);

-- ── SONGS METADATA TABLE ──────────────────────────────────────
-- Extended data only for content where type = 'song'
CREATE TABLE IF NOT EXISTS songs_metadata (
    id           UUID PRIMARY KEY REFERENCES content(id) ON DELETE CASCADE,
    mood_tags    JSONB NOT NULL DEFAULT '[]'::jsonb,
    instruments  JSONB NOT NULL DEFAULT '[]'::jsonb,
    festival     VARCHAR(100),
    album        VARCHAR(255),
    lyrics_url   TEXT,
    audio_url_hq TEXT,
    audio_url_lq TEXT,
    video_url    TEXT,
    artist_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── AUTO-UPDATE updated_at TRIGGER ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_content_updated_at ON content;
CREATE TRIGGER trigger_content_updated_at
    BEFORE UPDATE ON content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_episodes_updated_at ON episodes;
CREATE TRIGGER trigger_episodes_updated_at
    BEFORE UPDATE ON episodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── SAMPLE DATA ───────────────────────────────────────────────
-- Insert sample content for testing (optional)
/*
INSERT INTO content (title, type, description, language, region, genre, director, release_year, rating, is_free, price_tvod, status)
VALUES
  ('Dangal', 'movie', 'A story of a wrestler and his daughters.', 'Hindi', 'Pan-India', '["Drama","Sports","Biography"]', 'Nitesh Tiwari', 2016, 'U', true, 0, 'published'),
  ('Mirzapur', 'show', 'Crime drama set in Mirzapur, UP.', 'Hindi', 'UP', '["Crime","Thriller","Drama"]', 'Gurmmeet Singh', 2018, 'A', false, 2, 'published'),
  ('Arjun Reddy', 'movie', 'A rebel doctor spirals after a breakup.', 'Telugu', 'Andhra Pradesh', '["Drama","Romance"]', 'Sandeep Reddy Vanga', 2017, 'A', false, 5, 'published');
*/
