const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { requireSelfOrRoles } = require('../utils/authz');

const getPlans = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM subscription_plans
       WHERE is_active = true
       ORDER BY sort_order ASC, price_monthly ASC`
    );
    return sendSuccess(res, { plans: result.rows });
  } catch (err) { next(err); }
};

const createPlan = async (req, res, next) => {
  const {
    name, slug, price_monthly = 0, price_yearly = 0, currency = 'INR',
    max_devices = 1, max_streams = 1, resolution = 'HD',
    has_downloads = false, has_early_access = false, features = [], sort_order = 99,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO subscription_plans
       (name, slug, price_monthly, price_yearly, currency, max_devices, max_streams,
        resolution, has_downloads, has_early_access, features, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
       RETURNING *`,
      [name, slug, price_monthly, price_yearly, currency, max_devices, max_streams,
        resolution, has_downloads, has_early_access, JSON.stringify(features), sort_order]
    );
    return sendSuccess(res, { plan: result.rows[0] }, 'Plan created.', 201);
  } catch (err) { next(err); }
};

const updatePlan = async (req, res, next) => {
  const fields = [];
  const params = [];
  Object.entries(req.body).forEach(([key, value]) => {
    const allowed = ['name', 'slug', 'price_monthly', 'price_yearly', 'currency', 'max_devices', 'max_streams', 'resolution', 'has_downloads', 'has_early_access', 'features', 'sort_order', 'is_active'];
    if (!allowed.includes(key) || value === undefined) return;
    params.push(key === 'features' ? JSON.stringify(value) : value);
    fields.push(`${key} = $${params.length}${key === 'features' ? '::jsonb' : ''}`);
  });
  if (!fields.length) return sendError(res, 'No fields to update.', 400);
  params.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE subscription_plans SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows.length) return sendError(res, 'Plan not found.', 404);
    return sendSuccess(res, { plan: result.rows[0] }, 'Plan updated.');
  } catch (err) { next(err); }
};

const deactivatePlan = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE subscription_plans SET is_active = false, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Plan not found.', 404);
    return sendSuccess(res, { plan: result.rows[0] }, 'Plan deactivated.');
  } catch (err) { next(err); }
};

const getAllSubscriptions = async (req, res, next) => {
  const { page = 1, limit = 20, status, plan_id } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const where = [];
  if (status) { params.push(status); where.push(`us.status = $${params.length}`); }
  if (plan_id) { params.push(plan_id); where.push(`us.plan_id = $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const result = await pool.query(
      `SELECT us.*, u.first_name || ' ' || u.last_name AS user_name, u.email AS user_email,
              sp.name AS plan_name
       FROM user_subscriptions us
       LEFT JOIN users u ON u.id = us.user_id
       LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
       ${clause}
       ORDER BY us.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM user_subscriptions us ${clause}`, params);
    const total = parseInt(count.rows[0].count);
    return sendSuccess(res, {
      subscriptions: result.rows,
      pagination: { page: +page, limit: +limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
};

const getStats = async (req, res, next) => {
  try {
    const [summary, breakdown, month] = await Promise.all([
      pool.query(`SELECT
        COALESCE(SUM(CASE WHEN us.status='active' AND us.billing_cycle='monthly' THEN us.price_paid ELSE 0 END),0) +
        COALESCE(SUM(CASE WHEN us.status='active' AND us.billing_cycle='yearly' THEN us.price_paid / 12 ELSE 0 END),0) AS mrr,
        COUNT(*) FILTER (WHERE us.status='active') AS active_count,
        COUNT(*) FILTER (WHERE us.status='cancelled') AS cancelled_count,
        COUNT(*) FILTER (WHERE us.status='paused') AS paused_count,
        COUNT(*) FILTER (WHERE us.auto_renew = true) AS auto_renew_count
       FROM user_subscriptions us`),
      pool.query(`SELECT sp.name AS plan_name, COUNT(us.id)::int AS count, COALESCE(SUM(us.price_paid),0)::float AS revenue
       FROM subscription_plans sp
       LEFT JOIN user_subscriptions us ON us.plan_id = sp.id AND us.status = 'active'
       GROUP BY sp.id, sp.name ORDER BY sp.sort_order ASC`),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS new_this_month,
        COUNT(*) FILTER (WHERE status='cancelled' AND updated_at >= date_trunc('month', NOW())) AS churned_this_month
       FROM user_subscriptions`),
    ]);
    const mrr = Number(summary.rows[0].mrr || 0);
    return sendSuccess(res, {
      mrr,
      arr: mrr * 12,
      active_count: Number(summary.rows[0].active_count || 0),
      cancelled_count: Number(summary.rows[0].cancelled_count || 0),
      paused_count: Number(summary.rows[0].paused_count || 0),
      auto_renew_count: Number(summary.rows[0].auto_renew_count || 0),
      plan_breakdown: breakdown.rows,
      new_this_month: Number(month.rows[0].new_this_month || 0),
      churned_this_month: Number(month.rows[0].churned_this_month || 0),
    });
  } catch (err) { next(err); }
};

const subscribe = async (req, res, next) => {
  const { userId } = req.params;
  if (!requireSelfOrRoles(req, res, userId, ['admin'])) return;
  const { plan_id, billing_cycle = 'monthly', payment_method_id } = req.body;
  try {
    const planResult = await pool.query('SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true', [plan_id]);
    if (!planResult.rows.length) return sendError(res, 'Plan not found.', 404);
    const plan = planResult.rows[0];
    const price = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
    const expiresInterval = billing_cycle === 'yearly' ? '1 year' : '1 month';
    await pool.query(`UPDATE user_subscriptions SET status='cancelled', auto_renew=false, updated_at=NOW()
      WHERE user_id=$1 AND status IN ('active','paused')`, [userId]);
    const result = await pool.query(
      `INSERT INTO user_subscriptions
       (user_id, plan_id, status, price_paid, currency, billing_cycle, started_at, expires_at, auto_renew, payment_method_id)
       VALUES ($1,$2,'active',$3,$4,$5,NOW(),NOW() + $6::interval,true,$7)
       RETURNING *`,
      [userId, plan_id, price, plan.currency || 'INR', billing_cycle, expiresInterval, payment_method_id || null]
    );
    return sendSuccess(res, { subscription: result.rows[0] }, 'Subscription activated.', 201);
  } catch (err) { next(err); }
};

const getUserSubscription = async (req, res, next) => {
  const { userId } = req.params;
  if (!requireSelfOrRoles(req, res, userId, ['admin', 'manager'])) return;
  try {
    const result = await pool.query(
      `SELECT us.*, sp.name AS plan_name, sp.features
       FROM user_subscriptions us
       LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = $1
       ORDER BY us.created_at DESC LIMIT 1`,
      [userId]
    );
    return sendSuccess(res, { subscription: result.rows[0] || null });
  } catch (err) { next(err); }
};

const setSubscriptionStatus = (status, message) => async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE user_subscriptions SET status=$1, auto_renew=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [status, status === 'active', req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Subscription not found.', 404);
    if (!requireSelfOrRoles(req, res, result.rows[0].user_id, ['admin'])) return;
    return sendSuccess(res, { subscription: result.rows[0] }, message);
  } catch (err) { next(err); }
};

module.exports = {
  getPlans, createPlan, updatePlan, deactivatePlan, getAllSubscriptions, getStats,
  subscribe, getUserSubscription,
  cancelSubscription: setSubscriptionStatus('cancelled', 'Subscription cancelled.'),
  pauseSubscription: setSubscriptionStatus('paused', 'Subscription paused.'),
  resumeSubscription: setSubscriptionStatus('active', 'Subscription resumed.'),
};
