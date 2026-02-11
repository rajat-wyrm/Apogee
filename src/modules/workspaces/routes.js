const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const { slugify, randomToken } = require('../../utils/crypto');
const audit = require('../../services/audit').record;

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const m = await db.query("SELECT 1 FROM memberships WHERE user_id=$1 AND organization_id=$2 AND status='active'", [req.userId, orgId]);
  if (!m.rows[0]) throw HttpError.forbidden('Not a member');
  const r = await db.query(
    `SELECT w.*, (SELECT COUNT(*) FROM workspace_members WHERE workspace_id=w.id)::int AS member_count,
            (SELECT COUNT(*) FROM projects WHERE workspace_id=w.id AND archived_at IS NULL)::int AS project_count
     FROM workspaces w WHERE organization_id=$1 ORDER BY w.created_at ASC`,
    [orgId]
  );
  return ok(res, r.rows);
}));

router.post('/', [body('organization_id').isUUID(), body('name').trim().isLength({ min: 1, max: 200 })], validate, asyncHandler(async (req, res) => {
  const m = await db.query("SELECT 1 FROM memberships WHERE user_id=$1 AND organization_id=$2 AND role IN ('owner','admin') AND status='active'", [req.userId, req.body.organization_id]);
  if (!m.rows[0]) throw HttpError.forbidden('Only admins can create workspaces');
  const slug = (slugify(req.body.name) + '-' + randomToken(3).toLowerCase()).toLowerCase();
  const r = await db.query(
    `INSERT INTO workspaces(organization_id, name, slug, description, icon, color, visibility, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.body.organization_id, req.body.name, slug, req.body.description, req.body.icon, req.body.color || '#6366f1', req.body.visibility || 'private', req.userId]
  );
  await db.query(`INSERT INTO workspace_members(workspace_id, user_id, role) VALUES ($1,$2,'lead')`, [r.rows[0].id, req.userId]);
  audit({ organizationId: req.body.organization_id, actorId: req.userId, action: 'workspace.created', entityType: 'workspace', entityId: r.rows[0].id, ip: req.ip, userAgent: req.headers['user-agent'] });
  return created(res, r.rows[0]);
}));

router.get('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM workspaces WHERE id=$1', [req.params.id]);
  if (!r.rows[0]) throw HttpError.notFound('Workspace not found');
  const member = await db.query('SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2', [req.params.id, req.userId]);
  if (!member.rows[0]) throw HttpError.forbidden('Not a member');
  return ok(res, r.rows[0]);
}));

router.patch('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const wm = await db.query("SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2", [req.params.id, req.userId]);
  if (!wm.rows[0] || !['lead', 'admin'].includes(wm.rows[0].role)) throw HttpError.forbidden();
  const fields = ['name', 'description', 'icon', 'color', 'visibility', 'settings'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE workspaces SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

router.delete('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const wm = await db.query("SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2", [req.params.id, req.userId]);
  if (!wm.rows[0] || wm.rows[0].role !== 'lead') throw HttpError.forbidden();
  await db.query('DELETE FROM workspaces WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.get('/:id/members', asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT u.id, u.email, u.full_name, u.avatar_url, wm.role, wm.created_at AS joined_at
     FROM workspace_members wm JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id=$1 ORDER BY wm.created_at ASC`,
    [req.params.id]
  );
  return ok(res, r.rows);
}));

router.post('/:id/members', [param('id').isUUID(), body('user_id').isUUID(), body('role').optional().isIn(['lead', 'editor', 'commenter', 'viewer'])], validate, asyncHandler(async (req, res) => {
  const wm = await db.query("SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2", [req.params.id, req.userId]);
  if (!wm.rows[0] || wm.rows[0].role !== 'lead') throw HttpError.forbidden();
  await db.query(`INSERT INTO workspace_members(workspace_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT (workspace_id, user_id) DO NOTHING`, [req.params.id, req.body.user_id, req.body.role || 'member']);
  return created(res, { success: true });
}));

router.delete('/:id/members/:userId', [param('id').isUUID(), param('userId').isUUID()], validate, asyncHandler(async (req, res) => {
  const wm = await db.query("SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2", [req.params.id, req.userId]);
  if (!wm.rows[0] || wm.rows[0].role !== 'lead') throw HttpError.forbidden();
  if (req.params.userId === req.userId) throw HttpError.badRequest('Cannot remove yourself');
  await db.query('DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2', [req.params.id, req.params.userId]);
  return ok(res, { success: true });
}));

module.exports = router;
