const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, created } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM shares WHERE created_by=$1 ORDER BY created_at DESC', [req.userId]);
  return ok(res, r.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const token = crypto.randomBytes(16).toString('hex');
  const r = await db.query('INSERT INTO shares(entity_type, entity_id, token, permission, expires_at, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.body.entity_type, req.body.entity_id, token, req.body.permission || 'view', req.body.expires_at, req.userId]);
  return created(res, { ...r.rows[0], url: `${process.env.APP_URL || 'http://localhost:5173'}/share/${token}` });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM shares WHERE id=$1 AND created_by=$2', [req.params.id, req.userId]);
  return ok(res, { success: true });
}));

module.exports = router;
