// ============================================================
// src/config/db.js — PostgreSQL Connection Pool
//
// Supports two connection modes automatically:
//
//   LOCAL (your Windows machine):
//     DB_HOST=localhost  DB_PORT=5432
//     → connects via TCP as normal
//
//   CLOUD RUN + CLOUD SQL:
//     DB_HOST=/cloudsql/camcine-ott:asia-south1:camcine-db
//     → connects via Unix socket (no port needed)
//
// Cloud Run connects to Cloud SQL via a Unix socket injected
// at /cloudsql/<instance-connection-name>. The pg library
// uses the 'host' field as the socket directory when it
// starts with '/'.
// ============================================================

const { Pool } = require('pg');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const isUnixSocket = dbHost.startsWith('/');

// Build config based on connection type
const poolConfig = isUnixSocket
  ? {
      // Cloud SQL Unix socket connection (Cloud Run)
      host:     dbHost,           // e.g. /cloudsql/camcine-ott:asia-south1:camcine-db
      database: process.env.DB_NAME || 'camcine_production',
      user:     process.env.DB_USER || 'camcine_user',
      password: process.env.DB_PASSWORD,
      max:                  20,
      idleTimeoutMillis:    30000,
      connectionTimeoutMillis: 10000,  // longer timeout for socket connections
    }
  : {
      // Local TCP connection (development)
      host:     dbHost,
      port:     parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'Camcine',
      user:     process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max:                  20,
      idleTimeoutMillis:    30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log(`✅ PostgreSQL connected via ${isUnixSocket ? 'Cloud SQL socket' : 'TCP'}`);
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err.message);
  // Don't call process.exit here — let the request fail gracefully
  // instead of crashing the whole server
});

module.exports = pool;