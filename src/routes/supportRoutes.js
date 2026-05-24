const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('../controllers/supportController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.get('/tickets', authenticate, controller.listTickets);
router.get('/tickets/:id', authenticate, controller.getTicket);
router.post('/tickets', authenticate, [body('subject').notEmpty(), body('body').notEmpty()], validate, controller.createTicket);
router.put('/tickets/:id', authenticate, authorize('admin', 'manager'), controller.updateTicket);
router.post('/tickets/:id/reply', authenticate, [body('body').notEmpty()], validate, controller.reply);
router.delete('/tickets/:id', authenticate, authorize('admin'), controller.removeTicket);

module.exports = router;
