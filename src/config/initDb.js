const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function initDb() {
  const schemas = [
    '../../db/schema.sql',
    '../../db/content_schema.sql',
    '../../db/actor_schema.sql',
    '../../db/storage_cast_schema.sql'
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
