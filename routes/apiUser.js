const express = require('express');
const { checkJWT } = require('../middlewares/authCheck');
const checkScope = require('../middlewares/checkScope');

const router = express.Router();

router.get('/me', checkJWT, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

router.get('/secret-batmobile', checkJWT, checkScope('batmobile:control'), (req, res) => {
  res.json({
    message: `Accès accordé aux commandes critiques, ${req.user.username}.`,
    commands: ['Auto-pilote', 'Bouclier balistique', 'Mode furtif', 'Auto-destruction'],
  });
});

module.exports = router;
