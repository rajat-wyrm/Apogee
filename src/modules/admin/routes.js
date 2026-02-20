const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError, paginated } = require('../../utils/http');
const { authenticate, requireOrgRole } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const audit = require('../../services/audit');
const { randomToken } = require('../../utils/crypto');
const { hashToken } = require('../../utils/crypto');

const router = express.Router();
router.use(authenticate());

router.get('/users', requireOrgRole(['admin', 'owner']), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;
  const r = await db.query(
    `SELECT u.id, u.email, u.full_name, u.avatar_url, u.status, u.last_active_at, m.role, m.joined_at
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.organization_id=$1 ORDER BY m.joined_at DESC LIMIT $2 OFFSET $3`,
    [req.organizationId, limit, offset]
  );
  const c = await db.query('SELECT COUNT(*)::int AS total FROM memberships WHERE organization_id=$1', [req.organizationId]);
  return paginated(res, r.rows, c.rows[0].total, page, limit);
}));

router.put('/users/:userId/role', requireOrgRole(['admin', 'owner']), [param('userId').isUUID(), body('role').isIn(['admin', 'member', 'guest'])], validate, asyncHandler(async (req, res) => {
  const r = await db.query('UPDATE memberships SET role=$1 WHERE user_id=$2 AND organization_id=$3 RETURNING *', [req.body.role, req.params.userId, req.organizationId]);
  if (!r.rows[0]) throw HttpError.notFound();
  audit.record({ organizationId: req.organizationId, actorId: req.userId, action: 'admin.role_changed', entityType: 'user', entityId: req.params.userId, diff: { role: req.body.role } });
  return ok(res, r.rows[0]);
}));

router.delete('/users/:userId', requireOrgRole(['admin', 'owner']), asyncHandler(async (req, res) => {
  await db.query('DELETE FROM memberships WHERE user_id=$1 AND organization_id=$2', [req.params.userId, req.organizationId]);
  audit.record({ organizationId: req.organizationId, actorId: req.userId, action: 'admin.user_removed', entityType: 'user', entityId: req.params.userId });
  return ok(res, { success: true });
}));

router.get('/audit-logs', requireOrgRole(['admin', 'owner']), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const r = await audit.list(req.organizationId, { page, limit, action: req.query.action, entityType: req.query.entity_type });
  return paginated(res, r.rows, r.total, page, limit);
}));

router.get('/feature-flags', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM feature_flags ORDER BY key');
  return ok(res, r.rows);
}));

router.put('/feature-flags/:key', asyncHandler(async (req, res) => {
  const r = await db.query(
    `UPDATE feature_flags SET enabled=$1, updated_by=$2, updated_at=NOW() WHERE key=$3 RETURNING *`,
    [req.body.enabled, req.userId, req.params.key]
  );
  if (!r.rows[0]) {
    const r2 = await db.query(`INSERT INTO feature_flags(key, enabled, updated_by) VALUES ($1,$2,$3) RETURNING *`, [req.params.key, req.body.enabled, req.userId]);
    return ok(res, r2.rows[0]);
  }
  return ok(res, r.rows[0]);
}));

router.get('/api-keys', requireOrgRole(['admin', 'owner']), asyncHandler(async (req, res) => {
  const r = await db.query('SELECT id, name, prefix, scopes, last_used_at, expires_at, created_at FROM api_keys WHERE organization_id=$1 ORDER BY created_at DESC', [req.organizationId]);
  return ok(res, r.rows);
}));

router.post('/api-keys', requireOrgRole(['admin', 'owner']), [body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const raw = `apk_${randomToken(24)}`;
  const prefix = raw.slice(0, 8);
  const hash = hashToken(raw);
  await db.query(`INSERT INTO api_keys(organization_id, user_id, name, prefix, hash, scopes) VALUES ($1,$2,$3,$4,$5,$6)`, [req.organizationId, req.userId, req.body.name, prefix, hash, req.body.scopes || []]);
  return created(res, { name: req.body.name, prefix, key: raw, scopes: req.body.scopes || [] });
}));

router.delete('/api-keys/:id', requireOrgRole(['admin', 'owner']), asyncHandler(async (req, res) => {
  await db.query('UPDATE api_keys SET revoked_at=NOW() WHERE id=$1 AND organization_id=$2', [req.params.id, req.organizationId]);
  return ok(res, { success: true });
}));

module.exports = router;
