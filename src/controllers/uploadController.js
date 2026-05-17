// ============================================================
// uploadController.js — Camcine OTT Media Upload APIs
// Handles: Images, Videos, Trailers, Audio (Songs)
// Place this in: src/controllers/uploadController.js
// ============================================================

const { uploadToGCS, saveUploadRecord } = require('../middleware/uploadMiddleware');
const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

// ─────────────────────────────────────────────────────────────
// HELPER — Update content/episode URL fields after upload
// ─────────────────────────────────────────────────────────────
const updateContentUrl = async (contentId, field, url) => {
  await pool.query(
    `UPDATE content SET ${field} = $1, updated_at = NOW() WHERE id = $2`,
    [url, contentId]
  );
};

const updateEpisodeUrl = async (episodeId, field, url) => {
  await pool.query(
    `UPDATE episodes SET ${field} = $1, updated_at = NOW() WHERE id = $2`,
    [url, episodeId]
  );
};

// ─────────────────────────────────────────────────────────────
// 1. POST /upload/image
// Upload poster, thumbnail, cover image, actor headshot
// Field: file (single)
// ─────────────────────────────────────────────────────────────
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No file provided.', 400);

    const {
      linked_to_id,        // UUID of content/episode/actor
      linked_to_type,      // 'content' | 'episode' | 'actor' | 'news'
      image_purpose,       // 'poster' | 'thumbnail' | 'headshot' | 'cover' | 'banner'
      auto_update,         // 'true' = auto-update DB field
    } = req.body;

    // Upload to GCS
    const { uniqueName, gcsPath, publicUrl } = await uploadToGCS({
      fileBuffer:   req.file.buffer,
      originalName: req.file.originalname,
      mimeType:     req.file.mimetype,
      fileType:     'image',
      folder:       `images/${image_purpose || 'general'}`,
    });

    // Save upload record to DB
    const upload = await saveUploadRecord({
      uploadedBy:    req.user.id,
      originalName:  req.file.originalname,
      uniqueName,
      fileType:      'image',
      mimeType:      req.file.mimetype,
      fileSize:      req.file.size,
      gcsPath,
      publicUrl,
      linkedToId:    linked_to_id,
      linkedToType:  linked_to_type,
      metadata:      { image_purpose },
    });

    // Auto-update content/episode/actor with new URL
    if (auto_update === 'true' && linked_to_id && linked_to_type) {
      const fieldMap = {
        content: { poster: 'poster_url', thumbnail: 'poster_url', banner: 'poster_url' },
        episode: { thumbnail: 'thumbnail_url', poster: 'thumbnail_url' },
        actor:   { headshot: 'headshot_url', cover: 'headshot_url' },
      };
      const field = fieldMap[linked_to_type]?.[image_purpose];

      if (field) {
        if (linked_to_type === 'content') await updateContentUrl(linked_to_id, field, publicUrl);
        if (linked_to_type === 'episode') await updateEpisodeUrl(linked_to_id, field, publicUrl);
        if (linked_to_type === 'actor') {
          await pool.query(
            'UPDATE actors SET headshot_url = $1, updated_at = NOW() WHERE id = $2',
            [publicUrl, linked_to_id]
          );
        }
      }
    }

    return sendSuccess(res, {
      upload_id:  upload.id,
      public_url: publicUrl,
      file_name:  uniqueName,
      gcs_path:   gcsPath,
      file_size:  req.file.size,
      mime_type:  req.file.mimetype,
    }, 'Image uploaded successfully.', 201);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. POST /upload/video
// Upload movie/episode video, trailer, or song video
// Field: file (single)
// ─────────────────────────────────────────────────────────────
const uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No file provided.', 400);

    const {
      linked_to_id,        // UUID of content/episode
      linked_to_type,      // 'content' | 'episode'
      video_purpose,       // 'main_video' | 'trailer' | 'song_video'
      auto_update,         // 'true' = auto-update DB field
    } = req.body;

    // Upload to GCS
    const { uniqueName, gcsPath, publicUrl } = await uploadToGCS({
      fileBuffer:   req.file.buffer,
      originalName: req.file.originalname,
      mimeType:     req.file.mimetype,
      fileType:     'video',
      folder:       `videos/${video_purpose || 'general'}`,
    });

    // Save upload record to DB
    const upload = await saveUploadRecord({
      uploadedBy:    req.user.id,
      originalName:  req.file.originalname,
      uniqueName,
      fileType:      'video',
      mimeType:      req.file.mimetype,
      fileSize:      req.file.size,
      gcsPath,
      publicUrl,
      linkedToId:    linked_to_id,
      linkedToType:  linked_to_type,
      metadata:      { video_purpose },
    });

    // Auto-update content/episode with new URL
    if (auto_update === 'true' && linked_to_id && linked_to_type) {
      const fieldMap = {
        content: { main_video: 'video_url', trailer: 'trailer_url', song_video: 'video_url' },
        episode: { main_video: 'video_url' },
      };
      const field = fieldMap[linked_to_type]?.[video_purpose];

      if (field) {
        if (linked_to_type === 'content') await updateContentUrl(linked_to_id, field, publicUrl);
        if (linked_to_type === 'episode') await updateEpisodeUrl(linked_to_id, field, publicUrl);
      }
    }

    return sendSuccess(res, {
      upload_id:  upload.id,
      public_url: publicUrl,
      file_name:  uniqueName,
      gcs_path:   gcsPath,
      file_size:  req.file.size,
      mime_type:  req.file.mimetype,
    }, 'Video uploaded successfully.', 201);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 3. POST /upload/audio
// Upload high-quality audio for songs
// Field: file (single)
// ─────────────────────────────────────────────────────────────
const uploadAudio = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No file provided.', 400);

    const {
      song_id,             // UUID of content where type = 'song'
      audio_quality,       // 'hq' | 'lq'
      auto_update,         // 'true' = auto-update DB field
    } = req.body;

    // Upload to GCS
    const { uniqueName, gcsPath, publicUrl } = await uploadToGCS({
      fileBuffer:   req.file.buffer,
      originalName: req.file.originalname,
      mimeType:     req.file.mimetype,
      fileType:     'audio',
      folder:       `audio/${audio_quality || 'hq'}`,
    });

    // Save upload record to DB
    const upload = await saveUploadRecord({
      uploadedBy:    req.user.id,
      originalName:  req.file.originalname,
      uniqueName,
      fileType:      'audio',
      mimeType:      req.file.mimetype,
      fileSize:      req.file.size,
      gcsPath,
      publicUrl,
      linkedToId:    song_id,
      linkedToType:  'content',
      metadata:      { audio_quality },
    });

    // Auto-update songs_metadata table
    if (auto_update === 'true' && song_id) {
      const field = audio_quality === 'lq' ? 'audio_url_lq' : 'audio_url_hq';
      await pool.query(
        `UPDATE songs_metadata SET ${field} = $1, updated_at = NOW() WHERE id = $2`,
        [publicUrl, song_id]
      );
    }

    return sendSuccess(res, {
      upload_id:  upload.id,
      public_url: publicUrl,
      file_name:  uniqueName,
      gcs_path:   gcsPath,
      file_size:  req.file.size,
      mime_type:  req.file.mimetype,
    }, 'Audio uploaded successfully.', 201);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 4. GET /upload/history
// Admin only — View list of all recent uploads
// ─────────────────────────────────────────────────────────────
const getUploadHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    const params = [limit, offset];
    let where = '';
    if (type) {
      params.push(type);
      where = `WHERE file_type = $3`;
    }

    const result = await pool.query(
      `SELECT * FROM uploads ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params
    );

    return sendSuccess(res, {
      uploads: result.rows,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 5. POST /upload/lyrics
// Upload lyrics file (LRC or WebVTT) for songs
// Field: file (single)
// ─────────────────────────────────────────────────────────────
const uploadLyrics = async (req, res) => {
  try {
    if (!req.file) return sendError(res, 'No file provided.', 400);

    const { linked_to_id, auto_update } = req.body;

    const { uniqueName, gcsPath, publicUrl } = await uploadToGCS({
      fileBuffer:   req.file.buffer,
      originalName: req.file.originalname,
      mimeType:     req.file.mimetype || 'text/plain',
      fileType:     'document',
      folder:       'lyrics',
    });

    await saveUploadRecord({
      uploadedBy:   req.user.id,
      originalName: req.file.originalname,
      uniqueName,
      fileType:     'document',
      mimeType:     req.file.mimetype || 'text/plain',
      fileSize:     req.file.size,
      gcsPath,
      publicUrl,
      linkedToId:   linked_to_id,
      linkedToType: 'content',
      metadata:     { purpose: 'lyrics' },
    });

    if (auto_update === 'true' && linked_to_id) {
      await pool.query(
        `UPDATE songs_metadata SET lyrics_url = $1, updated_at = NOW() WHERE id = $2`,
        [publicUrl, linked_to_id]
      );
    }

    return sendSuccess(res, {
      public_url: publicUrl,
      file_name:  uniqueName,
    }, 'Lyrics file uploaded.', 201);
  } catch (err) {
    console.error('uploadLyrics error:', err);
    return sendError(res, 'Lyrics upload failed: ' + err.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 6. GET /upload/my-uploads
// Get all uploads by the logged-in admin/user
// ─────────────────────────────────────────────────────────────
const getMyUploads = async (req, res) => {
  const { file_type, linked_to_id, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    let conditions = ['uploaded_by = $1'];
    let params = [req.user.id];
    let idx = 2;

    if (file_type)    { conditions.push(`file_type = $${idx++}`);    params.push(file_type); }
    if (linked_to_id) { conditions.push(`linked_to_id = $${idx++}`); params.push(linked_to_id); }

    const where = conditions.join(' AND ');
    const result = await pool.query(
      `SELECT id, file_name, original_name, file_type, mime_type,
              file_size_bytes, public_url, status, linked_to_id,
              linked_to_type, metadata, created_at
       FROM media_uploads
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, parseInt(limit), offset]
    );
    const count = await pool.query(`SELECT COUNT(*) FROM media_uploads WHERE ${where}`, params);

    return sendSuccess(res, {
      uploads: result.rows,
      pagination: {
        page: parseInt(page), limit: parseInt(limit),
        total: parseInt(count.rows[0].count)
      }
    });
  } catch (err) {
    console.error('getMyUploads error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 7. DELETE /upload/:id
// Delete upload from GCS + DB
// ─────────────────────────────────────────────────────────────
const deleteUpload = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM media_uploads WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return sendError(res, 'Upload not found.', 404);

    const upload = result.rows[0];
    const { bucket } = require('../config/gcsClient');

    // Delete from GCS
    try {
      await bucket.file(upload.gcs_path).delete();
    } catch (gcsErr) {
      console.warn('GCS delete warning (file may not exist):', gcsErr.message);
    }

    // Delete from DB
    await pool.query('DELETE FROM media_uploads WHERE id = $1', [req.params.id]);

    return sendSuccess(res, {}, 'Upload deleted successfully.');
  } catch (err) {
    console.error('deleteUpload error:', err);
    return sendError(res, 'Internal server error.', 500);
  }
};

module.exports = {
  uploadImage,
  uploadVideo,
  uploadTrailer,
  uploadAudio,
  uploadLyrics,
  getMyUploads,
  deleteUpload,
};
