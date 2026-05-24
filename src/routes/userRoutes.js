const router = require('express').Router();
const { body, param } = require('express-validator');
const { getAllUsers, getUserById, updateUser, deleteUser } = require('../controllers/userController');
const watchController = require('../controllers/watchController');
const recommendationController = require('../controllers/recommendationController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (admin/manager only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [viewer, actor, manager, admin] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: List of users with pagination
 *       403:
 *         description: Forbidden
 */
router.get('/', authenticate, authorize('admin', 'manager'), getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  getUserById
);

router.get('/:userId/watchlist',
  authenticate,
  [param('userId').isUUID()],
  validate,
  watchController.getWatchlist
);

router.post('/:userId/watchlist',
  authenticate,
  [param('userId').isUUID(), body('content_id').isUUID()],
  validate,
  watchController.addWatchlist
);

router.delete('/:userId/watchlist/:contentId',
  authenticate,
  [param('userId').isUUID(), param('contentId').isUUID()],
  validate,
  watchController.removeWatchlist
);

router.get('/:userId/continue-watching',
  authenticate,
  [param('userId').isUUID()],
  validate,
  watchController.getContinueWatching
);

router.post('/:userId/progress',
  authenticate,
  [param('userId').isUUID(), body('content_id').isUUID(), body('progress_seconds').isInt({ min: 0 })],
  validate,
  watchController.saveProgress
);

router.get('/:userId/recommendations',
  authenticate,
  [param('userId').isUUID()],
  validate,
  recommendationController.personalized
);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user profile (own profile or admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:           { type: string }
 *               last_name:            { type: string }
 *               phone_number:         { type: string }
 *               age:                  { type: integer }
 *               language_preferences: { type: array, items: { type: string } }
 *               regions:              { type: array, items: { type: string } }
 *               role:                 { type: string, enum: [viewer, actor, manager, admin], description: Admin only }
 *     responses:
 *       200:
 *         description: User updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.put('/:id',
  authenticate,
  [
    param('id').isUUID(),
    body('first_name').optional().notEmpty().trim(),
    body('last_name').optional().notEmpty().trim(),
    body('phone_number')
      .optional({ checkFalsy: true })
      .trim()
      .matches(/^\+?[0-9]{10,15}$/)
      .withMessage('Phone number must contain 10 to 15 digits and may start with +.'),
    body('age').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Age must be a positive number.'),
    body('language_preferences').optional().isArray(),
    body('regions').optional().isArray(),
    body('role').optional().isIn(['viewer', 'actor', 'manager', 'admin']),
  ],
  validate,
  updateUser
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Deactivate a user (admin only)
 *     description: >
 *       Soft deactivates a user by setting `is_active` to `false`.
 *       This does not remove the user row from the database. Admins cannot
 *       deactivate their own account, and already inactive users return 404.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User UUID to deactivate.
 *     responses:
 *       200:
 *         description: User deactivated successfully.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "User deactivated successfully."
 *               data:
 *                 user:
 *                   id: "247dae77-9420-4186-8d51-a7f90d9f8712"
 *                   email: "viewer@example.com"
 *                   first_name: "Aditya"
 *                   last_name: "Borhade"
 *                   role: "viewer"
 *                   is_active: false
 *                   updated_at: "2026-05-19T08:30:00.000Z"
 *       400:
 *         description: Admin attempted to deactivate their own account.
 *       401:
 *         description: Unauthorized. Missing or invalid bearer token.
 *       403:
 *         description: Admin access required.
 *       404:
 *         description: User not found or already inactive.
 */
router.delete('/:id',
  authenticate,
  authorize('admin'),
  [param('id').isUUID()],
  validate,
  deleteUser
);

module.exports = router;
