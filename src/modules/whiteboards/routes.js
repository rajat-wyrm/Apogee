const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const wsId = req.query.workspace_id;
  const r = await db.query('SELECT * FROM whiteboards WHERE workspace_id=$1 ORDER BY updated_at DESC', [wsId]);
  return ok(res, r.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO whiteboards(workspace_id, title, data, created_by) VALUES ($1,$2,$3,$4) RETURNING *', [req.body.workspace_id, req.body.title || 'Untitled board', JSON.stringify(req.body.data || {}), req.userId]);
  return created(res, r.rows[0]);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['title', 'thumbnail_url'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (req.body.data !== undefined) { sets.push(`data = $${i++}`); params.push(JSON.stringify(req.body.data)); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE whiteboards SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM whiteboards WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

module.exports = router;
