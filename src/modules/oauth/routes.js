const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const config = require('../../config');
const { generateTokens, setAuthCookies } = require('../../services/tokens');
const { slugify, randomToken } = require('../../utils/crypto');
const audit = require('../../services/audit').record;

const router = express.Router();

const getRedirectBase = (req) => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, '');
  if (process.env.API_URL) return process.env.API_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
};

const getFrontendUrl = (req) => {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, '');
  if (config.appUrl) return config.appUrl.replace(/\/$/, '');
  return getRedirectBase(req);
};

const handleProviderCallback = async (req, res, profile) => {
  const email = profile.email || `${profile.provider}_${profile.id}@placeholder.local`;
  let user;
  const existing = await db.query(
    'SELECT u.* FROM oauth_accounts oa JOIN users u ON u.id = oa.user_id WHERE oa.provider=$1 AND oa.provider_user_id=$2',
    [profile.provider, profile.id]
  );
  user = existing.rows[0];

  if (!user) {
    const u2 = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    user = u2.rows[0];

    if (!user) {
      const newU = await db.query(
        `INSERT INTO users(email, full_name, avatar_url, email_verified, password_hash) VALUES ($1,$2,$3,true, NULL) RETURNING *`,
        [email, profile.name || profile.displayName || email.split('@')[0], profile.avatar_url || profile.picture]
      );
      user = newU.rows[0];
      const baseSlug = slugify(profile.name || email.split('@')[0]) || 'user';
      const slug = `${baseSlug}-${randomToken(3).toLowerCase()}`;
      const org = await db.query(
        `INSERT INTO organizations(slug, name, plan, plan_status, created_by) VALUES ($1,$2,'free','active',$3) RETURNING *`,
        [slug, `${user.full_name}'s workspace`, user.id]
      );
      await db.query(
        `INSERT INTO memberships(user_id, organization_id, role, status) VALUES ($1,$2,'owner','active') ON CONFLICT DO NOTHING`,
        [user.id, org.rows[0].id]
      );
      const wsSlug = `personal-${randomToken(3).toLowerCase()}`;
      const ws = await db.query(
        `INSERT INTO workspaces(organization_id, name, slug, created_by) VALUES ($1,'Personal',$2,$3) RETURNING *`,
        [org.rows[0].id, wsSlug, user.id]
      );
      await db.query(
        `INSERT INTO workspace_members(workspace_id, user_id, role) VALUES ($1,$2,'lead') ON CONFLICT DO NOTHING`,
        [ws.rows[0].id, user.id]
      );
      audit({
        organizationId: org.rows[0].id,
        actorId: user.id,
        action: 'user.registered.oauth',
        entityType: 'user',
        entityId: user.id,
        metadata: { provider: profile.provider },
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    await db.query(
      `INSERT INTO oauth_accounts(user_id, provider, provider_user_id, access_token, refresh_token, raw) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (provider, provider_user_id) DO UPDATE SET access_token=EXCLUDED.access_token, refresh_token=EXCLUDED.refresh_token, raw=EXCLUDED.raw, updated_at=NOW()`,
      [user.id, profile.provider, profile.id, profile.access_token || null, profile.refresh_token || null, JSON.stringify(profile)]
    );
  }

  const tokens = await generateTokens(user, db);
  setAuthCookies(res, tokens.access, tokens.refresh);
  const frontendUrl = getFrontendUrl(req);
  return res.redirect(`${frontendUrl}/app?oauth=success&provider=${profile.provider}`);
};

router.get('/google', (req, res) => {
  if (!config.google.clientId || !config.google.clientSecret) {
    return res.status(503).json({ success: false, error: { message: 'Google OAuth not configured' } });
  }
  const state = randomToken(16);
  const redirectBase = getRedirectBase(req);
  const callbackUrl = `${redirectBase}/api/oauth/google/callback`;
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=300`);
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get('/google/callback', asyncHandler(async (req, res) => {
  if (!req.query.code) {
    return res.redirect(`${getFrontendUrl(req)}/login?error=oauth_cancelled`);
  }
  if (!config.google.clientId || !config.google.clientSecret) {
    return res.redirect(`${getFrontendUrl(req)}/login?error=oauth_not_configured`);
  }

  const redirectBase = getRedirectBase(req);
  const callbackUrl = `${redirectBase}/api/oauth/google/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: req.query.code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    console.error('[oauth/google] token exchange failed:', tokenJson);
    return res.redirect(`${getFrontendUrl(req)}/login?error=oauth_failed`);
  }

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profile = await profileRes.json();
  if (!profile.sub) {
    return res.redirect(`${getFrontendUrl(req)}/login?error=oauth_no_profile`);
  }

  return handleProviderCallback(req, res, {
    provider: 'google',
    id: profile.sub,
    email: profile.email,
    name: profile.name,
    avatar_url: profile.picture,
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
  });
}));

router.get('/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(503).json({ success: false, error: { message: 'GitHub OAuth not configured' } });
  const state = randomToken(16);
  const redirectBase = getRedirectBase(req);
  res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=300`);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${redirectBase}/api/oauth/github/callback`,
    scope: 'user:email',
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

router.get('/github/callback', asyncHandler(async (req, res) => {
  if (!req.query.code) return res.redirect(`${getFrontendUrl(req)}/login?error=oauth_cancelled`);
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.redirect(`${getFrontendUrl(req)}/login?error=oauth_not_configured`);

  const redirectBase = getRedirectBase(req);
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: req.query.code,
      redirect_uri: `${redirectBase}/api/oauth/github/callback`,
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) return res.redirect(`${getFrontendUrl(req)}/login?error=oauth_failed`);

  const profileRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}`, 'User-Agent': 'Apogee' },
  });
  const profile = await profileRes.json();
  let email = profile.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}`, 'User-Agent': 'Apogee' },
    });
    const emails = await emailsRes.json();
    const primary = emails.find((e) => e.primary) || emails[0];
    email = primary?.email;
  }
  return handleProviderCallback(req, res, {
    provider: 'github',
    id: String(profile.id),
    email,
    name: profile.name || profile.login,
    avatar_url: profile.avatar_url,
    access_token: tokenJson.access_token,
    refresh_token: null,
  });
}));

router.get('/providers', (req, res) => {
  res.json({
    success: true,
    data: {
      google: !!(config.google.clientId && config.google.clientSecret),
      github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
    },
  });
});

module.exports = router;
