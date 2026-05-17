// ============================================================
// movieRoutes.js — Camcine OTT Movie Module
// Base path: /api/v1/movies
// NOTE: Upload endpoints take content_id in the request body,
//       NOT in the URL path — keeps uploads decoupled from content.
// ============================================================

const router = require('express').Router();
const { body, param } = require('express-validator');
const {
  getAllMovies, getMovieById,
  createMovie, updateMovie, updateMovieStatus, deleteMovie,
  addMovieCast, bulkAddMovieCast, updateMovieCast, removeMovieCast,
} = require('../controllers/movieController');
const { authenticate, authorize } = require('../middleware/auth');
const { createUploader, handleMulterError } = require('../middleware/uploadMiddleware');
const { uploadImage, uploadVideo } = require('../controllers/uploadController');
const validate = require('../middleware/validate');

const imageUploader   = createUploader('image');
const videoUploader   = createUploader('video');
const trailerUploader = createUploader('video');

const movieCreateRules = [
  body('title').notEmpty().trim().withMessage('Title is required'),
  body('rating').optional().isIn(['U', 'UA', 'A', 'S']),
  body('release_year').optional().isInt({ min: 1900, max: 2100 }),
  body('price_tvod').optional().isFloat({ min: 0 }),
  body('duration_seconds').optional().isInt({ min: 1 }),
  body('is_free').optional().isBoolean(),
  body('genre').optional().isArray(),
  body('tags').optional().isArray(),
  body('cast').optional().isArray(),
];

/**
 * @swagger
 * tags:
 *   - name: Movies
 *     description: Movie management — CRUD, video/trailer/thumbnail uploads, cast
 */

// ═══════════════════════════════════════════════════════════════
// MOVIE CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /movies:
 *   get:
 *     summary: List all published movies with filters & pagination
 *     tags: [Movies]
 *     security: []
 *     parameters:
 *       - { in: query, name: page,     schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit,    schema: { type: integer, default: 10 } }
 *       - { in: query, name: language, schema: { type: string }, example: Hindi }
 *       - { in: query, name: region,   schema: { type: string }, example: Maharashtra }
 *       - { in: query, name: genre,    schema: { type: string }, example: Drama }
 *       - { in: query, name: is_free,  schema: { type: boolean } }
 *       - { in: query, name: search,   schema: { type: string } }
 *       - { in: query, name: year,     schema: { type: integer } }
 *       - { in: query, name: rating,   schema: { type: string, enum: [U, UA, A, S] } }
 *       - { in: query, name: sort,     schema: { type: string, enum: [newest, oldest, title, price_low, price_high], default: newest } }
 *     responses:
 *       200:
 *         description: Paginated list of movies with cast[] embedded
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 movies:
 *                   - id: "uuid"
 *                     title: "Dangal"
 *                     poster_url: "https://storage.googleapis.com/camcine-media/images/poster/dangal.jpg"
 *                     thumbnail_url: "https://storage.googleapis.com/camcine-media/images/thumbnail/dangal.jpg"
 *                     trailer_url: "https://storage.googleapis.com/camcine-media/trailers/dangal.mp4"
 *                     video_url: "https://storage.googleapis.com/camcine-media/videos/dangal.mp4"
 *                     stream_url_hls: "https://cdn.camcine.com/hls/dangal/master.m3u8"
 *                     cast:
 *                       - actor_name: "Aamir Khan"
 *                         role_type: "lead_actor"
 *                         billing_order: 1
 *                 pagination:
 *                   page: 1
 *                   limit: 10
 *                   total: 42
 *                   total_pages: 5
 */
router.get('/', getAllMovies);

/**
 * @swagger
 * /movies/{id}:
 *   get:
 *     summary: Get single movie with video_url, trailer_url, thumbnail_url and full cast[]
 *     tags: [Movies]
 *     security: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Full movie detail
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 movie:
 *                   id: "uuid"
 *                   title: "Dangal"
 *                   poster_url: "https://..."
 *                   thumbnail_url: "https://..."
 *                   trailer_url: "https://..."
 *                   video_url: "https://..."
 *                   stream_url_hls: "https://cdn.camcine.com/hls/dangal/master.m3u8"
 *                   stream_url_dash: "https://cdn.camcine.com/dash/dangal/manifest.mpd"
 *                   cast:
 *                     - actor_name: "Aamir Khan"
 *                       character_name: "Mahavir Singh Phogat"
 *                       role_type: "lead_actor"
 *                       billing_order: 1
 *                       headshot_url: "https://..."
 *       404:
 *         description: Movie not found
 */
router.get('/:id', [param('id').isUUID()], validate, getMovieById);

/**
 * @swagger
 * /movies:
 *   post:
 *     summary: Create a new movie (admin only)
 *     tags: [Movies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Dangal"
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
 *                 example: ["Drama", "Sports", "Biography"]
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
 *                 description: "Direct URL — or upload separately via POST /movies/upload/thumbnail"
 *                 example: "https://storage.googleapis.com/camcine-media/images/poster/dangal.jpg"
 *               thumbnail_url:
 *                 type: string
 *                 description: "Thumbnail / cover art URL — or upload via POST /movies/upload/thumbnail"
 *                 example: "https://storage.googleapis.com/camcine-media/images/thumbnail/dangal.jpg"
 *               trailer_url:
 *                 type: string
 *                 description: "Trailer video URL — or upload via POST /movies/upload/trailer"
 *                 example: "https://storage.googleapis.com/camcine-media/trailers/dangal.mp4"
 *               video_url:
 *                 type: string
 *                 description: "Full movie video URL — or upload via POST /movies/upload/video"
 *                 example: "https://storage.googleapis.com/camcine-media/videos/dangal.mp4"
 *               stream_url_hls:
 *                 type: string
 *                 description: "HLS stream URL (after transcoding)"
 *                 example: "https://cdn.camcine.com/hls/dangal/master.m3u8"
 *               stream_url_dash:
 *                 type: string
 *                 description: "DASH stream URL (after transcoding)"
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
 *               imdb_id:
 *                 type: string
 *                 example: "tt5074352"
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["blockbuster", "award-winner"]
 *               cast:
 *                 type: array
 *                 description: "Optionally embed cast at creation time"
 *                 items:
 *                   type: object
 *                   properties:
 *                     actor_id:       { type: string, format: uuid }
 *                     actor_name:     { type: string }
 *                     character_name: { type: string }
 *                     role_type:      { type: string, enum: [lead_actor, lead_actress, supporting_actor, supporting_actress, director, producer, music_director, lyricist, cinematographer, editor, cameo] }
 *                     billing_order:  { type: integer }
 *                     headshot_url:   { type: string, description: "Actor headshot / profile image URL" }
 *                     cast_image:     { type: string, description: "Alternate cast-specific image URL" }
 *           example:
 *             title: "Dangal"
 *             language: "Hindi"
 *             genre: ["Drama", "Sports"]
 *             director: "Nitesh Tiwari"
 *             release_year: 2016
 *             rating: "U"
 *             is_free: false
 *             price_tvod: 49
 *             duration_seconds: 9420
 *             imdb_id: "tt5074352"
 *             poster_url: "https://storage.googleapis.com/camcine-media/images/poster/dangal.jpg"
 *             thumbnail_url: "https://storage.googleapis.com/camcine-media/images/thumbnail/dangal.jpg"
 *             trailer_url: "https://storage.googleapis.com/camcine-media/trailers/dangal.mp4"
 *             video_url: "https://storage.googleapis.com/camcine-media/videos/dangal.mp4"
 *             stream_url_hls: "https://cdn.camcine.com/hls/dangal/master.m3u8"
 *             cast:
 *               - actor_name: "Aamir Khan"
 *                 character_name: "Mahavir Singh Phogat"
 *                 role_type: "lead_actor"
 *                 billing_order: 1
 *                 headshot_url: "https://storage.googleapis.com/camcine-media/images/headshots/aamir-khan.jpg"
 *               - actor_name: "Fatima Sana Shaikh"
 *                 character_name: "Geeta Phogat"
 *                 role_type: "lead_actress"
 *                 billing_order: 2
 *                 headshot_url: "https://storage.googleapis.com/camcine-media/images/headshots/fatima.jpg"
 *     responses:
 *       201:
 *         description: Movie created. All URL fields are optional — upload files separately if needed.
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin only
 */
router.post('/', authenticate, authorize('admin'), movieCreateRules, validate, createMovie);

/**
 * @swagger
 * /movies/{id}:
 *   put:
 *     summary: Update movie details (admin only)
 *     tags: [Movies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *               thumbnail_url:    { type: string }
 *               trailer_url:      { type: string }
 *               video_url:        { type: string }
 *               stream_url_hls:   { type: string }
 *               stream_url_dash:  { type: string }
 *               duration_seconds: { type: integer }
 *               is_free:          { type: boolean }
 *               price_tvod:       { type: number }
 *     responses:
 *       200:
 *         description: Movie updated
 *       404:
 *         description: Movie not found
 */
router.put('/:id', authenticate, authorize('admin'), [param('id').isUUID()], validate, updateMovie);

/**
 * @swagger
 * /movies/{id}/status:
 *   patch:
 *     summary: Update movie publish status (admin only)
 *     tags: [Movies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [draft, processing, published, archived], example: "published" }
 *     responses:
 *       200:
 *         description: Status updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Movie status updated to published."
 *               data:
 *                 movie:
 *                   id: "uuid"
 *                   title: "Dangal"
 *                   status: "published"
 */
router.patch(
  '/:id/status',
  authenticate, authorize('admin'),
  [param('id').isUUID(), body('status').isIn(['draft', 'processing', 'published', 'archived'])],
  validate, updateMovieStatus
);

/**
 * @swagger
 * /movies/{id}:
 *   delete:
 *     summary: Archive (soft delete) a movie (admin only)
 *     tags: [Movies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Movie archived
 *       404:
 *         description: Not found or already archived
 */
router.delete('/:id', authenticate, authorize('admin'), [param('id').isUUID()], validate, deleteMovie);

// ═══════════════════════════════════════════════════════════════
// UPLOAD ENDPOINTS
// content_id is sent in the request BODY — no ID in the URL path
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /movies/upload/video:
 *   post:
 *     summary: Upload full movie video file (admin only)
 *     tags: [Movies]
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
 *                 description: "Movie video file — MP4, MOV, MKV, AVI, WEBM (max 5GB)"
 *               content_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the movie to link this video to. Auto-updates video_url."
 *                 example: "b1c2d3e4-0000-0000-0000-111122223333"
 *     responses:
 *       201:
 *         description: Video uploaded and video_url updated on the movie record.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 public_url: "https://storage.googleapis.com/camcine-media/videos/uuid.mp4"
 *                 note: "For HLS streaming, transcode via Cloud Transcoder or FFmpeg."
 */
router.post(
  '/upload/video',
  authenticate, authorize('admin'),
  (req, res, next) => {
    videoUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next));
  },
  (req, res, next) => {
    req.body.linked_to_id   = req.body.content_id;
    req.body.linked_to_type = 'content';
    req.body.auto_update    = 'true';
    next();
  },
  uploadVideo
);

/**
 * @swagger
 * /movies/upload/trailer:
 *   post:
 *     summary: Upload movie trailer (admin only)
 *     tags: [Movies]
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
 *                 description: "Trailer video — MP4, MOV, WEBM (max 500MB)"
 *               content_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the movie to link this trailer to. Auto-updates trailer_url."
 *                 example: "b1c2d3e4-0000-0000-0000-111122223333"
 *     responses:
 *       201:
 *         description: Trailer uploaded and trailer_url updated on the movie record.
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
    req.body.linked_to_id   = req.body.content_id;
    req.body.linked_to_type = 'content';
    req.body.video_purpose  = 'trailer';
    req.body.auto_update    = 'true';
    next();
  },
  uploadVideo
);

/**
 * @swagger
 * /movies/upload/thumbnail:
 *   post:
 *     summary: Upload movie poster / thumbnail image (admin only)
 *     tags: [Movies]
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
 *                 description: "Image — JPG, PNG, WEBP (max 10MB)"
 *               content_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the movie to link this image to. Auto-updates thumbnail_url."
 *                 example: "b1c2d3e4-0000-0000-0000-111122223333"
 *     responses:
 *       201:
 *         description: Thumbnail uploaded and thumbnail_url updated on the movie record.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 public_url: "https://storage.googleapis.com/camcine-media/images/thumbnail/uuid.jpg"
 */
router.post(
  '/upload/thumbnail',
  authenticate, authorize('admin'),
  (req, res, next) => {
    imageUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next));
  },
  (req, res, next) => {
    req.body.linked_to_id   = req.body.content_id;
    req.body.linked_to_type = 'content';
    req.body.image_purpose  = 'thumbnail';
    req.body.auto_update    = 'true';
    next();
  },
  uploadImage
);

// ═══════════════════════════════════════════════════════════════
// CAST ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /movies/{id}/cast:
 *   post:
 *     summary: Add a cast member to a movie (admin only)
 *     tags: [Movies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actor_id:       { type: string, format: uuid, description: "UUID if actor exists on platform" }
 *               actor_name:     { type: string, example: "Aamir Khan" }
 *               character_name: { type: string, example: "Mahavir Singh Phogat" }
 *               role_type:      { type: string, enum: [lead_actor, lead_actress, supporting_actor, supporting_actress, director, producer, music_director, lyricist, cinematographer, editor, cameo] }
 *               billing_order:  { type: integer, example: 1 }
 *               headshot_url:   { type: string }
 *               cast_image:     { type: string }
 *     responses:
 *       201:
 *         description: Cast member added to movie
 */
router.post('/:id/cast', authenticate, authorize('admin'), [param('id').isUUID()], validate, addMovieCast);

/**
 * @swagger
 * /movies/{id}/cast/bulk:
 *   post:
 *     summary: Add multiple cast members at once (admin only)
 *     tags: [Movies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cast]
 *             properties:
 *               cast:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     actor_name:     { type: string }
 *                     character_name: { type: string }
 *                     role_type:      { type: string }
 *                     billing_order:  { type: integer }
 *           example:
 *             cast:
 *               - actor_name: "Aamir Khan"
 *                 character_name: "Mahavir Singh Phogat"
 *                 role_type: "lead_actor"
 *                 billing_order: 1
 *                 headshot_url: "https://storage.googleapis.com/camcine-media/images/headshots/aamir-khan.jpg"
 *               - actor_name: "Fatima Sana Shaikh"
 *                 character_name: "Geeta Phogat"
 *                 role_type: "lead_actress"
 *                 billing_order: 2
 *                 headshot_url: "https://storage.googleapis.com/camcine-media/images/headshots/fatima.jpg"
 *     responses:
 *       201:
 *         description: All cast members added
 */
router.post(
  '/:id/cast/bulk',
  authenticate, authorize('admin'),
  [param('id').isUUID(), body('cast').isArray({ min: 1 })],
  validate, bulkAddMovieCast
);

/**
 * @swagger
 * /movies/{id}/cast/{castId}:
 *   put:
 *     summary: Update a movie cast member (admin only)
 *     tags: [Movies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id,     required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: castId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               character_name: { type: string }
 *               role_type:      { type: string }
 *               billing_order:  { type: integer }
 *               headshot_url:   { type: string }
 *               cast_image:     { type: string }
 *     responses:
 *       200:
 *         description: Cast member updated
 *   delete:
 *     summary: Remove a cast member from a movie (admin only)
 *     tags: [Movies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id,     required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: castId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Cast member removed
 *       404:
 *         description: Cast member not found
 */
router.put('/:id/cast/:castId',    authenticate, authorize('admin'), [param('id').isUUID(), param('castId').isUUID()], validate, updateMovieCast);
router.delete('/:id/cast/:castId', authenticate, authorize('admin'), [param('id').isUUID(), param('castId').isUUID()], validate, removeMovieCast);

module.exports = router;