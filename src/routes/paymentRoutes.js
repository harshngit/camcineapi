const router = require('express').Router();
const controller = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin', 'manager'), controller.listPayments);
router.get('/stats', authenticate, authorize('admin'), controller.getPaymentStats);
router.get('/export', authenticate, authorize('admin'), controller.exportPayments);
router.get('/:id', authenticate, authorize('admin'), controller.getPaymentById);
router.post('/refund/:id', authenticate, authorize('admin'), controller.refundPayment);

module.exports = router;
