function checkScope(requiredScope) {
  return (req, res, next) => {
    if (req.user?.scopes?.includes(requiredScope)) {
      return next();
    }
    res.status(403).json({ error: `Scope requis manquant : ${requiredScope}` });
  };
}

module.exports = checkScope;
