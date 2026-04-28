const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rateLimiter');
const authenticate = require('../middleware/authenticate');

const router = Router();
router.get('/github',          authLimiter, controller.githubLogin);
router.get('/github/callback', authLimiter, controller.githubCallback);
router.post('/refresh',        authLimiter, controller.refresh);
router.post('/logout',         authenticate, controller.logout);
router.get('/me',              authenticate, controller.me);

module.exports = router;