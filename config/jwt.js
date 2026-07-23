const jwt = require('jsonwebtoken');
const { scopesForRole } = require('./scopes');

const ACCESS_TOKEN_TTL = '15m';

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, scopes: scopesForRole(user.role) },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signAccessToken, verifyAccessToken, ACCESS_TOKEN_TTL };
