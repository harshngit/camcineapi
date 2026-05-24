const router = require('express').Router();
const controller = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, controller.listNotifications);
router.patch('/read-all', authenticate, controller.markAll);
router.patch('/:id/read', authenticate, controller.markRead);
router.delete('/:id', authenticate, controller.remove);
router.post('/', authenticate, authorize('admin'), controller.createNotification);

module.exports = router;
