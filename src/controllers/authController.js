const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');

// ── Register ──────────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  const { email, first_name, last_name, phone_number, password, role, age } = req.body;
  try {
    const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

    const result = await pool.query(
      `INSERT INTO users (email, first_name, last_name, phone_number, password_hash, role, age)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, email, first_name, last_name, phone_number, role, age, created_at`,
      [email, first_name, last_name, phone_number, hash, role || 'viewer', age]
    );

    const user = result.rows[0];
    const token = generateToken({ id: user.id, role: user.role });

    return sendSuccess(res, { user, token }, 'Registration successful.', 201);
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  const { id, email, phone_number, password } = req.body;
  try {
    let result;
    if (id) {
      result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    } else if (email) {
      result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    } else if (phone_number) {
      result = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
    } else {
      return sendError(res, 'Provide one of: id, email, or phone number.', 400);
    }

    if (!result.rows.length) return sendError(res, 'Invalid credentials.', 401);

    const user = result.rows[0];
    if (!user.is_active) return sendError(res, 'Account is deactivated.', 403);

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return sendError(res, 'Invalid credentials.', 401);

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({ id: user.id, role: user.role });
    const { password_hash, ...safeUser } = user;

    return sendSuccess(res, { user: safeUser, token }, 'Login successful.');
  } catch (err) {
    next(err);
  }
};

// ── Auth Me ───────────────────────────────────────────────────────────────────
const authMe = async (req, res) => {
  return sendSuccess(res, { user: req.user }, 'Authenticated user fetched.');
};

// ── Forgot Password ───────────────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!result.rows.length) {
      return sendSuccess(res, {}, 'If this email exists, a reset token has been sent.');
    }

    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3',
      [resetToken, resetExpires, email]
    );

    // In production: send this token via email
    return sendSuccess(res, { reset_token: resetToken }, 'Password reset token generated. (Send via email in production)');
  } catch (err) {
    next(err);
  }
};

// ── Change / Reset Password ───────────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  const { reset_token, new_password } = req.body;
  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
      [reset_token]
    );

    if (!result.rows.length) return sendError(res, 'Invalid or expired reset token.', 400);

    const user = result.rows[0];
    const hash = await bcrypt.hash(new_password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

    await pool.query(
      'UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
      [hash, user.id]
    );

    return sendSuccess(res, {}, 'Password changed successfully.');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, authMe, forgotPassword, changePassword };