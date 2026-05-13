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
const uploadImage = async (req, res) => {
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
    console.error('uploadImage error:', err);
    return sendError(res, 'Image upload failed: ' + err.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. POST /upload/video
// Upload full movie/episode video
// Field: file (single)
// ─────────────────────────────────────────────────────────────
const uploadVideo = async (req, res) => {
  try {
    if (!req.file) return sendError(res, 'No file provided.', 400);

    const {
      linked_to_id,    // content_id or episode_id
      linked_to_type,  // 'content' | 'episode'
      auto_update,     // 'true' = auto-update stream_url_hls field
    } = req.body;

    const { uniqueName, gcsPath, publicUrl } = await uploadToGCS({
      fileBuffer:   req.file.buffer,
      originalName: req.file.originalname,
      mimeType:     req.file.mimetype,
      fileType:     'video',
      folder:       'videos',
    });

    const upload = await saveUploadRecord({
      uploadedBy:   req.user.id,
      originalName: req.file.originalname,
      uniqueName,
      fileType:     'video',
      mimeType:     req.file.mimetype,
      fileSize:     req.file.size,
      gcsPath,
      publicUrl,
      linkedToId:   linked_to_id,
      linkedToType: linked_to_type,
      metadata:     { processing_status: 'raw_uploaded' },
    });

    // Auto-update content/episode stream URL
    if (auto_update === 'true' && linked_to_id && linked_to_type) {
      if (linked_to_type === 'content') await updateContentUrl(linked_to_id, 'stream_url_hls', publicUrl);
      if (linked_to_type === 'episode') await updateEpisodeUrl(linked_to_id, 'stream_url_hls', publicUrl);
    }

    return sendSuccess(res, {
      upload_id:  upload.id,
      public_url: publicUrl,
      file_name:  uniqueName,
      gcs_path:   gcsPath,
      file_size:  req.file.size,
      mime_type:  req.file.mimetype,
      note:       'Video uploaded. For HLS streaming, transcode via Cloud Transcoder or FFmpeg.',
    }, 'Video uploaded successfully.', 201);
  } catch (err) {
    console.error('uploadVideo error:', err);
    return sendError(res, 'Video upload failed: ' + err.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 3. POST /upload/trailer
// Upload movie/show trailer
// Field: file (single)
// ─────────────────────────────────────────────────────────────
const uploadTrailer = async (req, res) => {
  try {
    if (!req.file) return sendError(res, 'No file provided.', 400);

    const { linked_to_id, auto_update } = req.body;

    const { uniqueName, gcsPath, publicUrl } = await uploadToGCS({
      fileBuffer:   req.file.buffer,
      originalName: req.file.originalname,
      mimeType:     req.file.mimetype,
      fileType:     'trailer',
      folder:       'trailers',
    });

    const upload = await saveUploadRecord({
      uploadedBy:   req.user.id,
      originalName: req.file.originalname,
      uniqueName,
      fileType:     'trailer',
      mimeType:     req.file.mimetype,
      fileSize:     req.file.size,
      gcsPath,
      publicUrl,
      linkedToId:   linked_to_id,
      linkedToType: 'content',
      metadata:     {},
    });

    // Auto-update content trailer_url
    if (auto_update === 'true' && linked_to_id) {
      await updateContentUrl(linked_to_id, 'trailer_url', publicUrl);
    }

    return sendSuccess(res, {
      upload_id:  upload.id,
      public_url: publicUrl,
      file_name:  uniqueName,
      gcs_path:   gcsPath,
      file_size:  req.file.size,
    }, 'Trailer uploaded successfully.', 201);
  } catch (err) {
    console.error('uploadTrailer error:', err);
    return sendError(res, 'Trailer upload failed: ' + err.message, 500);
  }
};

// ─────────────────────────────────────────────────────────────
// 4. POST /upload/audio
// Upload song audio (HQ 320kbps + LQ 128kbps)
// Fields: audio_hq (required), audio_lq (optional)
// ─────────────────────────────────────────────────────────────
const uploadAudio = async (req, res) => {
  try {
    const hqFile = req.files?.audio_hq?.[0];
    const lqFile = req.files?.audio_lq?.[0];

    if (!hqFile) return sendError(res, 'audio_hq file is required.', 400);

    const { linked_to_id, auto_update } = req.body;
    const result = {};

    // Upload HQ audio
    const hq = await uploadToGCS({
      fileBuffer:   hqFile.buffer,
      originalName: hqFile.originalname,
      mimeType:     hqFile.mimetype,
      fileType:     'audio',
      folder:       'audio/hq',
    });

    const hqRecord = await saveUploadRecord({
      uploadedBy:   req.user.id,
      originalName: hqFile.originalname,
      uniqueName:   hq.uniqueName,
      fileType:     'audio',
      mimeType:     hqFile.mimetype,
      fileSize:     hqFile.size,
      gcsPath:      hq.gcsPath,
      publicUrl:    hq.publicUrl,
      linkedToId:   linked_to_id,
      linkedToType: 'content',
      metadata:     { quality: 'hq', bitrate: '320kbps' },
    });

    result.audio_hq = {
      upload_id:  hqRecord.id,
      public_url: hq.publicUrl,
      file_name:  hq.uniqueName,
    };

    // Upload LQ audio if provided
    if (lqFile) {
      const lq = await uploadToGCS({
        fileBuffer:   lqFile.buffer,
        originalName: lqFile.originalname,
        mimeType:     lqFile.mimetype,
        fileType:     'audio',
        folder:       'audio/lq',
      });

      const lqRecord = await saveUploadRecord({
        uploadedBy:   req.user.id,
        originalName: lqFile.originalname,
        uniqueName:   lq.uniqueName,
        fileType:     'audio',
        mimeType:     lqFile.mimetype,
        fileSize:     lqFile.size,
        gcsPath:      lq.gcsPath,
        publicUrl:    lq.publicUrl,
        linkedToId:   linked_to_id,
        linkedToType: 'content',
        metadata:     { quality: 'lq', bitrate: '128kbps' },
      });

      result.audio_lq = {
        upload_id:  lqRecord.id,
        public_url: lq.publicUrl,
        file_name:  lq.uniqueName,
      };

      // Auto-update songs_metadata
      if (auto_update === 'true' && linked_to_id) {
        await pool.query(
          `UPDATE songs_metadata SET
            audio_url_hq = $1, audio_url_lq = $2, updated_at = NOW()
           WHERE id = $3`,
          [hq.publicUrl, lq.publicUrl, linked_to_id]
        );
      }
    } else if (auto_update === 'true' && linked_to_id) {
      await pool.query(
        `UPDATE songs_metadata SET audio_url_hq = $1, updated_at = NOW() WHERE id = $2`,
        [hq.publicUrl, linked_to_id]
      );
    }

    return sendSuccess(res, result, 'Audio uploaded successfully.', 201);
  } catch (err) {
    console.error('uploadAudio error:', err);
    return sendError(res, 'Audio upload failed: ' + err.message, 500);
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
