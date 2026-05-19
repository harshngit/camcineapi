require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { handleDbError } = require('./utils/dbErrorHandler');

// ── Route imports ─────────────────────────────────────────────
const authRoutes         = require('./routes/authRoutes');
const userRoutes         = require('./routes/userRoutes');
const movieRoutes        = require('./routes/movieRoutes');
const episodeRoutes      = require('./routes/episodeRoutes');
const songRoutes         = require('./routes/songRoutes');
const viewTrackingRoutes = require('./routes/viewTrackingRoutes');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
// No size limits on body parser — file uploads go via multipart/multer anyway
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Swagger Docs ──────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Camcine OTT API Docs',
  swaggerOptions: { persistAuthorization: true },
}));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/v1/auth',     authRoutes);
app.use('/api/v1/users',    userRoutes);
app.use('/api/v1/movies',   movieRoutes);
app.use('/api/v1/episodes', episodeRoutes);
app.use('/api/v1/songs',    songRoutes);
app.use('/api/v1/views',    viewTrackingRoutes);

// ── Health Check ──────────────────────────────────────────────
// Cloud Run hits GET / to confirm the container started.
// Must respond with 200 within ~10 seconds or deploy fails.
app.get('/', (req, res) => res.status(200).json({ status: 'ok', service: 'Camcine OTT API' }));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.code) {
    const { message, statusCode } = handleDbError(err);
    return res.status(statusCode).json({ success: false, message, errors: [] });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message, errors: [] });
  }

  return res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Start Server ──────────────────────────────────────────────
// Cloud Run ALWAYS injects PORT=8080 into the container env.
// Never hardcode the port — always read from process.env.PORT.
// '0.0.0.0' is required for Cloud Run — it won't accept 'localhost'.
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Camcine API listening on port ${PORT}`);
});

module.exports = app;
