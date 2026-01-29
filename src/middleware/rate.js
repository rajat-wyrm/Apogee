const rateLimit = require('express-rate-limit');
const config = require('../config');

// Only auth endpoints need rate limiting for a 600-user team.
// Global rate limiting is overkill - your users won't DDoS themselves.
// We only protect login/register from brute force attacks.

const rateLimitAuth = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: { message: 'Too many attempts. Please try again in a few minutes.' } },
  keyGenerator: (req) => `auth:${req.ip}:${(req.body?.email || '').toLowerCase()}`,
});

module.exports = { rateLimitAuth };
