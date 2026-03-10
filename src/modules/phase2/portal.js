const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { validate } = require('../../middleware');
const { randomToken } = require('../../utils/crypto');
const { sendTemplate } = require('../../services/email');
const ai = require('../../services/ai');

const router = express.Router();

// Service portal — list public queues for an organization
router.get('/queues', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(
    `SELECT id, name, description, color, icon, greeting, instructions FROM service_queues
     WHERE organization_id=$1 AND is_public=true AND enabled=true ORDER BY position, name`,
    [orgId]
  );
  return ok(res, r.rows);
}));

// Public KB
router.get('/kb/categories', asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT id, name, slug, description, icon FROM kb_categories
     WHERE organization_id=$1 ORDER BY position, name`,
    [req.query.organization_id]
  );
  return ok(res, r.rows);
}));

router.get('/kb/articles', asyncHandler(async (req, res) => {
  const where = ['organization_id = $1', "status = 'published'"]; const params = [req.query.organization_id];
  if (req.query.category_id) { params.push(req.query.category_id); where.push(`category_id = $${params.length}`); }
  if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(title ILIKE $${params.length} OR content_text ILIKE $${params.length})`); }
  const r = await db.query(
    `SELECT id, title, slug, excerpt, category_id, views, helpful_count, published_at FROM kb_articles WHERE ${where.join(' AND ')} ORDER BY published_at DESC LIMIT 50`,
    params
  );
  return ok(res, r.rows);
}));

router.get('/kb/articles/:id', asyncHandler(async (req, res) => {
  const r = await db.query(
    `UPDATE kb_articles SET views = views + 1 WHERE id=$1 AND status='published' RETURNING *`,
    [req.params.id]
  );
  if (!r.rows[0]) throw HttpError.notFound('Article not found');
  return ok(res, r.rows[0]);
}));

router.post('/kb/articles/:id/helpful', [body('helpful').isBoolean()], validate, asyncHandler(async (req, res) => {
  const field = req.body.helpful ? 'helpful_count' : 'not_helpful_count';
  await db.query(`UPDATE kb_articles SET ${field} = ${field} + 1 WHERE id=$1`, [req.params.id]);
  return ok(res, { success: true });
}));

// Submit a ticket (public)
router.post('/tickets', [body('organization_id').isUUID(), body('queue_id').isUUID(), body('subject').notEmpty(), body('customer_email').isEmail(), body('description').notEmpty()], validate, asyncHandler(async (req, res) => {
  const q = await db.query('SELECT * FROM service_queues WHERE id=$1 AND is_public=true', [req.body.queue_id]);
  if (!q.rows[0]) throw HttpError.notFound('Queue not found');
  const token = randomToken(16);
  const r = await db.query(
    `INSERT INTO tickets(organization_id, workspace_id, project_id, requester_id, subject, description, priority, status, source, tags, resolution)
     VALUES ($1, (SELECT id FROM workspaces WHERE organization_id=$1 LIMIT 1), NULL, NULL, $2, $3, $4, 'open', 'portal', $5, NULL) RETURNING *`,
    [req.body.organization_id, req.body.subject, req.body.description, req.body.priority || 'normal', req.body.tags || []]
  );
  const ticket = r.rows[0];
  // Send confirmation
  sendTemplate({
    to: req.body.customer_email,
    subject: `Ticket #${ticket.id.slice(0, 8)}: ${ticket.subject}`,
    template: 'welcome',
    data: { name: req.body.customer_name || 'Customer', url: `${process.env.APP_URL}/portal/tickets/${token}` }
  }).catch(() => {});
  return created(res, { id: ticket.id, status: 'open', token, message: 'Ticket created successfully' });
}));

// CSAT submission (public)
router.post('/csat/:token', [body('rating').isInt({ min: 1, max: 5 })], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `UPDATE csat_surveys SET rating=$1, comment=$2, nps_score=$3, responded_at=NOW() WHERE token=$4 RETURNING *`,
    [req.body.rating, req.body.comment, req.body.nps_score, req.params.token]
  );
  if (!r.rows[0]) throw HttpError.notFound('Survey not found');
  return ok(res, { success: true, message: 'Thank you for your feedback' });
}));

router.get('/csat/:token', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT rating, comment, responded_at FROM csat_surveys WHERE token=$1', [req.params.token]);
  if (!r.rows[0]) throw HttpError.notFound('Survey not found');
  return ok(res, r.rows[0]);
}));

// AI assist for ticket (suggest KB articles based on description)
router.post('/ai-suggest', [body('organization_id').isUUID(), body('description').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT id, title, excerpt FROM kb_articles WHERE organization_id=$1 AND status='published' AND (title ILIKE $2 OR content_text ILIKE $2) LIMIT 5`,
    [req.body.organization_id, `%${(req.body.description || '').slice(0, 50)}%`]
  );
  return ok(res, { suggestions: r.rows });
}));

module.exports = router;
