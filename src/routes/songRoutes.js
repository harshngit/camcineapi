// ============================================================
// songRoutes.js — Camcine OTT Song Module
// Base path: /api/v1/songs
//
// Upload endpoints send song_id in the request BODY,
// NOT in the URL path — keeps uploads decoupled.
// ============================================================

const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { body, param } = require('express-validator');
const {
  getAllSongs, getSongById,
  createSong, updateSong, deleteSong,
  uploadSongAudio, uploadSongLyrics, uploadSongThumbnail,
  addSongCast, removeSongCast,
} = require('../controllers/songController');
const { authenticate, authorize } = require('../middleware/auth');
const { createUploader, handleMulterError } = require('../middleware/uploadMiddleware');
const validate = require('../middleware/validate');

const imageUploader = createUploader('image');
const audioUploader = createUploader('audio');

const lyricsUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.lrc', '.vtt', '.txt', '.srt'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(allowed.includes(ext) ? null : new Error('Only .lrc .vtt .txt .srt files are allowed'), allowed.includes(ext));
  },
});

const songCreateRules = [
  body('song_name').notEmpty().trim().withMessage('song_name is required'),
  body('rating').optional().isIn(['U', 'UA', 'A', 'S']),
  body('release_year').optional().isInt({ min: 1900, max: 2100 }),
  body('price_tvod').optional().isFloat({ min: 0 }),
  body('duration_seconds').optional().isInt({ min: 1 }),
  body('is_free').optional().isBoolean(),
  body('genre').optional().isArray(),
  body('mood_tags').optional().isArray(),
  body('instruments').optional().isArray(),
  body('artist_ids').optional().isArray(),
  body('cast').optional().isArray(),
];

/**
 * @swagger
 * tags:
 *   - name: Songs
 *     description: Song management — CRUD, audio/lyrics/thumbnail uploads, artists (cast)
 */

// ═══════════════════════════════════════════════════════════════
// SONG CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /songs:
 *   get:
 *     summary: List all published songs with filters & pagination
 *     tags: [Songs]
 *     security: []
 *     parameters:
 *       - { in: query, name: page,     schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit,    schema: { type: integer, default: 10 } }
 *       - { in: query, name: language, schema: { type: string } }
 *       - { in: query, name: genre,    schema: { type: string } }
 *       - { in: query, name: is_free,  schema: { type: boolean } }
 *       - { in: query, name: search,   schema: { type: string } }
 *       - { in: query, name: mood,     schema: { type: string }, example: "romantic" }
 *       - { in: query, name: album,    schema: { type: string } }
 *       - { in: query, name: festival, schema: { type: string }, example: "Navratri" }
 *       - { in: query, name: sort,     schema: { type: string, enum: [newest, oldest, title], default: newest } }
 *     responses:
 *       200:
 *         description: Paginated list of songs with metadata and cast[] embedded
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 songs:
 *                   - id: "uuid"
 *                     song_name: "Kesariya"
 *                     audio_url_hq: "https://storage.googleapis.com/camcine-media/audio/hq/kesariya.aac"
 *                     audio_url_lq: "https://storage.googleapis.com/camcine-media/audio/lq/kesariya.mp3"
 *                     lyrics_url: "https://storage.googleapis.com/camcine-media/lyrics/kesariya.lrc"
 *                     song_video_url: "https://storage.googleapis.com/camcine-media/videos/kesariya-mv.mp4"
 *                     stream_url_hls: "https://cdn.camcine.com/hls/kesariya/master.m3u8"
 *                     mood_tags: ["romantic", "folk"]
 *                     album: "Brahmastra"
 *                     cast:
 *                       - actor_name: "Arijit Singh"
 *                         role_type: "singer"
 *                         billing_order: 1
 *                 pagination:
 *                   page: 1
 *                   total: 25
 */
router.get('/', getAllSongs);

/**
 * @swagger
 * /songs/{id}:
 *   get:
 *     summary: Get a single song with all metadata and cast[]
 *     tags: [Songs]
 *     security: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Full song detail
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 song:
 *                   id: "uuid"
 *                   song_name: "Kesariya"
 *                   description: "Romantic Sufi song from Brahmastra"
 *                   language: "Hindi"
 *                   genre: ["Romantic", "Sufi"]
 *                   director: "Pritam"
 *                   release_year: 2022
 *                   rating: "U"
 *                   duration_seconds: 270
 *                   is_free: true
 *                   poster_url: "https://..."
 *                   thumbnail_url: "https://..."
 *                   stream_url_hls: "https://cdn.camcine.com/hls/kesariya/master.m3u8"
 *                   stream_url_dash: "https://cdn.camcine.com/dash/kesariya/manifest.mpd"
 *                   audio_url_hq: "https://storage.googleapis.com/camcine-media/audio/hq/kesariya.aac"
 *                   audio_url_lq: "https://storage.googleapis.com/camcine-media/audio/lq/kesariya.mp3"
 *                   lyrics_url: "https://storage.googleapis.com/camcine-media/lyrics/kesariya.lrc"
 *                   song_video_url: "https://storage.googleapis.com/camcine-media/videos/kesariya-mv.mp4"
 *                   mood_tags: ["romantic", "folk"]
 *                   instruments: ["guitar", "tabla"]
 *                   album: "Brahmastra"
 *                   festival: null
 *                   cast:
 *                     - actor_name: "Arijit Singh"
 *                       role_type: "singer"
 *                       billing_order: 1
 *                     - actor_name: "Pritam"
 *                       role_type: "music_director"
 *                       billing_order: 2
 *       404:
 *         description: Song not found
 */
router.get('/:id', [param('id').isUUID()], validate, getSongById);

/**
 * @swagger
 * /songs:
 *   post:
 *     summary: Create a new song with all OTT fields (admin only)
 *     tags: [Songs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [song_name]
 *             properties:
 *               song_name:
 *                 type: string
 *                 example: "Kesariya"
 *                 description: "Name / title of the song"
 *               description:
 *                 type: string
 *                 example: "Romantic Sufi song from Brahmastra"
 *               language:
 *                 type: string
 *                 example: "Hindi"
 *               region:
 *                 type: string
 *                 example: "Pan-India"
 *               genre:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["Romantic", "Sufi", "Folk"]
 *               director:
 *                 type: string
 *                 example: "Pritam"
 *                 description: "Music director / composer"
 *               release_year:
 *                 type: integer
 *                 example: 2022
 *               rating:
 *                 type: string
 *                 enum: [U, UA, A, S]
 *                 example: "U"
 *               duration_seconds:
 *                 type: integer
 *                 example: 270
 *               is_free:
 *                 type: boolean
 *                 example: true
 *               price_tvod:
 *                 type: number
 *                 example: 0
 *               imdb_id:
 *                 type: string
 *                 example: "tt1234567"
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["hit", "chartbuster"]
 *               poster_url:
 *                 type: string
 *                 description: "Song poster URL — or upload via POST /songs/upload/thumbnail"
 *                 example: "https://storage.googleapis.com/camcine-media/images/poster/kesariya.jpg"
 *               thumbnail_url:
 *                 type: string
 *                 description: "Cover art / thumbnail URL — or upload via POST /songs/upload/thumbnail"
 *                 example: "https://storage.googleapis.com/camcine-media/images/thumbnail/kesariya.jpg"
 *               stream_url_hls:
 *                 type: string
 *                 description: "HLS stream URL for audio streaming (after transcoding)"
 *                 example: "https://cdn.camcine.com/hls/kesariya/master.m3u8"
 *               stream_url_dash:
 *                 type: string
 *                 description: "DASH stream URL for audio streaming (after transcoding)"
 *                 example: "https://cdn.camcine.com/dash/kesariya/manifest.mpd"
 *               audio_url_hq:
 *                 type: string
 *                 description: "320kbps HQ audio URL — or upload via POST /songs/upload/audio"
 *                 example: "https://storage.googleapis.com/camcine-media/audio/hq/kesariya.aac"
 *               audio_url_lq:
 *                 type: string
 *                 description: "128kbps LQ audio URL — or upload via POST /songs/upload/audio"
 *                 example: "https://storage.googleapis.com/camcine-media/audio/lq/kesariya.mp3"
 *               video_url:
 *                 type: string
 *                 description: "Music video / song video URL"
 *                 example: "https://storage.googleapis.com/camcine-media/videos/kesariya-mv.mp4"
 *               lyrics_url:
 *                 type: string
 *                 description: "Lyrics file URL (.lrc / .vtt / .srt) — or upload via POST /songs/upload/lyrics"
 *                 example: "https://storage.googleapis.com/camcine-media/lyrics/kesariya.lrc"
 *               mood_tags:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["romantic", "folk", "sufi"]
 *               instruments:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["guitar", "tabla", "flute"]
 *               festival:
 *                 type: string
 *                 example: "Diwali"
 *                 description: "Festival association if applicable"
 *               album:
 *                 type: string
 *                 example: "Brahmastra"
 *               artist_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: "UUIDs of artists registered on the platform"
 *               cast:
 *                 type: array
 *                 description: "Artists — singers, musicians, lyricists, music directors"
 *                 items:
 *                   type: object
 *                   properties:
 *                     actor_id:       { type: string, format: uuid }
 *                     actor_name:     { type: string }
 *                     character_name: { type: string, description: "Role label e.g. Lead Vocalist" }
 *                     role_type:      { type: string, enum: [singer, music_director, lyricist, narrator, cameo] }
 *                     billing_order:  { type: integer }
 *                     headshot_url:   { type: string, description: "Artist headshot / profile image URL" }
 *                     cast_image:     { type: string, description: "Alternate artist-specific image URL" }
 *           example:
 *             song_name: "Kesariya"
 *             description: "Romantic Sufi song from Brahmastra"
 *             language: "Hindi"
 *             genre: ["Romantic", "Sufi"]
 *             director: "Pritam"
 *             release_year: 2022
 *             rating: "U"
 *             duration_seconds: 270
 *             is_free: true
 *             album: "Brahmastra"
 *             mood_tags: ["romantic", "folk"]
 *             instruments: ["guitar", "tabla"]
 *             poster_url: "https://storage.googleapis.com/camcine-media/images/poster/kesariya.jpg"
 *             thumbnail_url: "https://storage.googleapis.com/camcine-media/images/thumbnail/kesariya.jpg"
 *             audio_url_hq: "https://storage.googleapis.com/camcine-media/audio/hq/kesariya.aac"
 *             audio_url_lq: "https://storage.googleapis.com/camcine-media/audio/lq/kesariya.mp3"
 *             lyrics_url: "https://storage.googleapis.com/camcine-media/lyrics/kesariya.lrc"
 *             video_url: "https://storage.googleapis.com/camcine-media/videos/kesariya-mv.mp4"
 *             stream_url_hls: "https://cdn.camcine.com/hls/kesariya/master.m3u8"
 *             cast:
 *               - actor_name: "Arijit Singh"
 *                 role_type: "singer"
 *                 billing_order: 1
 *                 headshot_url: "https://storage.googleapis.com/camcine-media/images/headshots/arijit-singh.jpg"
 *               - actor_name: "Pritam"
 *                 role_type: "music_director"
 *                 billing_order: 2
 *                 headshot_url: "https://storage.googleapis.com/camcine-media/images/headshots/pritam.jpg"
 *               - actor_name: "Amitabh Bhattacharya"
 *                 role_type: "lyricist"
 *                 billing_order: 3
 *                 headshot_url: "https://storage.googleapis.com/camcine-media/images/headshots/amitabh-bhattacharya.jpg"
 *     responses:
 *       201:
 *         description: Song created as draft. All URL fields optional — upload files separately if needed.
 *       400:
 *         description: Validation error / song_name missing
 *       403:
 *         description: Admin only
 */
router.post('/', authenticate, authorize('admin'), songCreateRules, validate, createSong);

/**
 * @swagger
 * /songs/{id}:
 *   put:
 *     summary: Update song fields and metadata (admin only)
 *     tags: [Songs]
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
 *               song_name:        { type: string }
 *               description:      { type: string }
 *               language:         { type: string }
 *               genre:            { type: array, items: { type: string } }
 *               director:         { type: string }
 *               release_year:     { type: integer }
 *               rating:           { type: string, enum: [U, UA, A, S] }
 *               status:           { type: string, enum: [draft, processing, published, archived] }
 *               poster_url:       { type: string }
 *               thumbnail_url:    { type: string }
 *               stream_url_hls:   { type: string }
 *               stream_url_dash:  { type: string }
 *               duration_seconds: { type: integer }
 *               is_free:          { type: boolean }
 *               price_tvod:       { type: number }
 *               mood_tags:        { type: array, items: { type: string } }
 *               instruments:      { type: array, items: { type: string } }
 *               festival:         { type: string }
 *               album:            { type: string }
 *               lyrics_url:       { type: string }
 *               audio_url_hq:     { type: string }
 *               audio_url_lq:     { type: string }
 *               video_url:        { type: string }
 *               artist_ids:       { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Song updated
 *   delete:
 *     summary: Archive (soft delete) a song (admin only)
 *     tags: [Songs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Song archived
 */
router.put('/:id',    authenticate, authorize('admin'), [param('id').isUUID()], validate, updateSong);
router.delete('/:id', authenticate, authorize('admin'), [param('id').isUUID()], validate, deleteSong);

// ═══════════════════════════════════════════════════════════════
// UPLOAD ENDPOINTS — song_id in request body, no ID in URL
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /songs/upload/audio:
 *   post:
 *     summary: Upload HQ + optional LQ audio for a song (admin only)
 *     tags: [Songs]
 *     security:
 *       - bearerAuth: []
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
 *                 description: "HQ audio file — MP3, AAC, WAV, FLAC (max 100MB). Auto-updates audio_url_hq."
 *               audio_lq:
 *                 type: string
 *                 format: binary
 *                 description: "LQ audio file — MP3, AAC (max 100MB, optional). Auto-updates audio_url_lq."
 *               song_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the song to link this audio to"
 *                 example: "c1d2e3f4-0000-0000-0000-111122223333"
 *     responses:
 *       201:
 *         description: Audio uploaded and linked to song. audio_url_hq/lq auto-updated.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 audio_hq:
 *                   upload_id: "uuid"
 *                   public_url: "https://storage.googleapis.com/camcine-media/audio/hq/uuid.aac"
 *                 audio_lq:
 *                   upload_id: "uuid"
 *                   public_url: "https://storage.googleapis.com/camcine-media/audio/lq/uuid.mp3"
 */
router.post(
  '/upload/audio',
  authenticate, authorize('admin'),
  (req, res, next) => {
    audioUploader.fields([
      { name: 'audio_hq', maxCount: 1 },
      { name: 'audio_lq', maxCount: 1 },
    ])(req, res, (err) => handleMulterError(err, req, res, next));
  },
  uploadSongAudio
);

/**
 * @swagger
 * /songs/upload/lyrics:
 *   post:
 *     summary: Upload lyrics file for a song (admin only)
 *     tags: [Songs]
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
 *                 description: "Lyrics file — .lrc, .vtt, .srt, .txt (max 5MB). Auto-updates lyrics_url."
 *               song_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the song to link this lyrics file to"
 *                 example: "c1d2e3f4-0000-0000-0000-111122223333"
 *     responses:
 *       201:
 *         description: Lyrics uploaded and lyrics_url auto-updated on the song.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 public_url: "https://storage.googleapis.com/camcine-media/lyrics/uuid.lrc"
 *                 file_name: "uuid.lrc"
 */
router.post(
  '/upload/lyrics',
  authenticate, authorize('admin'),
  (req, res, next) => {
    lyricsUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next));
  },
  uploadSongLyrics
);

/**
 * @swagger
 * /songs/upload/thumbnail:
 *   post:
 *     summary: Upload song cover art / thumbnail (admin only)
 *     tags: [Songs]
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
 *                 description: "JPG, PNG, WEBP — max 10MB. Auto-updates thumbnail_url."
 *               song_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the song to link this image to"
 *                 example: "c1d2e3f4-0000-0000-0000-111122223333"
 *     responses:
 *       201:
 *         description: Thumbnail uploaded and thumbnail_url auto-updated on the song.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 public_url: "https://storage.googleapis.com/camcine-media/images/song-thumbnails/uuid.jpg"
 */
router.post(
  '/upload/thumbnail',
  authenticate, authorize('admin'),
  (req, res, next) => {
    imageUploader.single('file')(req, res, (err) => handleMulterError(err, req, res, next));
  },
  uploadSongThumbnail
);

// ═══════════════════════════════════════════════════════════════
// CAST / ARTISTS
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /songs/{id}/cast:
 *   post:
 *     summary: Add a singer / musician / lyricist to a song (admin only)
 *     tags: [Songs]
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
 *               actor_id:       { type: string, format: uuid, description: "UUID if artist is on the platform" }
 *               actor_name:     { type: string, example: "Arijit Singh" }
 *               character_name: { type: string, example: "Lead Vocalist" }
 *               role_type:      { type: string, enum: [singer, music_director, lyricist, narrator, cameo], default: "singer" }
 *               billing_order:  { type: integer, example: 1 }
 *               headshot_url:   { type: string }
 *           example:
 *             actor_name: "Arijit Singh"
 *             role_type: "singer"
 *             billing_order: 1
 *     responses:
 *       201:
 *         description: Artist added to song
 */
router.post('/:id/cast', authenticate, authorize('admin'), [param('id').isUUID()], validate, addSongCast);

/**
 * @swagger
 * /songs/{id}/cast/{castId}:
 *   delete:
 *     summary: Remove an artist from a song (admin only)
 *     tags: [Songs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id,     required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: castId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Artist removed from song
 *       404:
 *         description: Artist not found on this song
 */
router.delete('/:id/cast/:castId', authenticate, authorize('admin'), [param('id').isUUID(), param('castId').isUUID()], validate, removeSongCast);

module.exports = router;