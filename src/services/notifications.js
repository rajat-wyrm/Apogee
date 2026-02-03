const db = require('../db/pool');
const { getIO } = require('../sockets/io');

const create = async ({ userId, type, title, body, link, entityType, entityId, actorId, channel = 'inapp', icon, data = {} }) => {
  const r = await db.query(
    `INSERT INTO notifications(user_id, type, title, body, link, entity_type, entity_id, actor_id, channel, icon, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [userId, type, title, body, link, entityType, entityId, actorId, channel, icon, JSON.stringify(data)]
  );
  const notification = r.rows[0];
  try {
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notification);
      io.to(`user:${userId}`).emit('notify', { type, title, body, link });
    }
  } catch {}
  return notification;
};

const broadcast = async ({ organizationId, userIds, type, title, body, link, entityType, entityId, actorId, data }) => {
  const recipients = userIds && userIds.length ? userIds : (await db.query(
    'SELECT user_id FROM memberships WHERE organization_id=$1 AND status=$2',
    [organizationId, 'active']
  )).rows.map((r) => r.user_id);
  return Promise.all(
    recipients.map((uid) => create({ userId: uid, type, title, body, link, entityType, entityId, actorId, data }))
  );
};

const list = async (userId, { page = 1, limit = 30, unreadOnly = false }) => {
  const where = ['user_id = $1'];
  const params = [userId];
  if (unreadOnly) where.push('read_at IS NULL');
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const r = await db.query(
    `SELECT * FROM notifications WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const c = await db.query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread
     FROM notifications WHERE ${where.join(' AND ')}`,
    [userId, ...(unreadOnly ? [] : [])]
  );
  return { rows: r.rows, total: c.rows[0].total, unread: c.rows[0].unread };
};

const markRead = async (userId, id) => {
  const r = await db.query(
    'UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *',
    [id, userId]
  );
  return r.rows[0];
};

const markAllRead = async (userId) => {
  await db.query('UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL', [userId]);
  return { success: true };
};

const unreadCount = async (userId) => {
  const r = await db.query('SELECT COUNT(*)::int AS c FROM notifications WHERE user_id=$1 AND read_at IS NULL', [userId]);
  return r.rows[0].c;
};

module.exports = { create, broadcast, list, markRead, markAllRead, unreadCount };
