const router = require('express').Router();
const controller = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/overview', authenticate, authorize('admin'), controller.getOverview);
router.get('/content/:id', authenticate, authorize('admin'), controller.getContentAnalytics);

module.exports = router;
