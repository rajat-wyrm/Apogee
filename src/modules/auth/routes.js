const express = require('express');
const { body } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../../db/pool');
const config = require('../../config');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { hashPassword, verifyPassword, randomToken, hashToken, slugify } = require('../../utils/crypto');
const { generateTokens, setAuthCookies, clearAuthCookies, verifyRefresh } = require('../../services/tokens');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const email = require('../../services/email');
const { record: audit } = require('../../services/audit');
const { rateLimitAuth } = require('../../middleware/rate');

const router = express.Router();

const checkLockout = async (userId) => {
  const r = await db.query("SELECT COUNT(*)::int AS c FROM audit_logs WHERE actor_id=$1 AND action='login_failed' AND created_at > NOW() - INTERVAL '15 minutes'", [userId]);
  return r.rows[0].c;
};

router.post(
  '/register',
  rateLimitAuth,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('full_name').trim().isLength({ min: 1, max: 200 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    if (!config.features.registration) throw HttpError.forbidden('Registration disabled');
    const { email: userEmail, password, full_name } = req.body;

    const existing = await db.query('SELECT 1 FROM users WHERE email=$1', [userEmail]);
    if (existing.rows[0]) throw HttpError.conflict('Email already registered');

    const password_hash = await hashPassword(password);
    const orgSlug = slugify(`${full_name.split(' ')[0]}-${randomToken(4).toLowerCase()}`);

    // Single transaction with all the setup. Uses a CTE to atomically create user + org + membership + workspace.
    const u = await db.tx(async (c) => {
      const ur = await c.query(
        `WITH new_user AS (
           INSERT INTO users(email, password_hash, full_name, preferences)
           VALUES ($1,$2,$3,$4)
           RETURNING id, email, full_name, avatar_url, status, created_at
         ),
         new_org AS (
           INSERT INTO organizations(slug, name, plan, created_by)
           SELECT $5, $6, 'free', new_user.id FROM new_user
           RETURNING id, slug, name, description, logo_url, website, industry, size, plan, plan_status, trial_ends_at, billing_email, settings, metadata, created_by, created_at, updated_at
         ),
         new_member AS (
           INSERT INTO memberships(user_id, organization_id, role)
           SELECT new_user.id, new_org.id, 'owner' FROM new_user, new_org
         ),
         new_ws AS (
           INSERT INTO workspaces(organization_id, name, slug, created_by)
           SELECT new_org.id, 'Personal', 'personal', new_user.id FROM new_user, new_org
           RETURNING id, organization_id, name, slug, description, icon, color, visibility, archived_at, settings, created_by, created_at, updated_at
         ),
         new_ws_member AS (
           INSERT INTO workspace_members(workspace_id, user_id, role)
           SELECT new_ws.id, new_user.id, 'lead' FROM new_ws, new_user
         )
         SELECT (SELECT row_to_json(new_user) FROM new_user) AS user,
                (SELECT row_to_json(new_org) FROM new_org) AS org,
                (SELECT row_to_json(new_ws) FROM new_ws) AS workspace`,
        [userEmail, password_hash, full_name, JSON.stringify({ theme: 'system' }), orgSlug, `${full_name}'s workspace`]
      );
      return { user: ur.rows[0].user, org: ur.rows[0].org, workspace: ur.rows[0].workspace };
    });

    const { access, refresh } = await generateTokens(u.user, db);
    setAuthCookies(res, access, refresh);

    email.sendTemplate({
      to: userEmail,
      subject: 'Welcome to Apogee',
      template: 'welcome',
      data: { name: full_name, url: config.appUrl },
    }).catch(() => {});

    audit({ actorId: u.user.id, action: 'user.registered', entityType: 'user', entityId: u.user.id, ip: req.ip, userAgent: req.headers['user-agent'] });

    return created(res, { user: u.user, organization: u.org, workspace: u.workspace, access, refresh });
  })
);

router.post(
  '/login',
  rateLimitAuth,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const { email: userEmail, password } = req.body;
    const r = await db.query('SELECT * FROM users WHERE email=$1', [userEmail]);
    const user = r.rows[0];
    if (!user) {
      throw HttpError.unauthorized('Invalid email or password');
    }
    if (user.status === 'suspended') throw HttpError.forbidden('Account suspended');
    if (user.password_hash) {
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) {
        await audit({ actorId: user.id, action: 'login_failed', entityType: 'user', entityId: user.id, ip: req.ip, userAgent: req.headers['user-agent'] });
        const failures = await checkLockout(user.id);
        if (failures >= 5) {
          await db.query("UPDATE users SET status='suspended' WHERE id=$1", [user.id]);
          throw HttpError.forbidden('Account locked due to too many failed attempts');
        }
        throw HttpError.unauthorized('Invalid email or password');
      }
    } else {
      throw HttpError.unauthorized('Invalid email or password');
    }
    if (user.two_factor_enabled) {
      const otp = randomToken(6).toUpperCase();
      await db.query(
        `INSERT INTO notifications(user_id, type, title, body) VALUES ($1,'2fa','Two-factor code','Your code is ${otp}')`,
        [user.id]
      );
      return ok(res, { require2fa: true, userId: user.id });
    }
    const tokens = await generateTokens(user, db);
    setAuthCookies(res, tokens.access, tokens.refresh);
    await db.query('UPDATE users SET last_login_at=NOW(), last_active_at=NOW() WHERE id=$1', [user.id]);
    audit({ organizationId: null, actorId: user.id, action: 'user.login', entityType: 'user', entityId: user.id, ip: req.ip, userAgent: req.headers['user-agent'] });
    return ok(res, { user: { id: user.id, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url }, ...tokens });
  })
);

router.post('/2fa/verify', rateLimitAuth, [body('userId').isUUID(), body('code').isLength({ min: 4, max: 10 })], validate, asyncHandler(async (req, res) => {
  const { userId, code } = req.body;
  const r = await db.query("SELECT * FROM users WHERE id=$1 AND two_factor_enabled=true", [userId]);
  const user = r.rows[0];
  if (!user) throw HttpError.badRequest('2FA not enabled');
  const speakeasy = require('speakeasy');
  const verified = speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: 'base32', token: code, window: 2 });
  if (!verified && !(user.backup_codes || []).includes(code)) throw HttpError.unauthorized('Invalid code');
  const tokens = await generateTokens(user, db);
  setAuthCookies(res, tokens.access, tokens.refresh);
  return ok(res, { user: { id: user.id, email: user.email, full_name: user.full_name }, ...tokens });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.body.refresh_token || req.cookies?.refresh_token;
  if (!token) throw HttpError.badRequest('refresh_token required');
  const payload = verifyRefresh(token);
  const r = await db.query('SELECT id, email, full_name, status FROM users WHERE id=$1', [payload.sub]);
  const user = r.rows[0];
  if (!user || user.status !== 'active') throw HttpError.unauthorized('Invalid user');
  const tokenHash = hashToken(token);
  const tk = await db.query("SELECT id FROM refresh_tokens WHERE user_id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at > NOW()", [user.id, tokenHash]);
  if (!tk.rows[0]) throw HttpError.unauthorized('Refresh token revoked');
  await db.query("UPDATE refresh_tokens SET revoked_at=NOW() WHERE id=$1", [tk.rows[0].id]);
  const tokens = await generateTokens(user, db);
  setAuthCookies(res, tokens.access, tokens.refresh);
  return ok(res, tokens);
}));

router.post('/logout', authenticate({ optional: true }), asyncHandler(async (req, res) => {
  const token = req.body.refresh_token || req.cookies?.refresh_token;
  if (token) {
    const tokenHash = hashToken(token);
    await db.query("UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=$1", [tokenHash]);
  }
  clearAuthCookies(res);
  return ok(res, { success: true });
}));

router.post('/forgot-password', rateLimitAuth, [body('email').isEmail().normalizeEmail()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT id, full_name FROM users WHERE email=$1', [req.body.email]);
  const user = r.rows[0];
  if (user) {
    const token = randomToken();
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await db.query(
      `INSERT INTO notifications(user_id, type, title, body, link) VALUES ($1,'security','Reset your password','Click the link sent to your email',$2)`,
      [user.id, `${config.appUrl}/reset-password?token=${token}`]
    );
    email.sendTemplate({
      to: req.body.email,
      subject: 'Reset your password',
      template: 'reset',
      data: { name: user.full_name, url: `${config.appUrl}/reset-password?token=${tokenHash}` },
    }).catch(() => {});
  }
  return ok(res, { success: true });
}));

router.post('/reset-password', rateLimitAuth, [body('token').notEmpty(), body('password').isLength({ min: 8 })], validate, asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const tokenHash = hashToken(token);
  const r = await db.query("SELECT id FROM users WHERE id=(SELECT actor_id FROM audit_logs WHERE diff->>'reset_token'=$1 ORDER BY created_at DESC LIMIT 1)", [tokenHash]);
  if (!r.rows[0]) throw HttpError.badRequest('Invalid or expired token');
  const password_hash = await hashPassword(password);
  await db.query("UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2", [password_hash, r.rows[0].id]);
  return ok(res, { success: true });
}));

router.get('/me', authenticate(), asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT u.id, u.email, u.full_name, u.avatar_url, u.phone, u.locale, u.timezone, u.status, u.email_verified, u.two_factor_enabled, u.preferences, u.created_at
     FROM users u WHERE u.id=$1`,
    [req.userId]
  );
  const orgs = await db.query(
    `SELECT o.*, m.role FROM organizations o
     JOIN memberships m ON m.organization_id = o.id
     WHERE m.user_id=$1 AND m.status='active'`,
    [req.userId]
  );
  return ok(res, { user: r.rows[0], organizations: orgs.rows });
}));

router.patch('/me', authenticate(), [body('full_name').optional().isLength({ min: 1, max: 200 }), body('phone').optional(), body('locale').optional(), body('timezone').optional(), body('preferences').optional()], validate, asyncHandler(async (req, res) => {
  const fields = ['full_name', 'phone', 'locale', 'timezone', 'preferences'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.userId);
  const r = await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

router.post('/2fa/enable', authenticate(), asyncHandler(async (req, res) => {
  const speakeasy = require('speakeasy'); const QRCode = require('qrcode');
  const secret = speakeasy.generateSecret({ name: `Apogee:${req.user.email}` });
  const qr = await QRCode.toDataURL(secret.otpauth_url);
  await db.query('UPDATE users SET two_factor_secret=$1, two_factor_enabled=false WHERE id=$2', [secret.base32, req.userId]);
  return ok(res, { secret: secret.base32, qr });
}));

router.post('/2fa/confirm', authenticate(), [body('code').isLength({ min: 4, max: 10 })], validate, asyncHandler(async (req, res) => {
  const speakeasy = require('speakeasy');
  const r = await db.query('SELECT two_factor_secret FROM users WHERE id=$1', [req.userId]);
  if (!r.rows[0]?.two_factor_secret) throw HttpError.badRequest('2FA not initialized');
  const verified = speakeasy.totp.verify({ secret: r.rows[0].two_factor_secret, encoding: 'base32', token: req.body.code, window: 2 });
  if (!verified) throw HttpError.badRequest('Invalid code');
  const backup = Array.from({ length: 10 }, () => randomToken(8).toUpperCase());
  await db.query('UPDATE users SET two_factor_enabled=true, backup_codes=$1 WHERE id=$2', [backup, req.userId]);
  return ok(res, { backup_codes: backup });
}));

router.post('/2fa/disable', authenticate(), [body('code').isLength({ min: 4, max: 10 })], validate, asyncHandler(async (req, res) => {
  const speakeasy = require('speakeasy');
  const r = await db.query('SELECT two_factor_secret, backup_codes FROM users WHERE id=$1', [req.userId]);
  if (!r.rows[0]?.two_factor_secret) throw HttpError.badRequest('2FA not enabled');
  const ok = speakeasy.totp.verify({ secret: r.rows[0].two_factor_secret, encoding: 'base32', token: req.body.code, window: 2 });
  if (!ok && !(r.rows[0].backup_codes || []).includes(req.body.code)) throw HttpError.badRequest('Invalid code');
  await db.query('UPDATE users SET two_factor_enabled=false, two_factor_secret=NULL, backup_codes=NULL WHERE id=$1', [req.userId]);
  return ok(res, { success: true });
}));

router.post('/change-password', authenticate(), [body('current_password').notEmpty(), body('new_password').isLength({ min: 8 })], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.userId]);
  const valid = await verifyPassword(req.body.current_password, r.rows[0].password_hash);
  if (!valid) throw HttpError.unauthorized('Wrong current password');
  const password_hash = await hashPassword(req.body.new_password);
  await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [password_hash, req.userId]);
  return ok(res, { success: true });
}));

module.exports = router;
