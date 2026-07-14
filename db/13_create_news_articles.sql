-- ============================================================
-- CAMCINE OTT — News Module Schema
-- Table: news_articles
-- PREREQUISITES: Run 01_schema.sql first (users table, uuid-ossp)
--                 Run 12_fix_api_runtime_schema.sql first (update_updated_at_column())
-- Matches columns expected by src/controllers/newsController.js
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS news_articles (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title         VARCHAR(500) NOT NULL,
    slug          VARCHAR(500) NOT NULL UNIQUE,
    body          TEXT,
    excerpt       TEXT,
    category      VARCHAR(100),
    tags          JSONB NOT NULL DEFAULT '[]'::jsonb,
    thumbnail_url TEXT,
    is_published  BOOLEAN NOT NULL DEFAULT FALSE,
    author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_articles_category      ON news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_articles_is_published   ON news_articles(is_published);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at   ON news_articles(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_news_articles_title          ON news_articles USING gin(to_tsvector('english', title));

DROP TRIGGER IF EXISTS trigger_news_articles_updated_at ON news_articles;
CREATE TRIGGER trigger_news_articles_updated_at
    BEFORE UPDATE ON news_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Migration 13_create_news_articles applied successfully.' AS result;
