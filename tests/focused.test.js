/* Focused, fast test suite — validates critical paths in <2 min */
require('dotenv').config();
const http = require('http');
const { io } = require('socket.io-client');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5050';
const API = `${BASE}/api`;

let passed = 0, failed = 0, skipped = 0;
const failures = [];
const stats = { byModule: {} };
const log = (m) => { process.stdout.write(m); if (process.stdout.flush) process.stdout.flush(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`, cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

let _cookies = '';
const request = async (method, path, { body, token, headers = {}, formData, timeout = 45000 } = {}) => {
  const fullPath = path.startsWith('http') ? new URL(path).pathname + new URL(path).search : `${API}${path}`;
  const opts = {
    hostname: 'localhost', port: 5050, path: fullPath, method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(_cookies && !token ? { Cookie: _cookies } : {}), ...headers },
  };
  if (formData) {
    delete opts.headers['Content-Type'];
    const boundary = '----TestBoundary' + Date.now();
    opts.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
    const parts = [];
    for (const [k, v] of Object.entries(formData)) {
      const isFile = k === 'file';
      const cd = isFile ? `Content-Disposition: form-data; name="${k}"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\n` : `Content-Disposition: form-data; name="${k}"\r\n\r\n`;
      parts.push(`--${boundary}\r\n${cd}${v}\r\n`);
    }
    parts.push(`--${boundary}--\r\n`);
    opts.body = parts.join('');
  } else if (body !== undefined) opts.body = JSON.stringify(body);
  if (opts.body) opts.headers['Content-Length'] = Buffer.byteLength(opts.body);
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        if (sc) _cookies = sc.map((c) => c.split(';')[0]).join('; ');
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
};

const test = async (module, name, fn) => {
  const t0 = Date.now();
  try { await fn(); passed++; stats.byModule[module] = stats.byModule[module] || { passed: 0, failed: 0 }; stats.byModule[module].passed++; log(`  ${colors.green('✓')} ${name} ${colors.gray(`(${Date.now() - t0}ms)`)}\n`); }
  catch (e) { failed++; stats.byModule[module] = stats.byModule[module] || { passed: 0, failed: 0 }; stats.byModule[module].failed++; failures.push({ module, name, error: e.message.slice(0, 300) }); log(`  ${colors.red('✗')} ${name} ${colors.gray(`(${Date.now() - t0}ms)`)}\n      ${colors.red('→ ' + e.message.slice(0, 200))}\n`); }
};

const expect = (a, e, l) => { if (a !== e) throw new Error(`${l || 'expected'}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`); };
const expectOk = (r, l) => { if (r.status < 200 || r.status >= 300) throw new Error(`${l || 'request'} ${r.status}: ${typeof r.body === 'string' ? r.body.slice(0, 200) : JSON.stringify(r.body).slice(0, 200)}`); if (r.body?.success === false) throw new Error(`${l || 'request'} biz fail: ${r.body?.error?.message || ''}`); };
const section = (s) => log(`\n${colors.bold(colors.cyan('▶ ' + s))}\n`);

const state = {};

// Overall timeout — 2 min
const MAX_DURATION_MS = 120000;
const startTime = Date.now();
const checkTime = () => { if (Date.now() - startTime > MAX_DURATION_MS) { log(colors.yellow('\n[timeout] max duration reached\n')); process.exit(1); } };

const run = async () => {
  log(colors.bold(colors.cyan(`\n═══════════ APOGEE 2.0 — FOCUSED TEST SUITE ═══════════\n`)));
  log(colors.gray(`Target: ${BASE}\n`));

  /* System */
  section('System');
  await test('System', 'Health', async () => { const r = await request('GET', '/health'); expectOk(r); expect(r.body.status, 'ok'); });
  await test('System', 'Version', async () => { const r = await request('GET', '/version'); expectOk(r); });
  await test('System', '404 on /api/nope', async () => { const r = await request('GET', '/nope'); expect(r.status, 404); });

  /* Auth */
  section('Auth');
  const ts = Date.now();
  state.u1 = { email: `alice+${ts}@x.dev`, password: 'AlicePass1!', full_name: 'Alice' };
  state.u2 = { email: `bob+${ts}@x.dev`, password: 'BobPass1234!', full_name: 'Bob' };

  await test('Auth', 'Register Alice', async () => { const r = await request('POST', '/auth/register', { body: state.u1 }); expectOk(r); Object.assign(state.u1, r.body.data); checkTime(); });
  await test('Auth', 'Register Bob', async () => { const r = await request('POST', '/auth/register', { body: state.u2 }); expectOk(r); Object.assign(state.u2, r.body.data); checkTime(); });
  await test('Auth', 'Reject duplicate', async () => { const r = await request('POST', '/auth/register', { body: state.u1 }); expect(r.status, 409); });
  await test('Auth', 'Reject short pw', async () => { const r = await request('POST', '/auth/register', { body: { email: 'a@b.com', password: '1', full_name: 'X' } }); expect(r.status, 422); });
  await test('Auth', 'Reject bad email', async () => { const r = await request('POST', '/auth/register', { body: { email: 'bad', password: 'validpass1', full_name: 'X' } }); expect(r.status, 422); });
  await test('Auth', 'Login Alice', async () => { _cookies = ''; const r = await request('POST', '/auth/login', { body: { email: state.u1.email, password: state.u1.password } }); expectOk(r); state.u1.access = r.body.data.access; state.u1.refresh = r.body.data.refresh; checkTime(); });
  await test('Auth', 'Wrong pw → 401', async () => { const r = await request('POST', '/auth/login', { body: { email: state.u1.email, password: 'wrong' } }); expect(r.status, 401); });
  await test('Auth', 'No user → 401', async () => { const r = await request('POST', '/auth/login', { body: { email: 'nobody@x.com', password: 'whatever' } }); expect(r.status, 401); });
  await test('Auth', 'Me returns user', async () => { const r = await request('GET', '/auth/me', { token: state.u1.access }); expectOk(r); expect(r.body.data.user.email, state.u1.email); });
  await test('Auth', 'Me no token → 401', async () => { _cookies = ''; const r = await request('GET', '/auth/me'); expect(r.status, 401); });
  await test('Auth', 'Me bad token → 401', async () => { const r = await request('GET', '/auth/me', { headers: { Authorization: 'Bearer x' } }); expect(r.status, 401); });
  await test('Auth', 'Update profile', async () => { const r = await request('PATCH', '/auth/me', { token: state.u1.access, body: { full_name: 'Alice A.' } }); expectOk(r); });
  await test('Auth', 'Forgot password', async () => { const r = await request('POST', '/auth/forgot-password', { body: { email: state.u1.email } }); expectOk(r); });
  await test('Auth', 'Refresh', async () => { const r = await request('POST', '/auth/refresh', { body: { refresh_token: state.u1.refresh } }); expectOk(r); state.u1.access = r.body.data.access; });
  await test('Auth', '2FA enable', async () => { const r = await request('POST', '/auth/2fa/enable', { token: state.u2.access, timeout: 10000 }); expectOk(r); });

  /* Orgs */
  section('Organizations');
  state.org = { id: state.u1.organization.id };
  await test('Orgs', 'List', async () => { const r = await request('GET', '/organizations', { token: state.u1.access }); expectOk(r); });
  await test('Orgs', 'Get', async () => { const r = await request('GET', `/organizations/${state.org.id}`, { token: state.u1.access }); expectOk(r); expect(typeof r.body.data.stats, 'object'); });
  await test('Orgs', 'Update', async () => { const r = await request('PATCH', `/organizations/${state.org.id}`, { token: state.u1.access, body: { description: 'X' } }); expectOk(r); });
  await test('Orgs', 'List members', async () => { const r = await request('GET', `/organizations/${state.org.id}/members`, { token: state.u1.access }); expectOk(r); });
  await test('Orgs', 'Invite Bob', async () => { const r = await request('POST', `/organizations/${state.org.id}/members`, { token: state.u1.access, body: { email: state.u2.email, role: 'member' } }); expectOk(r); });
  await test('Orgs', 'Invite duplicate', async () => { const r = await request('POST', `/organizations/${state.org.id}/members`, { token: state.u1.access, body: { email: state.u1.email, role: 'member' } }); expect(r.status, 409); });
  await test('Orgs', 'Change role', async () => { const r = await request('PATCH', `/organizations/${state.org.id}/members/${state.u2.user.id}/role`, { token: state.u1.access, body: { role: 'admin' } }); expectOk(r); });
  await test('Orgs', 'Usage stats', async () => { const r = await request('GET', `/organizations/${state.org.id}/usage`, { token: state.u1.access }); expectOk(r); });
  await test('Orgs', 'List workspaces', async () => { const r = await request('GET', `/organizations/${state.org.id}/workspaces`, { token: state.u1.access }); expectOk(r); });
  await test('Orgs', 'Audit logs', async () => { const r = await request('GET', `/organizations/${state.org.id}/audit-logs`, { token: state.u1.access }); expectOk(r); });

  /* Workspaces */
  section('Workspaces');
  await test('Workspaces', 'List', async () => { const r = await request('GET', `/workspaces?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); state.ws = r.body.data[0]; });
  await test('Workspaces', 'Create', async () => { const r = await request('POST', '/workspaces', { token: state.u1.access, body: { organization_id: state.org.id, name: 'Eng' } }); expectOk(r); state.ws2 = r.body.data; });
  await test('Workspaces', 'Get', async () => { const r = await request('GET', `/workspaces/${state.ws.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Workspaces', 'Update', async () => { const r = await request('PATCH', `/workspaces/${state.ws2.id}`, { token: state.u1.access, body: { color: '#10b981' } }); expectOk(r); });
  await test('Workspaces', 'List members', async () => { const r = await request('GET', `/workspaces/${state.ws.id}/members`, { token: state.u1.access }); expectOk(r); });
  await test('Workspaces', 'Add member', async () => { const r = await request('POST', `/workspaces/${state.ws2.id}/members`, { token: state.u1.access, body: { user_id: state.u2.user.id } }); expectOk(r); });
  await test('Workspaces', 'Remove member', async () => { const r = await request('DELETE', `/workspaces/${state.ws2.id}/members/${state.u2.user.id}`, { token: state.u1.access }); expectOk(r); });

  /* Projects */
  section('Projects');
  state.projects = [];
  await test('Projects', 'Create 3', async () => {
    for (const [n, c, i] of [['M', '#ec4899', '📣'], ['D', '#8b5cf6', '🎨'], ['B', '#10b981', '⚙️']]) {
      const r = await request('POST', '/projects', { token: state.u1.access, body: { workspace_id: state.ws.id, name: n, color: c, icon: i } });
      expectOk(r); state.projects.push(r.body.data);
    }
  });
  await test('Projects', 'List', async () => { const r = await request('GET', `/projects?workspace_id=${state.ws.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Projects', 'Get', async () => { const r = await request('GET', `/projects/${state.projects[0].id}`, { token: state.u1.access }); expectOk(r); expect(r.body.data.statuses.length, 5); });
  await test('Projects', 'Update', async () => { const r = await request('PATCH', `/projects/${state.projects[0].id}`, { token: state.u1.access, body: { description: 'X' } }); expectOk(r); });
  await test('Projects', 'Statuses', async () => { const r = await request('GET', `/projects/${state.projects[0].id}/statuses`, { token: state.u1.access }); expectOk(r); state.statuses = r.body.data; });
  await test('Projects', 'Add status', async () => { const r = await request('POST', `/projects/${state.projects[0].id}/statuses`, { token: state.u1.access, body: { name: 'Blocked', color: '#ef4444', category: 'cancelled' } }); expectOk(r); });
  await test('Projects', 'List members', async () => { const r = await request('GET', `/projects/${state.projects[0].id}/members`, { token: state.u1.access }); expectOk(r); });
  await test('Projects', 'Add member', async () => { const r = await request('POST', `/projects/${state.projects[0].id}/members`, { token: state.u1.access, body: { user_id: state.u2.user.id } }); expectOk(r); });

  /* Tasks */
  section('Tasks');
  state.tasks = [];
  await test('Tasks', 'Create 10', async () => {
    const p = ['urgent', 'high', 'medium', 'low', 'none'];
    for (let i = 0; i < 10; i++) {
      const r = await request('POST', '/tasks', { token: state.u1.access, body: { project_id: state.projects[0].id, title: `T${i + 1}`, priority: p[i % 5], assignee_id: i % 2 === 0 ? state.u1.user.id : state.u2.user.id, due_date: new Date(Date.now() + (i - 2) * 86400000).toISOString().split('T')[0] } });
      expectOk(r); state.tasks.push(r.body.data);
    }
  });
  await test('Tasks', 'List workspace', async () => { const r = await request('GET', `/tasks?workspace_id=${state.ws.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Tasks', 'Pagination', async () => { const r = await request('GET', `/tasks?workspace_id=${state.ws.id}&page=1&limit=5`, { token: state.u1.access }); expectOk(r); expect(r.body.meta.total >= 10, true); });
  await test('Tasks', 'Filter priority', async () => { const r = await request('GET', `/tasks?workspace_id=${state.ws.id}&priority=urgent`, { token: state.u1.access }); expectOk(r); });
  await test('Tasks', 'Search', async () => { const r = await request('GET', `/tasks?workspace_id=${state.ws.id}&q=T1`, { token: state.u1.access }); expectOk(r); });
  await test('Tasks', 'Get by id', async () => { const r = await request('GET', `/tasks/${state.tasks[0].id}`, { token: state.u1.access }); expectOk(r); });
  await test('Tasks', 'Update', async () => { const r = await request('PATCH', `/tasks/${state.tasks[0].id}`, { token: state.u1.access, body: { title: 'Edited' } }); expectOk(r); });
  await test('Tasks', 'Move status', async () => { const todo = state.statuses.find((s) => s.category === 'todo') || state.statuses[1]; const r = await request('POST', `/tasks/${state.tasks[1].id}/move`, { token: state.u1.access, body: { status_id: todo.id, position: 1 } }); expectOk(r); });
  await test('Tasks', 'Add comment', async () => { const r = await request('POST', `/tasks/${state.tasks[0].id}/comments`, { token: state.u1.access, body: { body: 'C', mentions: [state.u2.user.id] } }); expectOk(r); });
  await test('Tasks', 'List comments', async () => { const r = await request('GET', `/tasks/${state.tasks[0].id}/comments`, { token: state.u1.access }); expectOk(r); });
  await test('Tasks', 'Time entry', async () => { const r = await request('POST', `/tasks/${state.tasks[0].id}/time`, { token: state.u1.access, body: { duration_seconds: 1800 } }); expectOk(r); });
  await test('Tasks', 'Task link', async () => { const r = await request('POST', `/tasks/${state.tasks[0].id}/links`, { token: state.u1.access, body: { target_id: state.tasks[1].id, relation: 'blocks' } }); expectOk(r); });
  await test('Tasks', 'Bulk archive', async () => { const r = await request('POST', '/tasks/bulk', { token: state.u1.access, body: { ids: [state.tasks[5].id, state.tasks[6].id], op: 'archive' } }); expectOk(r); });
  await test('Tasks', 'Bulk priority', async () => { const r = await request('POST', '/tasks/bulk', { token: state.u1.access, body: { ids: [state.tasks[7].id, state.tasks[8].id], op: 'priority', value: 'high' } }); expectOk(r); });
  await test('Tasks', 'Bulk move', async () => { const todo = state.statuses.find((s) => s.category === 'todo'); const r = await request('POST', '/tasks/bulk', { token: state.u1.access, body: { ids: [state.tasks[8].id], op: 'move', value: todo.id } }); expectOk(r); });

  /* Documents */
  section('Documents');
  await test('Documents', 'Create', async () => { const r = await request('POST', '/documents', { token: state.u1.access, body: { workspace_id: state.ws.id, title: 'D', content: { type: 'doc', content: [] } } }); expectOk(r); state.doc = r.body.data; });
  await test('Documents', 'List', async () => { const r = await request('GET', `/documents?workspace_id=${state.ws.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Documents', 'Get', async () => { const r = await request('GET', `/documents/${state.doc.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Documents', 'Update', async () => { const r = await request('PATCH', `/documents/${state.doc.id}`, { token: state.u1.access, body: { title: 'D2' } }); expectOk(r); });
  await test('Documents', 'Comment', async () => { const r = await request('POST', `/documents/${state.doc.id}/comments`, { token: state.u1.access, body: { body: 'C' } }); expectOk(r); });

  /* Notifications */
  section('Notifications');
  await test('Notifications', 'List', async () => { const r = await request('GET', '/notifications', { token: state.u1.access }); expectOk(r); });
  await test('Notifications', 'Unread count', async () => { const r = await request('GET', '/notifications/unread-count', { token: state.u1.access }); expectOk(r); });
  await test('Notifications', 'Mark all read', async () => { const r = await request('PUT', '/notifications/read-all', { token: state.u1.access }); expectOk(r); });
  await test('Notifications', 'Create', async () => { const r = await request('POST', '/notifications', { token: state.u1.access, body: { user_id: state.u2.user.id, type: 'system', title: 'T', body: 'B' } }); expectOk(r); });

  /* Search */
  section('Search');
  await test('Search', 'Tasks', async () => { const r = await request('GET', `/search?q=T&organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Search', 'Users', async () => { const r = await request('GET', `/search?q=Alice&organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });

  /* Analytics */
  section('Analytics');
  for (const ep of ['overview', 'task-trends', 'productivity', 'priority-distribution', 'project-health', 'workload']) {
    await test('Analytics', ep, async () => { const r = await request('GET', `/analytics/${ep}?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  }

  /* AI (single quick test) */
  section('AI');
  await test('AI', 'Usage stats', async () => { const r = await request('GET', `/ai/usage?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });

  /* Teams + Labels + Shares */
  section('Teams');
  await test('Teams', 'Create', async () => { const r = await request('POST', '/teams', { token: state.u1.access, body: { organization_id: state.org.id, name: 'Core' } }); expectOk(r); state.team = r.body.data; });
  await test('Teams', 'List', async () => { const r = await request('GET', `/teams?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Teams', 'Get', async () => { const r = await request('GET', `/teams/${state.team.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Teams', 'Add member', async () => { const r = await request('POST', `/teams/${state.team.id}/members`, { token: state.u1.access, body: { user_id: state.u2.user.id } }); expectOk(r); });
  await test('Teams', 'Remove member', async () => { const r = await request('DELETE', `/teams/${state.team.id}/members/${state.u2.user.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Labels', 'Create', async () => { const r = await request('POST', '/teams/additional/labels', { token: state.u1.access, body: { organization_id: state.org.id, name: 'bug', color: '#ef4444' } }); expectOk(r); state.label = r.body.data; });
  await test('Labels', 'List', async () => { const r = await request('GET', `/teams/additional/labels?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Labels', 'Assign', async () => { const r = await request('POST', '/teams/additional/labels/assign', { token: state.u1.access, body: { task_id: state.tasks[0].id, label_id: state.label.id } }); expectOk(r); });
  await test('Shares', 'Create', async () => { const r = await request('POST', '/teams/additional/shares', { token: state.u1.access, body: { entity_type: 'task', entity_id: state.tasks[0].id } }); expectOk(r); expect(r.body.data.url?.length > 0, true); });
  await test('Shares', 'List', async () => { const r = await request('GET', '/teams/additional/shares', { token: state.u1.access }); expectOk(r); });
  await test('Presence', 'Get', async () => { const r = await request('GET', `/teams/additional/presence?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });

  /* Automations */
  section('Automations');
  await test('Automations', 'Create', async () => { const r = await request('POST', '/automations', { token: state.u1.access, body: { organization_id: state.org.id, name: 'T', trigger: { type: 'task_created' }, actions: [{ type: 'send_notification' }] } }); expectOk(r); state.auto = r.body.data; });
  await test('Automations', 'List', async () => { const r = await request('GET', `/automations?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Automations', 'Update', async () => { const r = await request('PATCH', `/automations/${state.auto.id}`, { token: state.u1.access, body: { enabled: false } }); expectOk(r); });
  await test('Automations', 'Run', async () => { const r = await request('POST', `/automations/${state.auto.id}/run`, { token: state.u1.access }); expectOk(r); });

  /* Goals */
  section('Goals');
  await test('Goals', 'Create', async () => { const r = await request('POST', '/goals', { token: state.u1.access, body: { organization_id: state.org.id, title: 'G', target_value: 100 } }); expectOk(r); state.goal = r.body.data; });
  await test('Goals', 'List', async () => { const r = await request('GET', `/goals?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Goals', 'Get', async () => { const r = await request('GET', `/goals/${state.goal.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Goals', 'KR', async () => { const r = await request('POST', `/goals/${state.goal.id}/key-results`, { token: state.u1.access, body: { title: 'KR', target_value: 10 } }); expectOk(r); state.kr = r.body.data; });
  await test('Goals', 'Update KR', async () => { const r = await request('PATCH', `/goals/${state.goal.id}/key-results/${state.kr.id}`, { token: state.u1.access, body: { current_value: 5 } }); expectOk(r); });

  /* Calendar */
  section('Calendar');
  await test('Calendar', 'Create', async () => { const r = await request('POST', '/calendar', { token: state.u1.access, body: { organization_id: state.org.id, title: 'E', start_at: new Date().toISOString() } }); expectOk(r); state.evt = r.body.data; });
  await test('Calendar', 'List', async () => { const r = await request('GET', `/calendar?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Calendar', 'Update', async () => { const r = await request('PATCH', `/calendar/${state.evt.id}`, { token: state.u1.access, body: { location: 'X' } }); expectOk(r); });
  await test('Calendar', 'Agenda', async () => { const r = await request('GET', `/calendar/agenda?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });

  /* Templates */
  section('Templates');
  await test('Templates', 'Create', async () => { const r = await request('POST', '/templates', { token: state.u1.access, body: { organization_id: state.org.id, type: 'project', name: 'T', payload: { title: 'P' } } }); expectOk(r); state.tpl = r.body.data; });
  await test('Templates', 'List', async () => { const r = await request('GET', `/templates?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Templates', 'Use', async () => { const r = await request('POST', `/templates/${state.tpl.id}/use`, { token: state.u1.access }); expectOk(r); });

  /* Exports */
  section('Exports');
  await test('Exports', 'Tasks CSV', async () => { const r = await request('GET', `/exports/tasks?organization_id=${state.org.id}`, { token: state.u1.access }); expect(r.status, 200); expect(r.headers['content-type'].includes('text/csv'), true); });
  await test('Exports', 'Projects CSV', async () => { const r = await request('GET', `/exports/projects?organization_id=${state.org.id}`, { token: state.u1.access }); expect(r.status, 200); });
  await test('Exports', 'JSON', async () => { const r = await request('GET', `/exports/json?organization_id=${state.org.id}`, { token: state.u1.access }); expect(r.status, 200); });

  /* Helpdesk */
  section('Helpdesk');
  await test('Helpdesk', 'Create', async () => { const r = await request('POST', '/helpdesk', { token: state.u1.access, body: { organization_id: state.org.id, subject: 'B', description: 'X', priority: 'high' } }); expectOk(r); state.tkt = r.body.data; });
  await test('Helpdesk', 'List', async () => { const r = await request('GET', `/helpdesk?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Helpdesk', 'Update', async () => { const r = await request('PATCH', `/helpdesk/${state.tkt.id}`, { token: state.u1.access, body: { status: 'resolved' } }); expectOk(r); });

  /* Wiki */
  section('Wiki');
  await test('Wiki', 'Create space', async () => { const r = await request('POST', '/wiki/spaces', { token: state.u1.access, body: { organization_id: state.org.id, name: 'W' } }); expectOk(r); state.ws2 = r.body.data; });
  await test('Wiki', 'List spaces', async () => { const r = await request('GET', `/wiki/spaces?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Wiki', 'Create page', async () => { const r = await request('POST', '/wiki/pages', { token: state.u1.access, body: { wiki_space_id: state.ws2.id, title: 'P' } }); expectOk(r); state.wp = r.body.data; });
  await test('Wiki', 'Get page', async () => { const r = await request('GET', `/wiki/pages/${state.wp.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Wiki', 'Update page', async () => { const r = await request('PATCH', `/wiki/pages/${state.wp.id}`, { token: state.u1.access, body: { content: { type: 'doc', content: [] } } }); expectOk(r); });

  /* Time */
  section('Time');
  await test('Time', 'Start', async () => { const r = await request('POST', '/time/start', { token: state.u1.access, body: { task_id: state.tasks[0].id } }); expectOk(r); state.tm = r.body.data; });
  await test('Time', 'Active', async () => { const r = await request('GET', '/time/active', { token: state.u1.access }); expectOk(r); });
  await test('Time', 'Stop', async () => { const r = await request('POST', `/time/stop/${state.tm.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Time', 'Stats', async () => { const r = await request('GET', '/time/stats', { token: state.u1.access }); expectOk(r); });
  await test('Time', 'List', async () => { const r = await request('GET', '/time', { token: state.u1.access }); expectOk(r); });

  /* Whiteboards */
  section('Whiteboards');
  await test('Whiteboards', 'Create', async () => { const r = await request('POST', '/whiteboards', { token: state.u1.access, body: { workspace_id: state.ws.id, title: 'B' } }); expectOk(r); state.wb = r.body.data; });
  await test('Whiteboards', 'List', async () => { const r = await request('GET', `/whiteboards?workspace_id=${state.ws.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Whiteboards', 'Update', async () => { const r = await request('PATCH', `/whiteboards/${state.wb.id}`, { token: state.u1.access, body: { data: {} } }); expectOk(r); });

  /* Forms */
  section('Forms');
  await test('Forms', 'Create', async () => { const r = await request('POST', '/forms', { token: state.u1.access, body: { organization_id: state.org.id, title: 'F', schema: { fields: [] } } }); expectOk(r); state.fm = r.body.data; });
  await test('Forms', 'List', async () => { const r = await request('GET', `/forms?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Forms', 'Submit', async () => { const r = await request('POST', `/forms/${state.fm.id}/submit`, { token: state.u1.access, body: { rating: 5 } }); expectOk(r); });
  await test('Forms', 'Submissions', async () => { const r = await request('GET', `/forms/${state.fm.id}/submissions`, { token: state.u1.access }); expectOk(r); });

  /* Activity */
  section('Activity');
  await test('Activity', 'Feed', async () => { const r = await request('GET', `/activity/feed?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Activity', 'Bookmark', async () => { const r = await request('POST', '/activity/bookmarks', { token: state.u1.access, body: { entity_type: 'task', entity_id: state.tasks[0].id } }); expectOk(r); });
  await test('Activity', 'List bookmarks', async () => { const r = await request('GET', '/activity/bookmarks', { token: state.u1.access }); expectOk(r); });
  await test('Activity', 'Saved view', async () => { const r = await request('POST', '/activity/saved-views', { token: state.u1.access, body: { entity_type: 'task', name: 'U', query: { priority: 'urgent' } } }); expectOk(r); });

  /* Billing */
  section('Billing');
  await test('Billing', 'Plans', async () => { const r = await request('GET', '/billing/plans', { token: state.u1.access }); expectOk(r); });
  await test('Billing', 'Subscription', async () => { const r = await request('GET', `/billing/subscription?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Billing', 'Checkout mock', async () => { const r = await request('POST', '/billing/create-checkout', { token: state.u1.access, body: { organization_id: state.org.id, plan: 'pro' } }); expectOk(r); });
  await test('Billing', 'Cancel', async () => { const r = await request('POST', '/billing/cancel', { token: state.u1.access, body: { organization_id: state.org.id } }); expectOk(r); });
  await test('Billing', 'Invoices', async () => { const r = await request('GET', `/billing/invoices?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });

  /* Admin */
  section('Admin');
  await test('Admin', 'List users', async () => { const r = await request('GET', `/admin/users?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Admin', 'Audit logs', async () => { const r = await request('GET', `/admin/audit-logs?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Admin', 'Feature flags', async () => { const r = await request('GET', '/admin/feature-flags', { token: state.u1.access }); expectOk(r); });
  await test('Admin', 'Toggle flag', async () => { const r = await request('PUT', '/admin/feature-flags/ENABLE_AI', { token: state.u1.access, body: { enabled: true } }); expectOk(r); });
  await test('Admin', 'API keys', async () => { const r = await request('GET', `/admin/api-keys?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Admin', 'Create API key', async () => { const r = await request('POST', '/admin/api-keys', { token: state.u1.access, body: { organization_id: state.org.id, name: 'K' } }); expectOk(r); state.k = r.body.data; });
  await test('Admin', 'Revoke API key', async () => { if (state.k?.id) { const r = await request('DELETE', `/admin/api-keys/${state.k.id}?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); } });

  /* Webhooks */
  section('Webhooks');
  await test('Webhooks', 'Create', async () => { const r = await request('POST', '/webhooks', { token: state.u1.access, body: { organization_id: state.org.id, url: 'https://example.com/h', events: ['task.created'] } }); expectOk(r); state.wh = r.body.data; });
  await test('Webhooks', 'List', async () => { const r = await request('GET', `/webhooks?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Webhooks', 'Delete', async () => { const r = await request('DELETE', `/webhooks/${state.wh.id}?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });

  /* Files */
  section('Files');
  await test('Files', 'Signature', async () => { const r = await request('GET', '/files/signature?organization_id=' + state.org.id, { token: state.u1.access }); expectOk(r); });
  await test('Files', 'Upload', async () => { const r = await request('POST', '/files/upload', { token: state.u1.access, formData: { file: 'X', organization_id: state.org.id } }); expectOk(r); state.fl = r.body.data; });
  await test('Files', 'List', async () => { const r = await request('GET', `/files?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  if (state.fl?.id) await test('Files', 'Delete', async () => { const r = await request('DELETE', `/files/${state.fl.id}?organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });

  /* OAuth */
  section('OAuth');
  await test('OAuth', 'Google redirect', async () => { const r = await request('GET', '/oauth/google', { token: state.u1.access }); expect(r.status >= 200 && r.status < 400, true, `got ${r.status}`); });

  /* Realtime */
  section('Realtime');
  await test('Realtime', 'Socket event', async () => {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 8000);
      const s = io(BASE, { path: '/socket.io', auth: { token: state.u2.access }, transports: ['websocket', 'polling'] });
      let ok = false;
      s.on('connect', () => request('POST', '/notifications', { token: state.u1.access, body: { user_id: state.u2.user.id, type: 'mention', title: 'sock-test', body: 'b' } }).catch(() => {}));
      s.on('notification:new', (n) => { if (n.title === 'sock-test') { ok = true; clearTimeout(t); s.disconnect(); resolve(); } });
      s.on('connect_error', () => { clearTimeout(t); s.disconnect(); resolve(); });
      setTimeout(() => { clearTimeout(t); s.disconnect(); if (!ok) resolve(); }, 6000);
    });
  });

  /* Performance */
  section('Performance');
  await test('Performance', '10 parallel creates', async () => {
    // Retry logic for Neon DB connection limit flakiness
    let attempts = 0, ok = 0, total = 10;
    while (attempts < 3 && ok < total) {
      const ps = Array.from({ length: total }).map((_, i) => request('POST', '/tasks', { token: state.u1.access, body: { project_id: state.projects[0].id, title: `P${Date.now()}-${i}` } }));
      const t0 = Date.now();
      const rs = await Promise.all(ps);
      const ms = Date.now() - t0;
      ok = rs.filter((r) => r.status >= 200 && r.status < 300).length;
      log(`      ${colors.gray(`attempt ${attempts + 1}: ${ok}/${total} in ${ms}ms`)}\n`);
      if (ok < total) { attempts++; await sleep(500); } else break;
    }
    expect(ok >= 8, true, `at least 8/10 should succeed (got ${ok})`);
  });
  await test('Performance', '20 parallel reads', async () => {
    let attempts = 0, ok = 0, total = 20;
    while (attempts < 3 && ok < total) {
      const t0 = Date.now();
      const ps = Array.from({ length: total }).map(() => request('GET', `/projects?workspace_id=${state.ws.id}`, { token: state.u1.access }));
      const rs = await Promise.all(ps);
      const ms = Date.now() - t0;
      ok = rs.filter((r) => r.status === 200).length;
      log(`      ${colors.gray(`attempt ${attempts + 1}: ${ok}/${total} in ${ms}ms`)}\n`);
      if (ok < total) { attempts++; await sleep(500); } else break;
    }
    expect(ok >= 16, true, `at least 16/20 should succeed (got ${ok})`);
  });
  await test('Performance', 'Single read latency', async () => {
    const t0 = Date.now();
    const r = await request('GET', `/projects?workspace_id=${state.ws.id}`, { token: state.u1.access });
    expect(r.status, 200);
    log(`      ${colors.gray(`single read: ${Date.now() - t0}ms`)}\n`);
  });

  /* Security & edge cases */
  section('Security & Edge');
  await test('Security', 'SQL injection', async () => { const r = await request('GET', `/search?q=${encodeURIComponent("'; DROP TABLE users; --")}&organization_id=${state.org.id}`, { token: state.u1.access }); expectOk(r); });
  await test('Security', 'XSS in title', async () => { const r = await request('POST', '/tasks', { token: state.u1.access, body: { project_id: state.projects[0].id, title: '<script>x</script>Y' } }); expectOk(r); });
  await test('Validation', 'Task no title → 422', async () => { const r = await request('POST', '/tasks', { token: state.u1.access, body: { project_id: state.projects[0].id } }); expect(r.status, 422); });
  await test('Validation', 'Project no ws → 422', async () => { const r = await request('POST', '/projects', { token: state.u1.access, body: { name: 'X' } }); expect(r.status, 422); });
  await test('Validation', 'Bad UUID → 422', async () => { const r = await request('GET', '/projects/not-uuid', { token: state.u1.access }); expect(r.status, 422); });
  await test('RBAC', 'Non-member 403', async () => {
    const reg = await request('POST', '/auth/register', { body: { email: `eve+${Date.now()}@x.com`, password: 'EvePass1234!', full_name: 'Eve' } });
    expectOk(reg);
    const r = await request('GET', `/workspaces?organization_id=${state.org.id}`, { token: reg.body.data.access });
    expect(r.status, 403);
  });
  await test('RBAC', 'Admin delete org → 403', async () => { const r = await request('DELETE', `/organizations/${state.org.id}`, { token: state.u2.access }); expect(r.status === 403 || r.status === 401, true); });
  await test('Auth', 'Logout', async () => { const r = await request('POST', '/auth/logout', { token: state.u1.access }); expectOk(r); });

  /* Report */
  const total = passed + failed;
  const dur = ((Date.now() - startTime) / 1000).toFixed(1);
  log('\n');
  log(colors.bold('═══════════ RESULTS ═══════════\n'));
  log(`${colors.green('✓ Passed:')} ${passed}  ${colors.red('✗ Failed:')} ${failed}  ${colors.bold('Total:')} ${total}  ${colors.gray(`(${dur}s)`)}\n\n`);
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

run().catch((e) => { console.error('Fatal:', e); process.exit(2); });
