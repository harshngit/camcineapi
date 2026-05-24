const router = require('express').Router();
const controller = require('../controllers/recommendationController');

router.get('/trending', controller.trending);
router.get('/new-releases', controller.newReleases);

module.exports = router;
