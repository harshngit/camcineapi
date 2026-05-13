// ============================================================
// uploadMiddleware.js — Multer + GCP Storage Upload Handler
// Place this in: src/middleware/uploadMiddleware.js
// ============================================================

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { bucket, BUCKET_NAME } = require('../config/gcsClient');
const pool = require('../config/db');
const { sendError } = require('../utils/response');

// ── FILE TYPE CONFIG ──────────────────────────────────────────
const FILE_CONFIG = {
  image: {
    mimeTypes: ['image/jpeg','image/jpg','image/png','image/webp'],
    maxSize:   10 * 1024 * 1024,   // 10MB
    folder:    'images',
    extensions: ['.jpg','.jpeg','.png','.webp'],
  },
  video: {
    mimeTypes: ['video/mp4','video/x-msvideo','video/quicktime','video/x-matroska','video/webm'],
    maxSize:   5 * 1024 * 1024 * 1024,  // 5GB
    folder:    'videos',
    extensions: ['.mp4','.avi','.mov','.mkv','.webm'],
  },
  trailer: {
    mimeTypes: ['video/mp4','video/quicktime','video/webm'],
    maxSize:   500 * 1024 * 1024,  // 500MB
    folder:    'trailers',
    extensions: ['.mp4','.mov','.webm'],
  },
  audio: {
    mimeTypes: ['audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/flac','audio/ogg'],
    maxSize:   100 * 1024 * 1024,  // 100MB
    folder:    'audio',
    extensions: ['.mp3','.m4a','.aac','.wav','.flac','.ogg'],
  },
};

// ── USE MEMORY STORAGE (stream directly to GCS) ───────────────
const memStorage = multer.memoryStorage();

// ── BUILD MULTER UPLOAD FACTORY ───────────────────────────────
const createUploader = (fileType) => {
  const config = FILE_CONFIG[fileType];
  if (!config) throw new Error(`Unknown file type: ${fileType}`);

  return multer({
    storage: memStorage,
    limits: { fileSize: config.maxSize },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (config.mimeTypes.includes(file.mimetype) && config.extensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(
          `Invalid file type. Allowed: ${config.extensions.join(', ')} for ${fileType}`
        ), false);
      }
    },
  });
};

// ── UPLOAD FILE TO GCS ────────────────────────────────────────
const uploadToGCS = async ({ fileBuffer, originalName, mimeType, fileType, folder }) => {
  const ext = path.extname(originalName).toLowerCase();
  const uniqueName = `${uuidv4()}${ext}`;
  const gcsPath = `${folder}/${uniqueName}`;

  const file = bucket.file(gcsPath);

  await new Promise((resolve, reject) => {
    const stream = file.createWriteStream({
      metadata: { contentType: mimeType },
      resumable: false,
    });
    stream.on('error', reject);
    stream.on('finish', resolve);
    stream.end(fileBuffer);
  });

  // Make file publicly readable
  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${gcsPath}`;

  return { uniqueName, gcsPath, publicUrl };
};

// ── SAVE UPLOAD RECORD TO DB ──────────────────────────────────
const saveUploadRecord = async ({
  uploadedBy, originalName, uniqueName, fileType,
  mimeType, fileSize, gcsPath, publicUrl,
  linkedToId, linkedToType, metadata
}) => {
  const result = await pool.query(`
    INSERT INTO media_uploads (
      uploaded_by, file_name, original_name, file_type,
      mime_type, file_size_bytes, gcs_bucket, gcs_path,
      public_url, status, linked_to_id, linked_to_type, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'uploaded',$10,$11,$12)
    RETURNING *
  `, [
    uploadedBy, uniqueName, originalName, fileType,
    mimeType, fileSize,
    BUCKET_NAME, gcsPath, publicUrl,
    linkedToId || null,
    linkedToType || null,
    JSON.stringify(metadata || {})
  ]);
  return result.rows[0];
};

// ── MULTER ERROR HANDLER ──────────────────────────────────────
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'File too large. Please check size limits.', 400);
    }
    return sendError(res, `Upload error: ${err.message}`, 400);
  }
  if (err) return sendError(res, err.message, 400);
  next();
};

module.exports = {
  createUploader,
  uploadToGCS,
  saveUploadRecord,
  handleMulterError,
  FILE_CONFIG,
};
