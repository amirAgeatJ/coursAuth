const express = require('express');
const QRCode = require('qrcode');
const { authenticator } = require('@otplib/preset-v11');
const db = require('../config/db');
const { checkJWT } = require('../middlewares/authCheck');

const router = express.Router();

router.post('/setup', checkJWT, async (req, res) => {
  const secret = authenticator.generateSecret();
  const otpauthUri = authenticator.keyuri(req.user.username, 'Batcave', secret);

  db.prepare('UPDATE users SET two_factor_secret = ? WHERE id = ?').run(secret, req.user.id);

  const qrCode = await QRCode.toDataURL(otpauthUri);

  res.json({ qrCode, secret });
});

router.post('/confirm', checkJWT, (req, res) => {
  const { code } = req.body;

  const user = db.prepare('SELECT two_factor_secret FROM users WHERE id = ?').get(req.user.id);
  if (!user?.two_factor_secret) {
    return res.status(400).json({ error: 'Aucun enrôlement 2FA en attente' });
  }

  const isValid = authenticator.check(code, user.two_factor_secret);
  if (!isValid) {
    return res.status(401).json({ error: 'Code TOTP invalide ou expiré' });
  }

  db.prepare('UPDATE users SET two_factor_enabled = 1 WHERE id = ?').run(req.user.id);

  res.json({ message: 'Double authentification activée' });
});

module.exports = router;
