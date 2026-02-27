const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT t.*, u.full_name AS user_name, u.avatar_url AS user_avatar FROM time_entries t LEFT JOIN users u ON u.id = t.user_id WHERE t.user_id=$1 ORDER BY t.started_at DESC LIMIT 100`, [req.userId]);
  return ok(res, r.rows);
}));

router.post('/start', asyncHandler(async (req, res) => {
  const r = await db.query('INSERT INTO time_entries(task_id, user_id, started_at, description) VALUES ($1,$2,NOW(),$3) RETURNING *', [req.body.task_id, req.userId, req.body.description]);
  return created(res, r.rows[0]);
}));

router.post('/stop/:id', asyncHandler(async (req, res) => {
  const r = await db.query(`UPDATE time_entries SET ended_at=NOW(), duration_seconds=EXTRACT(EPOCH FROM (NOW()-started_at))::int WHERE id=$1 AND user_id=$2 RETURNING *`, [req.params.id, req.userId]);
  return ok(res, r.rows[0]);
}));

router.get('/active', asyncHandler(async (req, res) => {
  const r = await db.query('SELECT * FROM time_entries WHERE user_id=$1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1', [req.userId]);
  return ok(res, r.rows[0] || null);
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT
     COALESCE(SUM(duration_seconds),0)::int AS total_seconds,
     COUNT(*)::int AS entries,
     DATE_TRUNC('day', started_at) AS day
   FROM time_entries WHERE user_id=$1 AND started_at > NOW() - INTERVAL '7 days'
   GROUP BY day ORDER BY day`, [req.userId]);
  return ok(res, r.rows);
}));

module.exports = router;
