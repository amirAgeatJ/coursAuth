const express = require('express');
const { authenticator } = require('@otplib/preset-v11');
const db = require('../config/db');
const { signAccessToken } = require('../config/jwt');
const { ACCESS_TOKEN_COOKIE_MS, REFRESH_TOKEN_COOKIE_MS, cookieOptions, issueRefreshToken } = require('../config/tokens');

const router = express.Router();

router.post('/verify-2fa', (req, res) => {
  const { username, code } = req.body;

  if (!username || !code) {
    return res.status(400).json({ error: 'username et code requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
    return res.status(401).json({ error: 'Code TOTP invalide' });
  }

  const isValid = authenticator.check(code, user.two_factor_secret);
  if (!isValid) {
    return res.status(401).json({ error: 'Code TOTP invalide' });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = issueRefreshToken(user.id);

  res.cookie('token', accessToken, cookieOptions(ACCESS_TOKEN_COOKIE_MS));
  res.cookie('refreshToken', refreshToken, cookieOptions(REFRESH_TOKEN_COOKIE_MS));

  db.prepare(
    'INSERT INTO connexions_audit (username, action, ip_address, user_agent) VALUES (?, ?, ?, ?)'
  ).run(user.username, 'LOGIN', req.ip, req.headers['user-agent']);

  res.json({ message: 'Connexion validée' });
});

module.exports = router;
