const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError, paginated } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const audit = require('../../services/audit').record;
const { getIO } = require('../../sockets/io');
const { broadcast: notifyBroadcast, create: notifyCreate } = require('../../services/notifications');
const cache = require('../../services/cache');

const router = express.Router();
router.use(authenticate());

const projectAccess = async (userId, projectId) => {
  const r = await db.query(
    `SELECT p.*, wm.user_id AS member FROM projects p
     LEFT JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = $1
     WHERE p.id = $2`,
    [userId, projectId]
  );
  return r.rows[0] || null;
};

const nextNumber = async (client, projectId) => {
  const r = await client.query('SELECT COALESCE(MAX(number),0)+1 AS n FROM tasks WHERE project_id=$1', [projectId]);
  return r.rows[0].n;
};

router.get('/', asyncHandler(async (req, res) => {
  const wsId = req.query.workspace_id;
  if (!wsId) throw HttpError.badRequest('workspace_id required');
  const m = await db.query('SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2', [wsId, req.userId]);
  if (!m.rows[0]) throw HttpError.forbidden();
  const where = ['t.is_archived = false', 't.workspace_id = $1'];
  const params = [wsId];
  if (req.query.assignee_id) { params.push(req.query.assignee_id); where.push(`t.assignee_id = $${params.length}`); }
  if (req.query.priority) { params.push(req.query.priority); where.push(`t.priority = $${params.length}`); }
  if (req.query.status) { params.push(req.query.status); where.push(`s.category = $${params.length}`); }
  if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`); }
  if (req.query.due_before) { params.push(req.query.due_before); where.push(`t.due_date <= $${params.length}`); }
  if (req.query.due_after) { params.push(req.query.due_after); where.push(`t.due_date >= $${params.length}`); }
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const order = req.query.view === 'kanban' ? 't.position ASC, t.created_at DESC' : (req.query.order_by === 'due_date' ? 't.due_date ASC NULLS LAST' : 't.created_at DESC');
  const sql = `SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar, s.name AS status_name, s.color AS status_color, s.category AS status_category, p.name AS project_name, p.color AS project_color, p.icon AS project_icon
     FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN project_statuses s ON s.id = t.status_id JOIN projects p ON p.id = t.project_id
     WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const r = await db.query(sql, params);

  // Get total count for pagination (rebuild WHERE without limit/offset params)
  const countWhere = where.slice(); // copy
  const countParams = params.slice(0, params.length - 2); // exclude limit & offset
  const countSql = `SELECT COUNT(*)::int AS total FROM tasks t LEFT JOIN project_statuses s ON s.id = t.status_id JOIN projects p ON p.id = t.project_id WHERE ${countWhere.join(' AND ')}`;
  const countR = await db.query(countSql, countParams);
  return paginated(res, r.rows, countR.rows[0]?.total || r.rows.length, page, limit);
}));

router.post(
  '/',
  [
    body('project_id').isUUID(),
    body('title').trim().isLength({ min: 1, max: 500 }),
    body('description').optional(),
    body('priority').optional().isIn(['urgent', 'high', 'medium', 'low', 'none']),
    body('assignee_id').optional().isUUID(),
    body('due_date').optional(),
    body('start_date').optional(),
    body('estimate_minutes').optional().isInt(),
    body('story_points').optional().isInt(),
    body('parent_task_id').optional().isUUID(),
    body('status_id').optional().isUUID(),
    body('type').optional().isIn(['task', 'bug', 'feature', 'story', 'epic', 'subtask']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const p = await projectAccess(req.userId, req.body.project_id);
    if (!p) throw HttpError.notFound();
    const r = await db.tx(async (c) => {
      const number = await nextNumber(c, req.body.project_id);
      const ins = await c.query(
        `INSERT INTO tasks(project_id, workspace_id, organization_id, parent_task_id, number, title, description, priority, assignee_id, reporter_id, start_date, due_date, estimate_minutes, story_points, status_id, type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [req.body.project_id, p.workspace_id, p.organization_id, req.body.parent_task_id, number, req.body.title, req.body.description, req.body.priority || 'medium', req.body.assignee_id, req.userId, req.body.start_date, req.body.due_date, req.body.estimate_minutes, req.body.story_points, req.body.status_id, req.body.type || 'task']
      );
      await c.query(
        `INSERT INTO activities(organization_id, workspace_id, actor_id, verb, entity_type, entity_id, target_type, target_id, summary)
         VALUES ($1,$2,$3,'created','task',$4,'project',$5,$6)`,
        [p.organization_id, p.workspace_id, req.userId, ins.rows[0].id, p.id, `Created task #${number}: ${req.body.title}`]
      );
      return ins.rows[0];
    });
    const io = getIO();
    if (io) io.to(`project:${p.id}`).emit('task:created', r);
    if (r.assignee_id && r.assignee_id !== req.userId) {
      await notifyCreate({
        userId: r.assignee_id, type: 'assigned', title: 'You were assigned a task',
        body: r.title, link: `/app/projects/${p.id}/tasks/${r.id}`,
        entityType: 'task', entityId: r.id, actorId: req.userId,
      });
    }
    audit({ organizationId: p.organization_id, actorId: req.userId, action: 'task.created', entityType: 'task', entityId: r.id, ip: req.ip, userAgent: req.headers['user-agent'] });
    return created(res, r);
  })
);

router.get('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar, s.name AS status_name, s.color AS status_color, s.category AS status_category, p.name AS project_name, p.id AS project_id, p.color AS project_color
     FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN project_statuses s ON s.id = t.status_id JOIN projects p ON p.id = t.project_id
     WHERE t.id=$1`,
    [req.params.id]
  );
  const task = r.rows[0];
  if (!task) throw HttpError.notFound();
  const p = await projectAccess(req.userId, task.project_id);
  if (!p) throw HttpError.forbidden();
  const labels = await db.query(`SELECT l.* FROM labels l JOIN task_labels tl ON tl.label_id = l.id WHERE tl.task_id = $1`, [req.params.id]);
  const subtasks = await db.query(`SELECT id, title, status_id, completed_at, is_archived FROM tasks WHERE parent_task_id=$1`, [req.params.id]);
  const links = await db.query(`SELECT * FROM task_links WHERE source_id=$1 OR target_id=$1`, [req.params.id]);
  return ok(res, { ...task, labels: labels.rows, subtasks: subtasks.rows, links: links.rows });
}));

router.patch('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
  const task = r.rows[0];
  if (!task) throw HttpError.notFound();
  const p = await projectAccess(req.userId, task.project_id);
  if (!p) throw HttpError.forbidden();
  const fields = ['title', 'description', 'priority', 'status_id', 'assignee_id', 'start_date', 'due_date', 'estimate_minutes', 'spent_minutes', 'story_points', 'is_pinned', 'is_archived', 'is_blocked', 'blocked_reason', 'type', 'recurrence', 'custom_fields', 'parent_task_id'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]); }
  if (req.body.position !== undefined) { sets.push(`position = $${i++}`); params.push(req.body.position); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  if (req.body.status_id) {
    const s = await db.query("SELECT category FROM project_statuses WHERE id=$1", [req.body.status_id]);
    if (s.rows[0]?.category === 'done') sets.push(`completed_at = NOW()`);
  }
  params.push(req.params.id);
  const r2 = await db.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  const updated = r2.rows[0];
  const io = getIO();
  if (io) io.to(`project:${task.project_id}`).emit('task:updated', updated);
  if (req.body.assignee_id && req.body.assignee_id !== task.assignee_id && req.body.assignee_id !== req.userId) {
    await notifyCreate({
      userId: req.body.assignee_id, type: 'assigned', title: 'You were assigned a task',
      body: updated.title, link: `/app/projects/${task.project_id}/tasks/${updated.id}`,
      entityType: 'task', entityId: updated.id, actorId: req.userId,
    });
  }
  return ok(res, updated);
}));

router.delete('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT project_id FROM tasks WHERE id=$1', [req.params.id]);
  const task = r.rows[0];
  if (!task) throw HttpError.notFound();
  const p = await projectAccess(req.userId, task.project_id);
  if (!p) throw HttpError.forbidden();
  await db.query('UPDATE tasks SET is_archived=true WHERE id=$1', [req.params.id]);
  const io = getIO();
  if (io) io.to(`project:${task.project_id}`).emit('task:deleted', { id: req.params.id });
  return ok(res, { success: true });
}));

router.post('/:id/move', [param('id').isUUID(), body('status_id').isUUID(), body('position').optional()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT project_id FROM tasks WHERE id=$1', [req.params.id]);
  const task = r.rows[0];
  if (!task) throw HttpError.notFound();
  const p = await projectAccess(req.userId, task.project_id);
  if (!p) throw HttpError.forbidden();
  const position = req.body.position || Date.now();
  const r2 = await db.query(
    `UPDATE tasks SET status_id=$1, position=$2, completed_at = CASE WHEN $1 IN (SELECT id FROM project_statuses WHERE category='done') THEN NOW() ELSE NULL END WHERE id=$3 RETURNING *`,
    [req.body.status_id, position, req.params.id]
  );
  const io = getIO();
  if (io) io.to(`project:${task.project_id}`).emit('task:moved', { id: req.params.id, status_id: req.body.status_id, position });
  return ok(res, r2.rows[0]);
}));

router.post('/:id/comments', [param('id').isUUID(), body('body').notEmpty()], validate, asyncHandler(async (req, res) => {
  const r = await db.query('SELECT project_id, organization_id, workspace_id FROM tasks WHERE id=$1', [req.params.id]);
  const task = r.rows[0];
  if (!task) throw HttpError.notFound();
  const p = await projectAccess(req.userId, task.project_id);
  if (!p) throw HttpError.forbidden();
  const c = await db.query(
    `INSERT INTO comments(task_id, project_id, author_id, body, mentions) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.id, task.project_id, req.userId, req.body.body, req.body.mentions || []]
  );
  const io = getIO();
  if (io) io.to(`project:${task.project_id}`).emit('comment:created', c.rows[0]);
  if (req.body.mentions?.length) {
    for (const uid of req.body.mentions) {
      await notifyCreate({ userId: uid, type: 'mention', title: 'You were mentioned', body: req.body.body.slice(0, 200), link: `/app/projects/${task.project_id}/tasks/${req.params.id}`, entityType: 'task', entityId: req.params.id, actorId: req.userId });
    }
  }
  return created(res, c.rows[0]);
}));

router.get('/:id/comments', asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT c.*, u.full_name AS author_name, u.avatar_url AS author_avatar
     FROM comments c LEFT JOIN users u ON u.id = c.author_id
     WHERE c.task_id=$1 ORDER BY c.created_at ASC`,
    [req.params.id]
  );
  return ok(res, r.rows);
}));

router.post('/:id/links', [param('id').isUUID(), body('target_id').isUUID(), body('relation').isIn(['blocks', 'blocked_by', 'relates_to', 'duplicates', 'duplicate_of'])], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO task_links(source_id, target_id, relation, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT (source_id, target_id, relation) DO NOTHING RETURNING *`,
    [req.params.id, req.body.target_id, req.body.relation, req.userId]
  );
  return created(res, r.rows[0] || { success: true });
}));

router.post('/:id/time', [param('id').isUUID(), body('duration_seconds').isInt(), body('description').optional()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `INSERT INTO time_entries(task_id, user_id, started_at, ended_at, duration_seconds, description)
     VALUES ($1, $2, NOW() - make_interval(secs => $3::int), NOW(), $3::int, $4) RETURNING *`,
    [req.params.id, req.userId, req.body.duration_seconds, req.body.description]
  );
  await db.query('UPDATE tasks SET spent_minutes = spent_minutes + $1 WHERE id=$2', [Math.round(req.body.duration_seconds / 60), req.params.id]);
  return created(res, r.rows[0]);
}));

router.get('/:id/time', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT * FROM time_entries WHERE task_id=$1 ORDER BY started_at DESC`, [req.params.id]);
  return ok(res, r.rows);
}));

router.post('/bulk', [body('ids').isArray(), body('op').isIn(['archive', 'delete', 'assign', 'move', 'priority', 'label'])], validate, asyncHandler(async (req, res) => {
  const { ids, op, value } = req.body;
  let sql = '';
  if (op === 'archive') sql = 'UPDATE tasks SET is_archived=true WHERE id = ANY($1)';
  else if (op === 'delete') sql = 'DELETE FROM tasks WHERE id = ANY($1)';
  else if (op === 'assign') sql = 'UPDATE tasks SET assignee_id=$2 WHERE id = ANY($1)';
  else if (op === 'move') sql = 'UPDATE tasks SET status_id=$2 WHERE id = ANY($1)';
  else if (op === 'priority') sql = 'UPDATE tasks SET priority=$2 WHERE id = ANY($1)';
  if (!sql) throw HttpError.badRequest('Invalid op');
  const params = [ids];
  if (['assign', 'move', 'priority'].includes(op)) params.push(value);
  const r = await db.query(sql, params);
  return ok(res, { count: r.rowCount });
}));

module.exports = router;
