const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { requireSelfOrRoles } = require('../utils/authz');

const earnings = async (req, res, next) => {
  const { managerId } = req.params;
  if (!requireSelfOrRoles(req, res, managerId, ['admin'])) return;
  try {
    const [summary, content, payouts] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount),0)::float AS total_earned,
        COALESCE(SUM(amount) FILTER (WHERE status='pending'),0)::float AS pending_payout,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('month', NOW())),0)::float AS this_month,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW())),0)::float AS last_month
        FROM manager_payouts WHERE manager_id=$1`, [managerId]),
      pool.query(`SELECT crs.content_id, c.title, crs.revenue_share, COUNT(vv.id)::int AS views
        FROM content_revenue_shares crs
        LEFT JOIN content c ON c.id = crs.content_id
        LEFT JOIN video_views vv ON vv.content_id = crs.content_id
        WHERE crs.manager_id=$1
        GROUP BY crs.content_id, c.title, crs.revenue_share
        ORDER BY views DESC`, [managerId]),
      pool.query('SELECT * FROM manager_payouts WHERE manager_id=$1 ORDER BY created_at DESC', [managerId]),
    ]);
    return sendSuccess(res, { ...summary.rows[0], content_performance: content.rows, payout_history: payouts.rows });
  } catch (err) { next(err); }
};

const contentEarnings = async (req, res, next) => {
  const { managerId } = req.params;
  if (!requireSelfOrRoles(req, res, managerId, ['admin'])) return;
  try {
    const result = await pool.query('SELECT * FROM content_revenue_shares WHERE manager_id=$1 ORDER BY created_at DESC', [managerId]);
    return sendSuccess(res, { items: result.rows });
  } catch (err) { next(err); }
};

const createPayout = async (req, res, next) => {
  const { managerId } = req.params;
  const { amount, status = 'pending', notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO manager_payouts (manager_id, amount, status, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [managerId, amount, status, notes || null]
    );
    return sendSuccess(res, { payout: result.rows[0] }, 'Payout created.', 201);
  } catch (err) { next(err); }
};

const updatePayout = async (req, res, next) => {
  try {
    const result = await pool.query('UPDATE manager_payouts SET status=$1, paid_at=CASE WHEN $1=$2 THEN NOW() ELSE paid_at END, updated_at=NOW() WHERE id=$3 RETURNING *', [req.body.status, 'paid', req.params.payoutId]);
    if (!result.rows.length) return sendError(res, 'Payout not found.', 404);
    return sendSuccess(res, { payout: result.rows[0] }, 'Payout updated.');
  } catch (err) { next(err); }
};

module.exports = { earnings, contentEarnings, createPayout, updatePayout };
