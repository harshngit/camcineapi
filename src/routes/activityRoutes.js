const router = require('express').Router();
const { listActivity } = require('../controllers/activityController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin'), listActivity);

module.exports = router;
