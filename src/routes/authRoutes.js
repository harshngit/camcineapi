const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, authMe, forgotPassword, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - first_name
 *               - last_name
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               first_name:
 *                 type: string
 *                 example: John
 *               last_name:
 *                 type: string
 *                 example: Doe
 *               phone_number:
 *                 type: string
 *                 example: "+919876543210"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: secret123
 *               role:
 *                 type: string
 *                 enum: [viewer, actor, manager, admin]
 *                 example: viewer
 *               age:
 *                 type: integer
 *                 minimum: 1
 *                 example: 25
 *           example:
 *             email: john.doe@example.com
 *             first_name: John
 *             last_name: Doe
 *             phone_number: "+919876543210"
 *             password: secret123
 *             role: viewer
 *             age: 25
 *     responses:
 *       201:
 *         description: Registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('first_name').notEmpty().trim(),
    body('last_name').notEmpty().trim(),
    body('password').isLength({ min: 6 }),
    body('role').optional().isIn(['viewer', 'actor', 'manager', 'admin']),
    body('age').optional().isInt({ min: 1 }),
    body('phone_number').optional().isMobilePhone(),
  ],
  validate,
  register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with user ID, email, or phone number + password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *                 description: User UUID (login option 1)
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address (login option 2)
 *                 example: john.doe@example.com
 *               phone_number:
 *                 type: string
 *                 description: Registered phone number (login option 3)
 *                 example: "+919876543210"
 *               password:
 *                 type: string
 *                 description: Account password (required)
 *                 example: secret123
 *           examples:
 *             LoginWithEmail:
 *               summary: Login using email
 *               value:
 *                 email: john.doe@example.com
 *                 password: secret123
 *             LoginWithPhone:
 *               summary: Login using phone number
 *               value:
 *                 phone_number: "+919876543210"
 *                 password: secret123
 *             LoginWithId:
 *               summary: Login using user ID
 *               value:
 *                 id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                 password: secret123
 *     responses:
 *       200:
 *         description: Login successful — returns JWT token and user details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: No identifier provided (id / email / phone required)
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account deactivated
 */
router.post('/login',
  [
    body('password').notEmpty(),
    body('id').optional().isUUID(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone_number').optional().isMobilePhone(),
  ],
  validate,
  login
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get authenticated user details
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, authMe);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *     responses:
 *       200:
 *         description: Reset token generated (delivered via email in production)
 */
router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validate,
  forgotPassword
);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Reset password using a reset token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reset_token, new_password]
 *             properties:
 *               reset_token:
 *                 type: string
 *                 example: "abc123resettoken..."
 *               new_password:
 *                 type: string
 *                 minLength: 6
 *                 example: newSecret456
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/change-password',
  [
    body('reset_token').notEmpty(),
    body('new_password').isLength({ min: 6 }),
  ],
  validate,
  changePassword
);

module.exports = router;