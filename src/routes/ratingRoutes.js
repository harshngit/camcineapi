const router = require('express').Router();
const { body, param } = require('express-validator');
const controller = require('../controllers/ratingController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/:id/ratings', [param('id').isUUID()], validate, controller.listRatings);
router.post('/:id/ratings', authenticate, [param('id').isUUID(), body('rating').isInt({ min: 1, max: 5 })], validate, controller.createRating);
router.put('/:id/ratings/:ratingId', authenticate, [param('id').isUUID(), param('ratingId').isUUID(), body('rating').isInt({ min: 1, max: 5 })], validate, controller.updateRating);
router.delete('/:id/ratings/:ratingId', authenticate, authorize('admin'), [param('id').isUUID(), param('ratingId').isUUID()], validate, controller.deleteRating);

module.exports = router;
