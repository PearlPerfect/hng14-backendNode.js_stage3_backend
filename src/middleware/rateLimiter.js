const rateLimit = require('express-rate-limit');

// Helper function to normalize IP addresses (including IPv6)
const normalizeIp = (ip) => {
  if (!ip) return 'unknown';
  
  // Convert IPv6 localhost to IPv4 format for consistency
  if (ip === '::1') return '127.0.0.1';
  if (ip === '::ffff:127.0.0.1') return '127.0.0.1';
  
  // Remove IPv6 prefix if present (::ffff:)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  return ip;
};

// Get client IP with proper IPv6 handling
const getClientIp = (req) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.headers['x-real-ip']
    || req.ip
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress;
  
  return normalizeIp(ip);
};

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    return `auth_${ip}`;
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
    if (req.user?.id) {
      return `user_${req.user.id}`;
    }
    const ip = getClientIp(req);
    return `api_${ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({ status: 'error', message: 'Too many requests, please try again later' });
  },
});

module.exports = { authLimiter, apiLimiter };