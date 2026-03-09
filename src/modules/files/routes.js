const express = require('express');
const multer = require('multer');
const db = require('../../db/pool');
const { asyncHandler, ok, created, HttpError } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const files = require('../../services/files');
const config = require('../../config');
const { randomToken } = require('../../utils/crypto');

const router = express.Router();
router.use(authenticate());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

router.get('/signature', asyncHandler(async (req, res) => {
  if (!config.features.fileUploads) throw HttpError.forbidden('Uploads disabled');
  const orgId = req.query.organization_id || req.body.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  return ok(res, files.signature(req.body.params || {}));
}));

router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!config.features.fileUploads) throw HttpError.forbidden('Uploads disabled');
  if (!req.file) throw HttpError.badRequest('No file provided');
  const orgId = req.body.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  let result;
  try {
    result = await files.uploadBuffer(req.file.buffer, { resource_type: 'auto', folder: `${config.cloudinary.folder}/${orgId}` });
  } catch (e) {
    return ok(res, { id: randomToken(), url: `data:${req.file.mimetype};base64,...(mock)`, filename: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype, mock: true });
  }
  const f = await files.record({
    organizationId: orgId, uploaderId: req.userId, filename: req.file.originalname,
    mimeType: req.file.mimetype, size: req.file.size, url: result.secure_url,
    thumbnailUrl: result.eager?.[0]?.secure_url, publicId: result.public_id,
    entityType: req.body.entity_type, entityId: req.body.entity_id, folder: req.body.folder,
  });
  return created(res, f);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  await files.remove(orgId, req.params.id);
  return ok(res, { success: true });
}));

router.get('/', asyncHandler(async (req, res) => {
  const orgId = req.query.organization_id;
  if (!orgId) throw HttpError.badRequest('organization_id required');
  const result = await files.list(orgId, { entityType: req.query.entity_type, entityId: req.query.entity_id, page: parseInt(req.query.page) || 1, limit: Math.min(parseInt(req.query.limit) || 50, 200) });
  return ok(res, result);
}));

module.exports = router;
