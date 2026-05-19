// ============================================================
// gcsClient.js — Google Cloud Storage Client
// src/config/gcsClient.js
//
// Auth priority (automatic — nothing to change in code):
//   1. Local dev   → GOOGLE_APPLICATION_CREDENTIALS in .env
//                    points to your downloaded service account JSON
//   2. Cloud Run   → Attached service account (automatic, no key needed)
//   3. gcloud CLI  → If you ran: gcloud auth application-default login
// ============================================================

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

// ── Validate required env vars on startup ─────────────────────
const PROJECT_ID   = process.env.GCP_PROJECT_ID;
const BUCKET_NAME  = process.env.GCS_BUCKET_NAME;
const CREDENTIALS  = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!PROJECT_ID) {
  console.error('❌  GCP_PROJECT_ID is not set in your .env file.');
  console.error('    Add: GCP_PROJECT_ID=camcine-ott');
}

if (!BUCKET_NAME) {
  console.error('❌  GCS_BUCKET_NAME is not set in your .env file.');
  console.error('    Add: GCS_BUCKET_NAME=camcine-media');
}

// Local dev only — warn if key file is missing or unreadable
if (process.env.NODE_ENV !== 'production' && CREDENTIALS) {
  if (!fs.existsSync(CREDENTIALS)) {
    console.error(`❌  GOOGLE_APPLICATION_CREDENTIALS file not found at: ${CREDENTIALS}`);
    console.error('    Download a service account JSON key from GCP Console:');
    console.error('    IAM & Admin → Service Accounts → Keys → Add Key → JSON');
    console.error('    Then set GOOGLE_APPLICATION_CREDENTIALS=<path to that file> in .env');
  } else {
    console.log(`✅  GCP credentials loaded from: ${CREDENTIALS}`);
  }
}

if (process.env.NODE_ENV !== 'production' && !CREDENTIALS) {
  console.warn('⚠️   GOOGLE_APPLICATION_CREDENTIALS is not set.');
  console.warn('    Uploads will fail unless you are authenticated via gcloud CLI.');
  console.warn('    Fix: Add GOOGLE_APPLICATION_CREDENTIALS=<path-to-key.json> in .env');
}

// ── Build Storage client ──────────────────────────────────────
// If GOOGLE_APPLICATION_CREDENTIALS is set, the SDK picks it up automatically.
// If on Cloud Run, it uses the attached service account automatically.
const storage = BUCKET_NAME
  ? new Storage(PROJECT_ID ? { projectId: PROJECT_ID } : {})
  : null;

const bucket = storage ? storage.bucket(BUCKET_NAME) : null;

const getBucket = () => {
  if (!bucket) {
    const err = new Error(
      'Google Cloud Storage is not configured. Set GCP_PROJECT_ID and GCS_BUCKET_NAME in .env.'
    );
    err.statusCode = 503;
    throw err;
  }
  return bucket;
};

module.exports = { storage, bucket, getBucket, BUCKET_NAME };
