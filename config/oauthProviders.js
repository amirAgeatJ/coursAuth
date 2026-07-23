const PROVIDERS = {
  google: {
    displayName: 'Google',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    fetchProfile: async (accessToken) => {
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      return { providerUserId: data.sub, email: data.email, displayName: data.name || data.email };
    },
  },

  github: {
    displayName: 'GitHub',
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    fetchProfile: async (accessToken) => {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'batcave-security-app',
      };

      const profileRes = await fetch('https://api.github.com/user', { headers });
      const profile = await profileRes.json();

      let email = profile.email;
      if (!email) {
        const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
        const emails = await emailsRes.json();
        const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) : null;
        email = primary?.email || null;
      }

      return { providerUserId: String(profile.id), email, displayName: profile.login };
    },
  },

  discord: {
    displayName: 'Discord',
    authorizationEndpoint: 'https://discord.com/api/oauth2/authorize',
    tokenEndpoint: 'https://discord.com/api/oauth2/token',
    scope: 'identify email',
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    fetchProfile: async (accessToken) => {
      const res = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      return { providerUserId: data.id, email: data.email, displayName: data.username };
    },
  },
};

function getProvider(name) {
  return PROVIDERS[name];
}

module.exports = { PROVIDERS, getProvider };
