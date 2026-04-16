const pool = require('./db');
const fs = require('fs');
const path = require('path');

async function initDb() {
  const sqlPath = path.join(__dirname, '../../db/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Database schema initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing DB schema:', err.message);
  } finally {
    await pool.end();
  }
}

initDb();
