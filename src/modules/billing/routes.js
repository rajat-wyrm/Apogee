const express = require('express');
const { body } = require('express-validator');
const config = require('../../config');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const { getIO } = require('../../sockets/io');

const router = express.Router();
router.use(authenticate());

let stripe = null;
const getStripe = () => {
  if (stripe) return stripe;
  if (!config.stripe.secretKey || config.stripe.secretKey.startsWith('pk_')) return null;
  try { stripe = require('stripe')(config.stripe.secretKey); return stripe; } catch { return null; }
};

const PLANS = {
  free: { name: 'Free', price: 0, features: { workspaces: 1, members: 5, storage_gb: 1, ai_calls: 50 } },
  pro: { name: 'Pro', price: 12, features: { workspaces: 10, members: 50, storage_gb: 100, ai_calls: 5000 } },
  enterprise: { name: 'Enterprise', price: 49, features: { workspaces: -1, members: -1, storage_gb: -1, ai_calls: -1 } },
};

router.get('/plans', (req, res) => ok(res, PLANS));

router.get('/subscription', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query('SELECT * FROM subscriptions WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 1', [orgId]);
  return ok(res, r.rows[0] || null);
}));

router.post('/create-checkout', [body('organization_id').isUUID(), body('plan').isIn(['pro', 'enterprise'])], validate, asyncHandler(async (req, res) => {
  const s = getStripe();
  if (!s) {
    const r = await db.query(
      `INSERT INTO subscriptions(organization_id, plan, status, current_period_start, current_period_end)
       VALUES ($1,$2,'active',NOW(),NOW() + INTERVAL '30 days') RETURNING *`,
      [req.body.organization_id, req.body.plan]
    );
    await db.query('UPDATE organizations SET plan=$1 WHERE id=$2', [req.body.plan, req.body.organization_id]);
    return created(res, { mock: true, subscription: r.rows[0], url: `${config.appUrl}/app/settings/billing?success=true` });
  }
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price_data: { currency: 'usd', recurring: { interval: 'month' }, product_data: { name: PLANS[req.body.plan].name }, unit_amount: PLANS[req.body.plan].price * 100 }, quantity: 1 }],
    success_url: `${config.appUrl}/app/settings/billing?success=true`,
    cancel_url: `${config.appUrl}/app/settings/billing?canceled=true`,
    client_reference_id: req.body.organization_id,
    metadata: { organization_id: req.body.organization_id, plan: req.body.plan },
  });
  return created(res, { url: session.url });
}));

router.post('/portal', [body('organization_id').isUUID()], validate, asyncHandler(async (req, res) => {
  const s = getStripe();
  if (!s) return ok(res, { url: `${config.appUrl}/app/settings/billing` });
  const sub = await db.query('SELECT stripe_id FROM subscriptions WHERE organization_id=$1', [req.body.organization_id]);
  if (!sub.rows[0]?.stripe_id) throw HttpError.badRequest('No active subscription');
  const portal = await s.billingPortal.sessions.create({ customer: sub.rows[0].stripe_id, return_url: `${config.appUrl}/app/settings/billing` });
  return ok(res, { url: portal.url });
}));

router.post('/cancel', [body('organization_id').isUUID()], validate, asyncHandler(async (req, res) => {
  await db.query("UPDATE subscriptions SET cancel_at_period_end=true, status='canceled' WHERE organization_id=$1", [req.body.organization_id]);
  await db.query("UPDATE organizations SET plan='free' WHERE id=$1", [req.body.organization_id]);
  return ok(res, { success: true });
}));

router.get('/invoices', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query('SELECT * FROM invoices WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50', [orgId]);
  return ok(res, r.rows);
}));

router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(200).end();
  const sig = req.headers['stripe-signature'];
  let event;
  try { event = s.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret); }
  catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orgId = session.metadata.organization_id;
    const plan = session.metadata.plan;
    await db.query(
      `INSERT INTO subscriptions(organization_id, stripe_id, plan, status, current_period_start, current_period_end)
       VALUES ($1,$2,$3,'active',NOW(),NOW() + INTERVAL '30 days')
       ON CONFLICT (stripe_id) DO UPDATE SET plan=EXCLUDED.plan, status='active'`,
      [orgId, session.subscription, plan]
    );
    await db.query('UPDATE organizations SET plan=$1 WHERE id=$2', [plan, orgId]);
  } else if (event.type === 'invoice.paid') {
    const inv = event.data.object;
    await db.query(
      `INSERT INTO invoices(organization_id, stripe_id, number, amount_due, amount_paid, currency, status, hosted_url, pdf_url)
       VALUES ((SELECT organization_id FROM subscriptions WHERE stripe_id=$1),$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (stripe_id) DO NOTHING`,
      [inv.subscription, inv.id, inv.number, inv.amount_due, inv.amount_paid, inv.currency, inv.status, inv.hosted_invoice_url, inv.invoice_pdf]
    );
  } else if (event.type === 'customer.subscription.deleted') {
    await db.query("UPDATE subscriptions SET status='canceled', cancel_at_period_end=true WHERE stripe_id=$1", [event.data.object.id]);
    await db.query("UPDATE organizations SET plan='free' WHERE id=(SELECT organization_id FROM subscriptions WHERE stripe_id=$1)", [event.data.object.id]);
  }
  res.status(200).end();
}));

module.exports = router;
