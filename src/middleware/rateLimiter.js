const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim()
      || req.headers['x-real-ip']
      || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({ status: 'error', message: 'Too many requests, please try again later' });
  },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id
      || req.headers['x-forwarded-for']?.split(',')[0].trim()
      || req.headers['x-real-ip']
      || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({ status: 'error', message: 'Too many requests, please try again later' });
  },
});

module.exports = { authLimiter, apiLimiter };