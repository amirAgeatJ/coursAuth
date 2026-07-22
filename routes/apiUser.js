const express = require('express');
const { checkJWT, require2FA } = require('../middlewares/authCheck');

const router = express.Router();

router.get('/me', checkJWT, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

router.get('/secret-batmobile', checkJWT, require2FA, (req, res) => {
  res.json({
    message: `Accès accordé aux commandes critiques, ${req.user.username}.`,
    commands: ['Auto-pilote', 'Bouclier balistique', 'Mode furtif', 'Auto-destruction'],
  });
});

module.exports = router;
