const crypto = require('crypto');
const authService = require('../services/auth.service');
const { GITHUB_CLIENT_ID, GITHUB_CALLBACK_URL } = require('../config/auth');

const pendingStates = new Map();

// GET /auth/github — redirect to GitHub
function githubLogin(req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  // For CLI PKCE flow, code_challenge comes as query param
  const { code_challenge, code_challenge_method = 'S256' } = req.query;

  pendingStates.set(state, { code_challenge, created: Date.now() });

  const params = new URLSearchParams({
    client_id:    GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope:        'read:user user:email',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

// GET /auth/github/callback
async function githubCallback(req, res, next) {
  try {
    const { code, state } = req.query;
    const stateData = pendingStates.get(state);

    if (!stateData) return res.status(400).json({ status: 'error', message: 'Invalid state parameter' });
    pendingStates.delete(state);

    const githubUser = await authService.getGithubUser(code, stateData.code_challenge);
    const user       = await authService.upsertUser(githubUser);

    if (!user.is_active) return res.status(403).json({ status: 'error', message: 'Account is deactivated' });

    const { accessToken, refreshToken } = authService.issueTokens(user);
    await authService.storeRefreshToken(user.id, refreshToken);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    
    // Check if this is a CLI request (has port parameter)
    const redirectPort = req.query.port || req.session?.port;
    if (redirectPort) {
      return res.redirect(
        `http://localhost:${redirectPort}/callback?access_token=${accessToken}&refresh_token=${refreshToken}&username=${user.username}`
      );
    }

    // Web flow — redirect to Next.js portal after setting cookies
    res.cookie('access_token',  accessToken,  { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax', 
      maxAge: 3 * 60 * 1000 
    });
    res.cookie('refresh_token', refreshToken, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax', 
      maxAge: 5 * 60 * 1000 
    });
    
    // Redirect to Next.js frontend with tokens in URL for client-side storage
    res.redirect(`${frontendUrl}/login?access_token=${accessToken}&refresh_token=${refreshToken}&username=${user.username}`);
  } catch (err) { 
    next(err); 
  }
}

// POST /auth/refresh
async function refresh(req, res, next) {
  try {
    // Accept token from body (CLI) or cookie (web)
    const oldToken = req.body.refresh_token || req.cookies?.refresh_token;
    if (!oldToken) return res.status(400).json({ status: 'error', message: 'Refresh token required' });

    const { accessToken, refreshToken } = await authService.rotateRefreshToken(oldToken);

    // If cookie-based (web), update cookies
    if (req.cookies?.refresh_token) {
      res.cookie('access_token',  accessToken,  { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'lax', 
        maxAge: 3 * 60 * 1000 
      });
      res.cookie('refresh_token', refreshToken, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'lax', 
        maxAge: 5 * 60 * 1000 
      });
    }

    res.json({ status: 'success', access_token: accessToken, refresh_token: refreshToken });
  } catch (err) { 
    next(err); 
  }
}

// POST /auth/logout
async function logout(req, res, next) {
  try {
    const token = req.body.refresh_token || req.cookies?.refresh_token;
    if (token) await authService.invalidateRefreshToken(token);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ status: 'success', message: 'Logged out' });
  } catch (err) { 
    next(err); 
  }
}

// GET /auth/me
function me(req, res) {
  res.json({ status: 'success', data: req.user });
}

module.exports = { githubLogin, githubCallback, refresh, logout, me };