// ============================================================
// gcsClient.js — Google Cloud Storage Client
// Place this in: src/config/gcsClient.js
// ============================================================

const { Storage } = require('@google-cloud/storage');

// When running on Cloud Run, GCP auth is automatic via service account
// For local dev, set GOOGLE_APPLICATION_CREDENTIALS env var
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || 'camcine-ott',
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'camcine-media';

const bucket = storage.bucket(BUCKET_NAME);

module.exports = { storage, bucket, BUCKET_NAME };
