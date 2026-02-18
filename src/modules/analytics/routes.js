const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/overview', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM tasks WHERE organization_id=$1 AND is_archived=false) AS total_tasks,
       (SELECT COUNT(*)::int FROM tasks WHERE organization_id=$1 AND is_archived=false AND completed_at > NOW() - INTERVAL '7 days') AS completed_week,
       (SELECT COUNT(*)::int FROM tasks WHERE organization_id=$1 AND is_archived=false AND due_date < NOW() AND completed_at IS NULL) AS overdue,
       (SELECT COUNT(*)::int FROM projects WHERE organization_id=$1 AND archived_at IS NULL) AS active_projects,
       (SELECT COUNT(*)::int FROM memberships WHERE organization_id=$1 AND status='active') AS members,
       (SELECT COUNT(*)::int FROM documents WHERE organization_id=$1 AND is_archived=false) AS documents`,
    [orgId]
  );
  return ok(res, r.rows[0]);
}));

router.get('/task-trends', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(
    `SELECT DATE_TRUNC('day', completed_at) AS day, COUNT(*)::int AS count
     FROM tasks WHERE organization_id=$1 AND completed_at > NOW() - INTERVAL '30 days'
     GROUP BY day ORDER BY day`,
    [orgId]
  );
  return ok(res, r.rows);
}));

router.get('/productivity', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(
    `SELECT
       u.id, u.full_name, u.avatar_url,
       COUNT(t.id) FILTER (WHERE t.completed_at > NOW() - INTERVAL '7 days')::int AS completed,
       COUNT(t.id) FILTER (WHERE t.created_at > NOW() - INTERVAL '7 days')::int AS assigned
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN tasks t ON t.assignee_id = u.id AND t.organization_id = m.organization_id
     WHERE m.organization_id=$1
     GROUP BY u.id, u.full_name, u.avatar_url
     ORDER BY completed DESC LIMIT 20`,
    [orgId]
  );
  return ok(res, r.rows);
}));

router.get('/priority-distribution', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(
    `SELECT priority, COUNT(*)::int AS count FROM tasks
     WHERE organization_id=$1 AND is_archived=false AND completed_at IS NULL
     GROUP BY priority`,
    [orgId]
  );
  return ok(res, r.rows);
}));

router.get('/project-health', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(
    `SELECT p.id, p.name, p.color, p.icon,
       COUNT(t.id)::int AS total,
       COUNT(t.id) FILTER (WHERE t.completed_at IS NOT NULL)::int AS done,
       COUNT(t.id) FILTER (WHERE t.due_date < NOW() AND t.completed_at IS NULL)::int AS overdue
     FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.organization_id=$1 AND p.archived_at IS NULL
     GROUP BY p.id ORDER BY overdue DESC, total DESC`,
    [orgId]
  );
  return ok(res, r.rows);
}));

router.get('/workload', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(
    `SELECT u.id, u.full_name, u.avatar_url,
       COUNT(t.id) FILTER (WHERE t.completed_at IS NULL AND t.is_archived=false)::int AS open,
       SUM(t.estimate_minutes) FILTER (WHERE t.completed_at IS NULL AND t.is_archived=false)::int AS est_minutes
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN tasks t ON t.assignee_id = u.id AND t.organization_id = m.organization_id
     WHERE m.organization_id=$1
     GROUP BY u.id ORDER BY open DESC`,
    [orgId]
  );
  return ok(res, r.rows);
}));

module.exports = router;
