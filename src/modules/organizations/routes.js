const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError, paginated } = require('../../utils/http');
const { authenticate, requireOrgRole } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const { slugify, randomToken } = require('../../utils/crypto');
const audit = require('../../services/audit').record;
const email = require('../../services/email');
const config = require('../../config');
const cache = require('../../services/cache');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT o.*, m.role FROM organizations o
     JOIN memberships m ON m.organization_id = o.id
     WHERE m.user_id=$1 AND m.status='active'
     ORDER BY o.created_at DESC`,
    [req.userId]
  );
  return ok(res, r.rows);
}));

router.post(
  '/',
  [body('name').trim().isLength({ min: 1, max: 200 })],
  validate,
  asyncHandler(async (req, res) => {
    const slug = (req.body.slug || slugify(req.body.name) + '-' + randomToken(3).toLowerCase()).toLowerCase();
    const r = await db.tx(async (c) => {
      const org = await c.query(
        `INSERT INTO organizations(slug, name, description, industry, size, plan, created_by) VALUES ($1,$2,$3,$4,$5,'free',$6) RETURNING *`,
        [slug, req.body.name, req.body.description, req.body.industry, req.body.size, req.userId]
      );
      await c.query(`INSERT INTO memberships(user_id, organization_id, role) VALUES ($1,$2,'owner')`, [req.userId, org.rows[0].id]);
      const ws = await c.query(
        `INSERT INTO workspaces(organization_id, name, slug, created_by) VALUES ($1,'General','general',$2) RETURNING *`,
        [org.rows[0].id, req.userId]
      );
      await c.query(`INSERT INTO workspace_members(workspace_id, user_id, role) VALUES ($1,$2,'lead')`, [ws.rows[0].id, req.userId]);
      return { org: org.rows[0], workspace: ws.rows[0] };
    });
    audit({ organizationId: r.org.id, actorId: req.userId, action: 'org.created', entityType: 'organization', entityId: r.org.id, ip: req.ip, userAgent: req.headers['user-agent'] });
    return created(res, r);
  })
);

router.get('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const member = await db.query('SELECT o.*, m.role FROM organizations o JOIN memberships m ON m.organization_id = o.id WHERE o.id=$1 AND m.user_id=$2 AND m.status=$3', [req.params.id, req.userId, 'active']);
  if (!member.rows[0]) throw HttpError.notFound('Organization not found');
  const stats = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM workspaces WHERE organization_id=$1) AS workspaces,
       (SELECT COUNT(*) FROM memberships WHERE organization_id=$1 AND status='active') AS members,
       (SELECT COUNT(*) FROM projects WHERE organization_id=$1) AS projects,
       (SELECT COUNT(*) FROM tasks WHERE organization_id=$1) AS tasks`,
    [req.params.id]
  );
  return ok(res, { ...member.rows[0], stats: stats.rows[0] });
}));

router.patch('/:id', [param('id').isUUID(), body('name').optional(), body('description').optional(), body('logo_url').optional(), body('website').optional(), body('industry').optional(), body('size').optional(), body('settings').optional()], validate, requireOrgRole(['admin', 'owner']), asyncHandler(async (req, res) => {
  const fields = ['name', 'description', 'logo_url', 'website', 'industry', 'size', 'settings'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  audit({ organizationId: req.params.id, actorId: req.userId, action: 'org.updated', entityType: 'organization', entityId: req.params.id, ip: req.ip, userAgent: req.headers['user-agent'], diff: req.body });
  return ok(res, r.rows[0]);
}));

router.delete('/:id', [param('id').isUUID()], validate, requireOrgRole('owner'), asyncHandler(async (req, res) => {
  await db.query('DELETE FROM organizations WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.get('/:id/members', asyncHandler(async (req, res) => {
  const member = await db.query('SELECT 1 FROM memberships WHERE user_id=$1 AND organization_id=$2 AND status=$3', [req.userId, req.params.id, 'active']);
  if (!member.rows[0]) throw HttpError.forbidden('Not a member of this organization');
  const r = await db.query(
    `SELECT u.id, u.email, u.full_name, u.avatar_url, u.status, m.role, m.joined_at
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.organization_id=$1 ORDER BY m.joined_at DESC`,
    [req.params.id]
  );
  return ok(res, r.rows);
}));

router.post('/:id/members', [body('email').isEmail(), body('role').optional().isIn(['admin', 'member', 'guest'])], validate, requireOrgRole(['admin', 'owner']), asyncHandler(async (req, res) => {
  const u = await db.query('SELECT id, full_name FROM users WHERE email=$1', [req.body.email]);
  let user = u.rows[0];
  if (!user) {
    const inviteToken = randomToken(16);
    const r = await db.query(
      `INSERT INTO users(email, full_name, status) VALUES ($1,$2,'invited') RETURNING id, email, full_name`,
      [req.body.email, req.body.email.split('@')[0]]
    );
    user = r.rows[0];
    email.sendTemplate({ to: req.body.email, subject: `You're invited to join`, template: 'invite', data: { inviter: req.user.full_name, org: req.body.orgName || 'a workspace', url: `${config.appUrl}/signup?token=${inviteToken}` } }).catch(() => {});
  }
  const exists = await db.query('SELECT 1 FROM memberships WHERE user_id=$1 AND organization_id=$2', [user.id, req.params.id]);
  if (exists.rows[0]) throw HttpError.conflict('Already a member');
  await db.query(
    `INSERT INTO memberships(user_id, organization_id, role, invited_by) VALUES ($1,$2,$3,$4)`,
    [user.id, req.params.id, req.body.role || 'member', req.userId]
  );
  audit({ organizationId: req.params.id, actorId: req.userId, action: 'member.added', entityType: 'user', entityId: user.id, ip: req.ip, userAgent: req.headers['user-agent'] });
  return created(res, user);
}));

router.patch('/:id/members/:userId/role', [param('id').isUUID(), param('userId').isUUID(), body('role').isIn(['admin', 'member', 'guest'])], validate, requireOrgRole(['admin', 'owner']), asyncHandler(async (req, res) => {
  const r = await db.query('UPDATE memberships SET role=$1 WHERE user_id=$2 AND organization_id=$3 RETURNING *', [req.body.role, req.params.userId, req.params.id]);
  if (!r.rows[0]) throw HttpError.notFound('Member not found');
  audit({ organizationId: req.params.id, actorId: req.userId, action: 'member.role_changed', entityType: 'user', entityId: req.params.userId, ip: req.ip, userAgent: req.headers['user-agent'], diff: { role: req.body.role } });
  return ok(res, r.rows[0]);
}));

router.delete('/:id/members/:userId', [param('id').isUUID(), param('userId').isUUID()], validate, requireOrgRole(['admin', 'owner']), asyncHandler(async (req, res) => {
  await db.query('DELETE FROM memberships WHERE user_id=$1 AND organization_id=$2', [req.params.userId, req.params.id]);
  audit({ organizationId: req.params.id, actorId: req.userId, action: 'member.removed', entityType: 'user', entityId: req.params.userId, ip: req.ip, userAgent: req.headers['user-agent'] });
  return ok(res, { success: true });
}));

router.get('/:id/workspaces', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM workspaces WHERE organization_id=$1 ORDER BY created_at ASC', [req.params.id]);
  return ok(res, r.rows);
}));

router.get('/:id/audit-logs', requireOrgRole(['admin', 'owner']), asyncHandler(async (req, res) => {
  const { list } = require('../../services/audit');
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const result = await list(req.params.id, { page, limit, action: req.query.action, entityType: req.query.entity_type, actorId: req.query.actor_id });
  return paginated(res, result.rows, result.total, page, limit);
}));

router.get('/:id/usage', asyncHandler(async (req, res) => {
  const member = await db.query('SELECT 1 FROM memberships WHERE user_id=$1 AND organization_id=$2 AND status=$3', [req.userId, req.params.id, 'active']);
  if (!member.rows[0]) throw HttpError.forbidden('Not a member of this organization');
  const ai = await db.query(`SELECT feature, COUNT(*)::int AS calls, COALESCE(SUM(prompt_tokens+completion_tokens),0)::int AS tokens FROM ai_usage WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '30 days' GROUP BY feature`, [req.params.id]);
  const storage = await db.query(`SELECT COALESCE(SUM(size_bytes),0)::bigint AS bytes FROM files WHERE organization_id=$1`, [req.params.id]);
  return ok(res, { ai: ai.rows, storage_bytes: storage.rows[0].bytes });
}));

module.exports = router;
