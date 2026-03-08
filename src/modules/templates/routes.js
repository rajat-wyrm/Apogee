const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query('SELECT * FROM templates WHERE organization_id=$1 OR is_public=true ORDER BY uses_count DESC', [orgId]);
  return ok(res, r.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const r = await db.query(`INSERT INTO templates(organization_id, type, name, description, icon, is_public, payload, category, tags, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [req.body.organization_id, req.body.type, req.body.name, req.body.description, req.body.icon, req.body.is_public || false, JSON.stringify(req.body.payload), req.body.category, req.body.tags, req.userId]);
  return created(res, r.rows[0]);
}));

router.post('/:id/use', asyncHandler(async (req, res) => {
  await db.query('UPDATE templates SET uses_count = uses_count + 1 WHERE id=$1', [req.params.id]);
  const t = await db.query('SELECT * FROM templates WHERE id=$1', [req.params.id]);
  return ok(res, t.rows[0]);
}));

module.exports = router;
