const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError, paginated } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(
    `SELECT t.*, p.name AS project_name, p.color AS project_color, u.full_name AS assignee_name, u.avatar_url AS assignee_avatar
     FROM tickets t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN users u ON u.id=t.assignee_id
     WHERE t.organization_id=$1 ORDER BY t.created_at DESC`,
    [orgId]
  );
  return ok(res, r.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const r = await db.query(`INSERT INTO tickets(organization_id, workspace_id, project_id, requester_id, assignee_id, subject, description, priority, source, tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [req.body.organization_id, req.body.workspace_id, req.body.project_id, req.userId, req.body.assignee_id, req.body.subject, req.body.description, req.body.priority || 'normal', req.body.source || 'web', req.body.tags || []]);
  return created(res, r.rows[0]);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['status', 'priority', 'assignee_id', 'subject', 'description', 'tags'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(req.body[f]); }
  if (req.body.status === 'resolved' && !req.body.resolved_at) { sets.push(`resolved_at = NOW()`); }
  if (req.body.status === 'closed' && !req.body.closed_at) { sets.push(`closed_at = NOW()`); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE tickets SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

module.exports = router;
