const router = require('express').Router();
const { body, param } = require('express-validator');
const { getAllUsers, getUserById, updateUser, deleteUser } = require('../controllers/userController');
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
    body('phone_number').optional().isMobilePhone(),
    body('age').optional().isInt({ min: 1 }),
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
 *         description: User deactivated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.delete('/:id',
  authenticate,
  authorize('admin'),
  [param('id').isUUID()],
  validate,
  deleteUser
);

module.exports = router;
