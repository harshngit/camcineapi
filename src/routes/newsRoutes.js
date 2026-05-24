const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/newsController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/', controller.listNews);
router.get('/:id', controller.getNews);
router.post('/', authenticate, authorize('admin', 'manager'), [body('title').notEmpty(), body('slug').notEmpty(), body('body').notEmpty()], validate, controller.createNews);
router.put('/:id', authenticate, authorize('admin', 'manager'), controller.updateNews);
router.patch('/:id/publish', authenticate, authorize('admin'), controller.publishNews);
router.delete('/:id', authenticate, authorize('admin'), controller.removeNews);

module.exports = router;
