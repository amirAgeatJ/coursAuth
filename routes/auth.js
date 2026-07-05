const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('../config/db');

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
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
    res.status(201).json({ message: 'Utilisateur créé' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ce username est déjà pris' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/bat-computer');
  }
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

router.post('/login', async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).sendFile(path.join(__dirname, '../views/login.html'));
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user) {
    return res.status(401).sendFile(path.join(__dirname, '../views/login.html'));
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).sendFile(path.join(__dirname, '../views/login.html'));
  }

  req.session.regenerate((err) => {
    if (err) return next(err);

    req.session.user = { id: user.id, username: user.username, role: user.role };
    req.session.ip = req.ip;
    req.session.userAgent = req.headers['user-agent'];

    req.session.save((err) => {
      if (err) return next(err);

      db.prepare(
        'INSERT INTO connexions_audit (username, action, ip_address, user_agent) VALUES (?, ?, ?, ?)'
      ).run(user.username, 'LOGIN', req.ip, req.headers['user-agent']);

      res.redirect('/bat-computer');
    });
  });
});

router.get('/logout', (req, res, next) => {
  const username = req.session?.user?.username;
  const ip = req.ip;
  const ua = req.headers['user-agent'];

  req.session.destroy((err) => {
    if (err) return next(err);

    res.clearCookie('bat_identity');

    if (username) {
      db.prepare(
        'INSERT INTO connexions_audit (username, action, ip_address, user_agent) VALUES (?, ?, ?, ?)'
      ).run(username, 'LOGOUT', ip, ua);
    }

    res.redirect('/auth/login');
  });
});

module.exports = router;
