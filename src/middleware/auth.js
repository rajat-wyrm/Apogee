const { verifyAccess, verifyRefresh } = require('../services/tokens');
const { hashToken } = require('../utils/crypto');
const db = require('../db/pool');
const { HttpError } = require('../utils/http');

const extractToken = (req) => {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  if (req.cookies?.access_token) return req.cookies.access_token;
  if (req.query?.access_token) return req.query.access_token;
  return null;
};

const authenticate = (options = {}) => async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      if (options.optional) return next();
      throw HttpError.unauthorized('Missing access token');
    }
    let payload;
    try {
      payload = verifyAccess(token);
    } catch (e) {
      if (options.optional) return next();
      throw HttpError.unauthorized('Invalid or expired access token');
    }
    const r = await db.query(
      'SELECT id, email, full_name, avatar_url, status, two_factor_enabled, preferences, locale, timezone FROM users WHERE id=$1',
      [payload.sub]
    );
    if (!r.rows[0]) throw HttpError.unauthorized('User not found');
    if (r.rows[0].status !== 'active') throw HttpError.forbidden('Account suspended');
    req.user = r.rows[0];
    req.userId = r.rows[0].id;
    next();
  } catch (e) {
    next(e);
  }
};

const optionalAuth = authenticate({ optional: true });

const requireOrgRole = (roles) => async (req, _res, next) => {
  try {
    const orgId = req.params.id || req.params.orgId || req.params.organizationId || req.body.organization_id || req.query.organization_id;
    if (!orgId) throw HttpError.badRequest('organization_id required');
    const r = await db.query(
      'SELECT role, status FROM memberships WHERE user_id=$1 AND organization_id=$2',
      [req.userId, orgId]
    );
    if (!r.rows[0] || r.rows[0].status !== 'active') throw HttpError.forbidden('Not a member of this organization');
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(r.rows[0].role) && r.rows[0].role !== 'owner') {
      throw HttpError.forbidden('Insufficient role');
    }
    req.organizationId = orgId;
    req.orgRole = r.rows[0].role;
    next();
  } catch (e) {
    next(e);
  }
};

const requireWorkspaceRole = (roles) => async (req, _res, next) => {
  try {
    const wsId = req.params.workspaceId || req.params.id;
    if (!wsId) throw HttpError.badRequest('workspaceId required');
    const r = await db.query(
      'SELECT role FROM workspace_members WHERE user_id=$1 AND workspace_id=$2',
      [req.userId, wsId]
    );
    if (!r.rows[0]) throw HttpError.forbidden('Not a workspace member');
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(r.rows[0].role)) throw HttpError.forbidden('Insufficient role');
    req.workspaceId = wsId;
    req.workspaceRole = r.rows[0].role;
    next();
  } catch (e) {
    next(e);
  }
};

const apiKey = () => async (req, _res, next) => {
  try {
    const key = req.headers['x-api-key'] || req.query.api_key;
    if (!key) throw HttpError.unauthorized('API key required');
    const prefix = key.slice(0, 8);
    const hash = hashToken(key);
    const r = await db.query(
      'SELECT id, organization_id, scopes FROM api_keys WHERE prefix=$1 AND hash=$2 AND revoked_at IS NULL',
      [prefix, hash]
    );
    if (!r.rows[0]) throw HttpError.unauthorized('Invalid API key');
    await db.query('UPDATE api_keys SET last_used_at=NOW() WHERE id=$1', [r.rows[0].id]);
    req.apiKey = r.rows[0];
    req.organizationId = r.rows[0].organization_id;
    next();
  } catch (e) {
    next(e);
  }
};

module.exports = { authenticate, optionalAuth, requireOrgRole, requireWorkspaceRole, apiKey };
