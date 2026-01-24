const { Pool } = require('pg');
const config = require('../config');

const SCHEMA = process.env.DB_SCHEMA || 'apogee';

const pool = new Pool({
  connectionString: config.database.url,
  max: config.database.poolMax,
  idleTimeoutMillis: config.database.idleTimeout,
  connectionTimeoutMillis: 15000,
  statement_timeout: 30000,
  query_timeout: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: config.isProd || config.database.url.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client', err.message);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRetryable = (e) => {
  if (!e) return false;
  if (e.code === '57P03' || e.code === '08006' || e.code === '08001') return true;
  if (/connection terminated|ECONNRESET|ETIMEDOUT|terminating|Connection terminated|Server closed the connection|ENOTFOUND|ENETUNREACH/i.test(e.message)) return true;
  return false;
};

const withClient = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${SCHEMA}, public`);
    return await fn(client);
  } finally {
    client.release(true);
  }
};

const query = async (text, params) => {
  const start = Date.now();
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await withClient(async (client) => {
        return await client.query(text, params);
      });
      const ms = Date.now() - start;
      if (ms > 1000) console.warn(`[db] slow query (${ms}ms):`, text.slice(0, 80));
      return res;
    } catch (e) {
      lastErr = e;
      if (isRetryable(e) && attempt < 2) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
};

const tx = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${SCHEMA}, public`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release(true);
  }
};

const withTenant = async (orgId, fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${SCHEMA}, public`);
    await client.query(`SET LOCAL app.current_org = $1`, [orgId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release(true);
  }
};

const ensureSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
    await client.query(`SET search_path TO ${SCHEMA}, public`);
  } finally {
    client.release(true);
  }
};

const healthCheck = async () => {
  try {
    const r = await query('SELECT 1 AS ok');
    return r.rows[0]?.ok === 1;
  } catch {
    return false;
  }
};

const close = async () => {
  await pool.end();
};

const warmConnections = async (count = 2) => {
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(
      (async () => {
        try {
          const client = await pool.connect();
          await client.query(`SET search_path TO ${SCHEMA}, public`);
          client.release(true);
        } catch {}
      })()
    );
  }
  await Promise.all(promises);
};

const keepAlive = () => {
  setInterval(async () => {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release(true);
    } catch {}
  }, 20000);
};

module.exports = { pool, query, tx, withTenant, close, ensureSchema, healthCheck, warmConnections, keepAlive, SCHEMA };
