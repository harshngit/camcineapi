const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const search = async (req, res, next) => {
  const { q, type = 'all', page = 1, limit = 20 } = req.query;
  if (!q || q.trim().length < 2) return sendError(res, 'Search query must be at least 2 characters.', 400);
  const term = `%${q.trim()}%`;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const contentTypes = type === 'all' ? ['movie', 'show', 'song'] : [type];
    const queries = [];
    const params = [];
    if (type !== 'actor') {
      params.push(term, contentTypes);
      queries.push(`SELECT id, type, title, poster_url, thumbnail_url, release_year AS year, language, rating
        FROM content WHERE status='published' AND type = ANY($2) AND (title ILIKE $1 OR description ILIKE $1)`);
    }
    if (type === 'all' || type === 'actor') {
      const base = params.length;
      params.push(term);
      queries.push(`SELECT id, 'actor' AS type, name AS title, headshot_url AS poster_url, headshot_url AS thumbnail_url,
        NULL::int AS year, NULL::varchar AS language, NULL::varchar AS rating
        FROM actors WHERE name ILIKE $${base + 1} OR screen_name ILIKE $${base + 1}`);
    }
    const raw = await pool.query(`${queries.join(' UNION ALL ')} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, parseInt(limit), offset]);
    const counts = raw.rows.reduce((acc, item) => {
      const key = item.type === 'movie' ? 'movies' : item.type === 'show' ? 'shows' : item.type === 'song' ? 'songs' : 'actors';
      acc[key] += 1;
      return acc;
    }, { movies: 0, shows: 0, songs: 0, actors: 0 });
    return sendSuccess(res, { query: q, results: raw.rows, by_type: counts, pagination: { total: raw.rows.length } });
  } catch (err) { next(err); }
};

module.exports = { search };
