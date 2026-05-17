// ============================================================
// episodeController.js — Camcine OTT Episode / Series Module
// Routes: /api/v1/episodes
// - Series (parent) has a series_name and holds an array of episodes
// - Each episode has an aired_date
// - Cast is embedded inside the series & episode schema
// ============================================================

const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

// ═══════════════════════════════════════════════════════════════
// SERIES (parent content of type 'show')
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 1. GET /episodes  (list all series)
// Public — Paginated list of all published shows/series
// ─────────────────────────────────────────────────────────────
const getAllSeries = async (req, res, next) => {
  const {
    page = 1, limit = 10,
    language, region, genre, is_free, search, year, rating,
    sort = 'newest',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const statusFilter = req.user?.role === 'admin' ? req.query.status : 'published';

  const conditions = [`c.type IN ('show','short_film')`];
  const params = [];
  let idx = 1;

  if (statusFilter) { conditions.push(`c.status = $${idx++}`);           params.push(statusFilter); }
  if (language)     { conditions.push(`c.language ILIKE $${idx++}`);     params.push(language); }
  if (region)       { conditions.push(`c.region ILIKE $${idx++}`);       params.push(region); }
  if (is_free)      { conditions.push(`c.is_free = $${idx++}`);          params.push(is_free === 'true'); }
  if (genre)        { conditions.push(`c.genre @> $${idx++}::jsonb`);    params.push(JSON.stringify([genre])); }
  if (search)       {
    conditions.push(`(c.title ILIKE $${idx} OR c.description ILIKE $${idx + 1})`);
    params.push(`%${search}%`, `%${search}%`);
    idx += 2;
  }
  if (year)   { conditions.push(`c.release_year = $${idx++}`); params.push(parseInt(year)); }
  if (rating) { conditions.push(`c.rating = $${idx++}`);       params.push(rating); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const sortMap = {
    newest: 'c.created_at DESC', oldest: 'c.created_at ASC',
    title: 'c.title ASC', price_low: 'c.price_tvod ASC', price_high: 'c.price_tvod DESC',
  };
  const orderBy = sortMap[sort] || 'c.created_at DESC';

  try {
    const dataQuery = `
      SELECT
        c.id, c.title AS series_name, c.type, c.description,
        c.language, c.region, c.genre, c.director,
        c.release_year, c.rating, c.status,
        c.poster_url, c.trailer_url, c.thumbnail_url,
        c.is_free, c.price_tvod, c.tags, c.created_at, c.updated_at,
        COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'published') AS total_episodes,
        COALESCE(
          json_agg(
            json_build_object(
              'id',             cc.id,
              'actor_name',     COALESCE(cc.actor_name, a.name),
              'character_name', cc.character_name,
              'role_type',      cc.role_type,
              'billing_order',  cc.billing_order,
              'headshot_url',   COALESCE(cc.headshot_url, cc.cast_image, a.headshot_url)
            ) ORDER BY cc.billing_order ASC
          ) FILTER (WHERE cc.id IS NOT NULL),
          '[]'::json
        ) AS cast
      FROM content c
      LEFT JOIN episodes e  ON e.content_id = c.id
      LEFT JOIN content_cast cc ON cc.content_id = c.id
      LEFT JOIN actors a ON a.id = cc.actor_id
      ${where}
      GROUP BY c.id
      ORDER BY ${orderBy}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `SELECT COUNT(DISTINCT c.id) FROM content c ${where}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [...params, parseInt(limit), offset]),
      pool.query(countQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].count);
    return sendSuccess(res, {
      series: dataResult.rows,
      pagination: {
        page: parseInt(page), limit: parseInt(limit), total,
        total_pages: Math.ceil(total / parseInt(limit)),
        has_next: parseInt(page) < Math.ceil(total / parseInt(limit)),
        has_prev: parseInt(page) > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. GET /episodes/:seriesId
// Public — Get a series with its full episode array + cast
// ─────────────────────────────────────────────────────────────
const getSeriesById = async (req, res, next) => {
  try {
    // Fetch series (parent)
    const seriesResult = await pool.query(`
      SELECT
        c.id, c.title AS series_name, c.type, c.description,
        c.language, c.region, c.genre, c.director,
        c.release_year, c.rating, c.status,
        c.poster_url, c.trailer_url, c.thumbnail_url,
        c.is_free, c.price_tvod, c.tags, c.created_at, c.updated_at,
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
      WHERE c.id = $1 AND c.type IN ('show','short_film')
      GROUP BY c.id
    `, [req.params.seriesId]);

    if (!seriesResult.rows.length) return sendError(res, 'Series not found.', 404);

    // Fetch all episodes for this series (as array, ordered by season + episode)
    const episodesResult = await pool.query(`
      SELECT
        e.id, e.season, e.episode_number,
        e.title AS episode_title,
        e.description, e.duration_seconds,
        e.stream_url_hls, e.stream_url_dash,
        e.thumbnail_url, e.video_url,
        e.price_tvod, e.is_free, e.status,
        e.aired_date,
        e.created_at, e.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id',             ec.id,
              'actor_name',     COALESCE(ec.actor_name, a.name),
              'character_name', ec.character_name,
              'role_type',      ec.role_type,
              'billing_order',  ec.billing_order,
              'headshot_url',   COALESCE(ec.cast_image, a.headshot_url)
            ) ORDER BY ec.billing_order ASC
          ) FILTER (WHERE ec.id IS NOT NULL),
          '[]'::json
        ) AS episode_cast
      FROM episodes e
      LEFT JOIN episode_cast ec ON ec.episode_id = e.id
      LEFT JOIN actors a ON a.id = ec.actor_id
      WHERE e.content_id = $1
      GROUP BY e.id
      ORDER BY e.season ASC, e.episode_number ASC
    `, [req.params.seriesId]);

    const series = seriesResult.rows[0];
    series.episodes = episodesResult.rows;

    return sendSuccess(res, { series });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 3. POST /episodes  (create a series / show)
// Admin only — Create a show with optional cast and episodes
// ─────────────────────────────────────────────────────────────
const createSeries = async (req, res, next) => {
  const {
    series_name,        // maps to content.title
    type = 'show',      // 'show' | 'short_film'
    description, language, region,
    genre, director, release_year, rating,
    poster_url, thumbnail_url, trailer_url,
    is_free, price_tvod, imdb_id, tags,
    cast = [],          // array of cast objects
    episodes = [],      // array of initial episodes
  } = req.body;

  if (!['show', 'short_film'].includes(type)) {
    return sendError(res, "type must be 'show' or 'short_film'.", 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert parent content (series)
    const contentResult = await client.query(`
      INSERT INTO content (
        title, type, description, language, region,
        genre, director, release_year, rating,
        poster_url, thumbnail_url, trailer_url,
        is_free, price_tvod, imdb_id, tags,
        status, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'draft',$17)
      RETURNING *
    `, [
      series_name, type, description, language, region,
      JSON.stringify(genre || []),
      director, release_year, rating,
      poster_url, thumbnail_url, trailer_url,
      is_free || false,
      price_tvod || 0,
      imdb_id,
      JSON.stringify(tags || []),
      req.user.id,
    ]);

    const series = contentResult.rows[0];

    // Insert cast
    const insertedCast = [];
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
          billing_order  = EXCLUDED.billing_order
        RETURNING *
      `, [
        series.id,
        member.actor_id || null, member.actor_name || null, member.character_name || null,
        member.role_type || 'supporting_actor',
        member.billing_order || 99,
        member.headshot_url || null,
        member.cast_image || null,
      ]);
      insertedCast.push(r.rows[0]);
    }

    // Insert initial episodes if provided
    const insertedEpisodes = [];
    for (const ep of episodes) {
      if (!ep.episode_number) continue;
      const r = await client.query(`
        INSERT INTO episodes (
          content_id, season, episode_number, title, description,
          duration_seconds, stream_url_hls, stream_url_dash,
          thumbnail_url, video_url, price_tvod, is_free, aired_date, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'published')
        ON CONFLICT (content_id, season, episode_number) DO NOTHING
        RETURNING *
      `, [
        series.id,
        ep.season || 1,
        ep.episode_number,
        ep.title || null,
        ep.description || null,
        ep.duration_seconds || null,
        ep.stream_url_hls || null,
        ep.stream_url_dash || null,
        ep.thumbnail_url || null,
        ep.video_url || null,
        ep.price_tvod || 0,
        ep.is_free || false,
        ep.aired_date || null,
      ]);
      if (r.rows.length) insertedEpisodes.push(r.rows[0]);
    }

    await client.query('COMMIT');
    return sendSuccess(res, {
      series: { ...series, cast: insertedCast, episodes: insertedEpisodes }
    }, 'Series created successfully.', 201);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// 4. PUT /episodes/:seriesId
// Admin only — Update series metadata
// ─────────────────────────────────────────────────────────────
const updateSeries = async (req, res, next) => {
  const allowedFields = [
    'title', 'description', 'language', 'region',
    'genre', 'director', 'release_year', 'rating', 'status',
    'poster_url', 'thumbnail_url', 'trailer_url',
    'is_free', 'price_tvod', 'imdb_id', 'tags',
  ];
  const jsonFields = ['genre', 'tags'];

  // Allow series_name as alias for title
  if (req.body.series_name) req.body.title = req.body.series_name;

  try {
    const existing = await pool.query(
      `SELECT id FROM content WHERE id = $1 AND type IN ('show','short_film')`,
      [req.params.seriesId]
    );
    if (!existing.rows.length) return sendError(res, 'Series not found.', 404);

    const updates = [];
    const values = [];
    let idx = 1;

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(jsonFields.includes(field) ? JSON.stringify(req.body[field]) : req.body[field]);
      }
    });

    if (!updates.length) return sendError(res, 'No valid fields to update.', 400);
    updates.push(`updated_at = NOW()`);
    values.push(req.params.seriesId);

    const result = await pool.query(
      `UPDATE content SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return sendSuccess(res, { series: result.rows[0] }, 'Series updated.');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 5. DELETE /episodes/:seriesId
// Admin only — Archive a series
// ─────────────────────────────────────────────────────────────
const deleteSeries = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE content SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND type IN ('show','short_film') AND status != 'archived'
       RETURNING id, title`,
      [req.params.seriesId]
    );
    if (!result.rows.length) return sendError(res, 'Series not found or already archived.', 404);
    return sendSuccess(res, {}, 'Series archived.');
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
// EPISODE CRUD — individual episodes within a series
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 6. POST /episodes/:seriesId/episode
// Admin only — Add an episode to a series
// ─────────────────────────────────────────────────────────────
const addEpisode = async (req, res, next) => {
  const {
    season, episode_number, title, description,
    duration_seconds, stream_url_hls, stream_url_dash,
    thumbnail_url, video_url, price_tvod, is_free, aired_date,
  } = req.body;

  try {
    const parent = await pool.query(
      `SELECT id FROM content WHERE id = $1 AND type IN ('show','short_film')`,
      [req.params.seriesId]
    );
    if (!parent.rows.length) return sendError(res, 'Series not found.', 404);

    const result = await pool.query(`
      INSERT INTO episodes (
        content_id, season, episode_number, title, description,
        duration_seconds, stream_url_hls, stream_url_dash,
        thumbnail_url, video_url, price_tvod, is_free, aired_date, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'published')
      RETURNING *
    `, [
      req.params.seriesId,
      season || 1, episode_number,
      title, description,
      duration_seconds,
      stream_url_hls, stream_url_dash,
      thumbnail_url, video_url,
      price_tvod || 0,
      is_free || false,
      aired_date || null,
    ]);

    return sendSuccess(res, { episode: result.rows[0] }, 'Episode added.', 201);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 7. PUT /episodes/:seriesId/episode/:episodeId
// Admin only — Update an episode
// ─────────────────────────────────────────────────────────────
const updateEpisode = async (req, res, next) => {
  const allowedFields = [
    'season', 'episode_number', 'title', 'description',
    'duration_seconds', 'stream_url_hls', 'stream_url_dash',
    'thumbnail_url', 'video_url', 'price_tvod', 'is_free', 'status', 'aired_date',
  ];
  try {
    const updates = [];
    const values = [];
    let idx = 1;
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        values.push(req.body[f]);
      }
    });
    if (!updates.length) return sendError(res, 'No fields to update.', 400);
    updates.push(`updated_at = NOW()`);
    values.push(req.params.episodeId, req.params.seriesId);

    const result = await pool.query(
      `UPDATE episodes SET ${updates.join(', ')}
       WHERE id = $${idx++} AND content_id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return sendError(res, 'Episode not found.', 404);
    return sendSuccess(res, { episode: result.rows[0] }, 'Episode updated.');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 8. DELETE /episodes/:seriesId/episode/:episodeId
// Admin only — Archive an episode
// ─────────────────────────────────────────────────────────────
const deleteEpisode = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE episodes SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND content_id = $2 RETURNING id, title`,
      [req.params.episodeId, req.params.seriesId]
    );
    if (!result.rows.length) return sendError(res, 'Episode not found.', 404);
    return sendSuccess(res, {}, 'Episode archived.');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// CAST on series — POST/PUT/DELETE /episodes/:seriesId/cast
// ─────────────────────────────────────────────────────────────

const addSeriesCast = async (req, res, next) => {
  const { actor_id, actor_name, character_name, role_type, billing_order, headshot_url, cast_image } = req.body;
  if (!actor_id && !actor_name) return sendError(res, 'actor_id or actor_name is required.', 400);

  try {
    const series = await pool.query(
      `SELECT id FROM content WHERE id = $1 AND type IN ('show','short_film')`,
      [req.params.seriesId]
    );
    if (!series.rows.length) return sendError(res, 'Series not found.', 404);

    let resolvedName = actor_name;
    let resolvedHeadshot = headshot_url;
    if (actor_id) {
      const actor = await pool.query('SELECT name, headshot_url FROM actors WHERE id = $1', [actor_id]);
      if (!actor.rows.length) return sendError(res, 'Actor not found.', 404);
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
      req.params.seriesId,
      actor_id || null, resolvedName, character_name,
      role_type || 'supporting_actor',
      billing_order || 99,
      resolvedHeadshot || null,
      cast_image || null,
    ]);
    return sendSuccess(res, { cast: result.rows[0] }, 'Cast member added to series.', 201);
  } catch (err) {
    next(err);
  }
};

const removeSeriesCast = async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM content_cast WHERE id = $1 AND content_id = $2 RETURNING id',
      [req.params.castId, req.params.seriesId]
    );
    if (!result.rows.length) return sendError(res, 'Cast member not found.', 404);
    return sendSuccess(res, {}, 'Cast member removed from series.');
  } catch (err) {
    next(err);
  }
};

// CAST on episode — guest cast for individual episode
const addEpisodeCast = async (req, res, next) => {
  const { actor_id, actor_name, character_name, role_type, billing_order, cast_image } = req.body;
  if (!actor_id && !actor_name) return sendError(res, 'actor_id or actor_name is required.', 400);
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
      req.params.episodeId, req.params.seriesId,
      actor_id || null, actor_name || null,
      character_name,
      role_type || 'guest',
      billing_order || 99,
      cast_image || null,
    ]);
    return sendSuccess(res, { cast: result.rows[0] }, 'Guest cast added to episode.', 201);
  } catch (err) {
    next(err);
  }
};

const removeEpisodeCast = async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM episode_cast WHERE id = $1 AND episode_id = $2 RETURNING id',
      [req.params.castId, req.params.episodeId]
    );
    if (!result.rows.length) return sendError(res, 'Episode cast member not found.', 404);
    return sendSuccess(res, {}, 'Episode cast member removed.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllSeries,
  getSeriesById,
  createSeries,
  updateSeries,
  deleteSeries,
  addEpisode,
  updateEpisode,
  deleteEpisode,
  addSeriesCast,
  removeSeriesCast,
  addEpisodeCast,
  removeEpisodeCast,
};
