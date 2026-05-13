-- ============================================================
-- GCP STORAGE BUCKET SETUP COMMANDS
-- Run these in your Google Cloud SDK terminal
-- ============================================================

-- STEP 1: Create the GCS bucket (Mumbai region)
gcloud storage buckets create gs://camcine-media \
  --location=asia-south1 \
  --uniform-bucket-level-access \
  --project=camcine-ott

-- STEP 2: Make bucket publicly readable (for CDN access)
gcloud storage buckets add-iam-policy-binding gs://camcine-media \
  --member=allUsers \
  --role=roles/storage.objectViewer

-- STEP 3: Create folder structure (just upload dummy files to create folders)
-- Folders are auto-created when you upload files to paths like:
-- gs://camcine-media/images/poster/
-- gs://camcine-media/images/thumbnail/
-- gs://camcine-media/images/headshot/
-- gs://camcine-media/images/banner/
-- gs://camcine-media/videos/
-- gs://camcine-media/trailers/
-- gs://camcine-media/audio/hq/
-- gs://camcine-media/audio/lq/
-- gs://camcine-media/lyrics/

-- STEP 4: Grant Cloud Run service account access to GCS bucket
-- First get your Cloud Run service account email:
gcloud run services describe camcine-api \
  --region=asia-south1 \
  --format="value(spec.template.spec.serviceAccountName)"

-- Then grant it Storage Object Admin access:
gcloud storage buckets add-iam-policy-binding gs://camcine-media \
  --member=serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL \
  --role=roles/storage.objectAdmin

-- STEP 5: Add new env vars to Cloud Run
gcloud run services update camcine-api \
  --region=asia-south1 \
  --update-env-vars GCP_PROJECT_ID=camcine-ott,GCS_BUCKET_NAME=camcine-media

-- ============================================================
-- ADD THESE TO YOUR .env FILE (for local development)
-- ============================================================
-- GCP_PROJECT_ID=camcine-ott
-- GCS_BUCKET_NAME=camcine-media
-- GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json

-- ============================================================
-- ADD THESE TO package.json dependencies
-- ============================================================
-- "@google-cloud/storage": "^7.7.0"
-- "multer": "^1.4.5-lts.1"
--
-- Run: npm install @google-cloud/storage multer

-- ============================================================
-- ADD THESE TO src/app.js
-- ============================================================
-- const uploadRoutes = require('./routes/uploadRoutes');
-- app.use('/api/v1', uploadRoutes);
