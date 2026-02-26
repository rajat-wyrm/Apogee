const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(`SELECT g.*, u.full_name AS owner_name, u.avatar_url AS owner_avatar, (SELECT COUNT(*)::int FROM goal_key_results WHERE goal_id=g.id) AS key_results_count FROM goals g LEFT JOIN users u ON u.id=g.owner_id WHERE g.organization_id=$1 ORDER BY g.created_at DESC`, [orgId]);
  return ok(res, r.rows);
}));

router.post('/', [body('organization_id').isUUID(), body('title').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(`INSERT INTO goals(organization_id, workspace_id, parent_id, title, description, owner_id, metric_type, target_value, start_date, end_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [req.body.organization_id, req.body.workspace_id, req.body.parent_id, req.body.title, req.body.description, req.body.owner_id || req.userId, req.body.metric_type, req.body.target_value, req.body.start_date, req.body.end_date]);
  return created(res, r.rows[0]);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM goals WHERE id=$1', [req.params.id]);
  if (!r.rows[0]) throw HttpError.notFound();
  const krs = await db.query('SELECT * FROM goal_key_results WHERE goal_id=$1', [req.params.id]);
  return ok(res, { ...r.rows[0], key_results: krs.rows });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['title', 'description', 'owner_id', 'metric_type', 'target_value', 'current_value', 'start_date', 'end_date', 'status', 'progress'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE goals SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM goals WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.post('/:id/key-results', [param('id').isUUID(), body('title').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO goal_key_results(goal_id, title, target_value, owner_id) VALUES ($1,$2,$3,$4) RETURNING *', [req.params.id, req.body.title, req.body.target_value, req.body.owner_id]);
  return created(res, r.rows[0]);
}));

router.patch('/:id/key-results/:krId', asyncHandler(async (req, res) => {
  const fields = ['title', 'target_value', 'current_value'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.krId, req.params.id);
  const r = await db.query(`UPDATE goal_key_results SET ${sets.join(', ')} WHERE id=$${i++} AND goal_id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

module.exports = router;
