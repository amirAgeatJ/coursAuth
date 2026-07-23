const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('../config/db');
const { signAccessToken } = require('../config/jwt');
const { ACCESS_TOKEN_COOKIE_MS, REFRESH_TOKEN_COOKIE_MS, cookieOptions, issueRefreshToken } = require('../config/tokens');

const router = express.Router();

router.post('/register', async (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username et password requis' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères min)' });
  }
  if (username.includes(' ')) {
    return res.status(400).json({ error: "Le username ne doit pas contenir d'espaces" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);

    const accessToken = signAccessToken(user);
    const refreshToken = issueRefreshToken(user.id);

    res.cookie('token', accessToken, cookieOptions(ACCESS_TOKEN_COOKIE_MS));
    res.cookie('refreshToken', refreshToken, cookieOptions(REFRESH_TOKEN_COOKIE_MS));

    res.status(201).json({ message: 'Utilisateur créé', mustEnroll2FA: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ce username est déjà pris' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username et password requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  if (!user.two_factor_enabled) {
    return res.status(403).json({
      error: "Double authentification (2FA) obligatoire. Activez-la avant de vous connecter.",
      mustEnroll2FA: true,
    });
  }

  res.json({
    requires2FA: true,
    message: 'Étape 1 validée. Veuillez fournir votre code TOTP.',
    username: user.username,
  });
});

router.get('/logout', (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  const accessToken = req.cookies?.token;

  let username = accessToken ? jwt.decode(accessToken)?.username : undefined;

  if (refreshToken) {
    if (!username) {
      const row = db.prepare('SELECT user_id FROM refresh_tokens WHERE token = ?').get(refreshToken);
      username = row && db.prepare('SELECT username FROM users WHERE id = ?').get(row.user_id)?.username;
    }
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }

  res.clearCookie('token');
  res.clearCookie('refreshToken');

  if (username) {
    db.prepare(
      'INSERT INTO connexions_audit (username, action, ip_address, user_agent) VALUES (?, ?, ?, ?)'
    ).run(username, 'LOGOUT', req.ip, req.headers['user-agent']);
  }

  res.redirect('/auth/login');
});

module.exports = router;
