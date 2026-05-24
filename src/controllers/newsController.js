const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const listNews = async (req, res, next) => {
  const { page = 1, limit = 12, category } = req.query;
  const params = [];
  const where = [`is_published = true`];
  if (category) { params.push(category); where.push(`category=$${params.length}`); }
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const result = await pool.query(
      `SELECT * FROM news_articles WHERE ${where.join(' AND ')}
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM news_articles WHERE ${where.join(' AND ')}`, params);
    return sendSuccess(res, { articles: result.rows, pagination: { page: +page, limit: +limit, total: parseInt(count.rows[0].count) } });
  } catch (err) { next(err); }
};

const getNews = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM news_articles WHERE id=$1 OR slug=$1 LIMIT 1', [req.params.id]);
    if (!result.rows.length) return sendError(res, 'Article not found.', 404);
    return sendSuccess(res, { article: result.rows[0] });
  } catch (err) { next(err); }
};

const createNews = async (req, res, next) => {
  const { title, slug, body, category, tags = [], thumbnail_url, is_published = false, excerpt } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO news_articles (title, slug, body, category, tags, thumbnail_url, is_published, excerpt, author_id, published_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,CASE WHEN $7 THEN NOW() ELSE NULL END)
       RETURNING *`,
      [title, slug, body, category || null, JSON.stringify(tags), thumbnail_url || null, is_published, excerpt || null, req.user.id]
    );
    return sendSuccess(res, { article: result.rows[0] }, 'Article created.', 201);
  } catch (err) { next(err); }
};

const updateNews = async (req, res, next) => {
  const fields = [];
  const params = [];
  ['title', 'slug', 'body', 'category', 'thumbnail_url', 'excerpt', 'is_published'].forEach(key => {
    if (req.body[key] === undefined) return;
    params.push(req.body[key]);
    fields.push(`${key}=$${params.length}`);
  });
  if (req.body.tags !== undefined) { params.push(JSON.stringify(req.body.tags)); fields.push(`tags=$${params.length}::jsonb`); }
  if (!fields.length) return sendError(res, 'No fields to update.', 400);
  params.push(req.params.id);
  try {
    const result = await pool.query(`UPDATE news_articles SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${params.length} RETURNING *`, params);
    if (!result.rows.length) return sendError(res, 'Article not found.', 404);
    return sendSuccess(res, { article: result.rows[0] }, 'Article updated.');
  } catch (err) { next(err); }
};

const publishNews = async (req, res, next) => {
  try {
    const result = await pool.query(`UPDATE news_articles SET is_published = NOT is_published,
      published_at = CASE WHEN is_published = false THEN NOW() ELSE published_at END,
      updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!result.rows.length) return sendError(res, 'Article not found.', 404);
    return sendSuccess(res, { article: result.rows[0] }, 'Publish status updated.');
  } catch (err) { next(err); }
};

const removeNews = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM news_articles WHERE id=$1', [req.params.id]);
    return sendSuccess(res, {}, 'Article deleted.');
  } catch (err) { next(err); }
};

module.exports = { listNews, getNews, createNews, updateNews, publishNews, removeNews };
