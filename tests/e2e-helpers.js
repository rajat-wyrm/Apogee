/* Shared test utilities */
const http = require('http');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5050';
const API = `${BASE}/api`;

let passed = 0, failed = 0;
const failures = [];
const stats = { byModule: {} };
const log = (m) => { process.stdout.write(m); if (process.stdout.flush) process.stdout.flush(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`, cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const request = async (method, path, { body, token, headers = {}, timeout = 45000, retries = 4 } = {}) => {
  const fullPath = path.startsWith('http') ? new URL(path).pathname + new URL(path).search : `/api${path}`;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const opts = {
        hostname: 'localhost', port: 5050, path: fullPath, method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      };
      if (body !== undefined) opts.body = JSON.stringify(body);
      if (opts.body) opts.headers['Content-Length'] = Buffer.byteLength(opts.body);
      const result = await new Promise((resolve, reject) => {
        const req = http.request(opts, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            let parsed = data; const ct = res.headers['content-type'] || '';
            if (ct.includes('application/json')) try { parsed = JSON.parse(data); } catch {}
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          });
        });
        req.on('error', reject);
        req.setTimeout(timeout, () => req.destroy(new Error(`timeout after ${timeout}ms`)));
        if (opts.body) req.write(opts.body);
        req.end();
      });
      return result;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        // Wait for server to recover (Neon DB or connection-pool related)
        await sleep(1500 * (attempt + 1));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
};

const test = async (module, name, fn) => {
  const t0 = Date.now();
  try { await fn(); passed++; stats.byModule[module] = stats.byModule[module] || { passed: 0, failed: 0 }; stats.byModule[module].passed++; log(`  ${colors.green('✓')} ${name} ${colors.gray(`(${Date.now() - t0}ms)`)}\n`); }
  catch (e) { failed++; stats.byModule[module] = stats.byModule[module] || { passed: 0, failed: 0 }; stats.byModule[module].failed++; failures.push({ module, name, error: (e && e.message ? e.message : String(e)).slice(0, 300) }); log(`  ${colors.red('✗')} ${name} ${colors.gray(`(${Date.now() - t0}ms)`)}\n      ${colors.red('→ ' + ((e && e.message ? e.message : String(e)).slice(0, 200)))}\n`); }
};

const expect = (a, e, l) => { if (a !== e) throw new Error(`${l || 'expected'}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`); };
const expectOk = (r, l) => { if (r.status < 200 || r.status >= 300) throw new Error(`${l || 'request'} ${r.status}: ${typeof r.body === 'string' ? r.body.slice(0, 200) : JSON.stringify(r.body).slice(0, 200)}`); if (r.body?.success === false) throw new Error(`${l || 'request'} biz fail: ${r.body?.error?.message || ''}`); };
const section = (s) => log(`\n${colors.bold(colors.cyan('▶ ' + s))}\n`);

const report = (suiteName) => {
  const total = passed + failed;
  log('\n');
  log(colors.bold(`═══════════ ${suiteName} RESULTS ═══════════\n`));
  log(`${colors.green('✓ Passed:')} ${passed}  ${colors.red('✗ Failed:')} ${failed}  ${colors.bold('Total:')} ${total}\n\n`);
  log(colors.bold('By module:\n'));
  for (const [m, s] of Object.entries(stats.byModule)) {
    const c = s.failed > 0 ? colors.red : colors.green;
    log(`  ${c(m.padEnd(20))} ${colors.green(s.passed + '✓')} ${s.failed > 0 ? colors.red(s.failed + '✗') : ''}\n`);
  }
  if (failures.length) {
    log('\n' + colors.bold(colors.red('Failures:\n')));
    for (const f of failures) log(`  ${colors.red('•')} ${colors.bold(f.module + ' › ' + f.name)}  ${colors.gray(f.error)}\n`);
  }
  process.exit(failed > 0 ? 1 : 0);
};

const waitForServer = async (maxWaitMs = 30000) => {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const r = await request('GET', '/health', { timeout: 3000, retries: 0 });
      if (r.status === 200) return true;
    } catch (e) { /* keep trying */ }
    await sleep(500);
  }
  throw new Error(`server not reachable at ${BASE} after ${maxWaitMs}ms`);
};

module.exports = { BASE, API, request, test, expect, expectOk, section, sleep, log, colors, stats, passed, failed, failures, report, waitForServer };
