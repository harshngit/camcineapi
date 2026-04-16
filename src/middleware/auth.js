const { verifyToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const pool = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const result = await pool.query(
      'SELECT id, email, first_name, last_name, phone_number, role, age, language_preferences, regions, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length) return sendError(res, 'User not found.', 401);
    if (!result.rows[0].is_active) return sendError(res, 'Account is deactivated.', 403);

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return sendError(res, 'Token expired.', 401);
    return sendError(res, 'Invalid token.', 401);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Forbidden. Insufficient permissions.', 403);
    }
    next();
  };
};

module.exports = { authenticate, authorize };
