const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError, paginated } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const { body, param, query } = require('express-validator');
const { slugify, randomToken } = require('../../utils/crypto');
const audit = require('../../services/audit').record;

const router = express.Router();
router.use(authenticate());

const memberCheck = async (userId, orgId) => {
  const r = await db.query(
    "SELECT role FROM memberships WHERE user_id=$1 AND organization_id=$2 AND status='active'",
    [userId, orgId]
  );
  return r.rows[0]?.role;
};

const resolveOrgId = (req) => {
  return req.query.organization_id || req.body.organization_id || req.user?.organization_id;
};

const requireMember = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) throw HttpError.badRequest('organization_id required');
    const role = await memberCheck(req.userId, orgId);
    if (!role) throw HttpError.forbidden('Not a member');
    req.organizationId = orgId;
    req.orgRole = role;
    next();
  } catch (e) { next(e); }
};

// ==================== COMPANIES ====================
router.get('/companies', requireMember, asyncHandler(async (req, res) => {
  const { search, status, owner_id, tag, limit = 50, page = 1 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const params = [req.organizationId];
  let where = "WHERE organization_id=$1 AND deleted_at IS NULL";
  if (search) { params.push(`%${search}%`); where += ` AND (name ILIKE $${params.length} OR domain ILIKE $${params.length})`; }
  if (status) { params.push(status); where += ` AND status=$${params.length}`; }
  if (owner_id) { params.push(owner_id); where += ` AND owner_id=$${params.length}`; }
  if (tag) { params.push(tag); where += ` AND $${params.length} = ANY(tags)`; }
  const total = await db.query(`SELECT COUNT(*)::int AS c FROM crm_companies ${where}`, params);
  params.push(parseInt(limit)); params.push(offset);
  const rows = await db.query(
    `SELECT c.*, (SELECT COUNT(*)::int FROM crm_contacts WHERE company_id=c.id AND deleted_at IS NULL) AS contact_count,
            (SELECT COUNT(*)::int FROM crm_deals WHERE company_id=c.id AND deleted_at IS NULL) AS deal_count,
            (SELECT COALESCE(SUM(value),0)::float FROM crm_deals WHERE company_id=c.id AND status='open' AND deleted_at IS NULL) AS open_value,
            u.full_name AS owner_name, u.avatar_url AS owner_avatar
     FROM crm_companies c LEFT JOIN users u ON u.id=c.owner_id
     ${where} ORDER BY c.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return paginated(res, rows.rows, total.rows[0].c, parseInt(page), parseInt(limit));
}));

router.post('/companies', requireMember, [
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('domain').optional().isLength({ max: 255 }),
  body('industry').optional().isLength({ max: 100 }),
  body('size').optional().isLength({ max: 50 }),
  body('email').optional().isEmail(),
  body('website').optional().isLength({ max: 500 }),
  body('phone').optional().isLength({ max: 50 }),
  body('owner_id').optional().isUUID(),
], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO crm_companies(organization_id, workspace_id, name, domain, industry, size, annual_revenue, phone, email, website, logo_url, billing_address, shipping_address, social_links, tags, custom_fields, owner_id, source, status, description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
    [req.organizationId, req.body.workspace_id, req.body.name, req.body.domain, req.body.industry, req.body.size,
     req.body.annual_revenue || 0, req.body.phone, req.body.email, req.body.website, req.body.logo_url,
     JSON.stringify(req.body.billing_address || {}), JSON.stringify(req.body.shipping_address || {}),
     JSON.stringify(req.body.social_links || {}), req.body.tags || [], JSON.stringify(req.body.custom_fields || {}),
     req.body.owner_id || req.userId, req.body.source, req.body.status || 'active', req.body.description, req.userId]
  );
  audit({ organizationId: req.organizationId, actorId: req.userId, action: 'crm.company.created', entityType: 'company', entityId: r.rows[0].id });
  return created(res, r.rows[0]);
}));

router.get('/companies/:id', requireMember, asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT c.*, u.full_name AS owner_name, u.avatar_url AS owner_avatar
     FROM crm_companies c LEFT JOIN users u ON u.id=c.owner_id
     WHERE c.id=$1 AND c.organization_id=$2 AND c.deleted_at IS NULL`,
    [req.params.id, req.organizationId]
  );
  if (!r.rows[0]) throw HttpError.notFound('Company not found');
  const contacts = await db.query(`SELECT id, first_name, last_name, full_name, email, phone, job_title FROM crm_contacts WHERE company_id=$1 AND deleted_at IS NULL ORDER BY full_name`, [req.params.id]);
  const deals = await db.query(`SELECT id, title, value, currency, status, expected_close_date FROM crm_deals WHERE company_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`, [req.params.id]);
  const activities = await db.query(`SELECT id, type, subject, created_at FROM crm_activities WHERE company_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.params.id]);
  return ok(res, { ...r.rows[0], contacts: contacts.rows, deals: deals.rows, activities: activities.rows });
}));

router.patch('/companies/:id', requireMember, asyncHandler(async (req, res) => {
  const fields = ['name','domain','industry','size','annual_revenue','phone','email','website','logo_url','tags','owner_id','source','status','description'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) {
    sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]);
  }
  for (const f of ['billing_address','shipping_address','social_links','custom_fields']) if (req.body[f] !== undefined) {
    sets.push(`${f} = $${i++}`); params.push(JSON.stringify(req.body[f]));
  }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id, req.organizationId);
  const r = await db.query(`UPDATE crm_companies SET ${sets.join(', ')} WHERE id=$${i++} AND organization_id=$${i} RETURNING *`, params);
  if (!r.rows[0]) throw HttpError.notFound('Company not found');
  audit({ organizationId: req.organizationId, actorId: req.userId, action: 'crm.company.updated', entityType: 'company', entityId: req.params.id });
  return ok(res, r.rows[0]);
}));

router.delete('/companies/:id', requireMember, asyncHandler(async (req, res) => {
  const r = await db.query(`UPDATE crm_companies SET deleted_at=NOW() WHERE id=$1 AND organization_id=$2 RETURNING id`, [req.params.id, req.organizationId]);
  if (!r.rows[0]) throw HttpError.notFound('Company not found');
  audit({ organizationId: req.organizationId, actorId: req.userId, action: 'crm.company.deleted', entityType: 'company', entityId: req.params.id });
  return ok(res, { success: true });
}));

// ==================== CONTACTS ====================
router.get('/contacts', requireMember, asyncHandler(async (req, res) => {
  const { search, status, owner_id, company_id, lifecycle_stage, limit = 50, page = 1 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const params = [req.organizationId];
  let where = "WHERE c.organization_id=$1 AND c.deleted_at IS NULL";
  if (search) { params.push(`%${search}%`); where += ` AND (c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length} OR c.email ILIKE $${params.length})`; }
  if (status) { params.push(status); where += ` AND c.status=$${params.length}`; }
  if (owner_id) { params.push(owner_id); where += ` AND c.owner_id=$${params.length}`; }
  if (company_id) { params.push(company_id); where += ` AND c.company_id=$${params.length}`; }
  if (lifecycle_stage) { params.push(lifecycle_stage); where += ` AND c.lifecycle_stage=$${params.length}`; }
  const total = await db.query(`SELECT COUNT(*)::int AS c FROM crm_contacts c ${where}`, params);
  params.push(parseInt(limit)); params.push(offset);
  const rows = await db.query(
    `SELECT c.*, comp.name AS company_name, u.full_name AS owner_name
     FROM crm_contacts c LEFT JOIN crm_companies comp ON comp.id=c.company_id LEFT JOIN users u ON u.id=c.owner_id
     ${where} ORDER BY c.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return paginated(res, rows.rows, total.rows[0].c, parseInt(page), parseInt(limit));
}));

router.post('/contacts', requireMember, [
  body('last_name').trim().isLength({ min: 1, max: 100 }),
  body('email').optional({ checkFalsy: true }).isEmail(),
], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO crm_contacts(organization_id, workspace_id, company_id, first_name, last_name, email, phone, mobile, job_title, department, linkedin_url, twitter_handle, source, status, lead_status, lifecycle_stage, owner_id, tags, custom_fields, description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
    [req.organizationId, req.body.workspace_id, req.body.company_id, req.body.first_name, req.body.last_name,
     req.body.email, req.body.phone, req.body.mobile, req.body.job_title, req.body.department,
     req.body.linkedin_url, req.body.twitter_handle, req.body.source, req.body.status || 'active',
     req.body.lead_status, req.body.lifecycle_stage || 'subscriber', req.body.owner_id || req.userId,
     req.body.tags || [], JSON.stringify(req.body.custom_fields || {}), req.body.description, req.userId]
  );
  audit({ organizationId: req.organizationId, actorId: req.userId, action: 'crm.contact.created', entityType: 'contact', entityId: r.rows[0].id });
  return created(res, r.rows[0]);
}));

router.get('/contacts/:id', requireMember, asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT c.*, comp.name AS company_name, u.full_name AS owner_name, u.avatar_url AS owner_avatar
     FROM crm_contacts c LEFT JOIN crm_companies comp ON comp.id=c.company_id LEFT JOIN users u ON u.id=c.owner_id
     WHERE c.id=$1 AND c.organization_id=$2 AND c.deleted_at IS NULL`,
    [req.params.id, req.organizationId]
  );
  if (!r.rows[0]) throw HttpError.notFound('Contact not found');
  const deals = await db.query(`SELECT id, title, value, currency, status, stage_id FROM crm_deals WHERE contact_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`, [req.params.id]);
  const activities = await db.query(`SELECT id, type, subject, created_at FROM crm_activities WHERE contact_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.params.id]);
  const notes = await db.query(`SELECT id, body, pinned, created_at FROM crm_notes WHERE contact_id=$1 ORDER BY pinned DESC, created_at DESC`, [req.params.id]);
  return ok(res, { ...r.rows[0], deals: deals.rows, activities: activities.rows, notes: notes.rows });
}));

router.patch('/contacts/:id', requireMember, asyncHandler(async (req, res) => {
  const fields = ['first_name','last_name','email','phone','mobile','job_title','department','linkedin_url','twitter_handle','source','status','lead_status','lifecycle_stage','owner_id','tags','description','company_id'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) {
    sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]);
  }
  if (req.body.custom_fields !== undefined) { sets.push(`custom_fields = $${i++}`); params.push(JSON.stringify(req.body.custom_fields)); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id, req.organizationId);
  const r = await db.query(`UPDATE crm_contacts SET ${sets.join(', ')} WHERE id=$${i++} AND organization_id=$${i} RETURNING *`, params);
  if (!r.rows[0]) throw HttpError.notFound('Contact not found');
  return ok(res, r.rows[0]);
}));

router.delete('/contacts/:id', requireMember, asyncHandler(async (req, res) => {
  const r = await db.query(`UPDATE crm_contacts SET deleted_at=NOW() WHERE id=$1 AND organization_id=$2 RETURNING id`, [req.params.id, req.organizationId]);
  if (!r.rows[0]) throw HttpError.notFound('Contact not found');
  return ok(res, { success: true });
}));

// ==================== PIPELINES ====================
router.get('/pipelines', requireMember, asyncHandler(async (req, res) => {
  const pipelines = await db.query(
    `SELECT p.*, (SELECT COUNT(*)::int FROM crm_stages WHERE pipeline_id=p.id) AS stage_count,
            (SELECT COUNT(*)::int FROM crm_deals WHERE pipeline_id=p.id AND status='open' AND deleted_at IS NULL) AS open_deals,
            (SELECT COALESCE(SUM(value),0)::float FROM crm_deals WHERE pipeline_id=p.id AND status='open' AND deleted_at IS NULL) AS pipeline_value
     FROM crm_pipelines p WHERE p.organization_id=$1 ORDER BY p.is_default DESC, p.display_order ASC, p.created_at ASC`,
    [req.organizationId]
  );
  const stages = await db.query(`SELECT * FROM crm_stages WHERE pipeline_id IN (SELECT id FROM crm_pipelines WHERE organization_id=$1) ORDER BY display_order`, [req.organizationId]);
  const result = pipelines.rows.map(p => ({ ...p, stages: stages.rows.filter(s => s.pipeline_id === p.id) }));
  return ok(res, result);
}));

router.post('/pipelines', requireMember, [
  body('name').trim().isLength({ min: 1, max: 255 }),
], validate, asyncHandler(async (req, res) => {
  const r = await db.tx(async (c) => {
    const p = await c.query(
      `INSERT INTO crm_pipelines(organization_id, workspace_id, name, description, currency, is_default, display_order, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.organizationId, req.body.workspace_id, req.body.name, req.body.description, req.body.currency || 'USD',
       req.body.is_default || false, req.body.display_order || 0, req.userId]
    );
    const defaultStages = req.body.stages || [
      { name: 'Lead', probability: 10, color: '#94a3b8' },
      { name: 'Qualified', probability: 25, color: '#3b82f6' },
      { name: 'Proposal', probability: 50, color: '#8b5cf6' },
      { name: 'Negotiation', probability: 75, color: '#f59e0b' },
      { name: 'Won', probability: 100, color: '#10b981', is_won: true, stage_type: 'won' },
      { name: 'Lost', probability: 0, color: '#ef4444', is_lost: true, stage_type: 'lost' },
    ];
    const stages = [];
    for (let i = 0; i < defaultStages.length; i++) {
      const s = defaultStages[i];
      const sr = await c.query(
        `INSERT INTO crm_stages(pipeline_id, name, display_order, probability, color, stage_type, is_won, is_lost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [p.rows[0].id, s.name, i, s.probability || 0, s.color || '#6366f1', s.stage_type || 'open', s.is_won || false, s.is_lost || false]
      );
      stages.push(sr.rows[0]);
    }
    return { ...p.rows[0], stages };
  });
  audit({ organizationId: req.organizationId, actorId: req.userId, action: 'crm.pipeline.created', entityType: 'pipeline', entityId: r.id });
  return created(res, r);
}));

router.get('/pipelines/:id', requireMember, asyncHandler(async (req, res) => {
  const p = await db.query(`SELECT * FROM crm_pipelines WHERE id=$1 AND organization_id=$2`, [req.params.id, req.organizationId]);
  if (!p.rows[0]) throw HttpError.notFound('Pipeline not found');
  const stages = await db.query(`SELECT * FROM crm_stages WHERE pipeline_id=$1 ORDER BY display_order`, [req.params.id]);
  return ok(res, { ...p.rows[0], stages: stages.rows });
}));

// ==================== DEALS ====================
router.get('/deals', requireMember, asyncHandler(async (req, res) => {
  const { pipeline_id, stage_id, status, owner_id, contact_id, company_id, search, limit = 50, page = 1 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const params = [req.organizationId];
  let where = "WHERE d.organization_id=$1 AND d.deleted_at IS NULL";
  if (pipeline_id) { params.push(pipeline_id); where += ` AND d.pipeline_id=$${params.length}`; }
  if (stage_id) { params.push(stage_id); where += ` AND d.stage_id=$${params.length}`; }
  if (status) { params.push(status); where += ` AND d.status=$${params.length}`; }
  if (owner_id) { params.push(owner_id); where += ` AND d.owner_id=$${params.length}`; }
  if (contact_id) { params.push(contact_id); where += ` AND d.contact_id=$${params.length}`; }
  if (company_id) { params.push(company_id); where += ` AND d.company_id=$${params.length}`; }
  if (search) { params.push(`%${search}%`); where += ` AND d.title ILIKE $${params.length}`; }
  const total = await db.query(`SELECT COUNT(*)::int AS c, COALESCE(SUM(value),0)::float AS total_value FROM crm_deals d ${where}`, params);
  params.push(parseInt(limit)); params.push(offset);
  const rows = await db.query(
    `SELECT d.*, s.name AS stage_name, s.color AS stage_color, p.name AS pipeline_name,
            c.full_name AS contact_name, comp.name AS company_name, u.full_name AS owner_name
     FROM crm_deals d
     LEFT JOIN crm_stages s ON s.id=d.stage_id
     LEFT JOIN crm_pipelines p ON p.id=d.pipeline_id
     LEFT JOIN crm_contacts c ON c.id=d.contact_id
     LEFT JOIN crm_companies comp ON comp.id=d.company_id
     LEFT JOIN users u ON u.id=d.owner_id
     ${where} ORDER BY d.position ASC, d.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return paginated(res, rows.rows, total.rows[0].c, parseInt(page), parseInt(limit), { total_value: total.rows[0].total_value });
}));

router.post('/deals', requireMember, [
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('pipeline_id').isUUID(),
  body('stage_id').isUUID(),
], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO crm_deals(organization_id, workspace_id, pipeline_id, stage_id, title, description, value, currency, probability, expected_close_date, contact_id, company_id, owner_id, source, priority, tags, products, next_step, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [req.organizationId, req.body.workspace_id, req.body.pipeline_id, req.body.stage_id, req.body.title,
     req.body.description, req.body.value || 0, req.body.currency || 'USD', req.body.probability || 0,
     req.body.expected_close_date, req.body.contact_id, req.body.company_id, req.body.owner_id || req.userId,
     req.body.source, req.body.priority || 'medium', req.body.tags || [], JSON.stringify(req.body.products || []),
     req.body.next_step, req.userId]
  );
  audit({ organizationId: req.organizationId, actorId: req.userId, action: 'crm.deal.created', entityType: 'deal', entityId: r.rows[0].id });
  return created(res, r.rows[0]);
}));

router.get('/deals/:id', requireMember, asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT d.*, s.name AS stage_name, s.color AS stage_color, p.name AS pipeline_name,
            c.full_name AS contact_name, comp.name AS company_name, u.full_name AS owner_name
     FROM crm_deals d
     LEFT JOIN crm_stages s ON s.id=d.stage_id
     LEFT JOIN crm_pipelines p ON p.id=d.pipeline_id
     LEFT JOIN crm_contacts c ON c.id=d.contact_id
     LEFT JOIN crm_companies comp ON comp.id=d.company_id
     LEFT JOIN users u ON u.id=d.owner_id
     WHERE d.id=$1 AND d.organization_id=$2 AND d.deleted_at IS NULL`,
    [req.params.id, req.organizationId]
  );
  if (!r.rows[0]) throw HttpError.notFound('Deal not found');
  const activities = await db.query(`SELECT id, type, subject, created_at FROM crm_activities WHERE deal_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.params.id]);
  return ok(res, { ...r.rows[0], activities: activities.rows });
}));

router.patch('/deals/:id', requireMember, asyncHandler(async (req, res) => {
  const fields = ['title','description','value','currency','probability','expected_close_date','contact_id','company_id','owner_id','source','priority','status','lost_reason','won_reason','tags','next_step','position'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) {
    sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]);
  }
  if (req.body.stage_id) { sets.push(`stage_id = $${i++}`); params.push(req.body.stage_id); }
  if (req.body.pipeline_id) { sets.push(`pipeline_id = $${i++}`); params.push(req.body.pipeline_id); }
  if (req.body.products) { sets.push(`products = $${i++}`); params.push(JSON.stringify(req.body.products)); }
  if (req.body.custom_fields) { sets.push(`custom_fields = $${i++}`); params.push(JSON.stringify(req.body.custom_fields)); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id, req.organizationId);
  const r = await db.query(`UPDATE crm_deals SET ${sets.join(', ')} WHERE id=$${i++} AND organization_id=$${i} RETURNING *`, params);
  if (!r.rows[0]) throw HttpError.notFound('Deal not found');
  return ok(res, r.rows[0]);
}));

router.delete('/deals/:id', requireMember, asyncHandler(async (req, res) => {
  const r = await db.query(`UPDATE crm_deals SET deleted_at=NOW() WHERE id=$1 AND organization_id=$2 RETURNING id`, [req.params.id, req.organizationId]);
  if (!r.rows[0]) throw HttpError.notFound('Deal not found');
  return ok(res, { success: true });
}));

router.post('/deals/:id/move', requireMember, asyncHandler(async (req, res) => {
  const { stage_id, position } = req.body;
  const stage = await db.query(`SELECT * FROM crm_stages WHERE id=$1`, [stage_id]);
  const r = await db.query(
    `UPDATE crm_deals SET stage_id=$1, position=COALESCE($2,position), status=CASE WHEN $3 THEN 'won' WHEN $4 THEN 'lost' ELSE 'open' END, actual_close_date=CASE WHEN $3 OR $4 THEN CURRENT_DATE ELSE actual_close_date END WHERE id=$5 AND organization_id=$6 RETURNING *`,
    [stage_id, position, stage.rows[0]?.is_won || false, stage.rows[0]?.is_lost || false, req.params.id, req.organizationId]
  );
  if (!r.rows[0]) throw HttpError.notFound('Deal not found');
  return ok(res, r.rows[0]);
}));

// ==================== LEADS ====================
router.get('/leads', requireMember, asyncHandler(async (req, res) => {
  const { status, owner_id, search, limit = 50, page = 1 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const params = [req.organizationId];
  let where = "WHERE l.organization_id=$1 AND l.deleted_at IS NULL";
  if (status) { params.push(status); where += ` AND l.status=$${params.length}`; }
  if (owner_id) { params.push(owner_id); where += ` AND l.owner_id=$${params.length}`; }
  if (search) { params.push(`%${search}%`); where += ` AND (l.first_name ILIKE $${params.length} OR l.last_name ILIKE $${params.length} OR l.email ILIKE $${params.length} OR l.company_name ILIKE $${params.length})`; }
  const total = await db.query(`SELECT COUNT(*)::int AS c FROM crm_leads l ${where}`, params);
  params.push(parseInt(limit)); params.push(offset);
  const rows = await db.query(`SELECT l.*, u.full_name AS owner_name FROM crm_leads l LEFT JOIN users u ON u.id=l.owner_id ${where} ORDER BY l.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return paginated(res, rows.rows, total.rows[0].c, parseInt(page), parseInt(limit));
}));

router.post('/leads', requireMember, [
  body('email').optional({ checkFalsy: true }).isEmail(),
], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO crm_leads(organization_id, workspace_id, first_name, last_name, email, phone, company_name, job_title, website, source, campaign, status, score, owner_id, tags, custom_fields, description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [req.organizationId, req.body.workspace_id, req.body.first_name, req.body.last_name, req.body.email, req.body.phone,
     req.body.company_name, req.body.job_title, req.body.website, req.body.source, req.body.campaign,
     req.body.status || 'new', req.body.score || 0, req.body.owner_id || req.userId, req.body.tags || [],
     JSON.stringify(req.body.custom_fields || {}), req.body.description, req.userId]
  );
  return created(res, r.rows[0]);
}));

router.patch('/leads/:id', requireMember, asyncHandler(async (req, res) => {
  const fields = ['first_name','last_name','email','phone','company_name','job_title','website','source','campaign','status','score','owner_id','tags','description'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id, req.organizationId);
  const r = await db.query(`UPDATE crm_leads SET ${sets.join(', ')} WHERE id=$${i++} AND organization_id=$${i} RETURNING *`, params);
  if (!r.rows[0]) throw HttpError.notFound('Lead not found');
  return ok(res, r.rows[0]);
}));

router.post('/leads/:id/convert', requireMember, asyncHandler(async (req, res) => {
  const lead = await db.query(`SELECT * FROM crm_leads WHERE id=$1 AND organization_id=$2`, [req.params.id, req.organizationId]);
  if (!lead.rows[0]) throw HttpError.notFound('Lead not found');
  const l = lead.rows[0];
  const r = await db.tx(async (c) => {
    let companyId = null;
    if (l.company_name) {
      const comp = await c.query(`INSERT INTO crm_companies(organization_id, name, website, source, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [req.organizationId, l.company_name, l.website, l.source, req.userId]);
      companyId = comp.rows[0].id;
    }
    const contact = await c.query(`INSERT INTO crm_contacts(organization_id, company_id, first_name, last_name, email, phone, job_title, source, lifecycle_stage, owner_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [req.organizationId, companyId, l.first_name, l.last_name, l.email, l.phone, l.job_title, l.source, 'lead', l.owner_id, req.userId]);
    await c.query(`UPDATE crm_leads SET status='converted', converted_to_contact_id=$1, converted_to_company_id=$2, converted_at=NOW() WHERE id=$3`, [contact.rows[0].id, companyId, l.id]);
    return { contact: contact.rows[0], company_id: companyId };
  });
  return ok(res, r);
}));

// ==================== ACTIVITIES ====================
router.get('/activities', requireMember, asyncHandler(async (req, res) => {
  const { type, contact_id, deal_id, company_id, status, limit = 50, page = 1 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const params = [req.organizationId];
  let where = "WHERE a.organization_id=$1";
  if (type) { params.push(type); where += ` AND a.type=$${params.length}`; }
  if (contact_id) { params.push(contact_id); where += ` AND a.contact_id=$${params.length}`; }
  if (deal_id) { params.push(deal_id); where += ` AND a.deal_id=$${params.length}`; }
  if (company_id) { params.push(company_id); where += ` AND a.company_id=$${params.length}`; }
  if (status) { params.push(status); where += ` AND a.status=$${params.length}`; }
  const total = await db.query(`SELECT COUNT(*)::int AS c FROM crm_activities a ${where}`, params);
  params.push(parseInt(limit)); params.push(offset);
  const rows = await db.query(`SELECT a.*, u.full_name AS owner_name, c.full_name AS contact_name, comp.name AS company_name, d.title AS deal_title FROM crm_activities a LEFT JOIN users u ON u.id=a.owner_id LEFT JOIN crm_contacts c ON c.id=a.contact_id LEFT JOIN crm_companies comp ON comp.id=a.company_id LEFT JOIN crm_deals d ON d.id=a.deal_id ${where} ORDER BY a.due_date DESC NULLS LAST, a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return paginated(res, rows.rows, total.rows[0].c, parseInt(page), parseInt(limit));
}));

router.post('/activities', requireMember, [
  body('type').isIn(['call','email','meeting','task','note','demo','follow_up']),
  body('subject').trim().isLength({ min: 1, max: 255 }),
], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO crm_activities(organization_id, workspace_id, type, subject, description, contact_id, company_id, deal_id, lead_id, owner_id, due_date, status, priority, outcome, duration_minutes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [req.organizationId, req.body.workspace_id, req.body.type, req.body.subject, req.body.description,
     req.body.contact_id, req.body.company_id, req.body.deal_id, req.body.lead_id,
     req.body.owner_id || req.userId, req.body.due_date, req.body.status || 'pending',
     req.body.priority || 'medium', req.body.outcome, req.body.duration_minutes, req.userId]
  );
  return created(res, r.rows[0]);
}));

router.patch('/activities/:id', requireMember, asyncHandler(async (req, res) => {
  const fields = ['type','subject','description','due_date','status','priority','outcome','duration_minutes','completed_at'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id, req.organizationId);
  const r = await db.query(`UPDATE crm_activities SET ${sets.join(', ')} WHERE id=$${i++} AND organization_id=$${i} RETURNING *`, params);
  if (!r.rows[0]) throw HttpError.notFound('Activity not found');
  return ok(res, r.rows[0]);
}));

// ==================== QUOTES ====================
router.get('/quotes', requireMember, asyncHandler(async (req, res) => {
  const { status, deal_id, contact_id, limit = 50, page = 1 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const params = [req.organizationId];
  let where = "WHERE q.organization_id=$1";
  if (status) { params.push(status); where += ` AND q.status=$${params.length}`; }
  if (deal_id) { params.push(deal_id); where += ` AND q.deal_id=$${params.length}`; }
  if (contact_id) { params.push(contact_id); where += ` AND q.contact_id=$${params.length}`; }
  const total = await db.query(`SELECT COUNT(*)::int AS c FROM crm_quotes q ${where}`, params);
  params.push(parseInt(limit)); params.push(offset);
  const rows = await db.query(`SELECT q.*, d.title AS deal_title, c.full_name AS contact_name, comp.name AS company_name FROM crm_quotes q LEFT JOIN crm_deals d ON d.id=q.deal_id LEFT JOIN crm_contacts c ON c.id=q.contact_id LEFT JOIN crm_companies comp ON comp.id=q.company_id ${where} ORDER BY q.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return paginated(res, rows.rows, total.rows[0].c, parseInt(page), parseInt(limit));
}));

router.post('/quotes', requireMember, [
  body('title').trim().isLength({ min: 1, max: 255 }),
], validate, asyncHandler(async (req, res) => {
  const num = `Q-${Date.now().toString(36).toUpperCase()}-${randomToken(3).toUpperCase()}`;
  const subtotal = (req.body.line_items || []).reduce((sum, item) => sum + (item.quantity || 1) * (item.unit_price || 0), 0);
  const taxAmount = subtotal * (req.body.tax_rate || 0) / 100;
  const total = subtotal + taxAmount - (req.body.discount_value || 0);
  const r = await db.query(
    `INSERT INTO crm_quotes(organization_id, workspace_id, deal_id, contact_id, company_id, quote_number, title, description, status, subtotal, discount_type, discount_value, tax_rate, tax_amount, total, currency, valid_until, terms, notes, line_items, owner_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
    [req.organizationId, req.body.workspace_id, req.body.deal_id, req.body.contact_id, req.body.company_id,
     num, req.body.title, req.body.description, 'draft', subtotal,
     req.body.discount_type, req.body.discount_value || 0, req.body.tax_rate || 0,
     taxAmount, total, req.body.currency || 'USD', req.body.valid_until, req.body.terms,
     req.body.notes, JSON.stringify(req.body.line_items || []), req.body.owner_id || req.userId, req.userId]
  );
  return created(res, r.rows[0]);
}));

router.post('/quotes/:id/send', requireMember, asyncHandler(async (req, res) => {
  const r = await db.query(`UPDATE crm_quotes SET status='sent', sent_at=NOW() WHERE id=$1 AND organization_id=$2 RETURNING *`, [req.params.id, req.organizationId]);
  if (!r.rows[0]) throw HttpError.notFound('Quote not found');
  return ok(res, r.rows[0]);
}));

// ==================== DASHBOARD ====================
router.get('/dashboard', requireMember, asyncHandler(async (req, res) => {
  const [pipelineValue, wonValue, dealsByStage, topDeals, recentActivities, leadsByStatus, contactsByMonth] = await Promise.all([
    db.query(`SELECT COALESCE(SUM(value),0)::float AS total FROM crm_deals WHERE organization_id=$1 AND status='open' AND deleted_at IS NULL`, [req.organizationId]),
    db.query(`SELECT COALESCE(SUM(value),0)::float AS total, COUNT(*)::int AS count FROM crm_deals WHERE organization_id=$1 AND status='won' AND deleted_at IS NULL`, [req.organizationId]),
    db.query(`SELECT s.name AS stage, s.color, COUNT(d.id)::int AS count, COALESCE(SUM(d.value),0)::float AS value FROM crm_stages s LEFT JOIN crm_deals d ON d.stage_id=s.id AND d.deleted_at IS NULL AND d.status='open' WHERE s.pipeline_id IN (SELECT id FROM crm_pipelines WHERE organization_id=$1) GROUP BY s.id, s.name, s.color, s.display_order ORDER BY s.display_order`, [req.organizationId]),
    db.query(`SELECT d.id, d.title, d.value, d.currency, c.full_name AS contact_name, comp.name AS company_name FROM crm_deals d LEFT JOIN crm_contacts c ON c.id=d.contact_id LEFT JOIN crm_companies comp ON comp.id=d.company_id WHERE d.organization_id=$1 AND d.status='open' AND d.deleted_at IS NULL ORDER BY d.value DESC LIMIT 10`, [req.organizationId]),
    db.query(`SELECT a.id, a.type, a.subject, a.created_at, c.full_name AS contact_name FROM crm_activities a LEFT JOIN crm_contacts c ON c.id=a.contact_id WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 10`, [req.organizationId]),
    db.query(`SELECT status, COUNT(*)::int AS count FROM crm_leads WHERE organization_id=$1 AND deleted_at IS NULL GROUP BY status`, [req.organizationId]),
    db.query(`SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*)::int AS count FROM crm_contacts WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '6 months' GROUP BY month ORDER BY month`, [req.organizationId]),
  ]);
  return ok(res, {
    pipeline_value: pipelineValue.rows[0].total,
    won_value: wonValue.rows[0].total,
    won_count: wonValue.rows[0].count,
    deals_by_stage: dealsByStage.rows,
    top_deals: topDeals.rows,
    recent_activities: recentActivities.rows,
    leads_by_status: leadsByStatus.rows,
    contacts_by_month: contactsByMonth.rows,
  });
}));

module.exports = router;
