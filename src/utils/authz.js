const { sendError } = require('./response');

const isAdmin = (user) => user?.role === 'admin';
const isManager = (user) => user?.role === 'manager';
const isSelf = (user, id) => String(user?.id) === String(id);

const requireSelfOrRoles = (req, res, id, roles = []) => {
  if (isSelf(req.user, id) || roles.includes(req.user?.role)) return true;
  sendError(res, 'Forbidden.', 403);
  return false;
};

module.exports = { isAdmin, isManager, isSelf, requireSelfOrRoles };
