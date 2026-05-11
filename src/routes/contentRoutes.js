// ============================================================
// contentRoutes.js — Camcine OTT Content Module
// Base path: /api/v1/content
// ============================================================

const router = require('express').Router();
const { body, param, query } = require('express-validator');
const {
  getAllContent,
  getContentById,
  createContent,
  updateContent,
  updateContentStatus,
  deleteContent,
  getEpisodes,
  getEpisodeById,
  addEpisode,
  updateEpisode,
  deleteEpisode,
  getContentStats,
} = require('../controllers/contentController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

// ─────────────────────────────────────────────────────────────
// VALIDATION RULES
// ─────────────────────────────────────────────────────────────
const contentCreateRules = [
  body('title').notEmpty().trim().withMessage('Title is required'),
  body('type')
    .notEmpty()
    .isIn(['movie','show','short_film','song','news'])
    .withMessage('Type must be: movie, show, short_film, song, or news'),
  body('rating').optional().isIn(['U','UA','A','S']).withMessage('Rating must be U, UA, A, or S'),
  body('release_year').optional().isInt({ min: 1900, max: 2100 }).withMessage('Invalid release year'),
  body('price_tvod').optional().isFloat({ min: 0 }).withMessage('Price must be >= 0'),
  body('duration_seconds').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  body('is_free').optional().isBoolean(),
  body('genre').optional().isArray(),
  body('cast_ids').optional().isArray(),
  body('tags').optional().isArray(),
];

const episodeRules = [
  body('episode_number').isInt({ min: 1 }).withMessage('Episode number must be a positive integer'),
  body('season').optional().isInt({ min: 1 }).withMessage('Season must be a positive integer'),
  body('price_tvod').optional().isFloat({ min: 0 }),
  body('is_free').optional().isBoolean(),
];

/**
 * @swagger
 * tags:
 *   name: Content
 *   description: Content management — Movies, TV Shows, Short Films, Songs, News
 */

// ═══════════════════════════════════════════════════════════════
// CONTENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// ── GET /content/stats ────────────────────────────────────────
/**
 * @swagger
 * /content/stats:
 *   get:
 *     summary: Get content statistics (admin dashboard)
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Counts of content by type, status, and pricing
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 stats:
 *                   total_published: 42
 *                   total_draft: 5
 *                   total_movies: 20
 *                   total_shows: 10
 *                   total_songs: 8
 *                   total_free: 15
 *                   total_paid: 27
 */
router.get(
  '/stats',
  authenticate,
  authorize('admin', 'manager'),
  getContentStats
);

// ── GET /content ──────────────────────────────────────────────
/**
 * @swagger
 * /content:
 *   get:
 *     summary: Get all published content with filters and pagination
 *     tags: [Content]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Results per page (max 50)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [movie, show, short_film, song, news]
 *         description: Filter by content type
 *       - in: query
 *         name: language
 *         schema: { type: string }
 *         example: Hindi
 *         description: Filter by language
 *       - in: query
 *         name: region
 *         schema: { type: string }
 *         example: Maharashtra
 *         description: Filter by region
 *       - in: query
 *         name: genre
 *         schema: { type: string }
 *         example: Drama
 *         description: Filter by genre tag
 *       - in: query
 *         name: is_free
 *         schema: { type: boolean }
 *         description: Filter free or paid content
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by title or description
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         example: 2024
 *         description: Filter by release year
 *       - in: query
 *         name: rating
 *         schema:
 *           type: string
 *           enum: [U, UA, A, S]
 *         description: Filter by content rating
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, title, price_low, price_high]
 *           default: newest
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Paginated list of content
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 content:
 *                   - id: "uuid-here"
 *                     title: "Dangal"
 *                     type: "movie"
 *                     language: "Hindi"
 *                     genre: ["Drama","Sports"]
 *                     rating: "U"
 *                     is_free: true
 *                     price_tvod: 0
 *                     poster_url: "https://cdn.camcine.com/posters/dangal.jpg"
 *                 pagination:
 *                   page: 1
 *                   limit: 10
 *                   total: 42
 *                   total_pages: 5
 *                   has_next: true
 *                   has_prev: false
 */
router.get('/', getAllContent);

// ── GET /content/:id ──────────────────────────────────────────
/**
 * @swagger
 * /content/{id}:
 *   get:
 *     summary: Get a single content item by ID
 *     tags: [Content]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Content UUID
 *     responses:
 *       200:
 *         description: Full content details (includes song_meta if type is song)
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 content:
 *                   id: "uuid-here"
 *                   title: "Mirzapur"
 *                   type: "show"
 *                   description: "Crime drama set in UP"
 *                   language: "Hindi"
 *                   region: "UP"
 *                   genre: ["Crime","Thriller"]
 *                   episode_count: 18
 *       404:
 *         description: Content not found
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid content ID')],
  validate,
  getContentById
);

// ── POST /content ─────────────────────────────────────────────
/**
 * @swagger
 * /content:
 *   post:
 *     summary: Create new content (admin only)
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Dangal"
 *               type:
 *                 type: string
 *                 enum: [movie, show, short_film, song, news]
 *                 example: "movie"
 *               description:
 *                 type: string
 *                 example: "A story of a wrestler and his daughters"
 *               language:
 *                 type: string
 *                 example: "Hindi"
 *               region:
 *                 type: string
 *                 example: "Pan-India"
 *               genre:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["Drama","Sports","Biography"]
 *               cast_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: Array of actor UUIDs
 *               director:
 *                 type: string
 *                 example: "Nitesh Tiwari"
 *               release_year:
 *                 type: integer
 *                 example: 2016
 *               rating:
 *                 type: string
 *                 enum: [U, UA, A, S]
 *                 example: "U"
 *               poster_url:
 *                 type: string
 *                 example: "https://cdn.camcine.com/posters/dangal.jpg"
 *               trailer_url:
 *                 type: string
 *                 example: "https://cdn.camcine.com/trailers/dangal.mp4"
 *               stream_url_hls:
 *                 type: string
 *                 example: "https://cdn.camcine.com/hls/dangal/master.m3u8"
 *               stream_url_dash:
 *                 type: string
 *                 example: "https://cdn.camcine.com/dash/dangal/manifest.mpd"
 *               duration_seconds:
 *                 type: integer
 *                 example: 9420
 *               is_free:
 *                 type: boolean
 *                 example: false
 *               price_tvod:
 *                 type: number
 *                 example: 49
 *                 description: "Price in INR — starts at ₹2"
 *               imdb_id:
 *                 type: string
 *                 example: "tt5074352"
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["blockbuster","award-winner"]
 *               mood_tags:
 *                 type: array
 *                 items: { type: string }
 *                 description: "Songs only — e.g. ['devotional','folk']"
 *               instruments:
 *                 type: array
 *                 items: { type: string }
 *                 description: "Songs only — e.g. ['tabla','sitar']"
 *               festival:
 *                 type: string
 *                 description: "Songs only — e.g. Diwali, Navratri"
 *               album:
 *                 type: string
 *                 description: "Songs only"
 *               lyrics_url:
 *                 type: string
 *                 description: "Songs only — WebVTT/LRC file URL"
 *               audio_url_hq:
 *                 type: string
 *                 description: "Songs only — 320kbps AAC"
 *               audio_url_lq:
 *                 type: string
 *                 description: "Songs only — 128kbps AAC"
 *               artist_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: "Songs only — actor/artist UUIDs"
 *           examples:
 *             Movie:
 *               summary: Create a movie
 *               value:
 *                 title: "Dangal"
 *                 type: "movie"
 *                 description: "A story of a wrestler and his daughters."
 *                 language: "Hindi"
 *                 genre: ["Drama","Sports"]
 *                 director: "Nitesh Tiwari"
 *                 release_year: 2016
 *                 rating: "U"
 *                 is_free: false
 *                 price_tvod: 49
 *                 duration_seconds: 9420
 *             Song:
 *               summary: Create a song
 *               value:
 *                 title: "Kesariya"
 *                 type: "song"
 *                 language: "Hindi"
 *                 is_free: true
 *                 mood_tags: ["romantic","folk"]
 *                 instruments: ["guitar","tabla"]
 *                 festival: null
 *                 audio_url_hq: "https://cdn.camcine.com/songs/kesariya_320.aac"
 *                 audio_url_lq: "https://cdn.camcine.com/songs/kesariya_128.aac"
 *     responses:
 *       201:
 *         description: Content created (status = draft by default)
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 */
router.post(
  '/',
  authenticate,
  authorize('admin'),
  contentCreateRules,
  validate,
  createContent
);

// ── PUT /content/:id ──────────────────────────────────────────
/**
 * @swagger
 * /content/{id}:
 *   put:
 *     summary: Update content details (admin only)
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Any combination of content fields to update
 *             properties:
 *               title:            { type: string }
 *               description:      { type: string }
 *               language:         { type: string }
 *               region:           { type: string }
 *               genre:            { type: array, items: { type: string } }
 *               director:         { type: string }
 *               release_year:     { type: integer }
 *               rating:           { type: string, enum: [U, UA, A, S] }
 *               status:           { type: string, enum: [draft, processing, published, archived] }
 *               poster_url:       { type: string }
 *               trailer_url:      { type: string }
 *               stream_url_hls:   { type: string }
 *               stream_url_dash:  { type: string }
 *               duration_seconds: { type: integer }
 *               is_free:          { type: boolean }
 *               price_tvod:       { type: number }
 *     responses:
 *       200:
 *         description: Content updated
 *       400:
 *         description: No valid fields provided
 *       404:
 *         description: Content not found
 */
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [param('id').isUUID()],
  validate,
  updateContent
);

// ── PATCH /content/:id/status ─────────────────────────────────
/**
 * @swagger
 * /content/{id}/status:
 *   patch:
 *     summary: Quickly update content status — publish, archive, draft (admin only)
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, processing, published, archived]
 *                 example: "published"
 *     responses:
 *       200:
 *         description: Status updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Content status updated to published."
 *               data:
 *                 content:
 *                   id: "uuid-here"
 *                   title: "Dangal"
 *                   status: "published"
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize('admin'),
  [
    param('id').isUUID(),
    body('status').isIn(['draft','processing','published','archived']).withMessage('Invalid status'),
  ],
  validate,
  updateContentStatus
);

// ── DELETE /content/:id ───────────────────────────────────────
/**
 * @swagger
 * /content/{id}:
 *   delete:
 *     summary: Archive (soft delete) content (admin only)
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Content archived
 *       404:
 *         description: Content not found or already archived
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  [param('id').isUUID()],
  validate,
  deleteContent
);

// ═══════════════════════════════════════════════════════════════
// EPISODE ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// ── GET /content/:id/episodes ─────────────────────────────────
/**
 * @swagger
 * /content/{id}/episodes:
 *   get:
 *     summary: Get all episodes for a show or short film
 *     tags: [Content]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Content (Show) UUID
 *       - in: query
 *         name: season
 *         schema: { type: integer }
 *         description: Filter by season number
 *         example: 1
 *     responses:
 *       200:
 *         description: List of episodes ordered by season and episode number
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total: 9
 *                 episodes:
 *                   - id: "ep-uuid"
 *                     season: 1
 *                     episode_number: 1
 *                     title: "Ep 1 - The Beginning"
 *                     duration_seconds: 3600
 *                     is_free: false
 *                     price_tvod: 2
 *       400:
 *         description: Content type does not have episodes
 *       404:
 *         description: Content not found
 */
router.get(
  '/:id/episodes',
  [param('id').isUUID()],
  validate,
  getEpisodes
);

// ── GET /content/:id/episodes/:episodeId ──────────────────────
/**
 * @swagger
 * /content/{id}/episodes/{episodeId}:
 *   get:
 *     summary: Get a single episode by ID
 *     tags: [Content]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: episodeId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Episode details including stream URLs
 *       404:
 *         description: Episode not found
 */
router.get(
  '/:id/episodes/:episodeId',
  [
    param('id').isUUID(),
    param('episodeId').isUUID(),
  ],
  validate,
  getEpisodeById
);

// ── POST /content/:id/episodes ────────────────────────────────
/**
 * @swagger
 * /content/{id}/episodes:
 *   post:
 *     summary: Add an episode to a show (admin only)
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Parent show UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - episode_number
 *             properties:
 *               episode_number:
 *                 type: integer
 *                 example: 1
 *               season:
 *                 type: integer
 *                 example: 1
 *                 default: 1
 *               title:
 *                 type: string
 *                 example: "Episode 1 - The Setup"
 *               description:
 *                 type: string
 *               duration_seconds:
 *                 type: integer
 *                 example: 2700
 *               stream_url_hls:
 *                 type: string
 *                 example: "https://cdn.camcine.com/hls/mirzapur/s1e1/master.m3u8"
 *               stream_url_dash:
 *                 type: string
 *               thumbnail_url:
 *                 type: string
 *               price_tvod:
 *                 type: number
 *                 example: 2
 *                 description: "Price per episode in INR (min ₹2)"
 *               is_free:
 *                 type: boolean
 *                 example: false
 *           example:
 *             season: 1
 *             episode_number: 1
 *             title: "Ep 1 - Mirzapur"
 *             duration_seconds: 3600
 *             stream_url_hls: "https://cdn.camcine.com/hls/mirzapur/s1e1/master.m3u8"
 *             price_tvod: 2
 *             is_free: false
 *     responses:
 *       201:
 *         description: Episode added
 *       400:
 *         description: Validation error or invalid content type
 *       409:
 *         description: Episode number already exists for this season
 */
router.post(
  '/:id/episodes',
  authenticate,
  authorize('admin'),
  [param('id').isUUID(), ...episodeRules],
  validate,
  addEpisode
);

// ── PUT /content/:id/episodes/:episodeId ──────────────────────
/**
 * @swagger
 * /content/{id}/episodes/{episodeId}:
 *   put:
 *     summary: Update an episode (admin only)
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: episodeId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:            { type: string }
 *               description:      { type: string }
 *               duration_seconds: { type: integer }
 *               stream_url_hls:   { type: string }
 *               stream_url_dash:  { type: string }
 *               thumbnail_url:    { type: string }
 *               price_tvod:       { type: number }
 *               is_free:          { type: boolean }
 *               status:           { type: string, enum: [draft, published, archived] }
 *     responses:
 *       200:
 *         description: Episode updated
 *       404:
 *         description: Episode not found
 */
router.put(
  '/:id/episodes/:episodeId',
  authenticate,
  authorize('admin'),
  [param('id').isUUID(), param('episodeId').isUUID()],
  validate,
  updateEpisode
);

// ── DELETE /content/:id/episodes/:episodeId ───────────────────
/**
 * @swagger
 * /content/{id}/episodes/{episodeId}:
 *   delete:
 *     summary: Archive an episode (admin only)
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: episodeId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Episode archived
 *       404:
 *         description: Episode not found
 */
router.delete(
  '/:id/episodes/:episodeId',
  authenticate,
  authorize('admin'),
  [param('id').isUUID(), param('episodeId').isUUID()],
  validate,
  deleteEpisode
);

module.exports = router;
