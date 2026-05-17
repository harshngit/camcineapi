require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { handleDbError } = require('./utils/dbErrorHandler');
const { sendError } = require('./utils/response');

// ── Route imports ─────────────────────────────────────────────
const authRoutes         = require('./routes/authRoutes');
const userRoutes         = require('./routes/userRoutes');
const movieRoutes        = require('./routes/movieRoutes');     // /api/v1/movies
const episodeRoutes      = require('./routes/episodeRoutes');   // /api/v1/episodes
const songRoutes         = require('./routes/songRoutes');      // /api/v1/songs
const viewTrackingRoutes = require('./routes/viewTrackingRoutes');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Swagger Docs ──────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Camcine OTT API Docs',
  swaggerOptions: { persistAuthorization: true },
}));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/v1/auth',    authRoutes);
app.use('/api/v1/users',   userRoutes);
app.use('/api/v1/movies',  movieRoutes);
app.use('/api/v1/episodes', episodeRoutes);
app.use('/api/v1/songs',   songRoutes);
app.use('/api/v1/views',   viewTrackingRoutes);

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Handle database errors
  if (err.code && (err.code.startsWith('23') || err.code.startsWith('22'))) {
    const { message, statusCode } = handleDbError(err);
    return sendError(res, message, statusCode);
  }

  // Handle other known errors if any...
  
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.message || 'Internal server error.' 
  });
});

// ── Start Server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Camcine API running on http://localhost:${PORT}`);
  console.log(`📚 Swagger docs  → http://localhost:${PORT}/api-docs`);
  console.log(`\n📦 Routes:`);
  console.log(`   Auth     → /api/v1/auth`);
  console.log(`   Users    → /api/v1/users`);
  console.log(`   Movies   → /api/v1/movies`);
  console.log(`   Episodes → /api/v1/episodes`);
  console.log(`   Songs    → /api/v1/songs`);
  console.log(`   Views    → /api/v1/views`);
});

module.exports = app;