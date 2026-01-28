const { validationResult } = require('express-validator');
const { HttpError } = require('../utils/http');

const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(HttpError.unprocessable('Validation failed', errors.array()));
  }
  next();
};

const errorHandler = (err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[err]', err);
  }
  res.status(status).json({
    success: false,
    error: {
      message: err.message || 'Internal server error',
      code: err.code,
      details: err.details,
    },
  });
};

const notFound = (_req, _res, next) => next(HttpError.notFound('Route not found'));

const requestId = (req, _res, next) => {
  req.id = req.headers['x-request-id'] || require('crypto').randomUUID();
  next();
};

const corsHeaders = (req, res, next) => {
  const origin = req.headers.origin;
  const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key,X-Requested-With,X-Request-Id');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
};

const accessLog = (req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const ms = Date.now() - start;
    if (process.env.NODE_ENV !== 'test' && _res.statusCode >= 400) {
      console.warn(`[${_res.statusCode}] ${req.method} ${req.originalUrl} ${ms}ms`);
    }
  });
  next();
};

const cacheControl = (maxAge = 60) => (_req, res, next) => {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
  next();
};

const noCache = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

module.exports = { validate, errorHandler, notFound, requestId, corsHeaders, logger: accessLog, accessLog, cacheControl, noCache };
