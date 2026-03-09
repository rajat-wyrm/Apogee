const express = require('express');
const { body } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate, requireOrgRole } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const { randomToken } = require('../../utils/crypto');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query('SELECT id, url, events, active, created_at FROM webhooks WHERE organization_id=$1 ORDER BY created_at DESC', [orgId]);
  return ok(res, r.rows);
}));

router.post('/', requireOrgRole(['admin', 'owner']), [body('url').isURL(), body('events').isArray()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO webhooks(organization_id, url, secret, events, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id, url, events, active, created_at`,
    [req.organizationId, req.body.url, randomToken(32), req.body.events, req.userId]
  );
  return created(res, r.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  // Look up the webhook to get its organization_id
  const w = await db.query('SELECT organization_id FROM webhooks WHERE id=$1', [req.params.id]);
  if (!w.rows[0]) throw HttpError.notFound('Webhook not found');
  // Check membership
  const m = await db.query('SELECT 1 FROM memberships WHERE user_id=$1 AND organization_id=$2 AND status=$3', [req.userId, w.rows[0].organization_id, 'active']);
  if (!m.rows[0]) throw HttpError.forbidden('Not a member of this organization');
  // Check role (admin or owner)
  const role = await db.query('SELECT role FROM memberships WHERE user_id=$1 AND organization_id=$2', [req.userId, w.rows[0].organization_id]);
  if (!['admin', 'owner'].includes(role.rows[0]?.role) && role.rows[0]?.role !== 'owner') throw HttpError.forbidden('Insufficient role');
  await db.query('DELETE FROM webhooks WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

const deliver = async (webhook, event, payload) => {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const crypto = require('crypto');
  const sig = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
  try {
    const r = await fetch(webhook.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Apogee-Signature': sig }, body });
    await db.query(
      `INSERT INTO webhook_deliveries(webhook_id, event, payload, response_code, response_body, status, attempt, delivered_at)
       VALUES ($1,$2,$3,$4,$5,$6,1,NOW())`,
      [webhook.id, event, JSON.stringify(payload), r.status, (await r.text()).slice(0, 500), r.ok ? 'success' : 'failed']
    );
    await db.query('UPDATE webhooks SET active=$1 WHERE id=$2', [r.ok, webhook.id]);
  } catch (e) {
    await db.query(
      `INSERT INTO webhook_deliveries(webhook_id, event, payload, status, attempt) VALUES ($1,$2,$3,'failed',1)`,
      [webhook.id, event, JSON.stringify(payload)]
    );
  }
};

const dispatch = async (organizationId, event, payload) => {
  if (!process.env.ENABLE_WEBHOOKS) return;
  const r = await db.query("SELECT * FROM webhooks WHERE organization_id=$1 AND active=true AND $2 = ANY(events)", [organizationId, event]);
  for (const w of r.rows) deliver(w, event, payload);
};

module.exports = router;
module.exports.dispatch = dispatch;
