const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError, paginated } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const { slugify, randomToken } = require('../../utils/crypto');
const audit = require('../../services/audit').record;
const { getIO } = require('../../sockets/io');

const router = express.Router();
router.use(authenticate());

const ensureAccess = async (userId, projectId) => {
  const r = await db.query(
    `SELECT p.*, wm.user_id AS member FROM projects p
     LEFT JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = $1
     WHERE p.id = $2`,
    [userId, projectId]
  );
  if (!r.rows[0]) return null;
  if (!r.rows[0].member) return null;
  return r.rows[0];
};

router.get('/', asyncHandler(async (req, res) => {
  const workspaceId = req.query.workspace_id;
  if (!workspaceId) throw HttpError.badRequest('workspace_id required');
  const m = await db.query('SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2', [workspaceId, req.userId]);
  if (!m.rows[0]) throw HttpError.forbidden();
  const r = await db.query(
    `SELECT p.*,
       (SELECT COUNT(*)::int FROM tasks WHERE project_id=p.id AND is_archived=false) AS task_count,
       (SELECT COUNT(*)::int FROM tasks WHERE project_id=p.id AND is_archived=false AND status_id IN (SELECT id FROM project_statuses WHERE category IN ('done','completed'))) AS done_count
     FROM projects p
     WHERE p.workspace_id=$1 ${req.query.archived ? '' : 'AND p.archived_at IS NULL'}
     ORDER BY p.created_at DESC`,
    [workspaceId]
  );
  return ok(res, r.rows);
}));

router.post(
  '/',
  [
    body('workspace_id').isUUID(),
    body('name').trim().isLength({ min: 1, max: 200 }),
    body('description').optional(),
    body('color').optional(),
    body('icon').optional(),
    body('view_type').optional().isIn(['kanban', 'list', 'calendar', 'timeline', 'gantt']),
    body('visibility').optional().isIn(['workspace', 'private', 'public']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const m = await db.query('SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2', [req.body.workspace_id, req.userId]);
    if (!m.rows[0]) throw HttpError.forbidden();
    const w = await db.query('SELECT organization_id FROM workspaces WHERE id=$1', [req.body.workspace_id]);
    const r = await db.tx(async (c) => {
      const slug = (slugify(req.body.name) + '-' + randomToken(3).toLowerCase()).toLowerCase();
      const p = await c.query(
        `INSERT INTO projects(workspace_id, organization_id, name, slug, description, icon, color, view_type, visibility, owner_id, team_id, start_date, target_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [req.body.workspace_id, w.rows[0].organization_id, req.body.name, slug, req.body.description, req.body.icon, req.body.color || '#6366f1', req.body.view_type || 'kanban', req.body.visibility || 'workspace', req.userId, req.body.team_id, req.body.start_date, req.body.target_date]
      );
      await c.query(`INSERT INTO project_members(project_id, user_id, role) VALUES ($1,$2,'lead')`, [p.rows[0].id, req.userId]);
      const defaults = [
        ['Backlog', '#94a3b8', 'backlog', 0],
        ['To Do', '#3b82f6', 'todo', 1],
        ['In Progress', '#f59e0b', 'in_progress', 2],
        ['In Review', '#8b5cf6', 'review', 3],
        ['Done', '#10b981', 'done', 4],
      ];
      for (const [n, c2, cat, pos] of defaults) {
        await c.query(`INSERT INTO project_statuses(project_id, name, color, category, position, is_default) VALUES ($1,$2,$3,$4,$5,$6)`, [p.rows[0].id, n, c2, cat, pos, cat === 'todo']);
      }
      return p.rows[0];
    });
    audit({ organizationId: w.rows[0].organization_id, actorId: req.userId, action: 'project.created', entityType: 'project', entityId: r.id, ip: req.ip, userAgent: req.headers['user-agent'] });
    return created(res, r);
  })
);

router.get('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const p = await ensureAccess(req.userId, req.params.id);
  if (!p) throw HttpError.notFound('Project not found');
  const statuses = await db.query('SELECT * FROM project_statuses WHERE project_id=$1 ORDER BY position', [p.id]);
  const members = await db.query(`SELECT u.id, u.full_name, u.avatar_url, pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1`, [p.id]);
  return ok(res, { ...p, statuses: statuses.rows, members: members.rows });
}));

router.patch('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const p = await ensureAccess(req.userId, req.params.id);
  if (!p) throw HttpError.notFound();
  const fields = ['name', 'description', 'icon', 'color', 'status', 'visibility', 'view_type', 'start_date', 'target_date', 'progress', 'settings', 'team_id'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE projects SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  const io = getIO(); if (io) io.to(`project:${req.params.id}`).emit('project:updated', r.rows[0]);
  return ok(res, r.rows[0]);
}));

router.delete('/:id', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const p = await ensureAccess(req.userId, req.params.id);
  if (!p) throw HttpError.notFound();
  const member = await db.query("SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2", [req.params.id, req.userId]);
  if (!member.rows[0] || !['lead', 'contributor'].includes(member.rows[0].role)) throw HttpError.forbidden();
  await db.query('UPDATE projects SET archived_at=NOW() WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.get('/:id/tasks', [param('id').isUUID()], validate, asyncHandler(async (req, res) => {
  const p = await ensureAccess(req.userId, req.params.id);
  if (!p) throw HttpError.notFound();
  const where = ['t.project_id = $1', 't.is_archived = false'];
  const params = [req.params.id];
  if (req.query.status_id) { params.push(req.query.status_id); where.push(`t.status_id = $${params.length}`); }
  if (req.query.assignee_id) { params.push(req.query.assignee_id); where.push(`t.assignee_id = $${params.length}`); }
  if (req.query.priority) { params.push(req.query.priority); where.push(`t.priority = $${params.length}`); }
  if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`t.title ILIKE $${params.length}`); }
  const order = req.query.view === 'kanban' ? 't.position ASC, t.created_at DESC' : (req.query.order_by === 'due_date' ? 't.due_date ASC NULLS LAST' : 't.created_at DESC');
  const r = await db.query(
    `SELECT t.*, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar, s.name AS status_name, s.color AS status_color, s.category AS status_category
     FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN project_statuses s ON s.id = t.status_id
     WHERE ${where.join(' AND ')} ORDER BY ${order}`,
    params
  );
  return ok(res, r.rows);
}));

router.get('/:id/members', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT u.id, u.full_name, u.avatar_url, u.email, pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1`, [req.params.id]);
  return ok(res, r.rows);
}));

router.post('/:id/members', [param('id').isUUID(), body('user_id').isUUID(), body('role').optional().isIn(['lead', 'contributor', 'viewer'])], validate, asyncHandler(async (req, res) => {
  await db.query(`INSERT INTO project_members(project_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT (project_id, user_id) DO UPDATE SET role=EXCLUDED.role`, [req.params.id, req.body.user_id, req.body.role || 'contributor']);
  return created(res, { success: true });
}));

router.delete('/:id/members/:userId', [param('id').isUUID(), param('userId').isUUID()], validate, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, req.params.userId]);
  return ok(res, { success: true });
}));

router.get('/:id/statuses', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM project_statuses WHERE project_id=$1 ORDER BY position', [req.params.id]);
  return ok(res, r.rows);
}));

router.post('/:id/statuses', [body('name').notEmpty(), body('color').optional(), body('category').optional().isIn(['backlog','todo','in_progress','review','done','cancelled'])], validate, asyncHandler(async (req, res) => {
  const max = await db.query('SELECT COALESCE(MAX(position),0)+1 AS p FROM project_statuses WHERE project_id=$1', [req.params.id]);
  const r = await db.query(
    `INSERT INTO project_statuses(project_id, name, color, category, position) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.id, req.body.name, req.body.color || '#94a3b8', req.body.category || 'todo', max.rows[0].p]
  );
  return created(res, r.rows[0]);
}));

router.patch('/:id/statuses/:statusId', asyncHandler(async (req, res) => {
  const fields = ['name', 'color', 'category', 'position'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.statusId, req.params.id);
  const r = await db.query(`UPDATE project_statuses SET ${sets.join(', ')} WHERE id=$${i++} AND project_id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

router.delete('/:id/statuses/:statusId', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM project_statuses WHERE id=$1 AND project_id=$2', [req.params.statusId, req.params.id]);
  return ok(res, { success: true });
}));

module.exports = router;
