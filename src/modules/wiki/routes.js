const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { slugify, randomToken } = require('../../utils/crypto');

const router = express.Router();
router.use(authenticate());

router.get('/spaces', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query('SELECT * FROM wiki_spaces WHERE organization_id=$1 ORDER BY name', [orgId]);
  return ok(res, r.rows);
}));

router.post('/spaces', asyncHandler(async (req, res) => {
  const slug = slugify(req.body.name) + '-' + randomToken(3).toLowerCase();
  const r = await db.query('INSERT INTO wiki_spaces(organization_id, name, slug, description, icon, visibility) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.body.organization_id, req.body.name, slug, req.body.description, req.body.icon, req.body.visibility || 'private']);
  return created(res, r.rows[0]);
}));

router.get('/spaces/:id/pages', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM wiki_pages WHERE wiki_space_id=$1 ORDER BY updated_at DESC', [req.params.id]);
  return ok(res, r.rows);
}));

router.post('/pages', asyncHandler(async (req, res) => {
  const r = await db.query(`INSERT INTO wiki_pages(wiki_space_id, parent_id, title, content, content_text, slug, is_published, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`, [req.body.wiki_space_id, req.body.parent_id, req.body.title || 'Untitled', JSON.stringify(req.body.content || {}), '', slugify(req.body.title || 'untitled'), req.body.is_published || false, req.userId]);
  return created(res, r.rows[0]);
}));

router.get('/pages/:id', asyncHandler(async (req, res) => {
  const r = await db.query('UPDATE wiki_pages SET views_count = views_count + 1 WHERE id=$1 RETURNING *', [req.params.id]);
  if (!r.rows[0]) throw HttpError.notFound();
  return ok(res, r.rows[0]);
}));

router.patch('/pages/:id', asyncHandler(async (req, res) => {
  const fields = ['title', 'is_published', 'parent_id'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (req.body.content !== undefined) { sets.push(`content = $${i++}`); params.push(JSON.stringify(req.body.content)); sets.push(`version = version + 1`); }
  sets.push(`updated_by = $${i++}`); params.push(req.userId);
  params.push(req.params.id);
  const r = await db.query(`UPDATE wiki_pages SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

module.exports = router;
