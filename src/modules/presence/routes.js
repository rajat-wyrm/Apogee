const express = require('express');
const db = require('../../db/pool');
const { asyncHandler, ok } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const r = await db.query(`SELECT u.id, u.full_name, u.avatar_url, p.status, p.last_seen_at, p.current_page FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN presence p ON p.user_id = u.id WHERE m.organization_id=$1`, [req.query.organization_id]);
  return ok(res, r.rows);
}));

module.exports = router;
