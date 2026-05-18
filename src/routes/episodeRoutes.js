// ============================================================
// episodeRoutes.js — Camcine OTT Episode / Series Module
// Base path: /api/v1/episodes
//
// Series = parent content (type: show / short_film)
// Episodes are created UNDER a series via /:seriesId/episode
//
// Upload endpoints send content_id / series_id / episode_id
// in the request BODY — no IDs in the upload URL paths.
// ============================================================

const router = require('express').Router();
const { body, param } = require('express-validator');
const {
  getAllSeries, getSeriesById,
  createSeries, updateSeries, deleteSeries,
  addEpisode, updateEpisode, deleteEpisode,
  addSeriesCast, removeSeriesCast,
  addEpisodeCast, removeEpisodeCast,
} = require('../controllers/episodeController');
const { authenticate, authorize } = require('../middleware/auth');
const { createUploader, handleMulterError } = require('../middleware/uploadMiddleware');
const { createDirectUploadUrl, uploadImage, uploadVideo } = require('../controllers/uploadController');
const validate = require('../middleware/validate');

const imageUploader   = createUploader('image');
const videoUploader   = createUploader('video');
const trailerUploader = createUploader('video');

const seriesCreateRules = [
  body('series_name').notEmpty().trim().withMessage('series_name is required'),
  body('type').optional().isIn(['show', 'short_film']),
  body('rating').optional().isIn(['U', 'UA', 'A', 'S']),
  body('release_year').optional().isInt({ min: 1900, max: 2100 }),
  body('is_free').optional().isBoolean(),
  body('genre').optional().isArray(),
  body('cast').optional().isArray(),
  body('episodes').optional().isArray(),
];

const episodeRules = [
  body('episode_number').isInt({ min: 1 }).withMessage('episode_number must be a positive integer'),
  body('season').optional().isInt({ min: 1 }),
  body('price_tvod').optional().isFloat({ min: 0 }),
  body('is_free').optional().isBoolean(),
  body('aired_date').optional().isISO8601().withMessage('aired_date must be YYYY-MM-DD'),
];

/**
 * @swagger
 * tags:
 *   - name: Episodes
 *     description: Series & episode management — CRUD, uploads, cast
 */

// ═══════════════════════════════════════════════════════════════
// SERIES CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /episodes:
 *   get:
 *     summary: List all published series / shows
 *     tags: [Episodes]
 *     security: []
 *     parameters:
 *       - { in: query, name: page,     schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit,    schema: { type: integer, default: 10 } }
 *       - { in: query, name: language, schema: { type: string } }
 *       - { in: query, name: region,   schema: { type: string } }
 *       - { in: query, name: genre,    schema: { type: string } }
 *       - { in: query, name: is_free,  schema: { type: boolean } }
 *       - { in: query, name: search,   schema: { type: string } }
 *       - { in: query, name: year,     schema: { type: integer } }
 *       - { in: query, name: rating,   schema: { type: string, enum: [U, UA, A, S] } }
 *       - { in: query, name: sort,     schema: { type: string, enum: [newest, oldest, title, price_low, price_high], default: newest } }
 *     responses:
 *       200:
 *         description: Paginated list of series with cast[] and total_episodes embedded
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 series:
 *                   - id: "uuid"
 *                     series_name: "Mirzapur"
 *                     type: "show"
 *                     total_episodes: 18
 *                     cast:
 *                       - actor_name: "Pankaj Tripathi"
 *                         role_type: "lead_actor"
 *                 pagination:
 *                   page: 1
 *                   total: 10
 */
router.get('/', getAllSeries);

/**
 * @swagger
 * /episodes/{seriesId}:
 *   get:
 *     summary: Get a series with its full episodes[] array and cast
 *     tags: [Episodes]
 *     security: []
 *     parameters:
 *       - { in: path, name: seriesId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Series detail with series_name, cast[], and episodes[] (each episode has aired_date)
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 series:
 *                   id: "uuid"
 *                   series_name: "Mirzapur"
 *                   poster_url: "https://..."
 *                   trailer_url: "https://..."
 *                   cast:
 *                     - actor_name: "Pankaj Tripathi"
 *                       character_name: "Kaleen Bhaiya"
 *                       role_type: "lead_actor"
 *                   episodes:
 *                     - id: "ep-uuid"
 *                       season: 1
 *                       episode_number: 1
 *                       episode_title: "Ep 1 - Mirzapur"
 *                       aired_date: "2018-11-16"
 *                       video_url: "https://..."
 *                       stream_url_hls: "https://..."
 *                       thumbnail_url: "https://..."
 *                       episode_cast: []
 *       404:
 *         description: Series not found
 */
router.get('/:seriesId', [param('seriesId').isUUID()], validate, getSeriesById);

/**
 * @swagger
 * /episodes:
 *   post:
 *     summary: Create a new series / show (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [series_name]
 *             properties:
 *               series_name:
 *                 type: string
 *                 example: "Mirzapur"
 *               type:
 *                 type: string
 *                 enum: [show, short_film]
 *                 default: "show"
 *               description:
 *                 type: string
 *               language:
 *                 type: string
 *                 example: "Hindi"
 *               region:
 *                 type: string
 *                 example: "UP"
 *               genre:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["Crime", "Thriller"]
 *               director:
 *                 type: string
 *               release_year:
 *                 type: integer
 *               rating:
 *                 type: string
 *                 enum: [U, UA, A, S]
 *               poster_url:
 *                 type: string
 *                 description: "Direct URL — or upload via POST /episodes/upload/thumbnail"
 *                 example: "https://storage.googleapis.com/camcine-media/images/poster/mirzapur.jpg"
 *               thumbnail_url:
 *                 type: string
 *                 description: "Thumbnail URL — or upload via POST /episodes/upload/thumbnail"
 *               trailer_url:
 *                 type: string
 *                 description: "Trailer URL — or upload via POST /episodes/upload/trailer"
 *                 example: "https://storage.googleapis.com/camcine-media/trailers/mirzapur.mp4"
 *               is_free:
 *                 type: boolean
 *               price_tvod:
 *                 type: number
 *               imdb_id:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *               cast:
 *                 type: array
 *                 description: "Main series cast"
 *                 items:
 *                   type: object
 *                   properties:
 *                     actor_name:     { type: string }
 *                     character_name: { type: string }
 *                     role_type:      { type: string, enum: [lead_actor, lead_actress, supporting_actor, supporting_actress, director, producer, cameo] }
 *                     billing_order:  { type: integer }
 *                     headshot_url:   { type: string, description: "Actor headshot / profile image URL" }
 *                     cast_image:     { type: string, description: "Alternate cast-specific image URL" }
 *               episodes:
 *                 type: array
 *                 description: "Optionally seed initial episodes at creation time"
 *                 items:
 *                   type: object
 *                   properties:
 *                     episode_number:   { type: integer }
 *                     season:           { type: integer }
 *                     title:            { type: string }
 *                     aired_date:       { type: string, format: date }
 *                     video_url:        { type: string, description: "Episode video file URL" }
 *                     stream_url_hls:   { type: string, description: "HLS stream URL after transcoding" }
 *                     stream_url_dash:  { type: string, description: "DASH stream URL after transcoding" }
 *                     thumbnail_url:    { type: string, description: "Episode thumbnail image URL" }
 *                     duration_seconds: { type: integer }
 *                     is_free:          { type: boolean }
 *                     price_tvod:       { type: number }
 *           example:
 *             series_name: "Mirzapur"
 *             language: "Hindi"
 *             genre: ["Crime", "Thriller"]
 *             rating: "A"
 *             poster_url: "https://storage.googleapis.com/camcine-media/images/poster/mirzapur.jpg"
 *             trailer_url: "https://storage.googleapis.com/camcine-media/trailers/mirzapur.mp4"
 *             cast:
 *               - actor_name: "Pankaj Tripathi"
 *                 character_name: "Kaleen Bhaiya"
 *                 role_type: "lead_actor"
 *                 billing_order: 1
 *                 headshot_url: "https://storage.googleapis.com/camcine-media/images/headshots/pankaj-tripathi.jpg"
 *             episodes:
 *               - episode_number: 1
 *                 season: 1
 *                 title: "Ep 1 - Mirzapur"
 *                 aired_date: "2018-11-16"
 *                 video_url: "https://storage.googleapis.com/camcine-media/videos/mirzapur-s1e1.mp4"
 *                 stream_url_hls: "https://cdn.camcine.com/hls/mirzapur/s1e1/master.m3u8"
 *                 thumbnail_url: "https://storage.googleapis.com/camcine-media/images/thumbnail/mzp-s1e1.jpg"
 *                 duration_seconds: 3600
 *                 is_free: false
 *                 price_tvod: 2
 *     responses:
 *       201:
 *         description: Series created as draft. Add more episodes via POST /episodes/{seriesId}/episode
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin only
 */
router.post('/', authenticate, authorize('admin'), seriesCreateRules, validate, createSeries);

/**
 * @swagger
 * /episodes/{seriesId}:
 *   put:
 *     summary: Update series metadata (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: seriesId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               series_name:   { type: string }
 *               description:   { type: string }
 *               language:      { type: string }
 *               region:        { type: string }
 *               genre:         { type: array, items: { type: string } }
 *               director:      { type: string }
 *               release_year:  { type: integer }
 *               rating:        { type: string, enum: [U, UA, A, S] }
 *               status:        { type: string, enum: [draft, processing, published, archived] }
 *               poster_url:    { type: string }
 *               thumbnail_url: { type: string }
 *               trailer_url:   { type: string }
 *               is_free:       { type: boolean }
 *               price_tvod:    { type: number }
 *     responses:
 *       200:
 *         description: Series updated
 *       404:
 *         description: Series not found
 */
router.put('/:seriesId', authenticate, authorize('admin'), [param('seriesId').isUUID()], validate, updateSeries);

/**
 * @swagger
 * /episodes/{seriesId}:
 *   delete:
 *     summary: Archive a series (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: seriesId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Series archived
 *       404:
 *         description: Not found or already archived
 */
router.delete('/:seriesId', authenticate, authorize('admin'), [param('seriesId').isUUID()], validate, deleteSeries);

router.post(
  '/upload/direct-url',
  authenticate, authorize('admin'),
  [
    body('file_name').notEmpty().trim(),
    body('mime_type').optional({ checkFalsy: true }).trim(),
    body('upload_type').isIn(['thumbnail', 'trailer', 'video']),
  ],
  validate,
  createDirectUploadUrl
);

// ═══════════════════════════════════════════════════════════════
// EPISODE CRUD — episodes are created UNDER their series
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /episodes/{seriesId}/episode:
 *   post:
 *     summary: Add a new episode to a series (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: seriesId, required: true, schema: { type: string, format: uuid }, description: "UUID of the parent series" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [episode_number]
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
 *                 example: "Ep 1 - Mirzapur"
 *               description:
 *                 type: string
 *               duration_seconds:
 *                 type: integer
 *                 example: 3600
 *               aired_date:
 *                 type: string
 *                 format: date
 *                 example: "2018-11-16"
 *                 description: "Date the episode originally aired or was released"
 *               video_url:
 *                 type: string
 *                 description: "Direct video URL — or upload via POST /episodes/upload/episode-video"
 *                 example: "https://storage.googleapis.com/camcine-media/videos/mirzapur-s1e1.mp4"
 *               stream_url_hls:
 *                 type: string
 *                 description: "HLS stream URL after transcoding"
 *                 example: "https://cdn.camcine.com/hls/mirzapur/s1e1/master.m3u8"
 *               stream_url_dash:
 *                 type: string
 *                 description: "DASH stream URL after transcoding"
 *               thumbnail_url:
 *                 type: string
 *                 description: "Episode thumbnail — or upload via POST /episodes/upload/episode-thumbnail"
 *                 example: "https://storage.googleapis.com/camcine-media/images/thumbnail/mzp-s1e1.jpg"
 *               price_tvod:
 *                 type: number
 *                 example: 2
 *               is_free:
 *                 type: boolean
 *                 example: false
 *           example:
 *             episode_number: 1
 *             season: 1
 *             title: "Ep 1 - Mirzapur"
 *             aired_date: "2018-11-16"
 *             duration_seconds: 3600
 *             is_free: false
 *             price_tvod: 2
 *             video_url: "https://storage.googleapis.com/camcine-media/videos/mirzapur-s1e1.mp4"
 *             stream_url_hls: "https://cdn.camcine.com/hls/mirzapur/s1e1/master.m3u8"
 *             thumbnail_url: "https://storage.googleapis.com/camcine-media/images/thumbnail/mzp-s1e1.jpg"
 *     responses:
 *       201:
 *         description: Episode added to the series
 *       409:
 *         description: Episode number already exists for this season
 */
router.post(
  '/:seriesId/episode',
  authenticate, authorize('admin'),
  [param('seriesId').isUUID(), ...episodeRules],
  validate, addEpisode
);

/**
 * @swagger
 * /episodes/{seriesId}/episode/{episodeId}:
 *   put:
 *     summary: Update an episode (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: seriesId,  required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: episodeId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:            { type: string }
 *               description:      { type: string }
 *               duration_seconds: { type: integer }
 *               aired_date:       { type: string, format: date }
 *               video_url:        { type: string }
 *               stream_url_hls:   { type: string }
 *               stream_url_dash:  { type: string }
 *               thumbnail_url:    { type: string }
 *               price_tvod:       { type: number }
 *               is_free:          { type: boolean }
 *               status:           { type: string, enum: [draft, published, archived] }
 *     responses:
 *       200:
 *         description: Episode updated
 *   delete:
 *     summary: Archive an episode (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: seriesId,  required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: episodeId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Episode archived
 */
router.put('/:seriesId/episode/:episodeId',    authenticate, authorize('admin'), [param('seriesId').isUUID(), param('episodeId').isUUID()], validate, updateEpisode);
router.delete('/:seriesId/episode/:episodeId', authenticate, authorize('admin'), [param('seriesId').isUUID(), param('episodeId').isUUID()], validate, deleteEpisode);

// ═══════════════════════════════════════════════════════════════
// UPLOAD ENDPOINTS
// IDs are sent in request BODY — no IDs in the URL path
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /episodes/upload/trailer:
 *   post:
 *     summary: Upload series trailer (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "MP4, MOV, WEBM — max 500MB"
 *               series_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the series to link this trailer to. Auto-updates trailer_url."
 *                 example: "a1b2c3d4-0000-0000-0000-111122223333"
 *     responses:
 *       201:
 *         description: Trailer uploaded and trailer_url updated on the series.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 public_url: "https://storage.googleapis.com/camcine-media/trailers/uuid.mp4"
 */
router.post(
  '/upload/trailer',
  authenticate, authorize('admin'),
  (req, res, next) => {
    trailerUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next));
  },
  (req, res, next) => {
    req.body.linked_to_id   = req.body.series_id;
    req.body.linked_to_type = 'content';
    req.body.video_purpose  = 'trailer';
    req.body.auto_update    = 'true';
    next();
  },
  uploadVideo
);

/**
 * @swagger
 * /episodes/upload/thumbnail:
 *   post:
 *     summary: Upload series poster / thumbnail (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "JPG, PNG, WEBP — max 10MB"
 *               series_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the series. Auto-updates thumbnail_url."
 *                 example: "a1b2c3d4-0000-0000-0000-111122223333"
 *     responses:
 *       201:
 *         description: Thumbnail uploaded and thumbnail_url updated on the series.
 */
router.post(
  '/upload/thumbnail',
  authenticate, authorize('admin'),
  (req, res, next) => {
    imageUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next));
  },
  (req, res, next) => {
    req.body.linked_to_id   = req.body.series_id;
    req.body.linked_to_type = 'content';
    req.body.image_purpose  = 'thumbnail';
    req.body.auto_update    = 'true';
    next();
  },
  uploadImage
);

/**
 * @swagger
 * /episodes/upload/episode-video:
 *   post:
 *     summary: Upload a single episode video file (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "Episode video — MP4, MOV, MKV, AVI, WEBM (max 5GB)"
 *               episode_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the episode to link this video to. Auto-updates video_url on the episode."
 *                 example: "e5f6a7b8-0000-0000-0000-111122223333"
 *     responses:
 *       201:
 *         description: Episode video uploaded and video_url updated on the episode.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 public_url: "https://storage.googleapis.com/camcine-media/videos/episode-uuid.mp4"
 *                 note: "For HLS streaming, transcode via Cloud Transcoder or FFmpeg."
 */
router.post(
  '/upload/episode-video',
  authenticate, authorize('admin'),
  (req, res, next) => {
    videoUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next));
  },
  (req, res, next) => {
    req.body.linked_to_id   = req.body.episode_id;
    req.body.linked_to_type = 'episode';
    req.body.auto_update    = 'true';
    next();
  },
  uploadVideo
);

/**
 * @swagger
 * /episodes/upload/episode-thumbnail:
 *   post:
 *     summary: Upload a single episode thumbnail image (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "JPG, PNG, WEBP — max 10MB"
 *               episode_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the episode. Auto-updates thumbnail_url on the episode."
 *                 example: "e5f6a7b8-0000-0000-0000-111122223333"
 *     responses:
 *       201:
 *         description: Episode thumbnail uploaded and thumbnail_url updated on the episode.
 */
router.post(
  '/upload/episode-thumbnail',
  authenticate, authorize('admin'),
  (req, res, next) => {
    imageUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next));
  },
  (req, res, next) => {
    req.body.linked_to_id   = req.body.episode_id;
    req.body.linked_to_type = 'episode';
    req.body.image_purpose  = 'thumbnail';
    req.body.auto_update    = 'true';
    next();
  },
  uploadImage
);

// ═══════════════════════════════════════════════════════════════
// CAST — Series-level and episode-level
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /episodes/{seriesId}/cast:
 *   post:
 *     summary: Add a cast member to a series (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: seriesId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actor_id:       { type: string, format: uuid }
 *               actor_name:     { type: string, example: "Pankaj Tripathi" }
 *               character_name: { type: string, example: "Kaleen Bhaiya" }
 *               role_type:      { type: string, enum: [lead_actor, lead_actress, supporting_actor, supporting_actress, director, producer, cameo] }
 *               billing_order:  { type: integer }
 *     responses:
 *       201:
 *         description: Cast member added to series
 */
router.post('/:seriesId/cast', authenticate, authorize('admin'), [param('seriesId').isUUID()], validate, addSeriesCast);

/**
 * @swagger
 * /episodes/{seriesId}/cast/{castId}:
 *   delete:
 *     summary: Remove a cast member from a series (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: seriesId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: castId,   required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Cast member removed
 */
router.delete('/:seriesId/cast/:castId', authenticate, authorize('admin'), [param('seriesId').isUUID(), param('castId').isUUID()], validate, removeSeriesCast);

/**
 * @swagger
 * /episodes/{seriesId}/episode/{episodeId}/cast:
 *   post:
 *     summary: Add guest cast to a specific episode (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: seriesId,  required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: episodeId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actor_id:       { type: string, format: uuid }
 *               actor_name:     { type: string, example: "Divyenndu" }
 *               character_name: { type: string, example: "Munna Bhaiya" }
 *               role_type:      { type: string, enum: [lead_actor, lead_actress, supporting_actor, supporting_actress, guest, cameo, narrator] }
 *               billing_order:  { type: integer }
 *               headshot_url:   { type: string, description: "Actor headshot / profile image URL" }
 *               cast_image:     { type: string, description: "Alternate cast-specific image URL" }
 *     responses:
 *       201:
 *         description: Guest cast added to episode
 */
router.post('/:seriesId/episode/:episodeId/cast', authenticate, authorize('admin'), [param('seriesId').isUUID(), param('episodeId').isUUID()], validate, addEpisodeCast);

/**
 * @swagger
 * /episodes/{seriesId}/episode/{episodeId}/cast/{castId}:
 *   delete:
 *     summary: Remove guest cast from a specific episode (admin only)
 *     tags: [Episodes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: seriesId,  required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: episodeId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: castId,    required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Episode cast member removed
 */
router.delete('/:seriesId/episode/:episodeId/cast/:castId', authenticate, authorize('admin'), [param('seriesId').isUUID(), param('episodeId').isUUID(), param('castId').isUUID()], validate, removeEpisodeCast);

module.exports = router;
