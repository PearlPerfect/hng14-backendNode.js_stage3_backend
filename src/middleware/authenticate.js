const jwt = require('jsonwebtoken');
const { ACCESS_TOKEN_SECRET } = require('../config/auth');
const pool = require('../config/db');

async function authenticate(req, res, next) {
  try {
    // Accept token from Authorization header (CLI) or cookie (web)
    let token = req.cookies?.access_token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    // Verify the token
    let decoded;
    try {
      decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ status: 'error', message: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ status: 'error', message: 'Invalid token' });
    }

    // Check user exists and is active
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'User not found' });
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ status: 'error', message: 'Account is deactivated' });
    }

    // Attach full user object to request
    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

module.exports = authenticate;
