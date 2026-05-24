const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const listPayments = async (req, res, next) => {
  const { page = 1, limit = 20, status, user_id, start_date, end_date } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const where = [];
  if (status) { params.push(status); where.push(`p.status = $${params.length}`); }
  if (user_id) { params.push(user_id); where.push(`p.user_id = $${params.length}`); }
  if (start_date) { params.push(start_date); where.push(`p.created_at >= $${params.length}`); }
  if (end_date) { params.push(end_date); where.push(`p.created_at <= $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const result = await pool.query(
      `SELECT p.*, u.first_name || ' ' || u.last_name AS user_name, u.email AS user_email,
              sp.name AS plan_name
       FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN subscription_plans sp ON sp.id = p.plan_id
       ${clause}
       ORDER BY p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM payments p ${clause}`, params);
    return sendSuccess(res, {
      transactions: result.rows,
      pagination: { page: +page, limit: +limit, total: parseInt(count.rows[0].count) },
    });
  } catch (err) { next(err); }
};

const getPaymentStats = async (req, res, next) => {
  try {
    const [summary, trend] = await Promise.all([
      pool.query(`SELECT
        COALESCE(SUM(amount) FILTER (WHERE status='completed'),0) AS total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE status='completed' AND created_at::date = CURRENT_DATE),0) AS revenue_today,
        COALESCE(SUM(amount) FILTER (WHERE status='completed' AND created_at >= date_trunc('month', NOW())),0) AS revenue_this_month,
        COALESCE(SUM(amount) FILTER (WHERE status='completed' AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW())),0) AS revenue_last_month,
        COUNT(*) FILTER (WHERE status='completed') AS completed_count,
        COUNT(*) FILTER (WHERE status='failed') AS failed_count,
        COUNT(*) FILTER (WHERE status='refunded') AS refunded_count,
        COUNT(*) FILTER (WHERE status='pending') AS pending_count
       FROM payments`),
      pool.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(amount) FILTER (WHERE status='completed'),0)::float AS revenue,
        COUNT(*)::int AS count
       FROM payments
       WHERE created_at >= NOW() - INTERVAL '12 months'
       GROUP BY date_trunc('month', created_at)
       ORDER BY month ASC`),
    ]);
    return sendSuccess(res, { ...summary.rows[0], monthly_trend: trend.rows });
  } catch (err) { next(err); }
};

const getPaymentById = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return sendError(res, 'Payment not found.', 404);
    return sendSuccess(res, { transaction: result.rows[0] });
  } catch (err) { next(err); }
};

const refundPayment = async (req, res, next) => {
  const { reason = 'customer_request', amount } = req.body;
  try {
    const result = await pool.query(
      `UPDATE payments
       SET status='refunded', refund_reason=$1, refunded_amount=COALESCE($2, amount), refunded_at=NOW(), updated_at=NOW()
       WHERE id=$3 AND status='completed'
       RETURNING id, status`,
      [reason, amount || null, req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Completed payment not found.', 404);
    return sendSuccess(res, { refund_id: `ref_${result.rows[0].id}`, status: 'processed' }, 'Refund processed.');
  } catch (err) { next(err); }
};

const exportPayments = async (req, res, next) => {
  req.query.limit = req.query.limit || 10000;
  return listPayments(req, res, next);
};

module.exports = { listPayments, getPaymentStats, getPaymentById, refundPayment, exportPayments };
