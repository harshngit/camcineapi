const pool = require('../config/db');
const { sendSuccess } = require('../utils/response');

const listActivity = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT al.*, u.first_name || ' ' || u.last_name AS actor_name
       FROM activity_log al
       LEFT JOIN users u ON u.id = al.actor_id
       ORDER BY al.created_at DESC
       LIMIT 20`
    );
    return sendSuccess(res, { events: result.rows });
  } catch (err) { next(err); }
};

module.exports = { listActivity };
