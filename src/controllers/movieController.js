// ============================================================
// movieController.js — Camcine OTT Movie Module
// Routes: /api/v1/movies
// Cast is embedded inside the movie schema (no separate cast API)
// ============================================================

const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

// ── HELPER: Build WHERE clause ────────────────────────────────
const buildWhere = (filters) => {
  const conditions = [`type = 'movie'`]; // always filter movies only
  const params = [];
  let idx = 1;

  Object.entries(filters).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') return;
    if (key === 'status')   { conditions.push(`status = $${idx++}`);         params.push(val); }
    if (key === 'language') { conditions.push(`language ILIKE $${idx++}`);   params.push(val); }
    if (key === 'region')   { conditions.push(`region ILIKE $${idx++}`);     params.push(val); }
    if (key === 'is_free')  { conditions.push(`is_free = $${idx++}`);        params.push(val === 'true' || val === true); }
    if (key === 'genre')    { conditions.push(`genre @> $${idx++}::jsonb`);  params.push(JSON.stringify([val])); }
    if (key === 'search')   {
      conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx + 1})`);
      params.push(`%${val}%`, `%${val}%`);
      idx += 2;
    }
    if (key === 'year')   { conditions.push(`release_year = $${idx++}`);  params.push(parseInt(val)); }
    if (key === 'rating') { conditions.push(`rating = $${idx++}`);        params.push(val); }
  });

  return {
    where: `WHERE ${conditions.join(' AND ')}`,
    params,
    nextIdx: idx,
  };
};

// ─────────────────────────────────────────────────────────────
// 1. GET /movies
// Public — List all published movies with filters & pagination
// ─────────────────────────────────────────────────────────────
const getAllMovies = async (req, res, next) => {
  const {
    page = 1, limit = 10,
    language, region, genre, is_free,
    search, year, rating,
    sort = 'newest',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const statusFilter = req.user?.role === 'admin' ? req.query.status : 'published';

  const sortMap = {
    newest:     'c.created_at DESC',
    oldest:     'c.created_at ASC',
    title:      'c.title ASC',
    price_low:  'c.price_tvod ASC',
    price_high: 'c.price_tvod DESC',
  };
  const orderBy = sortMap[sort] || 'c.created_at DESC';

  try {
    const { where, params, nextIdx } = buildWhere({
      status: statusFilter, language, region, genre, is_free, search, year, rating,
    });

    const dataQuery = `
      SELECT
        c.id, c.title, c.description, c.language, c.region,
        c.genre, c.director, c.release_year, c.rating, c.status,
        c.poster_url,
        c.thumbnail_url,
        c.trailer_url,
        c.video_url,
        c.stream_url_hls, c.stream_url_dash,
        c.duration_seconds, c.is_free, c.price_tvod,
        c.imdb_id, c.tags, c.created_at, c.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id',             cc.id,
              'actor_id',       cc.actor_id,
              'actor_name',     COALESCE(cc.actor_name, a.name),
              'character_name', cc.character_name,
              'role_type',      cc.role_type,
              'billing_order',  cc.billing_order,
              'headshot_url',   COALESCE(cc.headshot_url, cc.cast_image, a.headshot_url),
              'is_verified',    a.is_verified
            ) ORDER BY cc.billing_order ASC
          ) FILTER (WHERE cc.id IS NOT NULL),
          '[]'::json
        ) AS cast
      FROM content c
      LEFT JOIN content_cast cc ON cc.content_id = c.id
      LEFT JOIN actors a ON a.id = cc.actor_id
      ${where}
      GROUP BY c.id
      ORDER BY ${orderBy}
      LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
    `;

    const countQuery = `SELECT COUNT(*) FROM content c ${where}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [...params, parseInt(limit), offset]),
      pool.query(countQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].count);

    return sendSuccess(res, {
      movies: dataResult.rows,
      pagination: {
        page:        parseInt(page),
        limit:       parseInt(limit),
        total,
        total_pages: Math.ceil(total / parseInt(limit)),
        has_next:    parseInt(page) < Math.ceil(total / parseInt(limit)),
        has_prev:    parseInt(page) > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. GET /movies/:id
// Public — Single movie with full cast embedded
// ─────────────────────────────────────────────────────────────
const getMovieById = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id, c.title, c.description, c.language, c.region,
        c.genre, c.director, c.release_year, c.rating, c.status,
        c.poster_url,
        c.thumbnail_url,
        c.trailer_url,
        c.video_url,
        c.stream_url_hls, c.stream_url_dash,
        c.duration_seconds, c.is_free, c.price_tvod,
        c.imdb_id, c.tags, c.created_at, c.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id',             cc.id,
              'actor_id',       cc.actor_id,
              'actor_name',     COALESCE(cc.actor_name, a.name),
              'character_name', cc.character_name,
              'role_type',      cc.role_type,
              'billing_order',  cc.billing_order,
              'headshot_url',   COALESCE(cc.headshot_url, cc.cast_image, a.headshot_url),
              'is_verified',    a.is_verified
            ) ORDER BY cc.billing_order ASC
          ) FILTER (WHERE cc.id IS NOT NULL),
          '[]'::json
        ) AS cast
      FROM content c
      LEFT JOIN content_cast cc ON cc.content_id = c.id
      LEFT JOIN actors a ON a.id = cc.actor_id
      WHERE c.id = $1 AND c.type = 'movie'
      GROUP BY c.id
    `, [req.params.id]);

    if (!result.rows.length) return sendError(res, 'Movie not found.', 404);
    return sendSuccess(res, { movie: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 3. POST /movies
// Admin only — Create a movie (with optional cast array)
// ─────────────────────────────────────────────────────────────
const createMovie = async (req, res, next) => {
  const {
    title, description, language, region,
    genre, director, release_year, rating,
    poster_url, thumbnail_url, trailer_url, video_url,
    stream_url_hls, stream_url_dash,
    duration_seconds, is_free, price_tvod, imdb_id, tags,
    cast = [],   // array of cast objects embedded in body
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO content (
        title, type, description, language, region,
        genre, director, release_year, rating,
        poster_url, thumbnail_url, trailer_url, video_url,
        stream_url_hls, stream_url_dash,
        duration_seconds, is_free, price_tvod, imdb_id, tags,
        status, created_by
      ) VALUES ($1,'movie',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'draft',$20)
      RETURNING *
    `, [
      title, description, language, region,
      JSON.stringify(genre || []),
      director, release_year, rating,
      poster_url, thumbnail_url, trailer_url, video_url,
      stream_url_hls, stream_url_dash,
      duration_seconds,
      is_free || false,
      price_tvod || 0,
      imdb_id,
      JSON.stringify(tags || []),
      req.user.id,
    ]);

    const movie = result.rows[0];

    // Insert cast members if provided
    const insertedCast = [];
    for (const member of cast) {
      if (!member.actor_id && !member.actor_name) continue;
      const castResult = await client.query(`
        INSERT INTO content_cast (
          content_id, actor_id, actor_name, character_name,
          role_type, billing_order, headshot_url, cast_image
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (content_id, actor_id) DO UPDATE SET
          character_name = EXCLUDED.character_name,
          role_type      = EXCLUDED.role_type,
          billing_order  = EXCLUDED.billing_order
        RETURNING *
      `, [
        movie.id,
        member.actor_id || null,
        member.actor_name || null,
        member.character_name || null,
        member.role_type || 'supporting_actor',
        member.billing_order || 99,
        member.headshot_url || null,
        member.cast_image || null,
      ]);
      insertedCast.push(castResult.rows[0]);
    }

    await client.query('COMMIT');
    return sendSuccess(res, { movie: { ...movie, cast: insertedCast } }, 'Movie created successfully.', 201);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// 4. PUT /movies/:id
// Admin only — Update movie fields
// ─────────────────────────────────────────────────────────────
const updateMovie = async (req, res, next) => {
  const allowedFields = [
    'title', 'description', 'language', 'region',
    'genre', 'director', 'release_year', 'rating', 'status',
    'poster_url', 'thumbnail_url', 'trailer_url', 'video_url',
    'stream_url_hls', 'stream_url_dash',
    'duration_seconds', 'is_free', 'price_tvod', 'imdb_id', 'tags',
  ];
  const jsonFields = ['genre', 'tags'];

  try {
    const existing = await pool.query(
      `SELECT id FROM content WHERE id = $1 AND type = 'movie'`,
      [req.params.id]
    );
    if (!existing.rows.length) return sendError(res, 'Movie not found.', 404);

    const updates = [];
    const values = [];
    let idx = 1;

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(jsonFields.includes(field) ? JSON.stringify(req.body[field]) : req.body[field]);
      }
    });

    if (!updates.length) return sendError(res, 'No valid fields provided to update.', 400);

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE content SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return sendSuccess(res, { movie: result.rows[0] }, 'Movie updated successfully.');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 5. PATCH /movies/:id/status
// Admin only — Publish / archive / draft
// ─────────────────────────────────────────────────────────────
const updateMovieStatus = async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'processing', 'published', 'archived'];
  if (!validStatuses.includes(status)) {
    return sendError(res, `Invalid status. Must be: ${validStatuses.join(', ')}`, 400);
  }
  try {
    const result = await pool.query(
      `UPDATE content SET status = $1, updated_at = NOW()
       WHERE id = $2 AND type = 'movie' RETURNING id, title, status`,
      [status, req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Movie not found.', 404);
    return sendSuccess(res, { movie: result.rows[0] }, `Movie status updated to "${status}".`);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 6. DELETE /movies/:id
// Admin only — Soft delete (archive)
// ─────────────────────────────────────────────────────────────
const deleteMovie = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE content SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND type = 'movie' AND status != 'archived'
       RETURNING id, title`,
      [req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Movie not found or already archived.', 404);
    return sendSuccess(res, { movie: result.rows[0] }, 'Movie archived successfully.');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// CAST — embedded inside movie (no separate route needed)
// ─────────────────────────────────────────────────────────────

// 7. POST /movies/:id/cast  — add / update a cast member
const addMovieCast = async (req, res) => {
  const { actor_id, actor_name, character_name, role_type, billing_order, headshot_url, cast_image } = req.body;
  if (!actor_id && !actor_name) return sendError(res, 'actor_id or actor_name is required.', 400);

  try {
    const movie = await pool.query(`SELECT id FROM content WHERE id = $1 AND type = 'movie'`, [req.params.id]);
    if (!movie.rows.length) return sendError(res, 'Movie not found.', 404);

    let resolvedName = actor_name;
    let resolvedHeadshot = headshot_url;
    if (actor_id) {
      const actor = await pool.query('SELECT name, headshot_url FROM actors WHERE id = $1', [actor_id]);
      if (!actor.rows.length) return sendError(res, 'Actor not found on platform.', 404);
      resolvedName     = resolvedName     || actor.rows[0].name;
      resolvedHeadshot = resolvedHeadshot || actor.rows[0].headshot_url;
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
      actor_id || null, resolvedName, character_name,
      role_type || 'supporting_actor',
      billing_order || 99,
      resolvedHeadshot || null,
      cast_image || null,
    ]);

    return sendSuccess(res, { cast: result.rows[0] }, 'Cast member added to movie.', 201);
  } catch (err) {
    console.error('addMovieCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// 8. POST /movies/:id/cast/bulk  — add multiple cast at once
const bulkAddMovieCast = async (req, res) => {
  const { cast } = req.body;
  if (!Array.isArray(cast) || !cast.length) return sendError(res, 'cast must be a non-empty array.', 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const movie = await client.query(`SELECT id FROM content WHERE id = $1 AND type = 'movie'`, [req.params.id]);
    if (!movie.rows.length) { await client.query('ROLLBACK'); return sendError(res, 'Movie not found.', 404); }

    const inserted = [];
    for (const member of cast) {
      if (!member.actor_id && !member.actor_name) continue;
      const r = await client.query(`
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
        member.actor_id || null, member.actor_name || null, member.character_name || null,
        member.role_type || 'supporting_actor',
        member.billing_order || 99,
        member.headshot_url || null,
        member.cast_image || null,
      ]);
      inserted.push(r.rows[0]);
    }

    await client.query('COMMIT');
    return sendSuccess(res, { cast: inserted, total: inserted.length }, `${inserted.length} cast member(s) added.`, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('bulkAddMovieCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  } finally {
    client.release();
  }
};

// 9. PUT /movies/:id/cast/:castId  — update one cast member
const updateMovieCast = async (req, res) => {
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
    return sendSuccess(res, { cast: result.rows[0] }, 'Cast member updated.');
  } catch (err) {
    console.error('updateMovieCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// 10. DELETE /movies/:id/cast/:castId  — remove one cast member
const removeMovieCast = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM content_cast WHERE id = $1 AND content_id = $2 RETURNING id',
      [req.params.castId, req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Cast member not found.', 404);
    return sendSuccess(res, {}, 'Cast member removed from movie.');
  } catch (err) {
    console.error('removeMovieCast error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

module.exports = {
  getAllMovies,
  getMovieById,
  createMovie,
  updateMovie,
  updateMovieStatus,
  deleteMovie,
  addMovieCast,
  bulkAddMovieCast,
  updateMovieCast,
  removeMovieCast,
};
