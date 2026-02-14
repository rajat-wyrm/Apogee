const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/feed', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  const wsId = req.query.workspace_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const where = ['a.organization_id = $1'];
  const params = [orgId];
  if (wsId) { params.push(wsId); where.push(`a.workspace_id = $${params.length}`); }
  const r = await db.query(`SELECT a.*, u.full_name AS actor_name, u.avatar_url AS actor_avatar FROM activities a LEFT JOIN users u ON u.id = a.actor_id WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC LIMIT 50`, params);
  return ok(res, r.rows);
}));

router.get('/bookmarks', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM bookmarks WHERE user_id=$1 ORDER BY created_at DESC', [req.userId]);
  return ok(res, r.rows);
}));

router.post('/bookmarks', asyncHandler(async (req, res) => {
  const r = await db.query(`INSERT INTO bookmarks(user_id, entity_type, entity_id, collection) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET collection=EXCLUDED.collection RETURNING *`, [req.userId, req.body.entity_type, req.body.entity_id, req.body.collection || 'inbox']);
  return ok(res, r.rows[0]);
}));

router.delete('/bookmarks/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM bookmarks WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
  return ok(res, { success: true });
}));

router.get('/saved-views', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM saved_views WHERE user_id=$1 AND entity_type=$2 ORDER BY created_at DESC', [req.userId, req.query.entity_type || 'task']);
  return ok(res, r.rows);
}));

router.post('/saved-views', asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO saved_views(user_id, entity_type, name, query, is_shared) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.userId, req.body.entity_type, req.body.name, JSON.stringify(req.body.query), req.body.is_shared || false]);
  return ok(res, r.rows[0]);
}));

module.exports = router;
