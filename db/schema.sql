-- ============================================================
-- schema.sql  —  Full database schema
-- Run: node src/config/initDb.js
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email                   VARCHAR(255) NOT NULL UNIQUE,
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    phone_number            VARCHAR(20) UNIQUE,
    password_hash           TEXT NOT NULL,
    role                    VARCHAR(20) NOT NULL DEFAULT 'viewer'
                                CHECK (role IN ('viewer','actor','manager','admin')),
    age                     INTEGER CHECK (age > 0),
    language_preferences    JSONB DEFAULT '[]'::jsonb,
    regions                 JSONB DEFAULT '[]'::jsonb,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    reset_password_token    TEXT,
    reset_password_expires  TIMESTAMPTZ,
    last_login              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone        ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role         ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active    ON users(is_active);
