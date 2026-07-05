const express = require('express');
const path = require('path');
const db = require('../config/db');
const { isAuthenticated, isAdmin } = require('../middlewares/authCheck');

const router = express.Router();

router.get('/', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/bat-computer.html'));
});

router.get('/api/me', isAuthenticated, (req, res) => {
  res.json({ id: req.session.user.id, username: req.session.user.username });
});

router.get('/api/secrets', isAuthenticated, (req, res) => {
  res.json([
    { name: 'Batarang', desc: 'Arme de jet',             icon: 'fa-shuriken'     },
    { name: 'Grappin',  desc: 'Ascension des bâtiments', icon: 'fa-anchor'       },
    { name: 'Fumigène', desc: 'Écran de fumée tactique', icon: 'fa-smog'         },
    { name: 'Traceur',  desc: 'Suivi de cibles',         icon: 'fa-location-dot' },
  ]);
});

router.post('/api/reports', isAuthenticated, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Contenu requis' });

  db.prepare('INSERT INTO reports (user_id, content) VALUES (?, ?)').run(req.session.user.id, content);
  res.status(201).json({ message: 'Rapport enregistré' });
});

router.get('/admin/audit', isAuthenticated, isAdmin, (req, res) => {
  const logs = db.prepare('SELECT * FROM connexions_audit ORDER BY timestamp DESC').all();
  res.sendFile(path.join(__dirname, '../views/admin-audit.html'));
});

router.get('/admin/audit/data', isAuthenticated, isAdmin, (req, res) => {
  const logs = db.prepare('SELECT * FROM connexions_audit ORDER BY timestamp DESC').all();
  res.json(logs);
});

module.exports = router;
