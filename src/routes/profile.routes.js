const { Router }   = require('express');
const controller   = require('../controllers/profile.controller');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const apiVersion   = require('../middleware/apiVersion');
const { apiLimiter } = require('../middleware/rateLimiter');

const router = Router();

// All profile routes
router.use(authenticate, apiVersion, apiLimiter);

// Read endpoints — admin and analyst
router.get('/search', authorize('admin', 'analyst'), controller.search);
router.get('/export', authorize('admin', 'analyst'), controller.exportCsv);
router.get('/',       authorize('admin', 'analyst'), controller.getAll);
router.get('/:id',    authorize('admin', 'analyst'), controller.getOne);

// Write endpoints — admin only
router.post('/',      authorize('admin'), controller.create);
router.delete('/:id', authorize('admin'), controller.remove);

module.exports = router;