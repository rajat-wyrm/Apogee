/* Ultimate E2E test — tests EVERY endpoint in EVERY module */
require('dotenv').config();
const http = require('http');

const BASE = 'http://localhost:5050';
const API = `${BASE}/api`;
let passed = 0, failed = 0;
const failures = [];
const stats = { byModule: {} };
const log = (m) => { process.stdout.write(m); if (process.stdout.flush) process.stdout.flush(); };
const colors = { green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, cyan: (s) => `\x1b[36m${s}\x1b[0m`, gray: (s) => `\x1b[90m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };
let _cookies = '';
const request = async (method, path, { body, token, headers = {}, timeout = 60000 } = {}) => {
  const fullPath = path.startsWith('http') ? new URL(path).pathname : `/api${path}`;
  const opts = { hostname: 'localhost', port: 5050, path: fullPath, method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(_cookies && !token ? { Cookie: _cookies } : {}), ...headers } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  if (opts.body) opts.headers['Content-Length'] = Buffer.byteLength(opts.body);
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = ''; res.on('data', (c) => (data += c));
      res.on('end', () => {
        const sc = res.headers['set-cookie']; if (sc) _cookies = sc.map((c) => c.split(';')[0]).join('; ');
        let parsed = data; const ct = res.headers['content-type'] || '';
        if (ct.includes('application/json')) try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error(`timeout ${timeout}ms`)));
    if (opts.body) req.write(opts.body);
    req.end();
  });
};

const test = async (module, name, fn) => {
  const t0 = Date.now();
  try { await fn(); passed++; stats.byModule[module] = stats.byModule[module] || { p: 0, f: 0 }; stats.byModule[module].p++; log(`  ${colors.green('✓')} ${name} ${colors.gray(`(${Date.now() - t0}ms)`)}\n`); }
  catch (e) { failed++; stats.byModule[module] = stats.byModule[module] || { p: 0, f: 0 }; stats.byModule[module].f++; failures.push({ module, name, error: e.message.slice(0, 200) }); log(`  ${colors.red('✗')} ${name} ${colors.gray(`(${Date.now() - t0}ms)`)}\n      ${colors.red('→ ' + e.message.slice(0, 150))}\n`); }
};

const expect = (a, e, l) => { if (a !== e) throw new Error(`${l || 'expected'}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`); };
const expectOk = (r, l) => { if (r.status < 200 || r.status >= 300) throw new Error(`${l || 'request'} ${r.status}: ${typeof r.body === 'string' ? r.body.slice(0, 200) : JSON.stringify(r.body).slice(0, 200)}`); if (r.body?.success === false) throw new Error(`${l || 'biz'}: ${r.body?.error?.message || ''}`); };
const section = (s) => log(`\n${colors.bold(colors.cyan('▶ ' + s))}\n`);

const state = {};

// ============ FULL E2E TEST ============
const run = async () => {
  log(colors.bold(colors.cyan('\n═══════════ APOGEE 5.0 — ULTIMATE E2E TEST ═══════════\n')));

  // Health
  section('System');
  await test('System', 'Health check', async () => { const r = await request('GET', '/health'); expectOk(r); expect(r.body.status, 'ok'); });
  await test('System', 'Version', async () => { const r = await request('GET', '/version'); expectOk(r); });

  // Auth
  section('Auth');
  const ts = Date.now();
  await test('Auth', 'Register', async () => { const r = await request('POST', '/auth/register', { body: { email: `e2e-${ts}@x.com`, password: 'E2EPass123!', full_name: 'E2E' } }); expectOk(r); Object.assign(state, r.body.data); });
  await test('Auth', 'Login', async () => { const r = await request('POST', '/auth/login', { body: { email: `e2e-${ts}@x.com`, password: 'E2EPass123!' } }); expectOk(r); state.access = r.body.data.access; });
  await test('Auth', 'Wrong password → 401', async () => { const r = await request('POST', '/auth/login', { body: { email: `e2e-${ts}@x.com`, password: 'wrong' } }); expect(r.status, 401); });
  await test('Auth', 'Me', async () => { const r = await request('GET', '/auth/me', { token: state.access }); expectOk(r); });
  await test('Auth', 'Update profile', async () => { const r = await request('PATCH', '/auth/me', { token: state.access, body: { full_name: 'E2E Updated' } }); expectOk(r); });
  await test('Auth', 'Forgot password', async () => { const r = await request('POST', '/auth/forgot-password', { body: { email: `e2e-${ts}@x.com` } }); expectOk(r); });
  await test('Auth', '2FA enable', async () => { const r = await request('POST', '/auth/2fa/enable', { token: state.access }); expectOk(r); });
  await test('Auth', 'Change password', async () => { const r = await request('POST', '/auth/change-password', { token: state.access, body: { current_password: 'E2EPass123!', new_password: 'NewE2EPass456!' } }); expectOk(r); });
  await test('Auth', 'Refresh token', async () => { const r = await request('POST', '/auth/refresh', { body: { refresh_token: state.refresh } }); expectOk(r); state.access = r.body.data.access; });
  await test('Auth', 'Google OAuth redirect', async () => { const r = await request('GET', '/oauth/google'); expect(r.status >= 200 && r.status < 400, true, `got ${r.status}`); });

  // Orgs
  section('Organizations');
  state.org = { id: state.organization.id };
  await test('Orgs', 'List', async () => { const r = await request('GET', '/organizations', { token: state.access }); expectOk(r); });
  await test('Orgs', 'Get', async () => { const r = await request('GET', `/organizations/${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Orgs', 'Update', async () => { const r = await request('PATCH', `/organizations/${state.org.id}`, { token: state.access, body: { description: 'E2E test' } }); expectOk(r); });
  await test('Orgs', 'List members', async () => { const r = await request('GET', `/organizations/${state.org.id}/members`, { token: state.access }); expectOk(r); });
  await test('Orgs', 'Usage stats', async () => { const r = await request('GET', `/organizations/${state.org.id}/usage`, { token: state.access }); expectOk(r); });
  await test('Orgs', 'List workspaces', async () => { const r = await request('GET', `/organizations/${state.org.id}/workspaces`, { token: state.access }); expectOk(r); });
  await test('Orgs', 'Audit logs', async () => { const r = await request('GET', `/organizations/${state.org.id}/audit-logs`, { token: state.access }); expectOk(r); });

  // Workspaces
  section('Workspaces');
  await test('Workspaces', 'List', async () => { const r = await request('GET', `/workspaces?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); state.ws = r.body.data[0]; });
  await test('Workspaces', 'Create', async () => { const r = await request('POST', '/workspaces', { token: state.access, body: { organization_id: state.org.id, name: 'E2E WS' } }); expectOk(r); state.ws2 = r.body.data; });
  await test('Workspaces', 'Get', async () => { const r = await request('GET', `/workspaces/${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Workspaces', 'Update', async () => { const r = await request('PATCH', `/workspaces/${state.ws2.id}`, { token: state.access, body: { color: '#f59e0b' } }); expectOk(r); });
  await test('Workspaces', 'List members', async () => { const r = await request('GET', `/workspaces/${state.ws.id}/members`, { token: state.access }); expectOk(r); });

  // Projects
  section('Projects');
  state.projects = [];
  await test('Projects', 'Create 3', async () => {
    for (const [n, c] of [['E2E-1', '#ec4899'], ['E2E-2', '#8b5cf6'], ['E2E-3', '#10b981']]) {
      const r = await request('POST', '/projects', { token: state.access, body: { workspace_id: state.ws.id, name: n, color: c } });
      expectOk(r); state.projects.push(r.body.data);
    }
  });
  await test('Projects', 'List', async () => { const r = await request('GET', `/projects?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 3, true); });
  await test('Projects', 'Get', async () => { const r = await request('GET', `/projects/${state.projects[0].id}`, { token: state.access }); expectOk(r); });
  await test('Projects', 'Update', async () => { const r = await request('PATCH', `/projects/${state.projects[0].id}`, { token: state.access, body: { description: 'E2E' } }); expectOk(r); });
  await test('Projects', 'Statuses', async () => { const r = await request('GET', `/projects/${state.projects[0].id}/statuses`, { token: state.access }); expectOk(r); state.statuses = r.body.data; });
  await test('Projects', 'Add status', async () => { const r = await request('POST', `/projects/${state.projects[0].id}/statuses`, { token: state.access, body: { name: 'Blocked', color: '#ef4444' } }); expectOk(r); });
  await test('Projects', 'List members', async () => { const r = await request('GET', `/projects/${state.projects[0].id}/members`, { token: state.access }); expectOk(r); });

  // Tasks
  section('Tasks');
  state.tasks = [];
  await test('Tasks', 'Create 20', async () => {
    for (let i = 0; i < 20; i++) {
      const r = await request('POST', '/tasks', { token: state.access, body: { project_id: state.projects[0].id, title: `E2E Task ${i + 1}`, priority: ['urgent', 'high', 'medium'][i % 3], assignee_id: state.user.id } });
      expectOk(r); state.tasks.push(r.body.data);
    }
  });
  await test('Tasks', 'List', async () => { const r = await request('GET', `/tasks?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Tasks', 'Get by id', async () => { const r = await request('GET', `/tasks/${state.tasks[0].id}`, { token: state.access }); expectOk(r); });
  await test('Tasks', 'Update', async () => { const r = await request('PATCH', `/tasks/${state.tasks[0].id}`, { token: state.access, body: { priority: 'urgent' } }); expectOk(r); });
  await test('Tasks', 'Move', async () => { const todo = state.statuses.find((s) => s.category === 'todo'); const r = await request('POST', `/tasks/${state.tasks[1].id}/move`, { token: state.access, body: { status_id: todo.id, position: 1 } }); expectOk(r); });
  await test('Tasks', 'Comment', async () => { const r = await request('POST', `/tasks/${state.tasks[0].id}/comments`, { token: state.access, body: { body: 'E2E comment' } }); expectOk(r); });
  await test('Tasks', 'List comments', async () => { const r = await request('GET', `/tasks/${state.tasks[0].id}/comments`, { token: state.access }); expectOk(r); });
  await test('Tasks', 'Time entry', async () => { const r = await request('POST', `/tasks/${state.tasks[0].id}/time`, { token: state.access, body: { duration_seconds: 3600 } }); expectOk(r); });
  await test('Tasks', 'Link', async () => { const r = await request('POST', `/tasks/${state.tasks[0].id}/links`, { token: state.access, body: { target_id: state.tasks[1].id, relation: 'blocks' } }); expectOk(r); });
  await test('Tasks', 'Bulk', async () => { const r = await request('POST', '/tasks/bulk', { token: state.access, body: { ids: [state.tasks[2].id, state.tasks[3].id], op: 'archive' } }); expectOk(r); });

  // Documents
  section('Documents');
  state.docs = [];
  await test('Documents', 'Create', async () => { const r = await request('POST', '/documents', { token: state.access, body: { workspace_id: state.ws.id, title: 'E2E Doc' } }); expectOk(r); state.docs.push(r.body.data); });
  await test('Documents', 'List', async () => { const r = await request('GET', `/documents?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Documents', 'Get', async () => { const r = await request('GET', `/documents/${state.docs[0].id}`, { token: state.access }); expectOk(r); });
  await test('Documents', 'Update', async () => { const r = await request('PATCH', `/documents/${state.docs[0].id}`, { token: state.access, body: { title: 'E2E Doc v2' } }); expectOk(r); });
  await test('Documents', 'AI improve', async () => { const r = await request('POST', `/documents/${state.docs[0].id}/ai/improve`, { token: state.access, body: {} }); expectOk(r); });
  await test('Documents', 'AI summarize', async () => { const r = await request('POST', `/documents/${state.docs[0].id}/ai/summarize`, { token: state.access }); expectOk(r); });
  await test('Documents', 'Comment', async () => { const r = await request('POST', `/documents/${state.docs[0].id}/comments`, { token: state.access, body: { body: 'E2E' } }); expectOk(r); });

  // Notifications
  section('Notifications');
  await test('Notifications', 'List', async () => { const r = await request('GET', '/notifications', { token: state.access }); expectOk(r); });
  await test('Notifications', 'Unread count', async () => { const r = await request('GET', '/notifications/unread-count', { token: state.access }); expectOk(r); });
  await test('Notifications', 'Mark all read', async () => { const r = await request('PUT', '/notifications/read-all', { token: state.access }); expectOk(r); });
  await test('Notifications', 'Create', async () => { const r = await request('POST', '/notifications', { token: state.access, body: { user_id: state.user.id, type: 'system', title: 'E2E', body: 'Test' } }); expectOk(r); });

  // Files
  section('Files');
  await test('Files', 'Signature', async () => { const r = await request('GET', `/files/signature?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Files', 'Upload', async () => {
    // Use proper multipart with filename for multer
    const fs = require('fs');
    const boundary = '----TestBoundary' + Date.now();
    const fileContent = 'E2E file content for upload test';
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="e2e.txt"\r\nContent-Type: text/plain\r\n\r\n${fileContent}\r\n--${boundary}\r\nContent-Disposition: form-data; name="organization_id"\r\n\r\n${state.org.id}\r\n--${boundary}--\r\n`;
    const r = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost', port: 5050, path: '/api/files/upload', method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(body),
          'Authorization': `Bearer ${state.access}`,
        },
      }, (res) => {
        let data = ''; res.on('data', (c) => data += c);
        res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: data }); } });
      });
      req.on('error', reject); req.write(body); req.end();
    });
    expectOk(r); state.file = r.body.data;
  });
  await test('Files', 'List', async () => { const r = await request('GET', `/files?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Files', 'Delete', async () => { if (state.file?.id) { const r = await request('DELETE', `/files/${state.file.id}?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); } });

  // Search
  section('Search');
  await test('Search', 'Tasks', async () => { const r = await request('GET', `/search?q=E2E&organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });

  // Analytics
  section('Analytics');
  for (const ep of ['overview', 'task-trends', 'productivity', 'priority-distribution', 'project-health', 'workload']) {
    await test('Analytics', ep, async () => { const r = await request('GET', `/analytics/${ep}?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  }

  // AI
  section('AI');
  await test('AI', 'Chat', async () => { const r = await request('POST', '/ai/chat', { token: state.access, body: { messages: [{ role: 'user', content: 'Hi' }], organization_id: state.org.id } }); expectOk(r); });
  await test('AI', 'Summarize', async () => { const r = await request('POST', '/ai/summarize', { token: state.access, body: { text: 'Apogee is great.' } }); expectOk(r); });
  await test('AI', 'Usage', async () => { const r = await request('GET', `/ai/usage?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });

  // Teams
  section('Teams');
  await test('Teams', 'Create', async () => { const r = await request('POST', '/teams', { token: state.access, body: { organization_id: state.org.id, name: 'E2E Team' } }); expectOk(r); state.team = r.body.data; });
  await test('Teams', 'List', async () => { const r = await request('GET', `/teams?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Teams', 'Get', async () => { const r = await request('GET', `/teams/${state.team.id}`, { token: state.access }); expectOk(r); });
  await test('Labels', 'Create', async () => { const r = await request('POST', '/teams/additional/labels', { token: state.access, body: { organization_id: state.org.id, name: 'e2e-label', color: '#ef4444' } }); expectOk(r); state.label = r.body.data; });
  await test('Labels', 'List', async () => { const r = await request('GET', `/teams/additional/labels?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Labels', 'Assign', async () => { const r = await request('POST', '/teams/additional/labels/assign', { token: state.access, body: { task_id: state.tasks[0].id, label_id: state.label.id } }); expectOk(r); });
  await test('Shares', 'Create', async () => { const r = await request('POST', '/teams/additional/shares', { token: state.access, body: { entity_type: 'task', entity_id: state.tasks[0].id } }); expectOk(r); });
  await test('Presence', 'Get', async () => { const r = await request('GET', `/teams/additional/presence?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });

  // Automations
  section('Automations');
  await test('Automations', 'Create', async () => { const r = await request('POST', '/automations', { token: state.access, body: { organization_id: state.org.id, name: 'E2E Auto', trigger: { type: 'task_created' }, actions: [{ type: 'send_notification' }] } }); expectOk(r); state.auto = r.body.data; });
  await test('Automations', 'List', async () => { const r = await request('GET', `/automations?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Automations', 'Update', async () => { const r = await request('PATCH', `/automations/${state.auto.id}`, { token: state.access, body: { enabled: false } }); expectOk(r); });
  await test('Automations', 'Run', async () => { const r = await request('POST', `/automations/${state.auto.id}/run`, { token: state.access }); expectOk(r); });

  // Goals
  section('Goals');
  await test('Goals', 'Create', async () => { const r = await request('POST', '/goals', { token: state.access, body: { organization_id: state.org.id, title: 'E2E Goal', target_value: 100 } }); expectOk(r); state.goal = r.body.data; });
  await test('Goals', 'List', async () => { const r = await request('GET', `/goals?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Goals', 'Get', async () => { const r = await request('GET', `/goals/${state.goal.id}`, { token: state.access }); expectOk(r); });
  await test('Goals', 'Add KR', async () => { const r = await request('POST', `/goals/${state.goal.id}/key-results`, { token: state.access, body: { title: 'E2E KR', target_value: 10 } }); expectOk(r); });

  // Calendar
  section('Calendar');
  await test('Calendar', 'Create', async () => { const r = await request('POST', '/calendar', { token: state.access, body: { organization_id: state.org.id, title: 'E2E Event', start_at: new Date().toISOString() } }); expectOk(r); state.evt = r.body.data; });
  await test('Calendar', 'List', async () => { const r = await request('GET', `/calendar?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Calendar', 'Agenda', async () => { const r = await request('GET', `/calendar/agenda?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });

  // Templates
  section('Templates');
  await test('Templates', 'Create', async () => { const r = await request('POST', '/templates', { token: state.access, body: { organization_id: state.org.id, type: 'project', name: 'E2E', payload: { title: 'P' } } }); expectOk(r); state.template = r.body.data; });
  await test('Templates', 'List', async () => { const r = await request('GET', `/templates?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Templates', 'Use', async () => { if (state.template?.id) { const r = await request('POST', `/templates/${state.template.id}/use`, { token: state.access }); expectOk(r); } });

  // Exports
  section('Exports');
  await test('Exports', 'Tasks CSV', async () => { const r = await request('GET', `/exports/tasks?organization_id=${state.org.id}`, { token: state.access }); expect(r.status, 200); expect(r.headers['content-type'].includes('text/csv'), true); });
  await test('Exports', 'Projects CSV', async () => { const r = await request('GET', `/exports/projects?organization_id=${state.org.id}`, { token: state.access }); expect(r.status, 200); });
  await test('Exports', 'JSON', async () => { const r = await request('GET', `/exports/json?organization_id=${state.org.id}`, { token: state.access }); expect(r.status, 200); });
  await test('Exports', 'PDF', async () => { const r = await request('POST', '/exports/pdf', { token: state.access, body: { organization_id: state.org.id, type: 'document', entity_id: state.docs[0].id, title: 'Test', content: '<h1>Test</h1>' } }); expect(r.status, 200); });

  // Helpdesk
  section('Helpdesk');
  await test('Helpdesk', 'Create', async () => { const r = await request('POST', '/helpdesk', { token: state.access, body: { organization_id: state.org.id, subject: 'E2E', description: 'Test', priority: 'high' } }); expectOk(r); state.tkt = r.body.data; });
  await test('Helpdesk', 'List', async () => { const r = await request('GET', `/helpdesk?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Helpdesk', 'Update', async () => { const r = await request('PATCH', `/helpdesk/${state.tkt.id}`, { token: state.access, body: { status: 'resolved' } }); expectOk(r); });

  // Wiki
  section('Wiki');
  await test('Wiki', 'Create space', async () => { const r = await request('POST', '/wiki/spaces', { token: state.access, body: { organization_id: state.org.id, name: 'E2E Wiki' } }); expectOk(r); state.wikiSpace = r.body.data; });
  await test('Wiki', 'List spaces', async () => { const r = await request('GET', `/wiki/spaces?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Wiki', 'Create page', async () => { const r = await request('POST', '/wiki/pages', { token: state.access, body: { wiki_space_id: state.wikiSpace.id, title: 'E2E Page' } }); expectOk(r); state.wikiPage = r.body.data; });
  await test('Wiki', 'Get page', async () => { const r = await request('GET', `/wiki/pages/${state.wikiPage.id}`, { token: state.access }); expectOk(r); });

  // Time
  section('Time');
  await test('Time', 'Start', async () => { const r = await request('POST', '/time/start', { token: state.access, body: { task_id: state.tasks[0].id } }); expectOk(r); state.tm = r.body.data; });
  await test('Time', 'Active', async () => { const r = await request('GET', '/time/active', { token: state.access }); expectOk(r); });
  await test('Time', 'Stop', async () => { const r = await request('POST', `/time/stop/${state.tm.id}`, { token: state.access }); expectOk(r); });
  await test('Time', 'Stats', async () => { const r = await request('GET', '/time/stats', { token: state.access }); expectOk(r); });
  await test('Time', 'List', async () => { const r = await request('GET', '/time', { token: state.access }); expectOk(r); });

  // Whiteboards
  section('Whiteboards');
  await test('Whiteboards', 'Create', async () => { const r = await request('POST', '/whiteboards', { token: state.access, body: { workspace_id: state.ws.id, title: 'E2E' } }); expectOk(r); state.wb = r.body.data; });
  await test('Whiteboards', 'List', async () => { const r = await request('GET', `/whiteboards?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Whiteboards', 'Update', async () => { const r = await request('PATCH', `/whiteboards/${state.wb.id}`, { token: state.access, body: { data: { shapes: [] } } }); expectOk(r); });

  // Forms
  section('Forms');
  await test('Forms', 'Create', async () => { const r = await request('POST', '/forms', { token: state.access, body: { organization_id: state.org.id, title: 'E2E', schema: { fields: [] } } }); expectOk(r); state.fm = r.body.data; });
  await test('Forms', 'List', async () => { const r = await request('GET', `/forms?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Forms', 'Submit', async () => { const r = await request('POST', `/forms/${state.fm.id}/submit`, { token: state.access, body: { rating: 5 } }); expectOk(r); });

  // Activity
  section('Activity');
  await test('Activity', 'Feed', async () => { const r = await request('GET', `/activity/feed?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Activity', 'Bookmark', async () => { const r = await request('POST', '/activity/bookmarks', { token: state.access, body: { entity_type: 'task', entity_id: state.tasks[0].id } }); expectOk(r); });
  await test('Activity', 'Saved view', async () => { const r = await request('POST', '/activity/saved-views', { token: state.access, body: { entity_type: 'task', name: 'E2E', query: {} } }); expectOk(r); });

  // Billing
  section('Billing');
  await test('Billing', 'Plans', async () => { const r = await request('GET', '/billing/plans', { token: state.access }); expectOk(r); });
  await test('Billing', 'Subscription', async () => { const r = await request('GET', `/billing/subscription?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Billing', 'Checkout', async () => { const r = await request('POST', '/billing/create-checkout', { token: state.access, body: { organization_id: state.org.id, plan: 'pro' } }); expectOk(r); });
  await test('Billing', 'Cancel', async () => { const r = await request('POST', '/billing/cancel', { token: state.access, body: { organization_id: state.org.id } }); expectOk(r); });
  await test('Billing', 'Invoices', async () => { const r = await request('GET', `/billing/invoices?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });

  // Admin
  section('Admin');
  await test('Admin', 'List users', async () => { const r = await request('GET', `/admin/users?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Admin', 'Audit logs', async () => { const r = await request('GET', `/admin/audit-logs?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Admin', 'Feature flags', async () => { const r = await request('GET', '/admin/feature-flags', { token: state.access }); expectOk(r); });
  await test('Admin', 'API keys', async () => { const r = await request('GET', `/admin/api-keys?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });

  // Webhooks
  section('Webhooks');
  await test('Webhooks', 'Create', async () => { const r = await request('POST', '/webhooks', { token: state.access, body: { organization_id: state.org.id, url: 'https://e2e.com/h', events: ['task.created'] } }); expectOk(r); state.wh = r.body.data; });
  await test('Webhooks', 'List', async () => { const r = await request('GET', `/webhooks?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });
  await test('Webhooks', 'Delete', async () => { const r = await request('DELETE', `/webhooks/${state.wh.id}?organization_id=${state.org.id}`, { token: state.access }); expectOk(r); });

  // Report
  const total = passed + failed;
  log('\n');
  log(colors.bold('═══════════ E2E RESULTS ═══════════\n'));
  log(`${colors.green('✓ Passed:')} ${passed}  ${colors.red('✗ Failed:')} ${failed}  ${colors.bold('Total:')} ${total}\n`);
  if (failures.length) {
    log('\n' + colors.bold(colors.red('Failures:\n')));
    for (const f of failures) log(`  ${colors.red('•')} ${colors.bold(f.module + ' › ' + f.name)}  ${colors.gray(f.error)}\n`);
  }
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => { console.error('Fatal:', e); process.exit(2); });
