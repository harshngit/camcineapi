const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const listNotifications = async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const [items, unread, total] = await Promise.all([
      pool.query(`SELECT * FROM notifications
        WHERE user_id=$1 OR target='all' OR target_role=$2
        ORDER BY created_at DESC LIMIT $3 OFFSET $4`, [req.user.id, req.user.role, parseInt(limit), offset]),
      pool.query(`SELECT COUNT(*) FROM notifications WHERE is_read=false AND (user_id=$1 OR target='all' OR target_role=$2)`, [req.user.id, req.user.role]),
      pool.query(`SELECT COUNT(*) FROM notifications WHERE user_id=$1 OR target='all' OR target_role=$2`, [req.user.id, req.user.role]),
    ]);
    return sendSuccess(res, {
      notifications: items.rows,
      unread_count: parseInt(unread.rows[0].count),
      pagination: { page: +page, total: parseInt(total.rows[0].count) },
    });
  } catch (err) { next(err); }
};

const markRead = async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true, read_at=NOW() WHERE id=$1 AND (user_id=$2 OR target=$3 OR target_role=$4)', [req.params.id, req.user.id, 'all', req.user.role]);
    return sendSuccess(res, {}, 'Notification marked read.');
  } catch (err) { next(err); }
};

const markAll = async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read=true, read_at=NOW() WHERE user_id=$1 OR target=$2 OR target_role=$3', [req.user.id, 'all', req.user.role]);
    return sendSuccess(res, {}, 'Notifications marked read.');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    return sendSuccess(res, {}, 'Notification deleted.');
  } catch (err) { next(err); }
};

const createNotification = async (req, res, next) => {
  const { type = 'system', title, body, target = 'user', target_role, user_id, action_url } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO notifications (type, title, body, target, target_role, user_id, action_url, actor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [type, title, body, target, target_role || null, user_id || null, action_url || null, req.user.id]
    );
    return sendSuccess(res, { notification: result.rows[0] }, 'Notification created.', 201);
  } catch (err) { next(err); }
};

module.exports = { listNotifications, markRead, markAll, remove, createNotification };
