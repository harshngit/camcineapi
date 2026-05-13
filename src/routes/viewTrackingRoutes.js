// ============================================================
// viewTrackingRoutes.js — Camcine OTT View Tracking & Points
// Base path: /api/v1/views
// ============================================================

const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  recordView,
  getUserPoints,
  getViewHistory,
  getContentViewStats,
} = require('../controllers/viewTrackingController');

/**
 * @swagger
 * tags:
 *   - name: ViewTracking
 *     description: Video view tracking and point allocation
 */

/**
 * @swagger
 * /views/record:
 *   post:
 *     summary: Record a video view and award points
 *     tags: [ViewTracking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - content_id
 *               - idempotency_key
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the user watching the video"
 *               content_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the content being viewed"
 *               episode_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID of the episode (if viewing a show episode)"
 *               idempotency_key:
 *                 type: string
 *                 description: "Unique key to prevent duplicate points (e.g., session_id + timestamp)"
 *           example:
 *             user_id: "550e8400-e29b-41d4-a716-446655440000"
 *             content_id: "550e8400-e29b-41d4-a716-446655440001"
 *             episode_id: "550e8400-e29b-41d4-a716-446655440002"
 *             idempotency_key: "session-123-2026-05-13T10:30:00Z"
 *     responses:
 *       201:
 *         description: View recorded and points awarded
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "View recorded and points awarded successfully."
 *               data:
 *                 view_id: "uuid"
 *                 user_id: "uuid"
 *                 content_id: "uuid"
 *                 episode_id: "uuid"
 *                 points_awarded: 1
 *                 current_balance: 3
 *                 daily_points_remaining: 2
 *       200:
 *         description: View recorded but no points awarded (limit reached or duplicate)
 *       400:
 *         description: Bad request - missing required fields
 *       404:
 *         description: User or content not found
 *       409:
 *         description: Conflict - duplicate idempotency key
 */
router.post(
  '/record',
  authenticate,
  [
    body('user_id').isUUID().withMessage('user_id must be a valid UUID'),
    body('content_id').isUUID().withMessage('content_id must be a valid UUID'),
    body('episode_id').optional().isUUID().withMessage('episode_id must be a valid UUID'),
    body('idempotency_key').notEmpty().withMessage('idempotency_key is required'),
  ],
  validate,
  recordView
);

/**
 * @swagger
 * /views/user/{user_id}/points:
 *   get:
 *     summary: Get a user's point balance and history
 *     tags: [ViewTracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User point balance retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 user_id: "uuid"
 *                 current_balance: 15
 *                 lifetime_earned: 50
 *                 lifetime_spent: 35
 *                 daily_views_last_7_days:
 *                   - view_date: "2026-05-13"
 *                     view_count: 3
 *                     points_earned: 3
 *                 daily_limit: 3
 *                 points_per_view: 1
 */
router.get(
  '/user/:user_id/points',
  authenticate,
  [param('user_id').isUUID().withMessage('user_id must be a valid UUID')],
  validate,
  getUserPoints
);

/**
 * @swagger
 * /views/user/{user_id}/history:
 *   get:
 *     summary: Get a user's view history
 *     tags: [ViewTracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: start_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: end_date
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: View history retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 views:
 *                   - id: "uuid"
 *                     content_id: "uuid"
 *                     content_title: "Dangal"
 *                     content_type: "movie"
 *                     episode_id: null
 *                     viewed_at: "2026-05-13T10:30:00Z"
 *                     points_awarded: 1
 *                     balance_after: 16
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: 50
 */
router.get(
  '/user/:user_id/history',
  authenticate,
  [
    param('user_id').isUUID().withMessage('user_id must be a valid UUID'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  ],
  validate,
  getViewHistory
);

/**
 * @swagger
 * /views/content/{content_id}/stats:
 *   get:
 *     summary: Get view statistics for a specific content
 *     tags: [ViewTracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: content_id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Content view statistics retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 content_id: "uuid"
 *                 total_views: 1500
 *                 total_points_awarded: 1200
 *                 unique_viewers: 980
 *                 today_views: 45
 */
router.get(
  '/content/:content_id/stats',
  authenticate,
  [param('content_id').isUUID().withMessage('content_id must be a valid UUID')],
  validate,
  getContentViewStats
);

module.exports = router;
