const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const listRatings = async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const [reviews, summary, breakdown] = await Promise.all([
      pool.query(`SELECT r.*, u.first_name || ' ' || u.last_name AS user_name
       FROM ratings r LEFT JOIN users u ON u.id = r.user_id
       WHERE r.content_id=$1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
      [req.params.id, parseInt(limit), offset]),
      pool.query('SELECT COALESCE(ROUND(AVG(rating)::numeric,1),0) AS average_rating, COUNT(*)::int AS total_ratings FROM ratings WHERE content_id=$1', [req.params.id]),
      pool.query('SELECT rating, COUNT(*)::int AS count FROM ratings WHERE content_id=$1 GROUP BY rating', [req.params.id]),
    ]);
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    breakdown.rows.forEach(row => { counts[row.rating] = row.count; });
    return sendSuccess(res, {
      ...summary.rows[0],
      breakdown: counts,
      reviews: reviews.rows,
      pagination: { page: +page, limit: +limit, total: summary.rows[0].total_ratings },
    });
  } catch (err) { next(err); }
};

const createRating = async (req, res, next) => {
  try {
    const result = await pool.query(
      `INSERT INTO ratings (content_id, user_id, rating, review)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (content_id, user_id)
       DO UPDATE SET rating=$3, review=$4, updated_at=NOW()
       RETURNING id`,
      [req.params.id, req.user.id, req.body.rating, req.body.review || null]
    );
    const summary = await pool.query('SELECT ROUND(AVG(rating)::numeric,1) AS average_rating, COUNT(*)::int AS total_ratings FROM ratings WHERE content_id=$1', [req.params.id]);
    return sendSuccess(res, { id: result.rows[0].id, ...summary.rows[0] }, 'Rating saved.', 201);
  } catch (err) { next(err); }
};

const updateRating = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE ratings SET rating=$1, review=$2, updated_at=NOW()
       WHERE id=$3 AND content_id=$4 AND user_id=$5 RETURNING *`,
      [req.body.rating, req.body.review || null, req.params.ratingId, req.params.id, req.user.id]
    );
    if (!result.rows.length) return sendError(res, 'Rating not found.', 404);
    return sendSuccess(res, { rating: result.rows[0] }, 'Rating updated.');
  } catch (err) { next(err); }
};

const deleteRating = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM ratings WHERE id=$1 AND content_id=$2', [req.params.ratingId, req.params.id]);
    return sendSuccess(res, {}, 'Rating removed.');
  } catch (err) { next(err); }
};

module.exports = { listRatings, createRating, updateRating, deleteRating };
