-- ============================================================
-- CAMCINE OTT — Storage + Cast Module Schema
-- Tables: media_uploads, content_cast, episode_cast
-- PREREQUISITES: Run schema.sql, content_schema.sql, actor_schema.sql first
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── MEDIA UPLOADS TABLE ───────────────────────────────────────
-- Tracks every file uploaded to GCP Storage
CREATE TABLE IF NOT EXISTS media_uploads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    file_name       VARCHAR(500) NOT NULL,
    original_name   VARCHAR(500) NOT NULL,
    file_type       VARCHAR(20) NOT NULL
                        CHECK (file_type IN ('image','video','audio','trailer','document')),
    mime_type       VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT,
    gcs_bucket      VARCHAR(255) NOT NULL,
    gcs_path        TEXT NOT NULL,
    public_url      TEXT NOT NULL,
    cdn_url         TEXT,
    duration_seconds INTEGER,         -- for video/audio
    width           INTEGER,          -- for images/video
    height          INTEGER,          -- for images/video
    status          VARCHAR(20) NOT NULL DEFAULT 'uploaded'
                        CHECK (status IN ('uploading','uploaded','processing','ready','failed')),
    linked_to_id    UUID,             -- content_id or episode_id this belongs to
    linked_to_type  VARCHAR(30),      -- 'content' | 'episode' | 'actor' | 'news'
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploads_uploaded_by    ON media_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_uploads_file_type      ON media_uploads(file_type);
CREATE INDEX IF NOT EXISTS idx_uploads_status         ON media_uploads(status);
CREATE INDEX IF NOT EXISTS idx_uploads_linked_to_id   ON media_uploads(linked_to_id);

-- ── CONTENT CAST TABLE ────────────────────────────────────────
-- Cast members for movies, shows, short films, songs
CREATE TABLE IF NOT EXISTS content_cast (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id      UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    actor_id        UUID REFERENCES actors(id) ON DELETE SET NULL,
    -- For cast members who are NOT yet actors on the platform:
    actor_name      VARCHAR(255),
    character_name  VARCHAR(255),
    role_type       VARCHAR(50) DEFAULT 'actor'
                        CHECK (role_type IN (
                            'lead_actor','lead_actress',
                            'supporting_actor','supporting_actress',
                            'director','producer','music_director',
                            'lyricist','cinematographer','editor',
                            'singer','narrator','cameo'
                        )),
    billing_order   INTEGER DEFAULT 99, -- 1 = top billed
    headshot_url    TEXT,               -- overrides actor.headshot_url if set
    cast_image      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(content_id, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_content_cast_content_id ON content_cast(content_id);
CREATE INDEX IF NOT EXISTS idx_content_cast_actor_id   ON content_cast(actor_id);

-- ── EPISODE CAST TABLE ────────────────────────────────────────
-- Cast overrides per episode (guest stars, special appearances)
CREATE TABLE IF NOT EXISTS episode_cast (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    episode_id      UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    content_id      UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    actor_id        UUID REFERENCES actors(id) ON DELETE SET NULL,
    actor_name      VARCHAR(255),
    character_name  VARCHAR(255),
    role_type       VARCHAR(50) DEFAULT 'guest'
                        CHECK (role_type IN (
                            'lead_actor','lead_actress',
                            'supporting_actor','supporting_actress',
                            'guest','cameo','narrator'
                        )),
    billing_order   INTEGER DEFAULT 99,
    cast_image      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(episode_id, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_episode_cast_episode_id ON episode_cast(episode_id);
CREATE INDEX IF NOT EXISTS idx_episode_cast_content_id ON episode_cast(content_id);

-- ── AUTO UPDATE TRIGGER ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_uploads_updated_at ON media_uploads;
CREATE TRIGGER trigger_uploads_updated_at
    BEFORE UPDATE ON media_uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
