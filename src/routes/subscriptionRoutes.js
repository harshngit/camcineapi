const router = require('express').Router();
const { body, param } = require('express-validator');
const controller = require('../controllers/subscriptionController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/plans', controller.getPlans);
router.post('/plans', authenticate, authorize('admin'), [body('name').notEmpty(), body('slug').notEmpty()], validate, controller.createPlan);
router.put('/plans/:id', authenticate, authorize('admin'), [param('id').isUUID()], validate, controller.updatePlan);
router.delete('/plans/:id', authenticate, authorize('admin'), [param('id').isUUID()], validate, controller.deactivatePlan);

router.get('/', authenticate, authorize('admin', 'manager'), controller.getAllSubscriptions);
router.get('/stats', authenticate, authorize('admin'), controller.getStats);
router.post('/:userId/subscribe', authenticate, [param('userId').isUUID(), body('plan_id').isUUID()], validate, controller.subscribe);
router.patch('/:id/cancel', authenticate, [param('id').isUUID()], validate, controller.cancelSubscription);
router.patch('/:id/pause', authenticate, authorize('admin'), [param('id').isUUID()], validate, controller.pauseSubscription);
router.patch('/:id/resume', authenticate, authorize('admin'), [param('id').isUUID()], validate, controller.resumeSubscription);
router.get('/:userId', authenticate, [param('userId').isUUID()], validate, controller.getUserSubscription);

module.exports = router;
