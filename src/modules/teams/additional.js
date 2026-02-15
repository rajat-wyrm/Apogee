const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/labels', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM labels WHERE organization_id=$1 ORDER BY name', [req.query.organization_id]);
  return ok(res, r.rows);
}));

router.post('/labels', asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO labels(organization_id, name, color, description) VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id, name) DO UPDATE SET color=EXCLUDED.color RETURNING *', [req.body.organization_id, req.body.name, req.body.color || '#6366f1', req.body.description]);
  return ok(res, r.rows[0]);
}));

router.delete('/labels/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM labels WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.post('/labels/assign', asyncHandler(async (req, res) => {
  await db.query('INSERT INTO task_labels(task_id, label_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.body.task_id, req.body.label_id]);
  return ok(res, { success: true });
}));

router.post('/labels/unassign', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM task_labels WHERE task_id=$1 AND label_id=$2', [req.body.task_id, req.body.label_id]);
  return ok(res, { success: true });
}));

router.get('/shares', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM shares WHERE created_by=$1 ORDER BY created_at DESC', [req.userId]);
  return ok(res, r.rows);
}));

router.post('/shares', asyncHandler(async (req, res) => {
  const token = require('crypto').randomBytes(16).toString('hex');
  const r = await db.query('INSERT INTO shares(entity_type, entity_id, token, permission, expires_at, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.body.entity_type, req.body.entity_id, token, req.body.permission || 'view', req.body.expires_at, req.userId]);
  return ok(res, { ...r.rows[0], url: `${process.env.APP_URL || 'http://localhost:5173'}/share/${token}` });
}));

router.delete('/shares/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM shares WHERE id=$1 AND created_by=$2', [req.params.id, req.userId]);
  return ok(res, { success: true });
}));

router.get('/presence', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT u.id, u.full_name, u.avatar_url, p.status, p.last_seen_at, p.current_page FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN presence p ON p.user_id = u.id WHERE m.organization_id=$1`, [req.query.organization_id]);
  return ok(res, r.rows);
}));

module.exports = router;
