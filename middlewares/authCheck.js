const { verifyAccessToken } = require('../config/jwt');

function extractToken(req) {
  if (req.cookies?.token) return req.cookies.token;

  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  return null;
}

function checkJWT(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'accessToken invalide ou expiré' });
  }
}

function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Accès refusé — réservé aux administrateurs.');
}

module.exports = { checkJWT, isAdmin };
