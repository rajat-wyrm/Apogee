const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

const hashPassword = async (password) => bcrypt.hash(password, SALT_ROUNDS);
const verifyPassword = async (password, hash) => bcrypt.compare(password, hash);

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const shortId = (len = 10) =>
  crypto
    .randomBytes(Math.ceil(len / 2))
    .toString('hex')
    .slice(0, len)
    .toUpperCase();

const slugify = (str) =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const pick = (obj, keys) => keys.reduce((acc, k) => (k in obj ? ((acc[k] = obj[k]), acc) : acc), {});
const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const safeJsonParse = (s, fallback = null) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

const tryCatch = async (fn, fallback = null) => {
  try { return await fn(); } catch { return fallback; }
};

const formatDate = (d) => new Date(d).toISOString();
const nowISO = () => new Date().toISOString();

module.exports = {
  hashPassword,
  verifyPassword,
  randomToken,
  hashToken,
  shortId,
  slugify,
  pick,
  omit,
  sleep,
  safeJsonParse,
  tryCatch,
  formatDate,
  nowISO,
};
