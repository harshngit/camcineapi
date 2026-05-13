// ============================================================
// viewTrackingController.js — Camcine OTT View Tracking & Points
// Handles: Video view tracking, point allocation with daily limits
// ============================================================

const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const POINTS_PER_VIEW = 1;
const MAX_DAILY_VIEW_POINTS = 3;

const recordView = async (req, res) => {
  const { user_id, content_id, episode_id, idempotency_key } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent') || 'unknown';

  if (!user_id || !content_id) {
    return sendError(res, 'user_id and content_id are required.', 400);
  }

  if (!idempotency_key) {
    return sendError(res, 'idempotency_key is required to prevent duplicate points.', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify user exists
    const userResult = await client.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [user_id]
    );
    if (!userResult.rows.length) {
      await client.query('ROLLBACK');
      return sendError(res, 'User not found.', 404);
    }
    if (!userResult.rows[0].is_active) {
      await client.query('ROLLBACK');
      return sendError(res, 'User account is inactive.', 403);
    }

    // 2. Verify content exists and is a video type
    const contentResult = await client.query(
      'SELECT id, type, title FROM content WHERE id = $1 AND type IN ($2, $3)',
      [content_id, 'movie', 'show']
    );
    if (!contentResult.rows.length) {
      await client.query('ROLLBACK');
      return sendError(res, 'Content not found or is not a video type.', 404);
    }

    // 3. If episode_id provided, verify episode exists
    if (episode_id) {
      const episodeResult = await client.query(
        'SELECT id FROM episodes WHERE id = $1 AND content_id = $2',
        [episode_id, content_id]
      );
      if (!episodeResult.rows.length) {
        await client.query('ROLLBACK');
        return sendError(res, 'Episode not found or does not belong to the specified content.', 404);
      }
    }

    // 4. Check for duplicate view within 24 hours using idempotency_key
    const existingView = await client.query(
      `SELECT id, points_awarded FROM video_views
       WHERE user_id = $1 AND content_id = $2 AND idempotency_key = $3
       AND viewed_at > NOW() - INTERVAL '24 hours'`,
      [user_id, content_id, idempotency_key]
    );
    if (existingView.rows.length > 0) {
      await client.query('ROLLBACK');
      return sendSuccess(res, {
        message: 'View already recorded within the last 24 hours.',
        view_id: existingView.rows[0].id,
        points_awarded: existingView.rows[0].points_awarded,
        duplicate: true,
      }, 'Duplicate view detected. Points not awarded again.', 200);
    }

    // 5. Check daily point limit
    const today = new Date().toISOString().split('T')[0];
    const dailyViewResult = await client.query(
      `SELECT view_count, points_earned FROM user_daily_views
       WHERE user_id = $1 AND view_date = $2`,
      [user_id, today]
    );

    const currentDailyPoints = dailyViewResult.rows.length > 0
      ? dailyViewResult.rows[0].points_earned
      : 0;

    if (currentDailyPoints >= MAX_DAILY_VIEW_POINTS) {
      // Still record the view but don't award points
      await client.query(
        `INSERT INTO video_views (user_id, content_id, episode_id, points_awarded, idempotency_key, client_ip, user_agent)
         VALUES ($1, $2, $3, 0, $4, $5, $6)`,
        [user_id, content_id, episode_id || null, idempotency_key, clientIp, userAgent]
      );
      await client.query('COMMIT');
      console.log(`[VIEW_TRACKING] User ${user_id} reached daily limit. View recorded without points.`);
      return sendSuccess(res, {
        message: `Daily point limit of ${MAX_DAILY_VIEW_POINTS} reached. No points awarded.`,
        points_awarded: 0,
        daily_limit_reached: true,
      }, 'View recorded but daily point limit reached.', 200);
    }

    // 6. Calculate points to award (respecting daily limit)
    const pointsToAward = Math.min(POINTS_PER_VIEW, MAX_DAILY_VIEW_POINTS - currentDailyPoints);

    // 7. Insert video view record
    const viewResult = await client.query(
      `INSERT INTO video_views (user_id, content_id, episode_id, points_awarded, idempotency_key, client_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, viewed_at`,
      [user_id, content_id, episode_id || null, pointsToAward, idempotency_key, clientIp, userAgent]
    );

    // 8. Update or insert daily view record
    await client.query(
      `INSERT INTO user_daily_views (user_id, view_date, view_count, points_earned, last_viewed_at)
       VALUES ($1, $2, 1, $3, NOW())
       ON CONFLICT (user_id, view_date) DO UPDATE SET
         view_count = user_daily_views.view_count + 1,
         points_earned = user_daily_views.points_earned + $3,
         last_viewed_at = NOW()`,
      [user_id, today, pointsToAward]
    );

    // 9. Get or create user balance
    let balanceResult = await client.query(
      'SELECT current_balance FROM user_point_balances WHERE user_id = $1',
      [user_id]
    );

    let newBalance;
    if (balanceResult.rows.length === 0) {
      // Create new balance record
      newBalance = pointsToAward;
      await client.query(
        `INSERT INTO user_point_balances (user_id, current_balance, lifetime_earned, lifetime_spent)
         VALUES ($1, $2, $2, 0)`,
        [user_id, newBalance]
      );
    } else {
      newBalance = balanceResult.rows[0].current_balance + pointsToAward;
      await client.query(
        `UPDATE user_point_balances SET
           current_balance = $1,
           lifetime_earned = lifetime_earned + $2,
           updated_at = NOW()
         WHERE user_id = $3`,
        [newBalance, pointsToAward, user_id]
      );
    }

    // 10. Record point transaction
    await client.query(
      `INSERT INTO point_transactions (
         user_id, content_id, transaction_type, points, balance_after,
         description, reference_id, idempotency_key
       ) VALUES ($1, $2, 'viewer', $3, $4, $5, $6, $7)`,
      [
        user_id,
        content_id,
        pointsToAward,
        newBalance,
        `Points earned for viewing: ${contentResult.rows[0].title}`,
        viewResult.rows[0].id,
        idempotency_key,
      ]
    );

    await client.query('COMMIT');

    console.log(`[VIEW_TRACKING] User ${user_id} earned ${pointsToAward} point(s) for viewing content ${content_id}. Balance: ${newBalance}`);

    return sendSuccess(res, {
      view_id: viewResult.rows[0].id,
      user_id,
      content_id,
      episode_id: episode_id || null,
      points_awarded: pointsToAward,
      current_balance: newBalance,
      daily_points_remaining: MAX_DAILY_VIEW_POINTS - (currentDailyPoints + pointsToAward),
    }, 'View recorded and points awarded successfully.', 201);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[VIEW_TRACKING] Error recording view:', err);

    if (err.code === '23505') { // Unique violation (duplicate idempotency key)
      return sendError(res, 'This view has already been processed.', 409);
    }

    return sendError(res, 'Failed to record view: ' + err.message, 500);
  } finally {
    client.release();
  }
};

const getUserPoints = async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return sendError(res, 'user_id is required.', 400);
  }

  try {
    const balanceResult = await pool.query(
      `SELECT current_balance, lifetime_earned, lifetime_spent, updated_at
       FROM user_point_balances WHERE user_id = $1`,
      [user_id]
    );

    const dailyResult = await pool.query(
      `SELECT view_date, view_count, points_earned
       FROM user_daily_views
       WHERE user_id = $1 AND view_date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY view_date DESC`,
      [user_id]
    );

    if (!balanceResult.rows.length) {
      return sendSuccess(res, {
        user_id,
        current_balance: 0,
        lifetime_earned: 0,
        lifetime_spent: 0,
        daily_views_last_7_days: dailyResult.rows,
        daily_limit: MAX_DAILY_VIEW_POINTS,
        points_per_view: POINTS_PER_VIEW,
      });
    }

    return sendSuccess(res, {
      user_id,
      current_balance: balanceResult.rows[0].current_balance,
      lifetime_earned: balanceResult.rows[0].lifetime_earned,
      lifetime_spent: balanceResult.rows[0].lifetime_spent,
      last_updated: balanceResult.rows[0].updated_at,
      daily_views_last_7_days: dailyResult.rows,
      daily_limit: MAX_DAILY_VIEW_POINTS,
      points_per_view: POINTS_PER_VIEW,
    });
  } catch (err) {
    console.error('[VIEW_TRACKING] Error fetching user points:', err);
    return sendError(res, 'Failed to fetch user points.', 500);
  }
};

const getViewHistory = async (req, res) => {
  const { user_id } = req.params;
  const { page = 1, limit = 20, start_date, end_date } = req.query;

  if (!user_id) {
    return sendError(res, 'user_id is required.', 400);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let dateFilter = '';
  const params = [user_id];
  let paramIndex = 2;

  if (start_date) {
    dateFilter += ` AND vv.viewed_at >= $${paramIndex++}`;
    params.push(start_date);
  }
  if (end_date) {
    dateFilter += ` AND vv.viewed_at <= $${paramIndex++}`;
    params.push(end_date);
  }

  try {
    const result = await pool.query(
      `SELECT
         vv.id,
         vv.content_id,
         c.title as content_title,
         c.type as content_type,
         vv.episode_id,
         vv.viewed_at,
         vv.points_awarded,
         pt.balance_after
       FROM video_views vv
       LEFT JOIN content c ON c.id = vv.content_id
       LEFT JOIN point_transactions pt ON pt.reference_id = vv.id AND pt.transaction_type = 'viewer'
       WHERE vv.user_id = $1 ${dateFilter}
       ORDER BY vv.viewed_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, parseInt(limit), offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM video_views vv WHERE vv.user_id = $1 ${dateFilter}`,
      params
    );

    return sendSuccess(res, {
      views: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
      },
    });
  } catch (err) {
    console.error('[VIEW_TRACKING] Error fetching view history:', err);
    return sendError(res, 'Failed to fetch view history.', 500);
  }
};

const getContentViewStats = async (req, res) => {
  const { content_id } = req.params;

  if (!content_id) {
    return sendError(res, 'content_id is required.', 400);
  }

  try {
    const totalViewsResult = await pool.query(
      `SELECT COUNT(*) as total_views, COALESCE(SUM(points_awarded), 0) as total_points_awarded
       FROM video_views WHERE content_id = $1`,
      [content_id]
    );

    const uniqueViewersResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as unique_viewers
       FROM video_views WHERE content_id = $1`,
      [content_id]
    );

    const todayViewsResult = await pool.query(
      `SELECT COUNT(*) as today_views
       FROM video_views
       WHERE content_id = $1 AND DATE(viewed_at) = CURRENT_DATE`,
      [content_id]
    );

    return sendSuccess(res, {
      content_id,
      total_views: parseInt(totalViewsResult.rows[0].total_views),
      total_points_awarded: parseInt(totalViewsResult.rows[0].total_points_awarded),
      unique_viewers: parseInt(uniqueViewersResult.rows[0].unique_viewers),
      today_views: parseInt(todayViewsResult.rows[0].today_views),
    });
  } catch (err) {
    console.error('[VIEW_TRACKING] Error fetching content stats:', err);
    return sendError(res, 'Failed to fetch content statistics.', 500);
  }
};

module.exports = {
  recordView,
  getUserPoints,
  getViewHistory,
  getContentViewStats,
};
