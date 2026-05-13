-- ============================================================
-- CAMCINE OTT — Actor Module Schema
-- Table: actors
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ACTORS TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    screen_name     VARCHAR(255),
    headshot_url    TEXT,
    bio             TEXT,
    date_of_birth   DATE,
    gender          VARCHAR(20),
    is_verified     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_actors_name        ON actors(name);
CREATE INDEX IF NOT EXISTS idx_actors_screen_name ON actors(screen_name);
CREATE INDEX IF NOT EXISTS idx_actors_is_verified ON actors(is_verified);

-- ── AUTO-UPDATE updated_at TRIGGER ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actors_updated_at ON actors;
CREATE TRIGGER trigger_actors_updated_at
    BEFORE UPDATE ON actors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
