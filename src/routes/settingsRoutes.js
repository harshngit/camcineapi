const router = require('express').Router();
const controller = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin'), controller.getSettings);
router.put('/', authenticate, authorize('admin'), controller.updateSettings);

module.exports = router;
