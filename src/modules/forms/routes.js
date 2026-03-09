const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  const r = await db.query('SELECT * FROM forms WHERE organization_id=$1 ORDER BY updated_at DESC', [orgId]);
  return ok(res, r.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO forms(organization_id, title, description, schema, settings, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.body.organization_id, req.body.title, req.body.description, JSON.stringify(req.body.schema), JSON.stringify(req.body.settings || {}), req.userId]);
  return created(res, r.rows[0]);
}));

router.get('/:id/submissions', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM form_submissions WHERE form_id=$1 ORDER BY created_at DESC', [req.params.id]);
  return ok(res, r.rows);
}));

router.post('/:id/submit', asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO form_submissions(form_id, data, submitted_by) VALUES ($1,$2,$3) RETURNING *', [req.params.id, JSON.stringify(req.body), req.userId]);
  return created(res, r.rows[0]);
}));

module.exports = router;
