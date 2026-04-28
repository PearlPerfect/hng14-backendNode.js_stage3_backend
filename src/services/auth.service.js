const jwt = require('jsonwebtoken');
const axios = require('axios');
const pool = require('../config/db');
const uuidv7 = require('../utils/uuidv7');
const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL } = require('../config/auth');

// Exchange GitHub code for user info
async function getGithubUser(code, codeVerifier) {
  const tokenRes = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id:     GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri:  GITHUB_CALLBACK_URL,
      code_verifier: codeVerifier, // PKCE
    },
    { headers: { Accept: 'application/json' } }
  );

  const { access_token } = tokenRes.data;
  if (!access_token) throw new Error('GitHub did not return an access token');

  const userRes = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'insighta-labs' },
  });

  return userRes.data;
}

// Create or update user in DB
async function upsertUser(githubUser) {
  const existing = await pool.query('SELECT * FROM users WHERE github_id = $1', [String(githubUser.id)]);

  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    await pool.query(
      'UPDATE users SET username=$1, email=$2, avatar_url=$3, last_login_at=NOW() WHERE github_id=$4',
      [githubUser.login, githubUser.email || '', githubUser.avatar_url, String(githubUser.id)]
    );
    return { ...user, username: githubUser.login };
  }

  const id = uuidv7();
  await pool.query(
    `INSERT INTO users (id, github_id, username, email, avatar_url, role, last_login_at)
     VALUES ($1,$2,$3,$4,$5,'analyst',NOW())`,
    [id, String(githubUser.id), githubUser.login, githubUser.email || '', githubUser.avatar_url]
  );
  const newUser = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return newUser.rows[0];
}

// Issue access + refresh token pair
function issueTokens(user) {
  const payload = { id: user.id, role: user.role, username: user.username };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ id: user.id }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  return { accessToken, refreshToken };
}

// Store refresh token in DB
async function storeRefreshToken(userId, token) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await pool.query(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1,$2,$3,$4)',
    [uuidv7(), userId, token, expiresAt]
  );
}

// Rotate refresh token — old one invalidated, new pair issued
async function rotateRefreshToken(oldToken) {
  const row = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token=$1 AND expires_at > NOW()',
    [oldToken]
  );
  if (row.rows.length === 0) throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });

  const { user_id } = row.rows[0];

  // Invalidate old token immediately
  await pool.query('DELETE FROM refresh_tokens WHERE token=$1', [oldToken]);

  const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [user_id]);
  if (userRes.rows.length === 0) throw Object.assign(new Error('User not found'), { status: 401 });

  const user = userRes.rows[0];
  if (!user.is_active) throw Object.assign(new Error('Account is deactivated'), { status: 403 });

  const tokens = issueTokens(user);
  await storeRefreshToken(user.id, tokens.refreshToken);
  return tokens;
}

// Invalidate refresh token on logout
async function invalidateRefreshToken(token) {
  await pool.query('DELETE FROM refresh_tokens WHERE token=$1', [token]);
}

module.exports = { getGithubUser, upsertUser, issueTokens, storeRefreshToken, rotateRefreshToken, invalidateRefreshToken };