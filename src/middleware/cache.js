const cache = require('../services/cache');
const crypto = require('crypto');

const DEFAULT_TTL = 30;
const CACHEABLE_METHODS = new Set(['GET']);
const SKIP_PATHS = [
  /^\/api\/auth\//,
  /^\/api\/billing\//,
  /^\/api\/admin\//,
  /^\/api\/webhooks\//,
  /^\/api\/incoming-webhooks\//,
  /^\/api\/notifications/,
  /^\/api\/ai\//,
  /^\/api\/health/,
  /^\/api\/version/,
  /^\/api\/status/,
];

const shouldCache = (req) => {
  if (!CACHEABLE_METHODS.has(req.method)) return false;
  if (!req.userId) return false;
  for (const pattern of SKIP_PATHS) {
    if (pattern.test(req.path)) return false;
  }
  return true;
};

const getCacheKey = (req) => {
  const sig = crypto.createHash('sha256').update(`${req.userId}:${req.method}:${req.originalUrl}`).digest('hex').slice(0, 32);
  return ['http', req.userId, sig];
};

const cacheMiddleware = (ttlSeconds = DEFAULT_TTL) => async (req, res, next) => {
  if (!shouldCache(req)) return next();

  const key = getCacheKey(req);
  try {
    const cached = await cache.get(...key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `private, max-age=${ttlSeconds}`);
      return res.json(cached);
    }
  } catch {}

  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cache.set(...key, data).catch(() => {});
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', `private, max-age=${ttlSeconds}`);
    }
    return originalJson(data);
  };

  next();
};

const invalidateUser = async (userId) => {
  try {
    const pattern = `apogee:http:${userId}:*`;
    await cache.request(`/keys/${pattern}`, { method: 'POST' });
  } catch {}
};

module.exports = { cacheMiddleware, invalidateUser, shouldCache };
