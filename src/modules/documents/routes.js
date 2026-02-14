const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const { slugify, randomToken } = require('../../utils/crypto');
const audit = require('../../services/audit').record;
const { getIO } = require('../../sockets/io');
const ai = require('../../services/ai');

const router = express.Router();
router.use(authenticate());

const access = async (userId, workspaceId) => {
  const r = await db.query('SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2', [workspaceId, userId]);
  return !!r.rows[0];
};

router.get('/', asyncHandler(async (req, res) => {
  const workspaceId = req.query.workspace_id;
  if (!workspaceId) throw HttpError.badRequest('workspace_id required');
  if (!(await access(req.userId, workspaceId))) throw HttpError.forbidden();
  const r = await db.query(
    `SELECT id, parent_id, title, icon, cover_url, is_template, is_archived, is_published, last_edited_by, created_by, created_at, updated_at, path
     FROM documents WHERE workspace_id=$1 AND is_archived=false ORDER BY is_published DESC, updated_at DESC`,
    [workspaceId]
  );
  return ok(res, r.rows);
}));

router.post('/', [body('workspace_id').isUUID(), body('title').optional(), body('parent_id').optional().isUUID(), body('template').optional()], validate, asyncHandler(async (req, res) => {
  if (!(await access(req.userId, req.body.workspace_id))) throw HttpError.forbidden();
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  let content = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  let title = req.body.title || 'Untitled';
  if (req.body.template) {
    const t = await db.query('SELECT payload FROM templates WHERE id=$1', [req.body.template]);
    if (t.rows[0]) { content = t.rows[0].payload.content || content; title = t.rows[0].payload.title || title; }
  }
  const r = await db.query(
    `INSERT INTO documents(workspace_id, organization_id, parent_id, title, content, content_text, created_by, last_edited_by, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7,false) RETURNING *`,
    [req.body.workspace_id, ws.rows[0].organization_id, req.body.parent_id, title, JSON.stringify(content), '', req.userId]
  );
  return created(res, r.rows[0]);
}));

router.get('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM documents WHERE id=$1', [req.params.id]);
  if (!r.rows[0]) throw HttpError.notFound();
  if (!(await access(req.userId, r.rows[0].workspace_id))) throw HttpError.forbidden();
  await db.query('UPDATE documents SET last_edited_by=$1 WHERE id=$2', [req.userId, req.params.id]).catch(() => {});
  return ok(res, r.rows[0]);
}));

router.patch('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM documents WHERE id=$1', [req.params.id]);
  if (!r.rows[0]) throw HttpError.notFound();
  if (!(await access(req.userId, r.rows[0].workspace_id))) throw HttpError.forbidden();
  const fields = ['title', 'icon', 'cover_url', 'is_archived', 'is_published', 'parent_id'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (req.body.content !== undefined) {
    sets.push(`content = $${i++}`); params.push(JSON.stringify(req.body.content));
    sets.push(`content_text = $${i++}`); params.push(JSON.stringify(req.body.content).replace(/<[^>]+>/g, '').slice(0, 50000));
  }
  sets.push(`last_edited_by = $${i++}`); params.push(req.userId);
  params.push(req.params.id);
  const r2 = await db.query(`UPDATE documents SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  const io = getIO();
  if (io) io.to(`doc:${req.params.id}`).emit('doc:updated', r2.rows[0]);
  return ok(res, r2.rows[0]);
}));

router.delete('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  await db.query('UPDATE documents SET is_archived=true WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.post('/:id/restore', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  await db.query('UPDATE documents SET is_archived=false WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.post('/:id/comments', [param('id').isUUID(), body('body').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO comments(document_id, author_id, body, body_html) VALUES ($1,$2,$3,$4) RETURNING *', [req.params.id, req.userId, req.body.body, req.body.body_html]);
  return created(res, r.rows[0]);
}));

router.get('/:id/comments', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT c.*, u.full_name AS author_name, u.avatar_url AS author_avatar FROM comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.document_id=$1 ORDER BY c.created_at ASC`, [req.params.id]);
  return ok(res, r.rows);
}));

router.post('/:id/ai/improve', [param('id').isUUID(), body('instruction').optional()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM documents WHERE id=$1', [req.params.id]);
  const doc = r.rows[0];
  if (!doc) throw HttpError.notFound();
  const text = (doc.content_text || JSON.stringify(doc.content)).slice(0, 8000);
  const res2 = await ai.chat({
    feature: 'doc_improve',
    organizationId: doc.organization_id,
    userId: req.userId,
    messages: [
      { role: 'system', content: 'You are an expert editor. Rewrite the following document to be clearer, more concise, and well-structured. Preserve technical terms and the original meaning.' },
      { role: 'user', content: `${req.body.instruction || 'Improve clarity, grammar, and structure.'}\n\nDocument:\n${text}` },
    ],
  });
  return ok(res, { text: res2.text, provider: res2.provider });
}));

router.post('/:id/ai/summarize', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM documents WHERE id=$1', [req.params.id]);
  const doc = r.rows[0];
  if (!doc) throw HttpError.notFound();
  const text = (doc.content_text || '').slice(0, 12000) || JSON.stringify(doc.content).slice(0, 8000);
  const res2 = await ai.summarize(text);
  return ok(res, { text: res2.text, provider: res2.provider });
}));

router.post('/:id/ai/continue', [param('id').isUUID(), body('prompt').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM documents WHERE id=$1', [req.params.id]);
  const doc = r.rows[0];
  if (!doc) throw HttpError.notFound();
  const text = (doc.content_text || '').slice(-4000);
  const res2 = await ai.chat({
    feature: 'doc_continue',
    organizationId: doc.organization_id,
    userId: req.userId,
    messages: [
      { role: 'system', content: 'You are a thoughtful co-author. Continue the document in the same style and tone, adding 1-2 paragraphs.' },
      { role: 'user', content: `Prompt: ${req.body.prompt}\n\nCurrent text:\n${text}` },
    ],
  });
  return ok(res, { text: res2.text, provider: res2.provider });
}));

module.exports = router;
