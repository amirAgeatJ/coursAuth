const express = require('express');
const path = require('path');
const db = require('../config/db');
const { checkJWT, isAdmin } = require('../middlewares/authCheck');
const checkScope = require('../middlewares/checkScope');

const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/bat-computer.html'));
});

router.get('/api/me', checkJWT, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

router.get('/api/secrets', checkJWT, checkScope('armory:weapons'), (req, res) => {
  res.json([
    { name: 'Batarang', desc: 'Arme de jet',             icon: 'fa-shuriken'     },
    { name: 'Grappin',  desc: 'Ascension des bâtiments', icon: 'fa-anchor'       },
    { name: 'Fumigène', desc: 'Écran de fumée tactique', icon: 'fa-smog'         },
    { name: 'Traceur',  desc: 'Suivi de cibles',         icon: 'fa-location-dot' },
  ]);
});

router.post('/api/reports', checkJWT, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Contenu requis' });

  db.prepare('INSERT INTO reports (user_id, content) VALUES (?, ?)').run(req.user.id, content);
  res.status(201).json({ message: 'Rapport enregistré' });
});

router.get('/admin/audit', checkJWT, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin-audit.html'));
});

router.get('/admin/audit/data', checkJWT, isAdmin, (req, res) => {
  const logs = db.prepare('SELECT * FROM connexions_audit ORDER BY timestamp DESC').all();
  res.json(logs);
});

module.exports = router;
