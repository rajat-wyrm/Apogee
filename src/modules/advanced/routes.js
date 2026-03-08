const express = require('express');
const { body, param, query } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError, paginated } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');

const auth = authenticate();
const validateUuid = [param('id').isUUID()];

// ====================== EPICS ======================
const epicsRouter = express.Router();
epicsRouter.use(auth);

epicsRouter.get('/', asyncHandler(async (req, res) => {
  const wsId = req.query.workspace_id;
  if (!wsId) throw HttpError.badRequest('workspace_id required');
  const r = await db.query(
    `SELECT e.*, u.full_name AS owner_name, u.avatar_url AS owner_avatar,
       (SELECT COUNT(*)::int FROM tasks WHERE epic_id = e.id) AS task_count,
       (SELECT COUNT(*)::int FROM tasks WHERE epic_id = e.id AND completed_at IS NOT NULL) AS done_count
     FROM epics e LEFT JOIN users u ON u.id = e.owner_id
     WHERE e.workspace_id = $1 ORDER BY e.created_at DESC`,
    [wsId]
  );
  return ok(res, r.rows);
}));

epicsRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  if (!ws.rows[0]) throw HttpError.notFound('Workspace not found');
  const r = await db.query(
    `INSERT INTO epics(workspace_id, organization_id, project_id, name, description, color, owner_id, start_date, end_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.body.workspace_id, ws.rows[0].organization_id, req.body.project_id, req.body.name, req.body.description, req.body.color || '#8b5cf6', req.body.owner_id || req.userId, req.body.start_date, req.body.end_date]
  );
  return created(res, r.rows[0]);
}));

epicsRouter.get('/:id', validateUuid, validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM epics WHERE id=$1', [req.params.id]);
  if (!r.rows[0]) throw HttpError.notFound('Epic not found');
  const tasks = await db.query('SELECT id, title, status_id, priority, completed_at, assignee_id, due_date FROM tasks WHERE epic_id=$1', [req.params.id]);
  return ok(res, { ...r.rows[0], tasks: tasks.rows });
}));

epicsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['name', 'description', 'color', 'status', 'owner_id', 'start_date', 'end_date', 'progress', 'project_id'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE epics SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

epicsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM epics WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

// ====================== RELEASES ======================
const releasesRouter = express.Router();
releasesRouter.use(auth);

releasesRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM releases WHERE workspace_id=$1 ORDER BY release_date DESC NULLS LAST', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

releasesRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query(
    `INSERT INTO releases(workspace_id, organization_id, project_id, name, description, version, release_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.body.workspace_id, ws.rows[0].organization_id, req.body.project_id, req.body.name, req.body.description, req.body.version, req.body.release_date]
  );
  return created(res, r.rows[0]);
}));

releasesRouter.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['name', 'description', 'version', 'status', 'release_date'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (req.body.status === 'released' && !req.body.released_at) { sets.push('released_at = NOW()'); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE releases SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

releasesRouter.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM releases WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

releasesRouter.get('/:id/tasks', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT t.*, s.name AS status_name FROM tasks t LEFT JOIN project_statuses s ON s.id=t.status_id WHERE t.release_id=$1', [req.params.id]);
  return ok(res, r.rows);
}));

// ====================== SPRINTS ======================
const sprintsRouter = express.Router();
sprintsRouter.use(auth);

sprintsRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM sprints WHERE project_id=$1 ORDER BY start_date DESC NULLS LAST', [req.query.project_id]);
  return ok(res, r.rows);
}));

sprintsRouter.post('/', [body('project_id').isUUID(), body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const p = await db.query('SELECT workspace_id, organization_id FROM projects WHERE id=$1', [req.body.project_id]);
  if (!p.rows[0]) throw HttpError.notFound('Project not found');
  const r = await db.query(
    `INSERT INTO sprints(workspace_id, organization_id, project_id, name, goal, start_date, end_date, capacity_hours) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [p.rows[0].workspace_id, p.rows[0].organization_id, req.body.project_id, req.body.name, req.body.goal, req.body.start_date, req.body.end_date, req.body.capacity_hours || 0]
  );
  return created(res, r.rows[0]);
}));

sprintsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['name', 'goal', 'status', 'start_date', 'end_date', 'capacity_hours'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (req.body.status === 'completed' && !req.body.completed_at) { sets.push('completed_at = NOW()'); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE sprints SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

sprintsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM sprints WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

sprintsRouter.get('/:id/tasks', asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT t.*, s.name AS status_name FROM sprint_tasks st JOIN tasks t ON t.id=st.task_id LEFT JOIN project_statuses s ON s.id=t.status_id WHERE st.sprint_id=$1`,
    [req.params.id]
  );
  return ok(res, r.rows);
}));

sprintsRouter.post('/:id/tasks', [body('task_id').isUUID()], validate, asyncHandler(async (req, res) => {
  await db.query('INSERT INTO sprint_tasks(sprint_id, task_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, req.body.task_id]);
  await db.query('UPDATE tasks SET sprint_id=$1 WHERE id=$2', [req.params.id, req.body.task_id]);
  return created(res, { success: true });
}));

sprintsRouter.delete('/:id/tasks/:taskId', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM sprint_tasks WHERE sprint_id=$1 AND task_id=$2', [req.params.id, req.params.taskId]);
  await db.query('UPDATE tasks SET sprint_id=NULL WHERE id=$1 AND sprint_id=$2', [req.params.taskId, req.params.id]);
  return ok(res, { success: true });
}));

sprintsRouter.get('/:id/burndown', asyncHandler(async (req, res) => {
  const sprint = await db.query('SELECT * FROM sprints WHERE id=$1', [req.params.id]);
  if (!sprint.rows[0]) throw HttpError.notFound('Sprint not found');
  const start = new Date(sprint.rows[0].start_date);
  const end = new Date(sprint.rows[0].end_date);
  const total = await db.query('SELECT COUNT(*)::int AS total, COALESCE(SUM(story_points),0)::int AS points FROM tasks WHERE sprint_id=$1', [req.params.id]);
  const totalCount = total.rows[0].total;
  const totalPoints = total.rows[0].points;
  const days = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
  const ideal = [];
  const actual = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    ideal.push({ day: i + 1, date: dateStr, remaining: Math.max(0, totalCount - Math.round((totalCount / Math.max(1, days - 1)) * i)) });
    const completed = await db.query(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(t.story_points),0)::int AS points FROM tasks t WHERE t.sprint_id=$1 AND t.completed_at IS NOT NULL AND DATE(t.completed_at) <= $2`,
      [req.params.id, dateStr]
    );
    actual.push({ day: i + 1, date: dateStr, remaining: totalCount - completed.rows[0].count, completed: completed.rows[0].count });
  }
  return ok(res, { ideal, actual, total: totalCount, points: totalPoints, sprint: sprint.rows[0] });
}));

sprintsRouter.get('/:id/capacity', asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT c.*, u.full_name, u.avatar_url FROM capacity c JOIN users u ON u.id=c.user_id WHERE c.sprint_id=$1`,
    [req.params.id]
  );
  return ok(res, r.rows);
}));

// ====================== COMPONENTS ======================
const componentsRouter = express.Router();
componentsRouter.use(auth);

componentsRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT c.*, u.full_name AS lead_name FROM components c LEFT JOIN users u ON u.id=c.lead_id WHERE c.project_id=$1 ORDER BY c.name', [req.query.project_id]);
  return ok(res, r.rows);
}));

componentsRouter.post('/', [body('project_id').isUUID(), body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const p = await db.query('SELECT workspace_id FROM projects WHERE id=$1', [req.body.project_id]);
  const r = await db.query(`INSERT INTO components(workspace_id, project_id, name, description, lead_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [p.rows[0].workspace_id, req.body.project_id, req.body.name, req.body.description, req.body.lead_id]);
  return created(res, r.rows[0]);
}));

// ====================== CUSTOM FIELDS ======================
const customFieldsRouter = express.Router();
customFieldsRouter.use(auth);

customFieldsRouter.get('/', asyncHandler(async (req, res) => {
  const where = ['workspace_id = $1']; const params = [req.query.workspace_id];
  if (req.query.entity_type) { params.push(req.query.entity_type); where.push(`entity_type = $${params.length}`); }
  const r = await db.query(`SELECT * FROM custom_fields WHERE ${where.join(' AND ')} ORDER BY position, name`, params);
  return ok(res, r.rows);
}));

customFieldsRouter.post('/', [body('workspace_id').isUUID(), body('entity_type').notEmpty(), body('name').notEmpty(), body('type').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const key = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const r = await db.query(
    `INSERT INTO custom_fields(workspace_id, organization_id, entity_type, name, key, type, options, config, required, description, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [req.body.workspace_id, ws.rows[0].organization_id, req.body.entity_type, req.body.name, key, req.body.type, JSON.stringify(req.body.options || []), JSON.stringify(req.body.config || {}), req.body.required || false, req.body.description, req.body.position || 0]
  );
  return created(res, r.rows[0]);
}));

customFieldsRouter.get('/:id/values', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM custom_field_values WHERE field_id=$1', [req.params.id]);
  return ok(res, r.rows);
}));

customFieldsRouter.post('/:id/values', [body('entity_id').isUUID(), body('value').exists()], validate, asyncHandler(async (req, res) => {
  const field = await db.query('SELECT * FROM custom_fields WHERE id=$1', [req.params.id]);
  if (!field.rows[0]) throw HttpError.notFound('Field not found');
  const v = req.body.value;
  const r = await db.query(
    `INSERT INTO custom_field_values(field_id, entity_type, entity_id, value_text, value_number, value_date, value_json) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (field_id, entity_id) DO UPDATE SET value_text=$4, value_number=$5, value_date=$6, value_json=$7, updated_at=NOW() RETURNING *`,
    [req.params.id, field.rows[0].entity_type, req.body.entity_id, typeof v === 'string' ? v : null, typeof v === 'number' ? v : null, typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : null, typeof v === 'object' ? JSON.stringify(v) : null]
  );
  return created(res, r.rows[0]);
}));

// ====================== WORKFLOWS ======================
const workflowsRouter = express.Router();
workflowsRouter.use(auth);

workflowsRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM workflows WHERE workspace_id=$1', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

workflowsRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query(
    `INSERT INTO workflows(workspace_id, organization_id, name, description, entity_type, is_default) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.body.workspace_id, ws.rows[0].organization_id, req.body.name, req.body.description, req.body.entity_type || 'task', req.body.is_default || false]
  );
  return created(res, r.rows[0]);
}));

workflowsRouter.get('/:id', asyncHandler(async (req, res) => {
  const wf = await db.query('SELECT * FROM workflows WHERE id=$1', [req.params.id]);
  if (!wf.rows[0]) throw HttpError.notFound('Workflow not found');
  const statuses = await db.query('SELECT * FROM workflow_statuses WHERE workflow_id=$1 ORDER BY position', [req.params.id]);
  const transitions = await db.query('SELECT * FROM workflow_transitions WHERE workflow_id=$1 ORDER BY position', [req.params.id]);
  return ok(res, { ...wf.rows[0], statuses: statuses.rows, transitions: transitions.rows });
}));

workflowsRouter.post('/:id/statuses', [body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const max = await db.query('SELECT COALESCE(MAX(position),0)+1 AS p FROM workflow_statuses WHERE workflow_id=$1', [req.params.id]);
  const r = await db.query(
    `INSERT INTO workflow_statuses(workflow_id, name, category, color, position, is_initial, is_final) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.id, req.body.name, req.body.category || 'todo', req.body.color || '#94a3b8', max.rows[0].p, req.body.is_initial || false, req.body.is_final || false]
  );
  return created(res, r.rows[0]);
}));

workflowsRouter.post('/:id/transitions', [body('from_status_id').isUUID(), body('to_status_id').isUUID()], validate, asyncHandler(async (req, res) => {
  const max = await db.query('SELECT COALESCE(MAX(position),0)+1 AS p FROM workflow_transitions WHERE workflow_id=$1', [req.params.id]);
  const r = await db.query(
    `INSERT INTO workflow_transitions(workflow_id, from_status_id, to_status_id, name, conditions, validators, post_functions, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.params.id, req.body.from_status_id, req.body.to_status_id, req.body.name, JSON.stringify(req.body.conditions || []), JSON.stringify(req.body.validators || []), JSON.stringify(req.body.post_functions || []), max.rows[0].p]
  );
  return created(res, r.rows[0]);
}));

// ====================== APPROVALS ======================
const approvalsRouter = express.Router();
approvalsRouter.use(auth);

approvalsRouter.get('/', asyncHandler(async (req, res) => {
  const where = ['a.organization_id = $1']; const params = [req.query.organization_id];
  if (req.query.status) { params.push(req.query.status); where.push(`a.status = $${params.length}`); }
  const r = await db.query(
    `SELECT a.*, u.full_name AS requester_name, u.avatar_url AS requester_avatar
     FROM approvals a LEFT JOIN users u ON u.id = a.requester_id WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC`,
    params
  );
  return ok(res, r.rows);
}));

approvalsRouter.post('/', [body('organization_id').isUUID(), body('entity_type').notEmpty(), body('entity_id').isUUID(), body('title').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT id FROM workspaces WHERE organization_id=$1 LIMIT 1', [req.body.organization_id]);
  const r = await db.query(
    `INSERT INTO approvals(workspace_id, organization_id, entity_type, entity_id, requester_id, title, description, required_count, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [ws.rows[0]?.id, req.body.organization_id, req.body.entity_type, req.body.entity_id, req.userId, req.body.title, req.body.description, req.body.required_count || 1, req.body.due_date]
  );
  return created(res, r.rows[0]);
}));

approvalsRouter.post('/:id/decide', [body('decision').isIn(['approved', 'rejected'])], validate, asyncHandler(async (req, res) => {
  await db.query('INSERT INTO approval_decisions(approval_id, approver_id, decision, comment) VALUES ($1,$2,$3,$4)', [req.params.id, req.userId, req.body.decision, req.body.comment]);
  const counts = await db.query(`SELECT COUNT(*) FILTER (WHERE decision='approved')::int AS approved, COUNT(*)::int AS total, a.required_count FROM approval_decisions ad JOIN approvals a ON a.id=ad.approval_id WHERE ad.approval_id=$1 GROUP BY a.required_count`, [req.params.id]);
  if (counts.rows[0]) {
    const { approved, total, required_count } = counts.rows[0];
    let status = 'pending';
    if (approved >= required_count) status = 'approved';
    else if (total - approved >= required_count) status = 'rejected';
    await db.query('UPDATE approvals SET status=$1, decided_at=NOW() WHERE id=$2', [status, req.params.id]);
  }
  return ok(res, { success: true });
}));

// ====================== SLA ======================
const slaRouter = express.Router();
slaRouter.use(auth);

slaRouter.get('/policies', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM sla_policies WHERE workspace_id=$1', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

slaRouter.post('/policies', [body('workspace_id').isUUID(), body('name').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query(
    `INSERT INTO sla_policies(workspace_id, organization_id, name, description, entity_type, conditions, response_time_minutes, resolution_time_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.body.workspace_id, ws.rows[0].organization_id, req.body.name, req.body.description, req.body.entity_type || 'ticket', JSON.stringify(req.body.conditions || []), req.body.response_time_minutes, req.body.resolution_time_minutes]
  );
  return created(res, r.rows[0]);
}));

slaRouter.get('/tracking', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM sla_tracking WHERE entity_type=$1 AND entity_id=$2', [req.query.entity_type, req.query.entity_id]);
  return ok(res, r.rows[0] || null);
}));

// ====================== ROADMAP ======================
const roadmapRouter = express.Router();
roadmapRouter.use(auth);

roadmapRouter.get('/items', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM roadmap_items WHERE workspace_id=$1 ORDER BY start_date NULLS LAST, created_at', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

roadmapRouter.post('/items', [body('workspace_id').isUUID(), body('title').notEmpty()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query(
    `INSERT INTO roadmap_items(workspace_id, organization_id, title, description, start_date, end_date, color, category, progress, parent_id, bar_type, dependencies) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [req.body.workspace_id, ws.rows[0].organization_id, req.body.title, req.body.description, req.body.start_date, req.body.end_date, req.body.color || '#6366f1', req.body.category, req.body.progress || 0, req.body.parent_id, req.body.bar_type || 'bar', JSON.stringify(req.body.dependencies || [])]
  );
  return created(res, r.rows[0]);
}));

roadmapRouter.patch('/items/:id', asyncHandler(async (req, res) => {
  const fields = ['title', 'description', 'start_date', 'end_date', 'color', 'category', 'progress', 'bar_type'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (req.body.dependencies !== undefined) { sets.push(`dependencies = $${i++}`); params.push(JSON.stringify(req.body.dependencies)); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE roadmap_items SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

roadmapRouter.delete('/items/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM roadmap_items WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

// ====================== ADVANCED SEARCH ======================
const searchV2Router = express.Router();
searchV2Router.use(auth);

searchV2Router.post('/search', asyncHandler(async (req, res) => {
  const { entity_type = 'task', workspace_id, jql = '', limit = 50 } = req.body;
  if (!workspace_id) throw HttpError.badRequest('workspace_id required');
  const where = ['t.workspace_id = $1']; const params = [workspace_id];
  let orderBy = 't.created_at DESC';
  const limitVal = Math.min(parseInt(limit) || 50, 200);

  if (entity_type === 'task') {
    // Simple JQL parser
    const conds = [];
    const tokens = (jql || '').match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (['AND', 'OR', 'NOT'].includes(t.toUpperCase())) continue;
      if (t.toUpperCase() === 'ORDER' && tokens[i + 1]?.toLowerCase() === 'by') {
        orderBy = `t.${tokens[i + 2]?.toLowerCase() || 'created_at'} ${(tokens[i + 3] || 'DESC').toUpperCase()}`;
        i += 3; continue;
      }
      const m = t.match(/^(\w+)\s*(=|!=|~=|!~=|>|<|>=|<=)\s*(.+)$/);
      if (m) {
        const [, field, op, value] = m;
        params.push(value.replace(/"/g, ''));
        const col = field === 'assignee' ? 't.assignee_id' : field === 'status' ? 's.category' : `t.${field}`;
        const sqlOp = { '=': '=', '!=': '!=', '~=': 'ILIKE', '!~=': 'NOT ILIKE', '>': '>', '<': '<', '>=': '>=', '<=': '<=' }[op] || '=';
        const val = sqlOp === 'ILIKE' || sqlOp === 'NOT ILIKE' ? `%${value.replace(/"/g, '')}%` : value.replace(/"/g, '');
        conds.push(`${col} ${sqlOp} $${params.length}`);
      }
    }
    if (conds.length) where.push(...conds);
    try {
      const sql = `SELECT t.*, u.full_name AS assignee_name, s.name AS status_name, p.name AS project_name, p.color AS project_color
                   FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id LEFT JOIN project_statuses s ON s.id=t.status_id LEFT JOIN projects p ON p.id=t.project_id
                   WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ${limitVal}`;
      const r = await db.query(sql, params);
      return ok(res, { results: r.rows, count: r.rows.length, jql });
    } catch (e) {
      return ok(res, { results: [], count: 0, jql, error: e.message });
    }
  }
  return ok(res, { results: [], count: 0 });
}));

// ====================== SAVED FILTERS ======================
const filtersRouter = express.Router();
filtersRouter.use(auth);

filtersRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM saved_filters WHERE workspace_id=$1 AND (user_id=$2 OR is_shared=true) ORDER BY name', [req.query.workspace_id, req.userId]);
  return ok(res, r.rows);
}));

filtersRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty(), body('jql').notEmpty(), body('entity_type').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO saved_filters(workspace_id, user_id, name, jql, description, entity_type, is_shared) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.body.workspace_id, req.userId, req.body.name, req.body.jql, req.body.description, req.body.entity_type, req.body.is_shared || false]
  );
  return created(res, r.rows[0]);
}));

// ====================== CAPACITY ======================
const capacityRouter = express.Router();
capacityRouter.use(auth);

capacityRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM capacity WHERE workspace_id=$1 ORDER BY start_date', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

capacityRouter.post('/', [body('workspace_id').isUUID(), body('user_id').isUUID(), body('hours').isFloat()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO capacity(workspace_id, user_id, sprint_id, hours, start_date, end_date) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id, sprint_id) DO UPDATE SET hours=$4 RETURNING *`,
    [req.body.workspace_id, req.body.user_id, req.body.sprint_id, req.body.hours, req.body.start_date, req.body.end_date]
  );
  return created(res, r.rows[0]);
}));

// ====================== PAGE VERSIONS ======================
const pageVersionsRouter = express.Router();
pageVersionsRouter.use(auth);

pageVersionsRouter.get('/:pageId', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT pv.*, u.full_name AS author_name FROM page_versions pv LEFT JOIN users u ON u.id=pv.author_id WHERE pv.document_id=$1 ORDER BY pv.version DESC LIMIT 50', [req.params.pageId]);
  return ok(res, r.rows);
}));

pageVersionsRouter.post('/:pageId', asyncHandler(async (req, res) => {
  const doc = await db.query('SELECT * FROM documents WHERE id=$1', [req.params.pageId]);
  if (!doc.rows[0]) throw HttpError.notFound();
  const max = await db.query('SELECT COALESCE(MAX(version),0)+1 AS v FROM page_versions WHERE document_id=$1', [req.params.pageId]);
  const r = await db.query(
    `INSERT INTO page_versions(document_id, version, title, content, content_text, author_id, change_summary) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.pageId, max.rows[0].v, doc.rows[0].title, JSON.stringify(doc.rows[0].content), doc.rows[0].content_text, req.userId, req.body.summary]
  );
  return created(res, r.rows[0]);
}));

pageVersionsRouter.post('/:pageId/restore/:version', asyncHandler(async (req, res) => {
  const v = await db.query('SELECT * FROM page_versions WHERE document_id=$1 AND version=$2', [req.params.pageId, req.params.version]);
  if (!v.rows[0]) throw HttpError.notFound('Version not found');
  await db.query('UPDATE documents SET title=$1, content=$2, content_text=$3, updated_at=NOW() WHERE id=$4', [v.rows[0].title, JSON.stringify(v.rows[0].content), v.rows[0].content_text, req.params.pageId]);
  return ok(res, { success: true });
}));

// ====================== BACKLINKS ======================
const backlinksRouter = express.Router();
backlinksRouter.use(auth);

backlinksRouter.get('/:entityType/:entityId', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM backlinks WHERE target_type=$1 AND target_id=$2', [req.params.entityType, req.params.entityId]);
  return ok(res, r.rows);
}));

backlinksRouter.post('/', asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO backlinks(source_type, source_id, target_type, target_id, context) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING *`,
    [req.body.source_type, req.body.source_id, req.body.target_type, req.body.target_id, req.body.context]
  );
  return created(res, r.rows[0] || { success: true });
}));

// ====================== REACTIONS ======================
const reactionsRouter = express.Router();
reactionsRouter.use(auth);

reactionsRouter.post('/', [body('page_type').notEmpty(), body('page_id').isUUID(), body('emoji').notEmpty()], validate, asyncHandler(async (req, res) => {
  await db.query(
    `INSERT INTO page_reactions(page_type, page_id, user_id, emoji) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [req.body.page_type, req.body.page_id, req.userId, req.body.emoji]
  );
  return created(res, { success: true });
}));

reactionsRouter.delete('/', asyncHandler(async (req, res) => {
  const { page_type, page_id, emoji } = req.query;
  await db.query('DELETE FROM page_reactions WHERE page_type=$1 AND page_id=$2 AND user_id=$3 AND emoji=$4', [page_type, page_id, req.userId, emoji]);
  return ok(res, { success: true });
}));

// ====================== SYNCED BLOCKS ======================
const syncedBlocksRouter = express.Router();
syncedBlocksRouter.use(auth);

syncedBlocksRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM synced_blocks WHERE workspace_id=$1', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

syncedBlocksRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty(), body('content').isObject()], validate, asyncHandler(async (req, res) => {
  const ws = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
  const r = await db.query(
    `INSERT INTO synced_blocks(workspace_id, organization_id, name, content, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$5) RETURNING *`,
    [req.body.workspace_id, ws.rows[0].organization_id, req.body.name, JSON.stringify(req.body.content), req.userId]
  );
  return created(res, r.rows[0]);
}));

// ====================== VIEWS ======================
const viewsRouter = express.Router();
viewsRouter.use(auth);

viewsRouter.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM views WHERE workspace_id=$1 ORDER BY created_at DESC', [req.query.workspace_id]);
  return ok(res, r.rows);
}));

viewsRouter.post('/', [body('workspace_id').isUUID(), body('name').notEmpty(), body('type').notEmpty(), body('entity_type').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO views(workspace_id, entity_type, entity_id, name, type, config, is_shared, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.body.workspace_id, req.body.entity_type, req.body.entity_id, req.body.name, req.body.type, JSON.stringify(req.body.config || {}), req.body.is_shared || false, req.userId]
  );
  return created(res, r.rows[0]);
}));

viewsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['name', 'type', 'config', 'is_shared'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE views SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

viewsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM views WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

// ====================== RELATIONS ======================
const relationsRouter = express.Router();
relationsRouter.use(auth);

relationsRouter.get('/', asyncHandler(async (req, res) => {
  const where = ['workspace_id=$1']; const params = [req.query.workspace_id];
  if (req.query.entity_type) { params.push(req.query.entity_type); where.push(`(source_type=$${params.length} OR target_type=$${params.length})`); }
  if (req.query.entity_id) { params.push(req.query.entity_id); where.push(`(source_id=$${params.length} OR target_id=$${params.length})`); }
  const r = await db.query(`SELECT * FROM relations WHERE ${where.join(' AND ')}`, params);
  return ok(res, r.rows);
}));

relationsRouter.post('/', [body('workspace_id').isUUID(), body('source_type').notEmpty(), body('source_id').isUUID(), body('target_type').notEmpty(), body('target_id').isUUID()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO relations(workspace_id, source_type, source_id, target_type, target_id, relation_type) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *`,
    [req.body.workspace_id, req.body.source_type, req.body.source_id, req.body.target_type, req.body.target_id, req.body.relation_type || 'related']
  );
  return created(res, r.rows[0] || { success: true });
}));

relationsRouter.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM relations WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

// ====================== INTEGRATIONS ======================
const integrationsV2Router = express.Router();
integrationsV2Router.use(auth);

integrationsV2Router.get('/', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT id, organization_id, provider, status, last_sync_at, created_at FROM integrations_v2 WHERE organization_id=$1', [req.query.organization_id]);
  return ok(res, r.rows);
}));

integrationsV2Router.post('/', [body('organization_id').isUUID(), body('provider').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO integrations_v2(organization_id, provider, config, credentials) VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id, provider) DO UPDATE SET config=$3, credentials=$4, updated_at=NOW() RETURNING *`,
    [req.body.organization_id, req.body.provider, JSON.stringify(req.body.config || {}), JSON.stringify(req.body.credentials || {})]
  );
  return created(res, r.rows[0]);
}));

integrationsV2Router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM integrations_v2 WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

module.exports = {
  epicsRouter, releasesRouter, sprintsRouter, componentsRouter, customFieldsRouter,
  workflowsRouter, approvalsRouter, slaRouter, roadmapRouter, searchV2Router,
  filtersRouter, capacityRouter, pageVersionsRouter, backlinksRouter, reactionsRouter,
  syncedBlocksRouter, viewsRouter, relationsRouter, integrationsV2Router,
};
