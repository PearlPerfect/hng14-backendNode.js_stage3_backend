const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ status: 'error', message: 'Too many requests, please try again later' }),
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ status: 'error', message: 'Too many requests, please try again later' }),
});

module.exports = { authLimiter, apiLimiter };