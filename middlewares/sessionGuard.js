const db = require('../config/db');

function sessionGuard(req, res, next) {
  if (!req.session || !req.session.user) {
    return next();
  }

  const currentIp = req.ip;
  const currentUA = req.headers['user-agent'];

  if (req.session.ip !== currentIp || req.session.userAgent !== currentUA) {
    const { username } = req.session.user;

    db.prepare(
      'INSERT INTO connexions_audit (username, action, ip_address, user_agent) VALUES (?, ?, ?, ?)'
    ).run(username, 'FRAUD', currentIp, currentUA);

    console.warn(`[ALERTE SÉCURITÉ] Empreinte suspecte détectée pour ${username}`);

    req.session.destroy(() => {
      res.clearCookie('bat_identity');
      res.status(403).send('Accès bloqué : empreinte suspecte détectée. Session détruite.');
    });
    return;
  }

  next();
}

module.exports = sessionGuard;
