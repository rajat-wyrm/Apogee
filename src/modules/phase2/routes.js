const express = require('express');
const { body, param, query } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError, paginated } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const { randomToken } = require('../../utils/crypto');
const crypto = require('crypto');
const ai = require('../../services/ai');
const cache = require('../../services/cache');

const auth = authenticate();
const validateUuid = [param('id').isUUID()];

// ====================== KB ======================
const kbRouter = express.Router();
kbRouter.use(auth);

kbRouter.get('/categories', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM kb_categories WHERE workspace_id=$1 ORDER BY position, name', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

kbRouter.post('/categories', [body('workspace_id').isUUID(), body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const slug = (req.body.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const r = await db.query('INSERT INTO kb_categories(workspace_id, organization_id, name, slug, description, icon) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.body.workspace_id, ws.rows[0].organization_id, req.body.name, slug, req.body.description, req.body.icon]);
  return created(res, r.rows[0]);
}));

kbRouter.get('/articles', asyncHandler(async (req, res) => {
  const where = ['workspace_id = $1']; const params = [req.query.workspace_id];
  if (req.query.category_id) { params.push(req.query.category_id); where.push(`category_id = $${params.length}`); }
  if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
  if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(title ILIKE $${params.length} OR content_text ILIKE $${params.length})`); }
  const r = await db.query(`SELECT id, title, slug, excerpt, category_id, status, views, helpful_count, published_at, created_at FROM kb_articles WHERE ${where.join(' AND ')} ORDER BY created_at DESC`, params);
  return ok(res, r.rows);
}));

kbRouter.post('/articles', [body('workspace_id').isUUID(), body('title').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const slug = (req.body.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const contentText = JSON.stringify(req.body.content || {}).replace(/<[^>]+>/g, '').slice(0, 5000);
  const excerpt = (req.body.content_text || contentText).slice(0, 200);
  const r = await db.query('INSERT INTO kb_articles(workspace_id, organization_id, category_id, title, slug, content, content_text, excerpt, author_id, status, search_keywords) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [req.body.workspace_id, ws.rows[0].organization_id, req.body.category_id, req.body.title, slug, JSON.stringify(req.body.content || {}), contentText, excerpt, req.userId, req.body.status || 'draft', req.body.search_keywords || []]);
  return created(res, r.rows[0]);
}));

kbRouter.get('/articles/:id', asyncHandler(async (req, res) => {
  const r = await db.query('UPDATE kb_articles SET views = views + 1 WHERE id=$1 RETURNING *', [req.params.id]);
  if (!r.rows[0]) throw HttpError.notFound();
  return ok(res, r.rows[0]);
}));

kbRouter.post('/articles/:id/helpful', asyncHandler(async (req, res) => {
  const field = req.body.helpful ? 'helpful_count' : 'not_helpful_count';
  await db.query(`UPDATE kb_articles SET ${field} = ${field} + 1 WHERE id=$1`, [req.params.id]);
  return ok(res, { success: true });
}));

// ====================== SERVICE QUEUES ======================
const queuesRouter = express.Router();
queuesRouter.use(auth);

queuesRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM service_queues WHERE workspace_id=$1 ORDER BY position, name', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

queuesRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query('INSERT INTO service_queues(workspace_id, organization_id, name, description, color, icon, default_assignee_id, sla_policy_id, auto_assign, auto_assign_strategy, public_email, is_public, greeting, instructions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *', [req.body.workspace_id, ws.rows[0].organization_id, req.body.name, req.body.description, req.body.color, req.body.icon, req.body.default_assignee_id, req.body.sla_policy_id, req.body.auto_assign || false, req.body.auto_assign_strategy || 'round_robin', req.body.public_email, req.body.is_public || false, req.body.greeting, req.body.instructions]);
  return created(res, r.rows[0]);
}));

queuesRouter.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['name', 'description', 'color', 'icon', 'default_assignee_id', 'sla_policy_id', 'auto_assign', 'auto_assign_strategy', 'public_email', 'is_public', 'greeting', 'instructions', 'enabled', 'position'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE service_queues SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

// ====================== CANNED RESPONSES ======================
const cannedRouter = express.Router();
cannedRouter.use(auth);

cannedRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM canned_responses WHERE workspace_id=$1 ORDER BY title', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

cannedRouter.post('/', [body('workspace_id').isUUID(), body('title').notEmpty(), body('content').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query('INSERT INTO canned_responses(workspace_id, organization_id, title, content, shortcut, category, author_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [req.body.workspace_id, ws.rows[0].organization_id, req.body.title, req.body.content, req.body.shortcut, req.body.category, req.userId]);
  return created(res, r.rows[0]);
}));

cannedRouter.post('/:id/use', asyncHandler(async (req, res) => {
  await db.query('UPDATE canned_responses SET usage_count = usage_count + 1 WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

// ====================== CSAT ======================
const csatRouter = express.Router();
csatRouter.use(auth);

csatRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM csat_surveys WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100', [req.query.organization_id]);
  return ok(res, r.rows);
}));

csatRouter.post('/send', [body('organization_id').isUUID(), body('ticket_id').isUUID(), body('customer_email').isEmail()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT id FROM workspaces WHERE organization_id=$1 LIMIT 1', [req.body.organization_id]);
  const token = randomToken(32);
  const r = await db.query(
    'INSERT INTO apogee.csat_surveys(workspace_id, organization_id, entity_type, entity_id, ticket_id, customer_email, customer_name, token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [ws.rows[0]?.id, req.body.organization_id, 'ticket', req.body.ticket_id, req.body.ticket_id, req.body.customer_email, req.body.customer_name, token]
  );
  return created(res, r.rows[0]);
}));

csatRouter.get('/stats', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE responded_at IS NOT NULL)::int AS responded, AVG(rating)::float AS avg_rating, AVG(nps_score)::float AS avg_nps FROM apogee.csat_surveys WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '30 days'`, [req.query.organization_id]);
  return ok(res, r.rows[0]);
}));

csatRouter.get('/stats', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE responded_at IS NOT NULL)::int AS responded, AVG(rating)::float AS avg_rating, AVG(nps_score)::float AS avg_nps FROM csat_surveys WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '30 days'`, [req.query.organization_id]);
  return ok(res, r.rows[0]);
}));

// ====================== ASSETS / CMDB ======================
const assetsRouter = express.Router();
assetsRouter.use(auth);

assetsRouter.get('/', asyncHandler(async (req, res) => {
  const where = ['workspace_id = $1']; const params = [req.query.workspace_id];
  if (req.query.type) { params.push(req.query.type); where.push(`type = $${params.length}`); }
  if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
  const r = await db.query(`SELECT * FROM assets WHERE ${where.join(' AND ')} ORDER BY name`, params);
  return ok(res, r.rows);
}));

assetsRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty(), body('type').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query('INSERT INTO assets(workspace_id, organization_id, name, asset_tag, type, category, status, manufacturer, model, serial_number, vendor, purchase_date, purchase_cost, warranty_end, assigned_to_id, location, specifications, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *', [req.body.workspace_id, ws.rows[0].organization_id, req.body.name, req.body.asset_tag, req.body.type, req.body.category, req.body.status || 'in_stock', req.body.manufacturer, req.body.model, req.body.serial_number, req.body.vendor, req.body.purchase_date, req.body.purchase_cost, req.body.warranty_end, req.body.assigned_to_id, req.body.location, JSON.stringify(req.body.specifications || {}), req.body.notes]);
  return created(res, r.rows[0]);
}));

assetsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['name', 'asset_tag', 'type', 'category', 'status', 'manufacturer', 'model', 'serial_number', 'vendor', 'purchase_date', 'purchase_cost', 'warranty_end', 'assigned_to_id', 'location', 'notes'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (req.body.specifications) { sets.push(`specifications = $${i++}`); params.push(JSON.stringify(req.body.specifications)); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE assets SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

// ====================== CHANGES ======================
const changesRouter = express.Router();
changesRouter.use(auth);

changesRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM changes WHERE workspace_id=$1 ORDER BY scheduled_start DESC NULLS LAST', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

changesRouter.post('/', [body('workspace_id').isUUID(), body('title').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query('INSERT INTO changes(workspace_id, organization_id, title, description, type, category, risk, impact, status, change_reason, change_plan, rollback_plan, risk_assessment, scheduled_start, scheduled_end, requester_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *', [req.body.workspace_id, ws.rows[0].organization_id, req.body.title, req.body.description, req.body.type || 'standard', req.body.category, req.body.risk || 'medium', req.body.impact, req.body.status || 'draft', req.body.change_reason, req.body.change_plan, req.body.rollback_plan, req.body.risk_assessment, req.body.scheduled_start, req.body.scheduled_end, req.userId]);
  return created(res, r.rows[0]);
}));

changesRouter.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['title', 'description', 'type', 'category', 'risk', 'impact', 'status', 'change_reason', 'change_plan', 'rollback_plan', 'risk_assessment', 'scheduled_start', 'scheduled_end', 'actual_start', 'actual_end', 'assignee_id', 'approver_id'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE changes SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

// ====================== INCIDENTS ======================
const incidentsRouter = express.Router();
incidentsRouter.use(auth);

incidentsRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT i.*, u.full_name AS commander_name FROM incidents i LEFT JOIN users u ON u.id=i.commander_id WHERE i.workspace_id=$1 ORDER BY i.created_at DESC', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

incidentsRouter.post('/', [body('workspace_id').isUUID(), body('title').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query('INSERT INTO incidents(workspace_id, organization_id, title, description, severity, status, category, affected_services) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [req.body.workspace_id, ws.rows[0].organization_id, req.body.title, req.body.description, req.body.severity || 'medium', req.body.status || 'open', req.body.category, req.body.affected_services || []]);
  return created(res, r.rows[0]);
}));

incidentsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['title', 'description', 'severity', 'status', 'category', 'commander_id', 'resolved_at'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (req.body.timeline) { sets.push(`timeline = $${i++}`); params.push(JSON.stringify(req.body.timeline)); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE incidents SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

// ====================== DASHBOARDS ======================
const dashboardsRouter = express.Router();
dashboardsRouter.use(auth);

dashboardsRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM dashboards WHERE workspace_id=$1 ORDER BY is_default DESC, name', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

dashboardsRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty(), body('layout').isObject()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query('INSERT INTO dashboards(workspace_id, organization_id, name, description, layout, is_default, is_shared, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [req.body.workspace_id, ws.rows[0].organization_id, req.body.name, req.body.description, JSON.stringify(req.body.layout), req.body.is_default || false, req.body.is_shared || false, req.userId]);
  return created(res, r.rows[0]);
}));

dashboardsRouter.get('/:id', asyncHandler(async (req, res) => {
  const d = await db.query('SELECT * FROM dashboards WHERE id=$1', [req.params.id]);
  if (!d.rows[0]) throw HttpError.notFound();
  const w = await db.query('SELECT * FROM dashboard_widgets WHERE dashboard_id=$1', [req.params.id]);
  return ok(res, { ...d.rows[0], widgets: w.rows });
}));

dashboardsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['name', 'description', 'layout', 'is_default', 'is_shared'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE dashboards SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

dashboardsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM dashboards WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

dashboardsRouter.post('/:id/widgets', [body('type').notEmpty(), body('title').notEmpty(), body('position').isObject()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO dashboard_widgets(dashboard_id, type, title, config, position) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.params.id, req.body.type, req.body.title, JSON.stringify(req.body.config || {}), JSON.stringify(req.body.position)]);
  return created(res, r.rows[0]);
}));

dashboardsRouter.patch('/:id/widgets/:widgetId', asyncHandler(async (req, res) => {
  const fields = ['type', 'title', 'position'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]); }
  if (req.body.config) { sets.push(`config = $${i++}`); params.push(JSON.stringify(req.body.config)); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.widgetId, req.params.id);
  const r = await db.query(`UPDATE dashboard_widgets SET ${sets.join(', ')} WHERE id=$${i++} AND dashboard_id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

dashboardsRouter.delete('/:id/widgets/:widgetId', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM dashboard_widgets WHERE id=$1 AND dashboard_id=$2', [req.params.widgetId, req.params.id]);
  return ok(res, { success: true });
}));

// Widget data endpoint — computes widget data on demand
dashboardsRouter.get('/:id/widgets/:widgetId/data', asyncHandler(async (req, res) => {
  const w = await db.query('SELECT * FROM dashboard_widgets WHERE id=$1 AND dashboard_id=$2', [req.params.widgetId, req.params.id]);
  if (!w.rows[0]) throw HttpError.notFound();
  const widget = w.rows[0];
  const config = widget.config || {};
  let data = { type: widget.type, title: widget.title, data: null };
  try {
    if (widget.type === 'kpi') {
      const r = await db.query(`SELECT COUNT(*)::int AS value FROM ${config.table || 'tasks'} WHERE organization_id=$1`, [config.organization_id]);
      data.data = { value: r.rows[0].value };
    } else if (widget.type === 'line_chart' || widget.type === 'bar_chart') {
      const r = await db.query(`SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*)::int AS count FROM ${config.table || 'tasks'} WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '30 days' GROUP BY day ORDER BY day`, [config.organization_id]);
      data.data = r.rows;
    } else if (widget.type === 'pie_chart') {
      const r = await db.query(`SELECT priority AS label, COUNT(*)::int AS value FROM ${config.table || 'tasks'} WHERE organization_id=$1 GROUP BY priority`, [config.organization_id]);
      data.data = r.rows;
    } else if (widget.type === 'list') {
      const r = await db.query(`SELECT id, title, status_id, priority, updated_at FROM ${config.table || 'tasks'} WHERE organization_id=$1 ORDER BY updated_at DESC LIMIT 10`, [config.organization_id]);
      data.data = r.rows;
    } else if (widget.type === 'burndown') {
      const sprint = await db.query('SELECT * FROM sprints WHERE id=$1', [config.sprint_id]);
      if (sprint.rows[0]) {
        const start = new Date(sprint.rows[0].start_date);
        const end = new Date(sprint.rows[0].end_date);
        const total = await db.query('SELECT COUNT(*)::int AS total FROM tasks WHERE sprint_id=$1', [config.sprint_id]);
        const days = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
        const ideal = [];
        for (let i = 0; i < days; i++) {
          ideal.push({ day: i + 1, remaining: Math.max(0, total.rows[0].total - Math.round((total.rows[0].total / Math.max(1, days - 1)) * i)) });
        }
        data.data = { ideal, total: total.rows[0].total, sprint: sprint.rows[0] };
      }
    } else if (widget.type === 'velocity') {
      const r = await db.query(`SELECT s.id, s.name, COUNT(t.id) FILTER (WHERE t.completed_at IS NOT NULL)::int AS done, COALESCE(SUM(t.story_points) FILTER (WHERE t.completed_at IS NOT NULL), 0)::int AS points FROM sprints s LEFT JOIN tasks t ON t.sprint_id = s.id WHERE s.project_id=$1 AND s.status='completed' GROUP BY s.id ORDER BY s.start_date DESC LIMIT 5`, [config.project_id]);
      data.data = r.rows;
    } else if (widget.type === 'recent_activity') {
      const r = await db.query(`SELECT a.*, u.full_name AS actor_name FROM activities a LEFT JOIN users u ON u.id=a.actor_id WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 10`, [config.organization_id]);
      data.data = r.rows;
    } else if (widget.type === 'text') {
      data.data = { text: config.text || '' };
    } else if (widget.type === 'leaderboard') {
      const r = await db.query(`SELECT u.id, u.full_name, u.avatar_url, COUNT(t.id) FILTER (WHERE t.completed_at > NOW() - INTERVAL '7 days')::int AS done FROM users u LEFT JOIN memberships m ON m.user_id = u.id AND m.organization_id=$1 LEFT JOIN tasks t ON t.assignee_id = u.id AND t.organization_id=$1 WHERE m.user_id IS NOT NULL GROUP BY u.id ORDER BY done DESC LIMIT 10`, [config.organization_id]);
      data.data = r.rows;
    }
  } catch (e) {
    data.error = e.message;
  }
  return ok(res, data);
}));

// ====================== INCOMING WEBHOOKS ======================
const incomingWebhooksRouter = express.Router();
incomingWebhooksRouter.use(auth);

incomingWebhooksRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT id, name, source, events, enabled, last_triggered_at, created_at FROM incoming_webhooks WHERE workspace_id=$1', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

incomingWebhooksRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty(), body('source').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const token = randomToken(24);
  const r = await db.query('INSERT INTO incoming_webhooks(workspace_id, organization_id, name, token, source, events, secret) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, source, events, token, enabled', [req.body.workspace_id, ws.rows[0].organization_id, req.body.name, token, req.body.source, req.body.events || [], req.body.secret]);
  return created(res, r.rows[0]);
}));

incomingWebhooksRouter.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM incoming_webhooks WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

// ====================== PUBLIC PAGES ======================
const publicPagesRouter = express.Router();

publicPagesRouter.get('/:token', asyncHandler(async (req, res) => {
  const r = await db.query('UPDATE public_pages SET views = views + 1 WHERE token=$1 AND (expires_at IS NULL OR expires_at > NOW()) RETURNING *', [req.params.token]);
  if (!r.rows[0]) throw HttpError.notFound('Page not found or expired');
  const page = r.rows[0];
  let data = null;
  if (page.page_type === 'document') {
    const d = await db.query('SELECT id, title, content, content_text, updated_at FROM documents WHERE id=$1', [page.page_id]);
    data = d.rows[0];
  } else if (page.page_type === 'kb_article') {
    const d = await db.query('SELECT id, title, content, content_text, excerpt, published_at FROM kb_articles WHERE id=$1', [page.page_id]);
    data = d.rows[0];
  } else if (page.page_type === 'form') {
    const d = await db.query('SELECT id, title, schema, description FROM forms WHERE id=$1', [page.page_id]);
    data = d.rows[0];
  }
  return ok(res, { page, data });
}));

// ====================== APPROVAL CHAINS ======================
const approvalChainsRouter = express.Router();
approvalChainsRouter.use(auth);

approvalChainsRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM approval_chains WHERE workspace_id=$1', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

approvalChainsRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty(), body('steps').isArray(), body('entity_type').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query('INSERT INTO approval_chains(workspace_id, organization_id, name, steps, entity_type, conditions) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [req.body.workspace_id, ws.rows[0].organization_id, req.body.name, JSON.stringify(req.body.steps), req.body.entity_type, JSON.stringify(req.body.conditions || {})]);
  return created(res, r.rows[0]);
}));

// ====================== EXPORT JOBS ======================
const exportJobsRouter = express.Router();
exportJobsRouter.use(auth);

exportJobsRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM export_jobs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 50', [req.query.organization_id]);
  return ok(res, r.rows);
}));

exportJobsRouter.post('/', [body('organization_id').isUUID(), body('type').notEmpty(), body('entity_type').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT id FROM workspaces WHERE organization_id=$1 LIMIT 1', [req.body.organization_id]);
  const r = await db.query(
    'INSERT INTO apogee.export_jobs(workspace_id, organization_id, user_id, type, entity_type, entity_id, filters) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [ws.rows[0]?.id, req.body.organization_id, req.userId, req.body.type, req.body.entity_type, req.body.entity_id, JSON.stringify(req.body.filters || {})]
  );
  return created(res, r.rows[0]);
}));

// ====================== TAGS ======================
const tagsRouter = express.Router();
tagsRouter.use(auth);

tagsRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM tags WHERE workspace_id=$1 ORDER BY name', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

tagsRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query('INSERT INTO tags(workspace_id, organization_id, name, color, description) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (workspace_id, name) DO UPDATE SET color=$4, description=$5 RETURNING *', [req.body.workspace_id, ws.rows[0].organization_id, req.body.name, req.body.color || '#6366f1', req.body.description]);
  return created(res, r.rows[0]);
}));

tagsRouter.post('/assign', [body('tag_id').isUUID(), body('entity_type').notEmpty(), body('entity_id').isUUID()], validate, asyncHandler(async (req, res) => {
  await db.query('INSERT INTO tag_assignments(tag_id, entity_type, entity_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.body.tag_id, req.body.entity_type, req.body.entity_id]);
  return created(res, { success: true });
}));

tagsRouter.delete('/assign', [body('tag_id').isUUID(), body('entity_type').notEmpty(), body('entity_id').isUUID()], validate, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM tag_assignments WHERE tag_id=$1 AND entity_type=$2 AND entity_id=$3', [req.body.tag_id, req.body.entity_type, req.body.entity_id]);
  return ok(res, { success: true });
}));

// ====================== SAML SSO ======================
const ssoRouter = express.Router();
ssoRouter.use(auth);

ssoRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT id, organization_id, provider, enabled, created_at FROM sso_configs WHERE organization_id=$1', [req.query.organization_id]);
  return ok(res, r.rows);
}));

ssoRouter.post('/', [body('organization_id').isUUID(), body('provider').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO sso_configs(organization_id, provider, metadata_url, entity_id, sso_url, certificate, config) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (organization_id, provider) DO UPDATE SET metadata_url=$3, entity_id=$4, sso_url=$5, certificate=$6, config=$7, updated_at=NOW() RETURNING *', [req.body.organization_id, req.body.provider, req.body.metadata_url, req.body.entity_id, req.body.sso_url, req.body.certificate, JSON.stringify(req.body.config || {})]);
  return created(res, r.rows[0]);
}));

// ====================== PAGE ANALYTICS ======================
const analyticsRouter = express.Router();
analyticsRouter.use(auth);

analyticsRouter.post('/track', [body('page_type').notEmpty(), body('page_id').isUUID(), body('event_type').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT id FROM workspaces WHERE organization_id=$1 LIMIT 1', [req.body.organization_id]);
  await db.query('INSERT INTO apogee.page_analytics(page_type, page_id, workspace_id, user_id, event_type, duration_seconds) VALUES ($1,$2,$3,$4,$5,$6)', [req.body.page_type, req.body.page_id, ws.rows[0]?.id, req.userId, req.body.event_type, req.body.duration_seconds]);
  return ok(res, { success: true });
}));

analyticsRouter.get('/page/:pageType/:pageId', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT event_type, COUNT(*)::int AS count, COUNT(DISTINCT user_id)::int AS unique_users, AVG(duration_seconds)::float AS avg_duration FROM page_analytics WHERE page_type=$1 AND page_id=$2 AND created_at > NOW() - INTERVAL '30 days' GROUP BY event_type`, [req.params.pageType, req.params.pageId]);
  return ok(res, r.rows);
}));

analyticsRouter.get('/workspace', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT page_type, COUNT(*)::int AS views, COUNT(DISTINCT user_id)::int AS unique_users FROM page_analytics WHERE workspace_id=$1 AND created_at > NOW() - INTERVAL '30 days' GROUP BY page_type`, [req.query.workspace_id]);
  return ok(res, r.rows);
}));

module.exports = {
  kbRouter, queuesRouter, cannedRouter, csatRouter, assetsRouter,
  changesRouter, incidentsRouter, dashboardsRouter, incomingWebhooksRouter,
  publicPagesRouter, approvalChainsRouter, exportJobsRouter, tagsRouter, ssoRouter, analyticsRouter,
};
