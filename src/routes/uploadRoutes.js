// ============================================================
// uploadRoutes.js — Camcine OTT Upload + Cast Routes
// Base path: /api/v1/upload  and  /api/v1/content/:id/cast
// Place in: src/routes/uploadRoutes.js
// ============================================================

const router = require('express').Router();
const { body, param } = require('express-validator');
const {
  uploadImage, uploadVideo, uploadTrailer,
  uploadAudio, uploadLyrics, getMyUploads, deleteUpload,
} = require('../controllers/uploadController');
const {
  getContentCast, addContentCast, updateContentCast,
  removeContentCast, bulkAddCast,
  getEpisodeCast, addEpisodeCast, removeEpisodeCast,
} = require('../controllers/castController');
const { authenticate, authorize } = require('../middleware/auth');
const { createUploader, handleMulterError } = require('../middleware/uploadMiddleware');
const validate = require('../middleware/validate');

// ── Multer instances per file type ────────────────────────────
const imageUploader   = createUploader('image');
const videoUploader   = createUploader('video');
const trailerUploader = createUploader('trailer');
const audioUploader   = createUploader('audio');
const lyricsUploader  = multer({
  storage: require('multer').memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.lrc', '.vtt', '.txt', '.srt'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    cb(allowed.includes(ext) ? null : new Error('Only .lrc .vtt .txt .srt files allowed'), allowed.includes(ext));
  },
});

// Need multer ref for lyrics
const multer = require('multer');

/**
 * @swagger
 * tags:
 *   - name: Upload
 *     description: File uploads to Google Cloud Storage
 *   - name: Cast
 *     description: Cast management per movie, show, episode
 */

// ═══════════════════════════════════════════════════════════════
// UPLOAD ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// ── POST /upload/image ────────────────────────────────────────
/**
 * @swagger
 * /upload/image:
 *   post:
 *     summary: Upload image — poster, thumbnail, cover, actor headshot
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
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
 *                 description: "Image file — JPG, PNG, WEBP (max 10MB)"
 *               linked_to_id:
 *                 type: string
 *                 format: uuid
 *                 description: "content_id or episode_id or actor_id to link this image to"
 *               linked_to_type:
 *                 type: string
 *                 enum: [content, episode, actor, news]
 *               image_purpose:
 *                 type: string
 *                 enum: [poster, thumbnail, headshot, cover, banner]
 *                 example: "poster"
 *               auto_update:
 *                 type: string
 *                 enum: ["true", "false"]
 *                 description: "If true, auto-updates poster_url/thumbnail_url/headshot_url in DB"
 *     responses:
 *       201:
 *         description: Image uploaded. Returns public_url.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Image uploaded successfully."
 *               data:
 *                 upload_id: "uuid"
 *                 public_url: "https://storage.googleapis.com/camcine-media/images/poster/abc123.jpg"
 *                 file_name: "abc123.jpg"
 *                 file_size: 204800
 */
router.post(
  '/upload/image',
  authenticate,
  authorize('admin'),
  (req, res, next) => imageUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next)),
  uploadImage
);

// ── POST /upload/video ────────────────────────────────────────
/**
 * @swagger
 * /upload/video:
 *   post:
 *     summary: Upload full video — movie or episode
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
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
 *                 description: "Video file — MP4, MOV, MKV, AVI, WEBM (max 5GB)"
 *               linked_to_id:
 *                 type: string
 *                 format: uuid
 *                 description: "content_id or episode_id"
 *               linked_to_type:
 *                 type: string
 *                 enum: [content, episode]
 *               auto_update:
 *                 type: string
 *                 enum: ["true", "false"]
 *                 description: "Auto-update stream_url_hls in DB"
 *     responses:
 *       201:
 *         description: Video uploaded. Returns public_url.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 upload_id: "uuid"
 *                 public_url: "https://storage.googleapis.com/camcine-media/videos/abc123.mp4"
 *                 note: "For HLS streaming, transcode via Cloud Transcoder or FFmpeg."
 */
router.post(
  '/upload/video',
  authenticate,
  authorize('admin'),
  (req, res, next) => videoUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next)),
  uploadVideo
);

// ── POST /upload/trailer ──────────────────────────────────────
/**
 * @swagger
 * /upload/trailer:
 *   post:
 *     summary: Upload trailer for a movie or show
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
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
 *               linked_to_id:
 *                 type: string
 *                 format: uuid
 *                 description: "content_id to link trailer to"
 *               auto_update:
 *                 type: string
 *                 enum: ["true", "false"]
 *                 description: "Auto-update trailer_url in content"
 *     responses:
 *       201:
 *         description: Trailer uploaded
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 public_url: "https://storage.googleapis.com/camcine-media/trailers/xyz.mp4"
 */
router.post(
  '/upload/trailer',
  authenticate,
  authorize('admin'),
  (req, res, next) => trailerUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next)),
  uploadTrailer
);

// ── POST /upload/audio ────────────────────────────────────────
/**
 * @swagger
 * /upload/audio:
 *   post:
 *     summary: Upload song audio — HQ (320kbps) and optionally LQ (128kbps)
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [audio_hq]
 *             properties:
 *               audio_hq:
 *                 type: string
 *                 format: binary
 *                 description: "HQ audio file — MP3, AAC, WAV, FLAC (max 100MB)"
 *               audio_lq:
 *                 type: string
 *                 format: binary
 *                 description: "LQ audio file — MP3, AAC (max 100MB) — optional"
 *               linked_to_id:
 *                 type: string
 *                 format: uuid
 *                 description: "content_id of the song"
 *               auto_update:
 *                 type: string
 *                 enum: ["true", "false"]
 *                 description: "Auto-update audio_url_hq / audio_url_lq in songs_metadata"
 *     responses:
 *       201:
 *         description: Audio uploaded
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 audio_hq:
 *                   upload_id: "uuid"
 *                   public_url: "https://storage.googleapis.com/camcine-media/audio/hq/abc.aac"
 *                 audio_lq:
 *                   upload_id: "uuid"
 *                   public_url: "https://storage.googleapis.com/camcine-media/audio/lq/abc.mp3"
 */
router.post(
  '/upload/audio',
  authenticate,
  authorize('admin'),
  (req, res, next) => {
    audioUploader.fields([
      { name: 'audio_hq', maxCount: 1 },
      { name: 'audio_lq', maxCount: 1 },
    ])(req, res, (err) => handleMulterError(err, req, res, next));
  },
  uploadAudio
);

// ── POST /upload/lyrics ───────────────────────────────────────
/**
 * @swagger
 * /upload/lyrics:
 *   post:
 *     summary: Upload lyrics file (.lrc or .vtt) for a song
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
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
 *                 description: "Lyrics file — .lrc, .vtt, .srt, .txt (max 5MB)"
 *               linked_to_id:
 *                 type: string
 *                 format: uuid
 *                 description: "content_id of the song"
 *               auto_update:
 *                 type: string
 *                 enum: ["true", "false"]
 *     responses:
 *       201:
 *         description: Lyrics uploaded
 */
router.post(
  '/upload/lyrics',
  authenticate,
  authorize('admin'),
  (req, res, next) => {
    const multer = require('multer');
    const path = require('path');
    const lyricsUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = ['.lrc','.vtt','.txt','.srt'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(allowed.includes(ext) ? null : new Error('Only .lrc .vtt .txt .srt allowed'), allowed.includes(ext));
      },
    });
    lyricsUpload.single('file')(req, res, (err) => handleMulterError(err, req, res, next));
  },
  uploadLyrics
);

// ── GET /upload/my-uploads ────────────────────────────────────
/**
 * @swagger
 * /upload/my-uploads:
 *   get:
 *     summary: Get all uploads by the logged-in user
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: file_type
 *         schema: { type: string, enum: [image, video, audio, trailer, document] }
 *       - in: query
 *         name: linked_to_id
 *         schema: { type: string, format: uuid }
 *         description: Filter uploads linked to a specific content/episode
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of uploads
 */
router.get('/upload/my-uploads', authenticate, authorize('admin'), getMyUploads);

// ── DELETE /upload/:id ────────────────────────────────────────
/**
 * @swagger
 * /upload/{id}:
 *   delete:
 *     summary: Delete an upload from GCS and DB
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Upload not found
 */
router.delete(
  '/upload/:id',
  authenticate,
  authorize('admin'),
  [param('id').isUUID()],
  validate,
  deleteUpload
);

// ═══════════════════════════════════════════════════════════════
// CAST ENDPOINTS — Content Cast
// ═══════════════════════════════════════════════════════════════

// ── GET /content/:id/cast ─────────────────────────────────────
/**
 * @swagger
 * /content/{id}/cast:
 *   get:
 *     summary: Get full cast for a movie, show, or song
 *     tags: [Cast]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Content UUID
 *     responses:
 *       200:
 *         description: Full cast list ordered by billing
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total: 3
 *                 cast:
 *                   - id: "cast-uuid"
 *                     actor_name: "Aamir Khan"
 *                     character_name: "Mahavir Singh Phogat"
 *                     role_type: "lead_actor"
 *                     billing_order: 1
 *                     final_headshot_url: "https://storage.googleapis.com/..."
 *                     actor_is_verified: true
 */
router.get(
  '/content/:id/cast',
  [param('id').isUUID()],
  validate,
  getContentCast
);

// ── POST /content/:id/cast ────────────────────────────────────
/**
 * @swagger
 * /content/{id}/cast:
 *   post:
 *     summary: Add a single cast member to content (admin only)
 *     tags: [Cast]
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
 *             properties:
 *               actor_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of actor already on Camcine platform (optional)"
 *               actor_name:
 *                 type: string
 *                 description: "Name if actor is NOT on platform"
 *                 example: "Aamir Khan"
 *               character_name:
 *                 type: string
 *                 example: "Mahavir Singh Phogat"
 *               role_type:
 *                 type: string
 *                 enum: [lead_actor, lead_actress, supporting_actor, supporting_actress, director, producer, music_director, lyricist, cinematographer, editor, singer, narrator, cameo]
 *                 example: "lead_actor"
 *               billing_order:
 *                 type: integer
 *                 example: 1
 *                 description: "1 = top billed, 99 = lowest"
 *               headshot_url:
 *                 type: string
 *                 description: "Override actor's default headshot"
 *               cast_image:
 *                 type: string
 *                 description: "Direct cast member image URL"
 *           examples:
 *             Platform Actor:
 *               summary: Link an actor already on Camcine
 *               value:
 *                 actor_id: "uuid-of-actor"
 *                 character_name: "Mahavir Singh Phogat"
 *                 role_type: "lead_actor"
 *                 billing_order: 1
 *             External Actor:
 *               summary: Add actor NOT yet on Camcine
 *               value:
 *                 actor_name: "Fatima Sana Shaikh"
 *                 character_name: "Geeta Phogat"
 *                 role_type: "lead_actress"
 *                 billing_order: 2
 *     responses:
 *       201:
 *         description: Cast member added
 */
router.post(
  '/content/:id/cast',
  authenticate,
  authorize('admin'),
  [param('id').isUUID()],
  validate,
  addContentCast
);

// ── POST /content/:id/cast/bulk ───────────────────────────────
/**
 * @swagger
 * /content/{id}/cast/bulk:
 *   post:
 *     summary: Add multiple cast members at once (admin only)
 *     tags: [Cast]
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
 *             required: [cast]
 *             properties:
 *               cast:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     actor_id:       { type: string, format: uuid }
 *                     actor_name:     { type: string }
 *                     character_name: { type: string }
 *                     role_type:      { type: string }
 *                     billing_order:  { type: integer }
 *                     headshot_url:   { type: string }
 *                     cast_image:     { type: string }
 *           example:
 *             cast:
 *               - actor_name: "Aamir Khan"
 *                 character_name: "Mahavir Singh Phogat"
 *                 role_type: "lead_actor"
 *                 billing_order: 1
 *               - actor_name: "Fatima Sana Shaikh"
 *                 character_name: "Geeta Phogat"
 *                 role_type: "lead_actress"
 *                 billing_order: 2
 *               - actor_name: "Sakshi Tanwar"
 *                 character_name: "Daya Kaur"
 *                 role_type: "supporting_actress"
 *                 billing_order: 3
 *     responses:
 *       201:
 *         description: All cast members added
 */
router.post(
  '/content/:id/cast/bulk',
  authenticate,
  authorize('admin'),
  [
    param('id').isUUID(),
    body('cast').isArray({ min: 1 }).withMessage('cast must be a non-empty array'),
  ],
  validate,
  bulkAddCast
);

// ── PUT /content/:id/cast/:castId ─────────────────────────────
/**
 * @swagger
 * /content/{id}/cast/{castId}:
 *   put:
 *     summary: Update a cast member's role or character name (admin only)
 *     tags: [Cast]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: castId
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *         description: Cast updated
 */
router.put(
  '/content/:id/cast/:castId',
  authenticate,
  authorize('admin'),
  [param('id').isUUID(), param('castId').isUUID()],
  validate,
  updateContentCast
);

// ── DELETE /content/:id/cast/:castId ──────────────────────────
/**
 * @swagger
 * /content/{id}/cast/{castId}:
 *   delete:
 *     summary: Remove a cast member from content (admin only)
 *     tags: [Cast]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: castId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Removed
 */
router.delete(
  '/content/:id/cast/:castId',
  authenticate,
  authorize('admin'),
  [param('id').isUUID(), param('castId').isUUID()],
  validate,
  removeContentCast
);

// ═══════════════════════════════════════════════════════════════
// CAST ENDPOINTS — Episode Cast (Guest Stars)
// ═══════════════════════════════════════════════════════════════

// ── GET /content/:id/episodes/:episodeId/cast ─────────────────
/**
 * @swagger
 * /content/{id}/episodes/{episodeId}/cast:
 *   get:
 *     summary: Get guest cast for a specific episode
 *     tags: [Cast]
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
 *         description: Episode cast list
 */
router.get(
  '/content/:id/episodes/:episodeId/cast',
  [param('id').isUUID(), param('episodeId').isUUID()],
  validate,
  getEpisodeCast
);

// ── POST /content/:id/episodes/:episodeId/cast ────────────────
/**
 * @swagger
 * /content/{id}/episodes/{episodeId}/cast:
 *   post:
 *     summary: Add guest cast to a specific episode (admin only)
 *     tags: [Cast]
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actor_id:       { type: string, format: uuid }
 *               actor_name:     { type: string, example: "Pankaj Tripathi" }
 *               character_name: { type: string, example: "Kaleen Bhaiya" }
 *               role_type:      { type: string, enum: [lead_actor, lead_actress, supporting_actor, supporting_actress, guest, cameo, narrator] }
 *               billing_order:  { type: integer }
 *               cast_image:     { type: string }
 *     responses:
 *       201:
 *         description: Episode cast member added
 */
router.post(
  '/content/:id/episodes/:episodeId/cast',
  authenticate,
  authorize('admin'),
  [param('id').isUUID(), param('episodeId').isUUID()],
  validate,
  addEpisodeCast
);

// ── DELETE /content/:id/episodes/:episodeId/cast/:castId ──────
/**
 * @swagger
 * /content/{id}/episodes/{episodeId}/cast/{castId}:
 *   delete:
 *     summary: Remove episode guest cast member (admin only)
 *     tags: [Cast]
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
 *       - in: path
 *         name: castId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Removed
 */
router.delete(
  '/content/:id/episodes/:episodeId/cast/:castId',
  authenticate,
  authorize('admin'),
  [param('id').isUUID(), param('episodeId').isUUID(), param('castId').isUUID()],
  validate,
  removeEpisodeCast
);

module.exports = router;
