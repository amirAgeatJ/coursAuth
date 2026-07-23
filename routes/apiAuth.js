const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { signAccessToken } = require('../config/jwt');
const { checkJWT } = require('../middlewares/authCheck');
const { ACCESS_TOKEN_COOKIE_MS, REFRESH_TOKEN_COOKIE_MS, cookieOptions, issueRefreshToken, clearAuthCookies } = require('../config/tokens');

const router = express.Router();

const ANSSI_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'refreshToken manquant' });
  }

  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);

  if (!row) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'refreshToken invalide' });
  }

  if (row.used) {
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(row.user_id);
    clearAuthCookies(res);

    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(row.user_id);
    if (user) {
      db.prepare(
        'INSERT INTO connexions_audit (username, action, ip_address, user_agent) VALUES (?, ?, ?, ?)'
      ).run(user.username, 'FRAUD', req.ip, req.headers['user-agent']);
    }

    return res.status(401).json({ error: 'Vol de jeton détecté : toutes les sessions ont été révoquées' });
  }

  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
    clearAuthCookies(res);
    return res.status(401).json({ error: 'refreshToken expiré' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Utilisateur introuvable' });
  }

  db.prepare('UPDATE refresh_tokens SET used = 1 WHERE id = ?').run(row.id);
  const newRefreshToken = issueRefreshToken(user.id);
  const accessToken = signAccessToken(user);

  res.cookie('token', accessToken, cookieOptions(ACCESS_TOKEN_COOKIE_MS));
  res.cookie('refreshToken', newRefreshToken, cookieOptions(REFRESH_TOKEN_COOKIE_MS));

  res.json({ message: 'accessToken rafraîchi' });
});

router.post('/change-password', checkJWT, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }

  const isValid = await bcrypt.compare(oldPassword, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
  }

  if (!ANSSI_PASSWORD_REGEX.test(newPassword)) {
    return res.status(400).json({
      error: 'Le nouveau mot de passe doit contenir au moins 12 caractères, 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial',
    });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newHash, user.id);

  res.json({ message: 'Mot de passe mis à jour' });
});

module.exports = router;
