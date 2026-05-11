// ============================================================
// contentController.js — Camcine OTT Content Module
// Handles: Movies, TV Shows, Short Films, Songs, News
// ============================================================

const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

// ── HELPER: Build WHERE clause dynamically ────────────────────
const buildWhere = (filters) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  Object.entries(filters).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') return;
    if (key === 'status')   { conditions.push(`status = $${idx++}`);              params.push(val); }
    if (key === 'type')     { conditions.push(`type = $${idx++}`);                params.push(val); }
    if (key === 'language') { conditions.push(`language ILIKE $${idx++}`);        params.push(val); }
    if (key === 'region')   { conditions.push(`region ILIKE $${idx++}`);          params.push(val); }
    if (key === 'is_free')  { conditions.push(`is_free = $${idx++}`);             params.push(val === 'true' || val === true); }
    if (key === 'genre')    { conditions.push(`genre @> $${idx++}::jsonb`);       params.push(JSON.stringify([val])); }
    if (key === 'search')   { conditions.push(`(title ILIKE $${idx++} OR description ILIKE $${idx++})`); params.push(`%${val}%`, `%${val}%`); idx++; }
    if (key === 'year')     { conditions.push(`release_year = $${idx++}`);        params.push(parseInt(val)); }
    if (key === 'rating')   { conditions.push(`rating = $${idx++}`);              params.push(val); }
  });

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    nextIdx: idx
  };
};

// ─────────────────────────────────────────────────────────────
// 1. GET /content
// Public — Get all published content with filters & pagination
// ─────────────────────────────────────────────────────────────
const getAllContent = async (req, res) => {
  const {
    page = 1, limit = 10,
    type, language, region, genre, is_free,
    search, year, rating,
    sort = 'newest'        // newest | oldest | title | price_low | price_high
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Non-admins only see published content
  const statusFilter = req.user?.role === 'admin' ? req.query.status : 'published';

  const sortMap = {
    newest:     'created_at DESC',
    oldest:     'created_at ASC',
    title:      'title ASC',
    price_low:  'price_tvod ASC',
    price_high: 'price_tvod DESC',
  };
  const orderBy = sortMap[sort] || 'created_at DESC';

  try {
    const { where, params, nextIdx } = buildWhere({
      status: statusFilter, type, language, region, genre, is_free, search, year, rating
    });

    const dataQuery = `
      SELECT
        id, title, type, description, language, region,
        genre, director, release_year, rating, status,
        poster_url, trailer_url, duration_seconds,
        is_free, price_tvod, tags, created_at, updated_at
      FROM content
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
    `;

    const countQuery = `SELECT COUNT(*) FROM content ${where}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [...params, parseInt(limit), offset]),
      pool.query(countQuery, params)
    ]);

    const total = parseInt(countResult.rows[0].count);

    return sendSuccess(res, {
      content: dataResult.rows,
      pagination: {
        page:        parseInt(page),
        limit:       parseInt(limit),
        total,
        total_pages: Math.ceil(total / parseInt(limit)),
        has_next:    parseInt(page) < Math.ceil(total / parseInt(limit)),
        has_prev:    parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error('getAllContent error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. GET /content/:id
// Public — Get single content by UUID
// ─────────────────────────────────────────────────────────────
const getContentById = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM episodes e WHERE e.content_id = c.id AND e.status = 'published') AS episode_count
      FROM content c
      WHERE c.id = $1
    `, [req.params.id]);

    if (!result.rows.length) return sendError(res, 'Content not found.', 404);

    // If song — also fetch songs_metadata
    const content = result.rows[0];
    if (content.type === 'song') {
      const meta = await pool.query('SELECT * FROM songs_metadata WHERE id = $1', [content.id]);
      content.song_meta = meta.rows[0] || null;
    }

    return sendSuccess(res, { content });
  } catch (err) {
    console.error('getContentById error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 3. POST /content
// Admin only — Create new content
// ─────────────────────────────────────────────────────────────
const createContent = async (req, res) => {
  const {
    title, type, description, language, region,
    genre, cast_ids, director, release_year, rating,
    poster_url, trailer_url, stream_url_hls, stream_url_dash,
    duration_seconds, is_free, price_tvod, imdb_id, tags,
    // Song-specific fields
    mood_tags, instruments, festival, album, lyrics_url,
    audio_url_hq, audio_url_lq, artist_ids
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO content (
        title, type, description, language, region,
        genre, cast_ids, director, release_year, rating,
        poster_url, trailer_url, stream_url_hls, stream_url_dash,
        duration_seconds, is_free, price_tvod, imdb_id, tags,
        status, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'draft',$20)
      RETURNING *
    `, [
      title, type, description, language, region,
      JSON.stringify(genre || []),
      JSON.stringify(cast_ids || []),
      director, release_year, rating,
      poster_url, trailer_url, stream_url_hls, stream_url_dash,
      duration_seconds,
      is_free || false,
      price_tvod || 0,
      imdb_id,
      JSON.stringify(tags || []),
      req.user.id
    ]);

    const content = result.rows[0];

    // If type = song, insert songs_metadata too
    if (type === 'song') {
      await client.query(`
        INSERT INTO songs_metadata (
          id, mood_tags, instruments, festival, album,
          lyrics_url, audio_url_hq, audio_url_lq, artist_ids
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        content.id,
        JSON.stringify(mood_tags || []),
        JSON.stringify(instruments || []),
        festival, album, lyrics_url, audio_url_hq, audio_url_lq,
        JSON.stringify(artist_ids || [])
      ]);
    }

    await client.query('COMMIT');
    return sendSuccess(res, { content }, 'Content created successfully.', 201);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createContent error:', err);
    return sendError(res, 'Internal server error.', 500);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// 4. PUT /content/:id
// Admin only — Update content fields or status
// ─────────────────────────────────────────────────────────────
const updateContent = async (req, res) => {
  const allowedFields = [
    'title', 'type', 'description', 'language', 'region',
    'genre', 'cast_ids', 'director', 'release_year', 'rating',
    'status', 'poster_url', 'trailer_url', 'stream_url_hls',
    'stream_url_dash', 'duration_seconds', 'is_free', 'price_tvod',
    'imdb_id', 'tags'
  ];
  const jsonFields = ['genre', 'cast_ids', 'tags'];

  try {
    const existing = await pool.query('SELECT id, type FROM content WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return sendError(res, 'Content not found.', 404);

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

    // Update songs_metadata if it's a song
    if (existing.rows[0].type === 'song') {
      const songFields = ['mood_tags','instruments','festival','album','lyrics_url','audio_url_hq','audio_url_lq','artist_ids'];
      const songJsonFields = ['mood_tags','instruments','artist_ids'];
      const songUpdates = [];
      const songValues = [];
      let sIdx = 1;
      songFields.forEach(f => {
        if (req.body[f] !== undefined) {
          songUpdates.push(`${f} = $${sIdx++}`);
          songValues.push(songJsonFields.includes(f) ? JSON.stringify(req.body[f]) : req.body[f]);
        }
      });
      if (songUpdates.length) {
        songValues.push(req.params.id);
        await pool.query(
          `UPDATE songs_metadata SET ${songUpdates.join(', ')}, updated_at = NOW() WHERE id = $${sIdx}`,
          songValues
        );
      }
    }

    return sendSuccess(res, { content: result.rows[0] }, 'Content updated successfully.');
  } catch (err) {
    console.error('updateContent error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 5. PATCH /content/:id/status
// Admin only — Publish, archive, or set to draft quickly
// ─────────────────────────────────────────────────────────────
const updateContentStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'processing', 'published', 'archived'];
  if (!validStatuses.includes(status)) {
    return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
  }
  try {
    const result = await pool.query(
      `UPDATE content SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, status`,
      [status, req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Content not found.', 404);
    return sendSuccess(res, { content: result.rows[0] }, `Content status updated to "${status}".`);
  } catch (err) {
    console.error('updateContentStatus error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 6. DELETE /content/:id
// Admin only — Soft delete (archive)
// ─────────────────────────────────────────────────────────────
const deleteContent = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE content SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND status != 'archived' RETURNING id, title`,
      [req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Content not found or already archived.', 404);
    return sendSuccess(res, { content: result.rows[0] }, 'Content archived successfully.');
  } catch (err) {
    console.error('deleteContent error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 7. GET /content/:id/episodes
// Public — Get all episodes for a show (optional season filter)
// ─────────────────────────────────────────────────────────────
const getEpisodes = async (req, res) => {
  const { season } = req.query;
  try {
    // Verify parent content exists
    const parent = await pool.query(
      `SELECT id, type FROM content WHERE id = $1 AND status = 'published'`,
      [req.params.id]
    );
    if (!parent.rows.length) return sendError(res, 'Content not found.', 404);
    if (!['show','short_film'].includes(parent.rows[0].type)) {
      return sendError(res, 'This content type does not have episodes.', 400);
    }

    let query = `SELECT * FROM episodes WHERE content_id = $1 AND status = 'published'`;
    const params = [req.params.id];
    if (season) { query += ` AND season = $2`; params.push(parseInt(season)); }
    query += ` ORDER BY season ASC, episode_number ASC`;

    const result = await pool.query(query, params);
    return sendSuccess(res, { episodes: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('getEpisodes error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 8. GET /content/:id/episodes/:episodeId
// Public — Get a single episode by ID
// ─────────────────────────────────────────────────────────────
const getEpisodeById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM episodes WHERE id = $1 AND content_id = $2`,
      [req.params.episodeId, req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Episode not found.', 404);
    return sendSuccess(res, { episode: result.rows[0] });
  } catch (err) {
    console.error('getEpisodeById error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 9. POST /content/:id/episodes
// Admin only — Add episode to a show
// ─────────────────────────────────────────────────────────────
const addEpisode = async (req, res) => {
  const {
    season, episode_number, title, description,
    duration_seconds, stream_url_hls, stream_url_dash,
    thumbnail_url, price_tvod, is_free
  } = req.body;
  try {
    // Verify parent show exists
    const parent = await pool.query('SELECT id, type FROM content WHERE id = $1', [req.params.id]);
    if (!parent.rows.length) return sendError(res, 'Content not found.', 404);
    if (!['show','short_film'].includes(parent.rows[0].type)) {
      return sendError(res, 'Episodes can only be added to shows or short films.', 400);
    }

    const result = await pool.query(`
      INSERT INTO episodes (
        content_id, season, episode_number, title, description,
        duration_seconds, stream_url_hls, stream_url_dash,
        thumbnail_url, price_tvod, is_free, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published')
      RETURNING *
    `, [
      req.params.id,
      season || 1,
      episode_number,
      title, description,
      duration_seconds,
      stream_url_hls, stream_url_dash,
      thumbnail_url,
      price_tvod || 0,
      is_free || false
    ]);
    return sendSuccess(res, { episode: result.rows[0] }, 'Episode added successfully.', 201);
  } catch (err) {
    if (err.code === '23505') return sendError(res, 'Episode number already exists for this season.', 409);
    console.error('addEpisode error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 10. PUT /content/:id/episodes/:episodeId
// Admin only — Update an episode
// ─────────────────────────────────────────────────────────────
const updateEpisode = async (req, res) => {
  const allowedFields = [
    'season','episode_number','title','description',
    'duration_seconds','stream_url_hls','stream_url_dash',
    'thumbnail_url','price_tvod','is_free','status'
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
    values.push(req.params.episodeId, req.params.id);

    const result = await pool.query(
      `UPDATE episodes SET ${updates.join(', ')}
       WHERE id = $${idx++} AND content_id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return sendError(res, 'Episode not found.', 404);
    return sendSuccess(res, { episode: result.rows[0] }, 'Episode updated.');
  } catch (err) {
    console.error('updateEpisode error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 11. DELETE /content/:id/episodes/:episodeId
// Admin only — Archive an episode
// ─────────────────────────────────────────────────────────────
const deleteEpisode = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE episodes SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND content_id = $2 RETURNING id, title`,
      [req.params.episodeId, req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Episode not found.', 404);
    return sendSuccess(res, {}, 'Episode archived.');
  } catch (err) {
    console.error('deleteEpisode error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 12. GET /content/stats
// Admin only — Content stats for dashboard
// ─────────────────────────────────────────────────────────────
const getContentStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'published')  AS total_published,
        COUNT(*) FILTER (WHERE status = 'draft')      AS total_draft,
        COUNT(*) FILTER (WHERE status = 'archived')   AS total_archived,
        COUNT(*) FILTER (WHERE type = 'movie')        AS total_movies,
        COUNT(*) FILTER (WHERE type = 'show')         AS total_shows,
        COUNT(*) FILTER (WHERE type = 'short_film')   AS total_short_films,
        COUNT(*) FILTER (WHERE type = 'song')         AS total_songs,
        COUNT(*) FILTER (WHERE type = 'news')         AS total_news,
        COUNT(*) FILTER (WHERE is_free = true)        AS total_free,
        COUNT(*) FILTER (WHERE is_free = false)       AS total_paid
      FROM content
    `);
    return sendSuccess(res, { stats: result.rows[0] });
  } catch (err) {
    console.error('getContentStats error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

module.exports = {
  getAllContent,
  getContentById,
  createContent,
  updateContent,
  updateContentStatus,
  deleteContent,
  getEpisodes,
  getEpisodeById,
  addEpisode,
  updateEpisode,
  deleteEpisode,
  getContentStats,
};
