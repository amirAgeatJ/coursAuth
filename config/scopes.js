const SCOPES_BY_ROLE = {
  admin: ['computers:admin', 'batmobile:control', 'armory:weapons'],
  user: ['computers:read', 'batmobile:status'],
};

function scopesForRole(role) {
  return SCOPES_BY_ROLE[role] || SCOPES_BY_ROLE.user;
}

module.exports = { scopesForRole };
