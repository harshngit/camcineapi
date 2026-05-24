const router = require('express').Router();
const { body, param } = require('express-validator');
const controller = require('../controllers/actorController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/', controller.listActors);
router.get('/:id', [param('id').isUUID()], validate, controller.getActor);
router.get('/:id/filmography', [param('id').isUUID()], validate, controller.filmography);
router.post('/', authenticate, authorize('admin'), [body('name').notEmpty()], validate, controller.createActor);
router.put('/:id', authenticate, authorize('admin'), [param('id').isUUID()], validate, controller.updateActor);

module.exports = router;
