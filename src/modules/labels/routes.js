const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, created } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM labels WHERE organization_id=$1 ORDER BY name', [req.query.organization_id]);
  return ok(res, r.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO labels(organization_id, name, color, description) VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id, name) DO UPDATE SET color=EXCLUDED.color RETURNING *', [req.body.organization_id, req.body.name, req.body.color || '#6366f1', req.body.description]);
  return created(res, r.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM labels WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.post('/assign', asyncHandler(async (req, res) => {
  await db.query('INSERT INTO task_labels(task_id, label_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.body.task_id, req.body.label_id]);
  return ok(res, { success: true });
}));

router.post('/unassign', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM task_labels WHERE task_id=$1 AND label_id=$2', [req.body.task_id, req.body.label_id]);
  return ok(res, { success: true });
}));

module.exports = router;
