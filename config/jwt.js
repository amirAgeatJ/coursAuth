const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL = '15s';

function signAccessToken(user, is2FAVerified = false) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, is2FAVerified },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signAccessToken, verifyAccessToken, ACCESS_TOKEN_TTL };
