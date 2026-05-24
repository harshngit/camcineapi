const pool = require('../config/db');
const { sendSuccess } = require('../utils/response');

const periodToInterval = (period = '30d') => ({
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '1y': '1 year',
}[period] || '30 days');

const getOverview = async (req, res, next) => {
  const period = req.query.period || '30d';
  const interval = periodToInterval(period);
  try {
    const [summary, top, breakdown, views, revenue, users] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*) FROM video_views WHERE viewed_at >= NOW() - $1::interval)::int AS total_views,
        (SELECT COUNT(DISTINCT user_id) FROM video_views WHERE viewed_at >= NOW() - $1::interval)::int AS unique_viewers,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='completed' AND created_at >= NOW() - $1::interval)::float AS total_revenue,
        (SELECT COUNT(*) FROM users WHERE is_active=true)::int AS active_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - $1::interval)::int AS new_users,
        (SELECT COUNT(*) FROM content)::int AS total_titles,
        (SELECT COUNT(*) FROM content WHERE status='published')::int AS published_titles,
        (SELECT COALESCE(SUM(points_awarded),0) FROM video_views WHERE viewed_at >= NOW() - $1::interval)::int AS total_points_awarded`, [interval]),
      pool.query(`SELECT c.id, c.title, c.type, c.thumbnail_url, COUNT(vv.id)::int AS views,
        COUNT(DISTINCT vv.user_id)::int AS unique_viewers, COALESCE(SUM(vv.points_awarded),0)::int AS points_awarded
       FROM video_views vv
       JOIN content c ON c.id = vv.content_id
       WHERE vv.viewed_at >= NOW() - $1::interval
       GROUP BY c.id
       ORDER BY views DESC LIMIT 10`, [interval]),
      pool.query(`SELECT c.type, COUNT(DISTINCT c.id)::int AS count, COUNT(vv.id)::int AS views
       FROM content c
       LEFT JOIN video_views vv ON vv.content_id = c.id AND vv.viewed_at >= NOW() - $1::interval
       GROUP BY c.type ORDER BY c.type`, [interval]),
      pool.query(`SELECT viewed_at::date AS date, COUNT(*)::int AS views, COUNT(DISTINCT user_id)::int AS unique_viewers
       FROM video_views WHERE viewed_at >= NOW() - $1::interval
       GROUP BY viewed_at::date ORDER BY date ASC`, [interval]),
      pool.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(amount),0)::float AS revenue
       FROM payments WHERE status='completed' AND created_at >= NOW() - $1::interval
       GROUP BY date_trunc('month', created_at) ORDER BY month ASC`, [interval]),
      pool.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
        COUNT(*)::int AS new_users,
        SUM(COUNT(*)) OVER (ORDER BY date_trunc('month', created_at))::int AS total_users
       FROM users WHERE created_at >= NOW() - $1::interval
       GROUP BY date_trunc('month', created_at) ORDER BY month ASC`, [interval]),
    ]);
    return sendSuccess(res, {
      period,
      summary: summary.rows[0],
      top_content: top.rows,
      content_type_breakdown: breakdown.rows,
      views_trend: views.rows,
      revenue_trend: revenue.rows,
      user_growth: users.rows,
    });
  } catch (err) { next(err); }
};

const getContentAnalytics = async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT c.id, c.title, c.type, COUNT(vv.id)::int AS views,
      COUNT(DISTINCT vv.user_id)::int AS unique_viewers, COALESCE(SUM(vv.points_awarded),0)::int AS points_awarded
      FROM content c LEFT JOIN video_views vv ON vv.content_id = c.id
      WHERE c.id = $1 GROUP BY c.id`, [req.params.id]);
    return sendSuccess(res, { analytics: result.rows[0] || null });
  } catch (err) { next(err); }
};

module.exports = { getOverview, getContentAnalytics };
