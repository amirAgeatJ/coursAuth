const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const { getProvider } = require('../config/oauthProviders');
const { signAccessToken } = require('../config/jwt');
const { ACCESS_TOKEN_COOKIE_MS, REFRESH_TOKEN_COOKIE_MS, cookieOptions, issueRefreshToken } = require('../config/tokens');

const router = express.Router();

// Cette transaction cookie DOIT être posée en sameSite:'lax', jamais 'strict'.
// Une première version générée avec l'aide d'une IA utilisait 'strict' par défaut (calqué sur
// les cookies de session applicatifs) : le callback ne recevait alors jamais oauth_state,
// puisque le retour depuis accounts.google.com est une navigation cross-site de premier niveau,
// que 'strict' bloque justement. C'est une confusion classique entre cookie de session interne
// (toujours same-site) et cookie de transaction OAuth (traverse un domaine tiers par nature).
const OAUTH_TRANSACTION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 5 * 60 * 1000,
};

function clearOAuthCookies(res) {
  res.clearCookie('oauth_state');
  res.clearCookie('oauth_verifier');
}

function redirectToError(res, reason) {
  res.redirect(`/auth-error.html?reason=${encodeURIComponent(reason)}`);
}

function upsertOAuthUser(providerName, profile) {
  const existingIdentity = db.prepare(
    'SELECT user_id FROM oauth_identities WHERE provider = ? AND provider_user_id = ?'
  ).get(providerName, profile.providerUserId);

  if (existingIdentity) {
    db.prepare('UPDATE oauth_identities SET email = ? WHERE provider = ? AND provider_user_id = ?')
      .run(profile.email || null, providerName, profile.providerUserId);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(existingIdentity.user_id);
  }

  const baseUsername = `${providerName}:${profile.displayName || profile.providerUserId}`;

  let lastInsertRowid;
  try {
    ({ lastInsertRowid } = db.prepare('INSERT INTO users (username, email) VALUES (?, ?)').run(baseUsername, profile.email || null));
  } catch (err) {
    if (!err.message.includes('UNIQUE')) throw err;
    const fallbackUsername = `${baseUsername}-${crypto.randomBytes(3).toString('hex')}`;
    ({ lastInsertRowid } = db.prepare('INSERT INTO users (username, email) VALUES (?, ?)').run(fallbackUsername, profile.email || null));
  }

  db.prepare(
    `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email) VALUES (?, ?, ?, ?)
     ON CONFLICT(provider, provider_user_id) DO UPDATE SET email = excluded.email`
  ).run(lastInsertRowid, providerName, profile.providerUserId, profile.email || null);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
}

router.get('/:provider', (req, res) => {
  const provider = getProvider(req.params.provider);
  if (!provider) return res.status(404).send('Fournisseur inconnu');

  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  res.cookie('oauth_state', state, OAUTH_TRANSACTION_COOKIE_OPTIONS);
  res.cookie('oauth_verifier', codeVerifier, OAUTH_TRANSACTION_COOKIE_OPTIONS);

  const redirectUri = `${process.env.OAUTH_BASE_URL}/auth/${req.params.provider}/callback`;
  const authUrl = new URL(provider.authorizationEndpoint);
  authUrl.searchParams.set('client_id', provider.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', provider.scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  res.redirect(authUrl.toString());
});

router.get('/:provider/callback', async (req, res) => {
  const providerName = req.params.provider;
  const provider = getProvider(providerName);
  if (!provider) return res.status(404).send('Fournisseur inconnu');

  if (req.query.error) {
    clearOAuthCookies(res);
    return redirectToError(res, req.query.error);
  }

  const { code, state } = req.query;
  const savedState = req.cookies?.oauth_state;
  const codeVerifier = req.cookies?.oauth_verifier;
  clearOAuthCookies(res);

  if (!code || !state || !savedState || state !== savedState) {
    return redirectToError(res, 'state_mismatch');
  }

  try {
    const redirectUri = `${process.env.OAUTH_BASE_URL}/auth/${providerName}/callback`;

    const tokenRes = await fetch(provider.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      return redirectToError(res, 'token_exchange_failed');
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return redirectToError(res, 'token_exchange_failed');
    }

    const profile = await provider.fetchProfile(tokenData.access_token);
    if (!profile?.providerUserId) {
      return redirectToError(res, 'profile_fetch_failed');
    }

    const user = upsertOAuthUser(providerName, profile);

    const accessToken = signAccessToken(user);
    const refreshToken = issueRefreshToken(user.id);

    res.cookie('token', accessToken, cookieOptions(ACCESS_TOKEN_COOKIE_MS));
    res.cookie('refreshToken', refreshToken, cookieOptions(REFRESH_TOKEN_COOKIE_MS));

    db.prepare(
      'INSERT INTO connexions_audit (username, action, ip_address, user_agent) VALUES (?, ?, ?, ?)'
    ).run(user.username, 'LOGIN', req.ip, req.headers['user-agent']);

    res.redirect('/bat-computer');
  } catch (err) {
    redirectToError(res, 'server_error');
  }
});

module.exports = router;
