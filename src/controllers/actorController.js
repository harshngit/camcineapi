const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const listActors = async (req, res, next) => {
  const { page = 1, limit = 20, search, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const where = [];
  if (search) { params.push(`%${search}%`); where.push(`(a.name ILIKE $${params.length} OR a.screen_name ILIKE $${params.length})`); }
  if (status === 'pending') where.push('a.is_verified = false');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const result = await pool.query(
      `SELECT a.*, COUNT(cc.content_id)::int AS content_count
       FROM actors a LEFT JOIN content_cast cc ON cc.actor_id = a.id
       ${clause}
       GROUP BY a.id
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM actors a ${clause}`, params);
    return sendSuccess(res, { actors: result.rows, pagination: { total: parseInt(count.rows[0].count) } });
  } catch (err) { next(err); }
};

const getActor = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM actors WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return sendError(res, 'Actor not found.', 404);
    return sendSuccess(res, { actor: result.rows[0] });
  } catch (err) { next(err); }
};

const createActor = async (req, res, next) => {
  const { name, screen_name, headshot_url, bio, date_of_birth, gender, is_verified = false } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO actors (name, screen_name, headshot_url, bio, date_of_birth, gender, is_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, screen_name || null, headshot_url || null, bio || null, date_of_birth || null, gender || null, is_verified]
    );
    return sendSuccess(res, { actor: result.rows[0] }, 'Actor created.', 201);
  } catch (err) { next(err); }
};

const updateActor = async (req, res, next) => {
  const fields = [];
  const params = [];
  ['name', 'screen_name', 'headshot_url', 'bio', 'date_of_birth', 'gender', 'is_verified'].forEach(key => {
    if (req.body[key] === undefined) return;
    params.push(req.body[key]);
    fields.push(`${key}=$${params.length}`);
  });
  if (!fields.length) return sendError(res, 'No fields to update.', 400);
  params.push(req.params.id);
  try {
    const result = await pool.query(`UPDATE actors SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${params.length} RETURNING *`, params);
    if (!result.rows.length) return sendError(res, 'Actor not found.', 404);
    return sendSuccess(res, { actor: result.rows[0] }, 'Actor updated.');
  } catch (err) { next(err); }
};

const filmography = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.type, c.release_year AS year, c.poster_url, c.thumbnail_url, cc.role_type
       FROM content_cast cc JOIN content c ON c.id = cc.content_id
       WHERE cc.actor_id=$1 AND c.status='published'
       ORDER BY c.release_year DESC NULLS LAST, c.created_at DESC`,
      [req.params.id]
    );
    return sendSuccess(res, {
      movies: result.rows.filter(i => i.type === 'movie'),
      shows: result.rows.filter(i => i.type === 'show'),
      songs: result.rows.filter(i => i.type === 'song'),
    });
  } catch (err) { next(err); }
};

module.exports = { listActors, getActor, createActor, updateActor, filmography };
