const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return ok(res, { tasks: [], projects: [], documents: [], users: [] });
  const wsId = req.query.workspace_id;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const pattern = `%${q}%`;

  const tasks = await db.query(
    `SELECT t.id, t.title, t.priority, p.name AS project_name, p.id AS project_id, p.color AS project_color
     FROM tasks t JOIN projects p ON p.id=t.project_id
     WHERE t.organization_id=$1 AND t.is_archived=false AND (t.title ILIKE $2 OR t.description ILIKE $2)
     ORDER BY t.updated_at DESC LIMIT $3`,
    [orgId, pattern, limit]
  );
  const projects = await db.query(
    `SELECT id, name, description, color, icon FROM projects
     WHERE organization_id=$1 AND archived_at IS NULL AND (name ILIKE $2 OR description ILIKE $2)
     ORDER BY updated_at DESC LIMIT $3`,
    [orgId, pattern, limit]
  );
  const documents = await db.query(
    `SELECT id, title, icon FROM documents
     WHERE organization_id=$1 AND is_archived=false AND (title ILIKE $2 OR content_text ILIKE $2)
     ORDER BY updated_at DESC LIMIT $3`,
    [orgId, pattern, limit]
  );
  const users = await db.query(
    `SELECT u.id, u.full_name, u.email, u.avatar_url FROM users u
     JOIN memberships m ON m.user_id=u.id
     WHERE m.organization_id=$1 AND (u.full_name ILIKE $2 OR u.email ILIKE $2)
     LIMIT $3`,
    [orgId, pattern, limit]
  );
  return ok(res, { tasks: tasks.rows, projects: projects.rows, documents: documents.rows, users: users.rows });
}));

module.exports = router;
