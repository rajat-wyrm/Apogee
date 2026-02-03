const cloudinary = require('cloudinary').v2;
const config = require('../config');
const db = require('../db/pool');
const crypto = require('crypto');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: config.cloudinary.secure,
});

const SIGNED_UPLOAD_FOLDER = config.cloudinary.folder;

const signature = (params = {}) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = { timestamp, folder: SIGNED_UPLOAD_FOLDER, ...params };
  const sorted = Object.keys(toSign).sort().map((k) => `${k}=${toSign[k]}`).join('&');
  const sig = crypto.createHash('sha1').update(sorted + config.cloudinary.apiSecret).digest('hex');
  return { timestamp, signature: sig, folder: SIGNED_UPLOAD_FOLDER, apiKey: config.cloudinary.apiKey, cloudName: config.cloudinary.cloudName };
};

const uploadBuffer = async (buffer, options = {}) => {
  if (!config.features.fileUploads) throw new Error('Uploads disabled');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: SIGNED_UPLOAD_FOLDER, resource_type: 'auto', ...options },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
};

const destroy = (publicId) => cloudinary.uploader.destroy(publicId);

const record = async ({ organizationId, uploaderId, filename, mimeType, size, url, thumbnailUrl, provider, publicId, entityType, entityId, folder }) => {
  const r = await db.query(
    `INSERT INTO files(organization_id, uploader_id, filename, mime_type, size_bytes, url, thumbnail_url, provider, provider_public_id, entity_type, entity_id, folder)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [organizationId, uploaderId, filename, mimeType, size, url, thumbnailUrl, provider || 'cloudinary', publicId, entityType, entityId, folder]
  );
  return r.rows[0];
};

const list = async (organizationId, { entityType, entityId, page = 1, limit = 50 }) => {
  const where = ['organization_id = $1'];
  const params = [organizationId];
  if (entityType) { params.push(entityType); where.push(`entity_type = $${params.length}`); }
  if (entityId) { params.push(entityId); where.push(`entity_id = $${params.length}`); }
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const r = await db.query(
    `SELECT * FROM files WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return r.rows;
};

const remove = async (organizationId, id) => {
  const r = await db.query('SELECT * FROM files WHERE id=$1 AND organization_id=$2', [id, organizationId]);
  if (r.rows[0]?.provider_public_id) {
    try { await destroy(r.rows[0].provider_public_id); } catch {}
  }
  await db.query('DELETE FROM files WHERE id=$1 AND organization_id=$2', [id, organizationId]);
  return { success: true };
};

module.exports = { cloudinary, signature, uploadBuffer, destroy, record, list, remove };
