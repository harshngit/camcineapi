-- ============================================================
-- db/auth/queries.sql  —  SQL queries for Auth APIs
-- ============================================================

-- ── REGISTER ─────────────────────────────────────────────────
-- Check if email exists
-- SELECT id FROM users WHERE email = $1;

-- Insert new user
INSERT INTO users (email, first_name, last_name, phone_number, password_hash, role, age)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, email, first_name, last_name, phone_number, role, age, created_at;

-- ── LOGIN ─────────────────────────────────────────────────────
-- Find by email
-- SELECT * FROM users WHERE email = $1;

-- Find by phone number
-- SELECT * FROM users WHERE phone_number = $1;

-- Update last login timestamp
-- UPDATE users SET last_login = NOW() WHERE id = $1;

-- ── AUTH ME ───────────────────────────────────────────────────
-- Fetch authenticated user (used in middleware)
SELECT id, email, first_name, last_name, phone_number, role, age,
       language_preferences, regions, is_active
FROM users
WHERE id = $1;

-- ── FORGOT PASSWORD ───────────────────────────────────────────
-- Store reset token
UPDATE users
SET reset_password_token = $1, reset_password_expires = $2
WHERE email = $3;

-- ── CHANGE PASSWORD ───────────────────────────────────────────
-- Validate reset token (must not be expired)
SELECT id
FROM users
WHERE reset_password_token = $1
  AND reset_password_expires > NOW();

-- Apply new password and clear reset token
UPDATE users
SET password_hash             = $1,
    reset_password_token      = NULL,
    reset_password_expires    = NULL
WHERE id = $2;
