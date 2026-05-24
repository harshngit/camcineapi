const router = require('express').Router();
const controller = require('../controllers/managerController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/:managerId/earnings', authenticate, controller.earnings);
router.get('/:managerId/earnings/content', authenticate, controller.contentEarnings);
router.post('/:managerId/payouts', authenticate, authorize('admin'), controller.createPayout);
router.patch('/payouts/:payoutId', authenticate, authorize('admin'), controller.updatePayout);

module.exports = router;
