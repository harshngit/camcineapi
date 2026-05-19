-- ============================================================
-- CAMCINE OTT — View Tracking & Points System Schema
-- Tables: video_views, point_transactions, daily_point_limits
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── VIDEO VIEWS TABLE ─────────────────────────────────────────
-- Tracks every video view by users
CREATE TABLE IF NOT EXISTS video_views (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id      UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    episode_id      UUID REFERENCES episodes(id) ON DELETE SET NULL,
    viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    points_awarded  INTEGER NOT NULL DEFAULT 0,
    idempotency_key TEXT NOT NULL,
    client_ip       TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, content_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_video_views_user_id     ON video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_video_views_content_id   ON video_views(content_id);
CREATE INDEX IF NOT EXISTS idx_video_views_episode_id   ON video_views(episode_id);
CREATE INDEX IF NOT EXISTS idx_video_views_viewed_at    ON video_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_video_views_idempotency  ON video_views(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_video_views_user_date    ON video_views(user_id, viewed_at DESC);

-- ── POINT TRANSACTIONS TABLE ─────────────────────────────────
-- Records all point allocations (viewer and admin transactions)
CREATE TABLE IF NOT EXISTS point_transactions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id          UUID REFERENCES content(id) ON DELETE SET NULL,
    transaction_type    VARCHAR(20) NOT NULL
                            CHECK (transaction_type IN ('viewer', 'admin', 'bonus', 'deduction')),
    points              INTEGER NOT NULL,
    balance_after       INTEGER NOT NULL,
    description         TEXT,
    reference_id        UUID,
    admin_id            UUID REFERENCES users(id) ON DELETE SET NULL,
    idempotency_key     TEXT,
    metadata            JSONB DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_trans_user_id      ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_trans_content_id   ON point_transactions(content_id);
CREATE INDEX IF NOT EXISTS idx_point_trans_type         ON point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_point_trans_created_at   ON point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_trans_admin_id     ON point_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_point_trans_idempotency  ON point_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_point_trans_user_date    ON point_transactions(user_id, created_at DESC);

-- ── USER POINT BALANCES TABLE ─────────────────────────────────
-- Tracks current point balance for each user
CREATE TABLE IF NOT EXISTS user_point_balances (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_balance INTEGER NOT NULL DEFAULT 0,
    lifetime_earned INTEGER NOT NULL DEFAULT 0,
    lifetime_spent  INTEGER NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balances_lifetime_earned ON user_point_balances(lifetime_earned DESC);

-- ── DAILY VIEW LIMITS TABLE ──────────────────────────────────
-- Tracks daily view counts per user to enforce limits
CREATE TABLE IF NOT EXISTS user_daily_views (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    view_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    view_count      INTEGER NOT NULL DEFAULT 0,
    points_earned   INTEGER NOT NULL DEFAULT 0,
    last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, view_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_views_date ON user_daily_views(view_date);

-- ── AUTO-UPDATE updated_at TRIGGER ───────────────────────────
DROP TRIGGER IF EXISTS trigger_video_views_updated_at ON video_views;
CREATE TRIGGER trigger_video_views_updated_at
    BEFORE UPDATE ON video_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_point_trans_updated_at ON point_transactions;
CREATE TRIGGER trigger_point_trans_updated_at
    BEFORE UPDATE ON point_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_balances_updated_at ON user_point_balances;
CREATE TRIGGER trigger_balances_updated_at
    BEFORE UPDATE ON user_point_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_daily_views_updated_at ON user_daily_views;
CREATE TRIGGER trigger_daily_views_updated_at
    BEFORE UPDATE ON user_daily_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── CONSTANTS ────────────────────────────────────────────────
-- These should be managed in application config, but can also be stored here
-- MAX_DAILY_VIEW_POINTS = 3 (per user per day)
-- POINTS_PER_VIEW = 1
