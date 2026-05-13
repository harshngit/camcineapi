// ============================================================
// castController.js — Camcine OTT Cast Management
// Handles: Content Cast, Episode Cast (guest stars)
// Place this in: src/controllers/castController.js
// ============================================================

const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

// ─────────────────────────────────────────────────────────────
// 1. GET /content/:id/cast
// Public — Get full cast for a movie/show/song
// ─────────────────────────────────────────────────────────────
const getContentCast = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        cc.id,
        cc.content_id,
        cc.actor_id,
        cc.actor_name,
        cc.character_name,
        cc.role_type,
        cc.billing_order,
        cc.headshot_url,
        cc.cast_image,
        cc.created_at,
        -- Pull live actor details if actor is on platform
        a.name            AS actor_platform_name,
        a.screen_name     AS actor_screen_name,
        a.is_verified     AS actor_is_verified,
        COALESCE(cc.headshot_url, a.headshot_url) AS final_headshot_url
      FROM content_cast cc
      LEFT JOIN actors a ON a.id = cc.actor_id
      WHERE cc.content_id = $1
      ORDER BY cc.billing_order ASC, cc.created_at ASC
    `, [req.params.id]);

    return sendSuccess(res, {
      content_id: req.params.id,
      cast:       result.rows,
      total:      result.rows.length,
    });
  } catch (err) {
    console.error('getContentCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. POST /content/:id/cast
// Admin — Add a cast member to a movie/show/song
// ─────────────────────────────────────────────────────────────
const addContentCast = async (req, res) => {
  const {
    actor_id,         // UUID — if actor exists on platform
    actor_name,       // string — if actor NOT on platform
    character_name,
    role_type,
    billing_order,
    headshot_url,
    cast_image,
  } = req.body;

  // Must provide either actor_id or actor_name
  if (!actor_id && !actor_name) {
    return sendError(res, 'Either actor_id or actor_name is required.', 400);
  }

  try {
    // Verify content exists
    const content = await pool.query('SELECT id, type FROM content WHERE id = $1', [req.params.id]);
    if (!content.rows.length) return sendError(res, 'Content not found.', 404);

    // If actor_id provided, verify actor exists
    let resolvedActorName = actor_name;
    let resolvedHeadshot = headshot_url;

    if (actor_id) {
      const actor = await pool.query('SELECT id, name, headshot_url FROM actors WHERE id = $1', [actor_id]);
      if (!actor.rows.length) return sendError(res, 'Actor not found on platform.', 404);
      resolvedActorName = resolvedActorName || actor.rows[0].name;
      resolvedHeadshot  = resolvedHeadshot  || actor.rows[0].headshot_url;
    }

    const result = await pool.query(`
      INSERT INTO content_cast (
        content_id, actor_id, actor_name, character_name,
        role_type, billing_order, headshot_url, cast_image
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (content_id, actor_id) DO UPDATE SET
        character_name = EXCLUDED.character_name,
        role_type      = EXCLUDED.role_type,
        billing_order  = EXCLUDED.billing_order,
        headshot_url   = EXCLUDED.headshot_url,
        cast_image     = EXCLUDED.cast_image
      RETURNING *
    `, [
      req.params.id,
      actor_id || null,
      resolvedActorName,
      character_name,
      role_type || 'supporting_actor',
      billing_order || 99,
      resolvedHeadshot,
      cast_image || null,
    ]);

    return sendSuccess(res, { cast: result.rows[0] }, 'Cast member added.', 201);
  } catch (err) {
    console.error('addContentCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 3. PUT /content/:id/cast/:castId
// Admin — Update a cast member's role or character
// ─────────────────────────────────────────────────────────────
const updateContentCast = async (req, res) => {
  const { character_name, role_type, billing_order, headshot_url, cast_image } = req.body;
  try {
    const result = await pool.query(`
      UPDATE content_cast SET
        character_name = COALESCE($1, character_name),
        role_type      = COALESCE($2, role_type),
        billing_order  = COALESCE($3, billing_order),
        headshot_url   = COALESCE($4, headshot_url),
        cast_image     = COALESCE($5, cast_image)
      WHERE id = $6 AND content_id = $7
      RETURNING *
    `, [character_name, role_type, billing_order, headshot_url, cast_image, req.params.castId, req.params.id]);

    if (!result.rows.length) return sendError(res, 'Cast member not found.', 404);
    return sendSuccess(res, { cast: result.rows[0] }, 'Cast updated.');
  } catch (err) {
    console.error('updateContentCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 4. DELETE /content/:id/cast/:castId
// Admin — Remove a cast member from content
// ─────────────────────────────────────────────────────────────
const removeContentCast = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM content_cast WHERE id = $1 AND content_id = $2 RETURNING id',
      [req.params.castId, req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Cast member not found.', 404);
    return sendSuccess(res, {}, 'Cast member removed.');
  } catch (err) {
    console.error('removeContentCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 5. POST /content/:id/cast/bulk
// Admin — Add multiple cast members at once
// ─────────────────────────────────────────────────────────────
const bulkAddCast = async (req, res) => {
  const { cast } = req.body; // array of cast members

  if (!Array.isArray(cast) || !cast.length) {
    return sendError(res, 'cast must be a non-empty array.', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify content
    const content = await client.query('SELECT id FROM content WHERE id = $1', [req.params.id]);
    if (!content.rows.length) {
      await client.query('ROLLBACK');
      return sendError(res, 'Content not found.', 404);
    }

    const inserted = [];
    for (const member of cast) {
      if (!member.actor_id && !member.actor_name) continue;

      const result = await client.query(`
        INSERT INTO content_cast (
          content_id, actor_id, actor_name, character_name,
          role_type, billing_order, headshot_url, cast_image
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (content_id, actor_id) DO UPDATE SET
          character_name = EXCLUDED.character_name,
          role_type      = EXCLUDED.role_type,
          billing_order  = EXCLUDED.billing_order,
          headshot_url   = EXCLUDED.headshot_url,
          cast_image     = EXCLUDED.cast_image
        RETURNING *
      `, [
        req.params.id,
        member.actor_id || null,
        member.actor_name,
        member.character_name,
        member.role_type || 'supporting_actor',
        member.billing_order || 99,
        member.headshot_url || null,
        member.cast_image || null,
      ]);
      inserted.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return sendSuccess(res, {
      cast:    inserted,
      total:   inserted.length,
    }, `${inserted.length} cast member(s) added.`, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('bulkAddCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// 6. GET /content/:id/episodes/:episodeId/cast
// Public — Get guest cast for a specific episode
// ─────────────────────────────────────────────────────────────
const getEpisodeCast = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ec.id,
        ec.episode_id,
        ec.content_id,
        ec.actor_id,
        ec.actor_name,
        ec.character_name,
        ec.role_type,
        ec.billing_order,
        ec.cast_image,
        ec.created_at,
        a.screen_name        AS actor_screen_name,
        a.is_verified        AS actor_is_verified,
        a.headshot_url       AS actor_headshot_url
      FROM episode_cast ec
      LEFT JOIN actors a ON a.id = ec.actor_id
      WHERE ec.episode_id = $1 AND ec.content_id = $2
      ORDER BY ec.billing_order ASC
    `, [req.params.episodeId, req.params.id]);

    return sendSuccess(res, { episode_cast: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('getEpisodeCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 7. POST /content/:id/episodes/:episodeId/cast
// Admin — Add guest cast for a specific episode
// ─────────────────────────────────────────────────────────────
const addEpisodeCast = async (req, res) => {
  const { actor_id, actor_name, character_name, role_type, billing_order, cast_image } = req.body;

  if (!actor_id && !actor_name) {
    return sendError(res, 'Either actor_id or actor_name is required.', 400);
  }

  try {
    const result = await pool.query(`
      INSERT INTO episode_cast (
        episode_id, content_id, actor_id, actor_name,
        character_name, role_type, billing_order, cast_image
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (episode_id, actor_id) DO UPDATE SET
        character_name = EXCLUDED.character_name,
        role_type      = EXCLUDED.role_type,
        billing_order  = EXCLUDED.billing_order,
        cast_image     = EXCLUDED.cast_image
      RETURNING *
    `, [
      req.params.episodeId,
      req.params.id,
      actor_id || null,
      actor_name,
      character_name,
      role_type || 'guest',
      billing_order || 99,
      cast_image || null,
    ]);

    return sendSuccess(res, { cast: result.rows[0] }, 'Episode cast member added.', 201);
  } catch (err) {
    console.error('addEpisodeCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 8. DELETE /content/:id/episodes/:episodeId/cast/:castId
// Admin — Remove episode cast member
// ─────────────────────────────────────────────────────────────
const removeEpisodeCast = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM episode_cast WHERE id = $1 AND episode_id = $2 RETURNING id',
      [req.params.castId, req.params.episodeId]
    );
    if (!result.rows.length) return sendError(res, 'Episode cast member not found.', 404);
    return sendSuccess(res, {}, 'Episode cast member removed.');
  } catch (err) {
    console.error('removeEpisodeCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

module.exports = {
  getContentCast,
  addContentCast,
  updateContentCast,
  removeContentCast,
  bulkAddCast,
  getEpisodeCast,
  addEpisodeCast,
  removeEpisodeCast,
};
