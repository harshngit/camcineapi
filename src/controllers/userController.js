const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

// ── Get All Users ─────────────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (role) { params.push(role); conditions.push(`role = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, phone_number, role, age,
              language_preferences, regions, is_active, created_at, last_login
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await pool.query(`SELECT COUNT(*) FROM users ${where}`, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    return sendSuccess(res, {
      users: result.rows,
      pagination: { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) },
    }, 'Users fetched successfully.');
  } catch (err) {
    console.error('Get all users error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ── Get User By ID ────────────────────────────────────────────────────────────
const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, phone_number, role, age,
              language_preferences, regions, is_active, created_at, last_login
       FROM users WHERE id = $1`,
      [id]
    );
    if (!result.rows.length) return sendError(res, 'User not found.', 404);
    return sendSuccess(res, { user: result.rows[0] }, 'User fetched successfully.');
  } catch (err) {
    console.error('Get user by id error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ── Update User ───────────────────────────────────────────────────────────────
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, phone_number, age, language_preferences, regions, role } = req.body;

  // Non-admins can only edit themselves
  if (req.user.role !== 'admin' && req.user.id !== id) {
    return sendError(res, 'Forbidden.', 403);
  }

  try {
    const fields = [];
    const params = [];

    if (first_name !== undefined) { params.push(first_name); fields.push(`first_name = $${params.length}`); }
    if (last_name !== undefined) { params.push(last_name); fields.push(`last_name = $${params.length}`); }
    if (phone_number !== undefined) { params.push(phone_number); fields.push(`phone_number = $${params.length}`); }
    if (age !== undefined) { params.push(age); fields.push(`age = $${params.length}`); }
    if (language_preferences !== undefined) { params.push(JSON.stringify(language_preferences)); fields.push(`language_preferences = $${params.length}`); }
    if (regions !== undefined) { params.push(JSON.stringify(regions)); fields.push(`regions = $${params.length}`); }
    // Only admin can change role
    if (role !== undefined && req.user.role === 'admin') { params.push(role); fields.push(`role = $${params.length}`); }

    if (!fields.length) return sendError(res, 'No fields to update.', 400);

    params.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING id, email, first_name, last_name, phone_number, role, age, language_preferences, regions, is_active, updated_at`,
      params
    );

    if (!result.rows.length) return sendError(res, 'User not found.', 404);
    return sendSuccess(res, { user: result.rows[0] }, 'User updated successfully.');
  } catch (err) {
    console.error('Update user error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ── Delete User ───────────────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows.length) return sendError(res, 'User not found.', 404);
    return sendSuccess(res, {}, 'User deactivated successfully.');
  } catch (err) {
    console.error('Delete user error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

module.exports = { getAllUsers, getUserById, updateUser, deleteUser };
