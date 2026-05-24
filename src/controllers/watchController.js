const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { requireSelfOrRoles } = require('../utils/authz');

const getWatchlist = async (req, res, next) => {
  const { userId } = req.params;
  if (!requireSelfOrRoles(req, res, userId, ['admin', 'manager'])) return;
  try {
    const result = await pool.query(
      `SELECT w.content_id, w.created_at AS added_at, c.*
       FROM watchlist w
       JOIN content c ON c.id = w.content_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [userId]
    );
    return sendSuccess(res, { items: result.rows, watchlist: result.rows });
  } catch (err) { next(err); }
};

const addWatchlist = async (req, res, next) => {
  const { userId } = req.params;
  if (!requireSelfOrRoles(req, res, userId, ['admin'])) return;
  try {
    const result = await pool.query(
      `INSERT INTO watchlist (user_id, content_id)
       VALUES ($1,$2)
       ON CONFLICT (user_id, content_id) DO UPDATE SET created_at = watchlist.created_at
       RETURNING *`,
      [userId, req.body.content_id]
    );
    return sendSuccess(res, { item: result.rows[0] }, 'Added to watchlist.', 201);
  } catch (err) { next(err); }
};

const removeWatchlist = async (req, res, next) => {
  const { userId, contentId } = req.params;
  if (!requireSelfOrRoles(req, res, userId, ['admin'])) return;
  try {
    await pool.query('DELETE FROM watchlist WHERE user_id=$1 AND content_id=$2', [userId, contentId]);
    return sendSuccess(res, {}, 'Removed from watchlist.');
  } catch (err) { next(err); }
};

const getContinueWatching = async (req, res, next) => {
  const { userId } = req.params;
  if (!requireSelfOrRoles(req, res, userId, ['admin', 'manager'])) return;
  try {
    const result = await pool.query(
      `SELECT wp.content_id, wp.episode_id, c.title, c.type,
              wp.progress_seconds, COALESCE(e.duration_seconds, c.duration_seconds, 0) AS duration_seconds,
              CASE WHEN COALESCE(e.duration_seconds, c.duration_seconds, 0) > 0
                THEN ROUND((wp.progress_seconds::numeric / COALESCE(e.duration_seconds, c.duration_seconds)) * 100, 1)
                ELSE 0 END AS progress_percent,
              e.episode_number, e.season, COALESCE(e.thumbnail_url, c.thumbnail_url, c.poster_url) AS thumbnail_url,
              wp.updated_at AS last_watched_at
       FROM watch_progress wp
       JOIN content c ON c.id = wp.content_id
       LEFT JOIN episodes e ON e.id = wp.episode_id
       WHERE wp.user_id = $1
       ORDER BY wp.updated_at DESC
       LIMIT 20`,
      [userId]
    );
    return sendSuccess(res, { items: result.rows });
  } catch (err) { next(err); }
};

const saveProgress = async (req, res, next) => {
  const { userId } = req.params;
  if (!requireSelfOrRoles(req, res, userId, ['admin'])) return;
  const { content_id, episode_id = null, progress_seconds = 0 } = req.body;
  try {
    await pool.query(
      `INSERT INTO watch_progress (user_id, content_id, episode_id, progress_seconds, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (user_id, content_id, episode_id)
       DO UPDATE SET progress_seconds=$4, updated_at=NOW()`,
      [userId, content_id, episode_id, progress_seconds]
    );
    return sendSuccess(res, {}, 'Progress saved.');
  } catch (err) { next(err); }
};

module.exports = { getWatchlist, addWatchlist, removeWatchlist, getContinueWatching, saveProgress };
