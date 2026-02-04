const jwt = require('jsonwebtoken');
const config = require('../config');
const { hashToken } = require('../utils/crypto');

const signAccess = (payload) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.accessExpires });

const signRefresh = (payload) =>
  jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpires });

const verifyAccess = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (e) {
    const { HttpError } = require('../utils/http');
    if (e.name === 'TokenExpiredError') throw HttpError.unauthorized('Access token expired');
    throw HttpError.unauthorized('Invalid access token');
  }
};

const verifyRefresh = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (e) {
    const { HttpError } = require('../utils/http');
    if (e.name === 'TokenExpiredError') throw HttpError.unauthorized('Refresh token expired');
    throw HttpError.unauthorized('Invalid refresh token');
  }
};

const generateTokens = async (user, db) => {
  const access = signAccess({ sub: user.id, email: user.email, name: user.full_name });
  const refresh = signRefresh({ sub: user.id, jti: hashToken(user.id + Date.now()) });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d
  if (db) {
    await db.query(
      `INSERT INTO refresh_tokens(user_id, token_hash, user_agent, ip, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [user.id, hashToken(refresh), null, null, expiresAt]
    );
  }
  return { access, refresh, refreshExpiresAt: expiresAt };
};

const setAuthCookies = (res, access, refresh) => {
  const isProd = config.isProd;
  res.cookie('access_token', access, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.cookie('refresh_token', refresh, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
};

module.exports = {
  signAccess,
  signRefresh,
  verifyAccess,
  verifyRefresh,
  generateTokens,
  setAuthCookies,
  clearAuthCookies,
};
