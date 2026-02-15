const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate, requireOrgRole } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const audit = require('../../services/audit').record;

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(
    `SELECT t.*, u.full_name AS lead_name, (SELECT COUNT(*) FROM team_members WHERE team_id=t.id)::int AS member_count
     FROM teams t LEFT JOIN users u ON u.id = t.lead_id WHERE t.organization_id=$1 ORDER BY t.name`,
    [orgId]
  );
  return ok(res, r.rows);
}));

router.post('/', requireOrgRole(['admin', 'member']), [body('organization_id').isUUID(), body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(`INSERT INTO teams(organization_id, name, description, color, icon, lead_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [req.body.organization_id, req.body.name, req.body.description, req.body.color || '#6366f1', req.body.icon, req.body.lead_id]);
  return created(res, r.rows[0]);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const t = await db.query('SELECT * FROM teams WHERE id=$1', [req.params.id]);
  if (!t.rows[0]) throw HttpError.notFound();
  const m = await db.query(`SELECT u.id, u.full_name, u.avatar_url, u.email, tm.role FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=$1`, [req.params.id]);
  return ok(res, { ...t.rows[0], members: m.rows });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['name', 'description', 'color', 'icon', 'lead_id'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE teams SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM teams WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.post('/:id/members', [param('id').isUUID(), body('user_id').isUUID()], validate, asyncHandler(async (req, res) => {
  await db.query(`INSERT INTO team_members(team_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, req.body.user_id]);
  return created(res, { success: true });
}));

router.delete('/:id/members/:userId', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM team_members WHERE team_id=$1 AND user_id=$2', [req.params.id, req.params.userId]);
  return ok(res, { success: true });
}));

module.exports = router;
