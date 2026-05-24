const pool = require('../config/db');
const { sendSuccess } = require('../utils/response');

const getSettings = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT key, value FROM platform_settings ORDER BY key ASC');
    const data = result.rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    return sendSuccess(res, data);
  } catch (err) { next(err); }
};

const updateSettings = async (req, res, next) => {
  const entries = Object.entries(req.body || {});
  try {
    await Promise.all(entries.map(([key, value]) => pool.query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ($1,$2::jsonb,NOW())
       ON CONFLICT (key) DO UPDATE SET value=$2::jsonb, updated_at=NOW()`,
      [key, JSON.stringify(value)]
    )));
    return getSettings(req, res, next);
  } catch (err) { next(err); }
};

module.exports = { getSettings, updateSettings };
