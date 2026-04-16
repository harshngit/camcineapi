-- ============================================================
-- db/users/queries.sql  —  SQL queries for User Management APIs
-- ============================================================

-- ── GET ALL USERS ─────────────────────────────────────────────
-- (with optional role filter and search; paginated)
SELECT id, email, first_name, last_name, phone_number, role, age,
       language_preferences, regions, is_active, created_at, last_login
FROM users
WHERE role = $1                                         -- optional role filter
  AND (
    first_name  ILIKE $2 OR
    last_name   ILIKE $2 OR
    email       ILIKE $2                                -- optional search
  )
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- Count total matching rows (for pagination meta)
SELECT COUNT(*) FROM users
WHERE role = $1
  AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2);

-- ── GET USER BY ID ────────────────────────────────────────────
SELECT id, email, first_name, last_name, phone_number, role, age,
       language_preferences, regions, is_active, created_at, last_login
FROM users
WHERE id = $1;

-- ── UPDATE USER ───────────────────────────────────────────────
-- Update basic profile fields
UPDATE users
SET first_name           = COALESCE($1, first_name),
    last_name            = COALESCE($2, last_name),
    phone_number         = COALESCE($3, phone_number),
    age                  = COALESCE($4, age),
    language_preferences = COALESCE($5::jsonb, language_preferences),
    regions              = COALESCE($6::jsonb, regions),
    updated_at           = NOW()
WHERE id = $7
RETURNING id, email, first_name, last_name, phone_number, role, age,
          language_preferences, regions, is_active, updated_at;

-- Update role (admin only)
UPDATE users
SET role       = $1,
    updated_at = NOW()
WHERE id = $2
RETURNING id, email, role, updated_at;

-- ── DELETE USER (soft delete) ─────────────────────────────────
UPDATE users
SET is_active  = false,
    updated_at = NOW()
WHERE id = $1
RETURNING id;

-- ── HARD DELETE (use with caution — irreversible) ─────────────
-- DELETE FROM users WHERE id = $1;
