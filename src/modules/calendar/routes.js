const express = require('express');
const { body } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const where = ['e.organization_id = $1'];
  const params = [orgId];
  if (req.query.start) { params.push(req.query.start); where.push(`e.end_at >= $${params.length}`); }
  if (req.query.end) { params.push(req.query.end); where.push(`e.start_at <= $${params.length}`); }
  const r = await db.query(`SELECT e.*, (SELECT COUNT(*)::int FROM unnest(e.attendees)) AS attendee_count FROM events e WHERE ${where.join(' AND ')} ORDER BY e.start_at ASC`, params);
  return ok(res, r.rows);
}));

router.post('/', [body('organization_id').isUUID(), body('title').notEmpty(), body('start_at').isISO8601()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(`INSERT INTO events(organization_id, workspace_id, title, description, start_at, end_at, all_day, timezone, location, color, type, recurrence, attendees, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [req.body.organization_id, req.body.workspace_id, req.body.title, req.body.description, req.body.start_at, req.body.end_at, req.body.all_day, req.body.timezone || 'UTC', req.body.location, req.body.color, req.body.type || 'event', req.body.recurrence ? JSON.stringify(req.body.recurrence) : null, req.body.attendees || [], req.userId]);
  return created(res, r.rows[0]);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const fields = ['title', 'description', 'start_at', 'end_at', 'all_day', 'location', 'color', 'type', 'recurrence', 'attendees'];
  const sets = []; const params = []; let i = 1;
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]); }
  if (!sets.length) throw HttpError.badRequest('Nothing to update');
  params.push(req.params.id);
  const r = await db.query(`UPDATE events SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, params);
  return ok(res, r.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM events WHERE id=$1', [req.params.id]);
  return ok(res, { success: true });
}));

router.get('/agenda', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const r = await db.query(`SELECT * FROM events WHERE organization_id=$1 AND start_at >= NOW() ORDER BY start_at ASC LIMIT 20`, [orgId]);
  return ok(res, r.rows);
}));

module.exports = router;
