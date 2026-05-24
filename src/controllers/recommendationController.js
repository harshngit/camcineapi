const pool = require('../config/db');
const { sendSuccess } = require('../utils/response');
const { requireSelfOrRoles } = require('../utils/authz');

const mapRows = rows => rows;

const trending = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(vv.id)::int AS views
       FROM content c
       LEFT JOIN video_views vv ON vv.content_id = c.id AND vv.viewed_at >= NOW() - INTERVAL '7 days'
       WHERE c.status='published'
       GROUP BY c.id
       ORDER BY views DESC, c.created_at DESC
       LIMIT 20`
    );
    return sendSuccess(res, { items: mapRows(result.rows) });
  } catch (err) { next(err); }
};

const newReleases = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM content
       WHERE status='published'
       ORDER BY created_at DESC
       LIMIT 20`
    );
    return sendSuccess(res, { items: result.rows });
  } catch (err) { next(err); }
};

const personalized = async (req, res, next) => {
  const { userId } = req.params;
  if (!requireSelfOrRoles(req, res, userId, ['admin'])) return;
  try {
    const [because, trend, releases, free] = await Promise.all([
      pool.query(`SELECT DISTINCT c.* FROM watch_progress wp
        JOIN content watched ON watched.id = wp.content_id
        JOIN content c ON c.type = watched.type AND c.id <> watched.id
        WHERE wp.user_id=$1 AND c.status='published'
        ORDER BY c.created_at DESC LIMIT 20`, [userId]),
      pool.query(`SELECT c.* FROM content c LEFT JOIN video_views vv ON vv.content_id=c.id AND vv.viewed_at >= NOW() - INTERVAL '7 days'
        WHERE c.status='published' GROUP BY c.id ORDER BY COUNT(vv.id) DESC LIMIT 20`),
      pool.query(`SELECT * FROM content WHERE status='published' ORDER BY created_at DESC LIMIT 20`),
      pool.query(`SELECT * FROM content WHERE status='published' AND is_free=true ORDER BY created_at DESC LIMIT 20`),
    ]);
    return sendSuccess(res, {
      because_you_watched: because.rows,
      trending_now: trend.rows,
      new_releases: releases.rows,
      free_to_watch: free.rows,
    });
  } catch (err) { next(err); }
};

module.exports = { trending, newReleases, personalized };
