const express = require('express');
const { body } = require('express-validator');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError, paginated } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const notifications = require('../../services/notifications');
const { getIO } = require('../../sockets/io');

const router = express.Router();
router.use(authenticate());

router.get('/', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const result = await notifications.list(req.userId, { page, limit, unreadOnly: req.query.unread === 'true' });
  return paginated(res, result.rows, result.total, page, limit);
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  const c = await notifications.unreadCount(req.userId);
  return ok(res, { count: c });
}));

router.put('/:id/read', asyncHandler(async (req, res) => {
  const r = await notifications.markRead(req.userId, req.params.id);
  if (!r) throw HttpError.notFound();
  return ok(res, r);
}));

router.put('/read-all', asyncHandler(async (req, res) => {
  await notifications.markAllRead(req.userId);
  return ok(res, { success: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await db.query('DELETE FROM notifications WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
  return ok(res, { success: true });
}));

router.post('/', [body('user_id').isUUID(), body('type').notEmpty(), body('title').notEmpty()], validate, asyncHandler(async (req, res) => {
  const n = await notifications.create({
    userId: req.body.user_id, type: req.body.type, title: req.body.title,
    body: req.body.body, link: req.body.link, entityType: req.body.entity_type,
    entityId: req.body.entity_id, actorId: req.userId, data: req.body.data || {},
  });
  return created(res, n);
}));

module.exports = router;
