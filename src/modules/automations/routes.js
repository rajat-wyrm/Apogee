const express = require('express');
const { body } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate, requireOrgRole } = require('../../middleware/auth');
const { validate } = require('../../middleware');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query('SELECT * FROM automations WHERE organization_id=$1 ORDER BY created_at DESC', [orgId]);
  return ok(res, r.rows);
}));

router.post('/', requireOrgRole(['admin', 'member']), [body('organization_id').isUUID(), body('name').notEmpty(), body('trigger').isObject(), body('actions').isArray()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO automations(organization_id, name, description, trigger, conditions, actions, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.body.organization_id, req.body.name, req.body.description, JSON.stringify(req.body.trigger), JSON.stringify(req.body.conditions || []), JSON.stringify(req.body.actions), req.userId]
  );
  return created(res, r.rows[0]);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['name', 'description', 'trigger', 'conditions', 'actions', 'enabled'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE automations SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM automations WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.post('/:id/run', asyncHandler(async (req, res) => {
  await db.query("UPDATE automations SET run_count = run_count + 1, last_run_at=NOW() WHERE id=$1", [req.params.id]);
  return ok(res, { success: true });
}));

router.get('/:id/runs', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM automation_runs WHERE automation_id=$1 ORDER BY started_at DESC LIMIT 50', [req.params.id]);
  return ok(res, r.rows);
}));

module.exports = router;
