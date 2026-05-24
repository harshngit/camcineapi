const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { isSelf } = require('../utils/authz');

const listTickets = async (req, res, next) => {
  const { page = 1, limit = 20, status, category, priority, user_id } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const where = [];
  if (!['admin', 'manager'].includes(req.user.role)) {
    params.push(req.user.id); where.push(`st.user_id=$${params.length}`);
  } else if (user_id) {
    params.push(user_id); where.push(`st.user_id=$${params.length}`);
  }
  if (status) { params.push(status); where.push(`st.status=$${params.length}`); }
  if (category) { params.push(category); where.push(`st.category=$${params.length}`); }
  if (priority) { params.push(priority); where.push(`st.priority=$${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const result = await pool.query(
      `SELECT st.*, u.first_name || ' ' || u.last_name AS user_name, u.email AS user_email
       FROM support_tickets st LEFT JOIN users u ON u.id = st.user_id
       ${clause} ORDER BY st.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM support_tickets st ${clause}`, params);
    return sendSuccess(res, { tickets: result.rows, pagination: { page: +page, limit: +limit, total: parseInt(count.rows[0].count) } });
  } catch (err) { next(err); }
};

const getTicket = async (req, res, next) => {
  try {
    const ticket = await pool.query('SELECT * FROM support_tickets WHERE id=$1', [req.params.id]);
    if (!ticket.rows.length) return sendError(res, 'Ticket not found.', 404);
    if (!['admin', 'manager'].includes(req.user.role) && !isSelf(req.user, ticket.rows[0].user_id)) return sendError(res, 'Forbidden.', 403);
    const replies = await pool.query('SELECT * FROM support_ticket_replies WHERE ticket_id=$1 ORDER BY created_at ASC', [req.params.id]);
    return sendSuccess(res, { ticket: ticket.rows[0], replies: replies.rows });
  } catch (err) { next(err); }
};

const createTicket = async (req, res, next) => {
  const { subject, category = 'general', body, content_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO support_tickets (user_id, subject, category, body, content_id, status)
       VALUES ($1,$2,$3,$4,$5,'open') RETURNING *`,
      [req.user.id, subject, category, body, content_id || null]
    );
    return sendSuccess(res, { id: result.rows[0].id, status: result.rows[0].status, ticket: result.rows[0] }, 'Ticket submitted.', 201);
  } catch (err) { next(err); }
};

const updateTicket = async (req, res, next) => {
  const { status, assigned_to, priority } = req.body;
  try {
    const result = await pool.query(
      `UPDATE support_tickets SET
       status=COALESCE($1,status), assigned_to=COALESCE($2,assigned_to),
       priority=COALESCE($3,priority), updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status || null, assigned_to || null, priority || null, req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Ticket not found.', 404);
    return sendSuccess(res, { ticket: result.rows[0] }, 'Ticket updated.');
  } catch (err) { next(err); }
};

const reply = async (req, res, next) => {
  try {
    const result = await pool.query(
      `INSERT INTO support_ticket_replies (ticket_id, user_id, body, is_staff_reply)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, req.user.id, req.body.body, ['admin', 'manager'].includes(req.user.role)]
    );
    return sendSuccess(res, { reply: result.rows[0] }, 'Reply added.', 201);
  } catch (err) { next(err); }
};

const removeTicket = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM support_tickets WHERE id=$1', [req.params.id]);
    return sendSuccess(res, {}, 'Ticket deleted.');
  } catch (err) { next(err); }
};

module.exports = { listTickets, getTicket, createTicket, updateTicket, reply, removeTicket };
