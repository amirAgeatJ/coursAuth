const crypto = require('crypto');
const db = require('./db');

const ACCESS_TOKEN_COOKIE_MS = 15 * 1000;
const REFRESH_TOKEN_TTL_DAYS = 7;
const REFRESH_TOKEN_COOKIE_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge,
});

function issueRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_COOKIE_MS).toISOString();

  db.prepare(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, userId, expiresAt);

  return token;
}

function clearAuthCookies(res) {
  res.clearCookie('token');
  res.clearCookie('refreshToken');
}

module.exports = {
  ACCESS_TOKEN_COOKIE_MS,
  REFRESH_TOKEN_COOKIE_MS,
  cookieOptions,
  issueRefreshToken,
  clearAuthCookies,
};
