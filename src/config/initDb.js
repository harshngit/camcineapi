const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function initDb() {
  const schemas = [
    '../../db/01_schema.sql',
    '../../db/02_content_schema.sql',
    '../../db/03_actor_schema.sql',
    '../../db/04_storage_cast_schema.sql',
    '../../db/05_view_tracking_schema.sql',
    '../../db/06_add_cast_image.sql',
    '../../db/07_add_view_tracking_points.sql',
    '../../db/08_add_song_video_url.sql',
    '../../db/09_add_video_thumbnail_aireddate.sql',
    '../../db/10_camcine_new_columns.sql',
    '../../db/11_add_country_to_content.sql',
    '../../db/12_fix_api_runtime_schema.sql',
    '../../db/13_create_news_articles.sql'
  ];

  try {
    for (const schemaFile of schemas) {
      const sqlPath = path.join(__dirname, schemaFile);
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        // Split SQL into individual statements to handle errors per-statement if needed
        // But for triggers, we use DROP TRIGGER IF EXISTS in the SQL itself.
        // We'll just execute the whole file and handle any non-recoverable errors.
        await pool.query(sql);
        console.log(`✅ ${path.basename(schemaFile)} initialized successfully`);
      } else {
        console.warn(`⚠️  Warning: ${schemaFile} not found, skipping.`);
      }
    }
    console.log('🚀 All database schemas initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing DB schema:', err.message);
  } finally {
    await pool.end();
  }
}

initDb();
