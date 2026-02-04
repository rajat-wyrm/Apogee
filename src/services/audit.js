const db = require('../db/pool');

const record = async ({
  organizationId,
  actorId,
  action,
  entityType,
  entityId,
  ip,
  userAgent,
  diff,
  metadata = {},
}) => {
  try {
    await db.query(
      `INSERT INTO audit_logs(organization_id, actor_id, action, entity_type, entity_id, ip, user_agent, diff, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [organizationId, actorId, action, entityType, entityId, ip, userAgent, diff ? JSON.stringify(diff) : null, JSON.stringify(metadata)]
    );
  } catch (e) {
    console.error('[audit] failed to record', e.message);
  }
};

const list = async (organizationId, { page = 1, limit = 50, action, entityType, actorId }) => {
  const where = ['organization_id = $1'];
  const params = [organizationId];
  if (action) { params.push(action); where.push(`action = $${params.length}`); }
  if (entityType) { params.push(entityType); where.push(`entity_type = $${params.length}`); }
  if (actorId) { params.push(actorId); where.push(`actor_id = $${params.length}`); }
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const r = await db.query(
    `SELECT a.*, u.full_name AS actor_name, u.avatar_url AS actor_avatar
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const c = await db.query(
    `SELECT COUNT(*)::int AS total FROM audit_logs WHERE ${where.join(' AND ')}`,
    params.slice(0, params.length - 2)
  );
  return { rows: r.rows, total: c.rows[0].total };
};

module.exports = { record, list };
