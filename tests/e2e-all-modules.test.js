/* Comprehensive E2E test - all modules */
require('dotenv').config();
const http = require('http');

const BASE = 'http://localhost:5050';
const API = `${BASE}/api`;
let passed = 0, failed = 0;
const failures = [];
const log = (m) => { process.stdout.write(m); if (process.stdout.flush) process.stdout.flush(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let _cookies = '';
const request = async (method, path, { body, token, headers = {}, timeout = 60000 } = {}) => {
  const opts = {
    hostname: 'localhost', port: 5050,
    path: path.startsWith('http') ? new URL(path).pathname : `/api${path}`,
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(_cookies && !token ? { Cookie: _cookies } : {}), ...headers },
  };
  if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Length'] = Buffer.byteLength(opts.body); }
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        if (sc) _cookies = sc.map((c) => c.split(';')[0]).join('; ');
        let parsed = data;
        if ((res.headers['content-type'] || '').includes('application/json')) try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    if (opts.body) req.write(opts.body);
    req.end();
  });
};

const test = async (mod, name, fn) => {
  try { await fn(); passed++; log(`  ✓ ${name}\n`); }
  catch (e) { failed++; failures.push(`${mod} › ${name}: ${e.message}`); log(`  ✗ ${name}: ${e.message}\n`); }
};

const expectOk = (r) => { if (r.status < 200 || r.status >= 300) throw new Error(`${r.status}: ${JSON.stringify(r.body).slice(0, 150)}`); if (r.body?.success === false) throw new Error(`biz: ${r.body?.error?.message}`); };
const expect = (a, e) => { if (a !== e) throw new Error(`expected ${e}, got ${a}`); };

const run = async () => {
  log('\n═══ COMPREHENSIVE E2E — ALL MODULES ═══\n');
  const ts = Date.now();

  // Setup
  log('Setup\n');
  const reg = await request('POST', '/auth/register', { body: { email: `e2eall+${ts}@x.com`, password: 'E2EAll123!', full_name: 'E2E All' } });
  expectOk(reg);
  const token = reg.body.data.access;
  const orgId = reg.body.data.organization.id;
  const wsId = reg.body.data.workspace.id;
  const userId = reg.body.data.user.id;

  // Create a project for tests that need it
  const proj = await request('POST', '/projects', { token, body: { workspace_id: wsId, name: 'E2E Project' } });
  expectOk(proj);
  const projId = proj.body.data.id;

  // System
  log('\nSystem\n');
  await test('System', 'Health', async () => { const r = await request('GET', '/health'); expectOk(r); expect(r.body.data?.db || r.body.db, 'up'); });
  await test('System', 'Version', async () => { const r = await request('GET', '/version'); expectOk(r); });

  // Auth
  log('\nAuth\n');
  await test('Auth', 'Me', async () => { const r = await request('GET', '/auth/me', { token }); expectOk(r); });
  await test('Auth', 'Me no token', async () => { _cookies = ''; const r = await request('GET', '/auth/me'); expect(r.status, 401); });

  // Organizations
  log('\nOrganizations\n');
  await test('Orgs', 'List', async () => { const r = await request('GET', '/organizations', { token }); expectOk(r); });
  await test('Orgs', 'Get', async () => { const r = await request('GET', `/organizations/${orgId}`, { token }); expectOk(r); });
  await test('Orgs', 'Members', async () => { const r = await request('GET', `/organizations/${orgId}/members`, { token }); expectOk(r); });
  await test('Orgs', 'Usage', async () => { const r = await request('GET', `/organizations/${orgId}/usage`, { token }); expectOk(r); });
  await test('Orgs', 'Workspaces', async () => { const r = await request('GET', `/organizations/${orgId}/workspaces`, { token }); expectOk(r); });

  // Workspaces
  log('\nWorkspaces\n');
  await test('WS', 'List', async () => { const r = await request('GET', `/workspaces?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('WS', 'Get', async () => { const r = await request('GET', `/workspaces/${wsId}`, { token }); expectOk(r); });
  await test('WS', 'Members', async () => { const r = await request('GET', `/workspaces/${wsId}/members`, { token }); expectOk(r); });

  // Projects
  log('\nProjects\n');
  await test('Projects', 'List', async () => { const r = await request('GET', `/projects?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('Projects', 'Get', async () => { const r = await request('GET', `/projects/${projId}`, { token }); expectOk(r); });
  await test('Projects', 'Members', async () => { const r = await request('GET', `/projects/${projId}/members`, { token }); expectOk(r); });

  // Tasks
  log('\nTasks\n');
  await test('Tasks', 'List', async () => { const r = await request('GET', `/tasks?workspace_id=${wsId}`, { token }); expectOk(r); });
  const task = await request('POST', '/tasks', { token, body: { project_id: projId, title: 'E2E Task' } });
  await test('Tasks', 'Create', async () => { expectOk(task); });
  if (task.body?.data?.id) {
    await test('Tasks', 'Get', async () => { const r = await request('GET', `/tasks/${task.body.data.id}`, { token }); expectOk(r); });
    await test('Tasks', 'Update', async () => { const r = await request('PATCH', `/tasks/${task.body.data.id}`, { token, body: { title: 'Updated' } }); expectOk(r); });
  }

  // Documents
  log('\nDocuments\n');
  await test('Documents', 'List', async () => { const r = await request('GET', `/documents?workspace_id=${wsId}`, { token }); expectOk(r); });

  // Notifications
  log('\nNotifications\n');
  await test('Notifications', 'List', async () => { const r = await request('GET', '/notifications', { token }); expectOk(r); });
  await test('Notifications', 'Unread count', async () => { const r = await request('GET', '/notifications/unread-count', { token }); expectOk(r); });

  // Search
  log('\nSearch\n');
  await test('Search', 'Global', async () => { const r = await request('GET', '/search?q=test', { token }); expectOk(r); });

  // Analytics
  log('\nAnalytics\n');
  await test('Analytics', 'Overview', async () => { const r = await request('GET', `/analytics/overview?organization_id=${orgId}`, { token }); expectOk(r); });

  // AI
  log('\nAI\n');
  await test('AI', 'Usage', async () => { const r = await request('GET', '/ai/usage', { token }); expectOk(r); });

  // Teams & Labels
  log('\nTeams\n');
  await test('Teams', 'List', async () => { const r = await request('GET', `/teams?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Labels', 'List', async () => { const r = await request('GET', `/labels?organization_id=${orgId}`, { token }); expectOk(r); });

  // Automations
  log('\nAutomations\n');
  await test('Automations', 'List', async () => { const r = await request('GET', `/automations?organization_id=${orgId}`, { token }); expectOk(r); });

  // Goals
  log('\nGoals\n');
  await test('Goals', 'List', async () => { const r = await request('GET', `/goals?organization_id=${orgId}`, { token }); expectOk(r); });

  // Calendar
  log('\nCalendar\n');
  await test('Calendar', 'List', async () => { const r = await request('GET', `/calendar?organization_id=${orgId}`, { token }); expectOk(r); });

  // Templates
  log('\nTemplates\n');
  await test('Templates', 'List', async () => { const r = await request('GET', `/templates?organization_id=${orgId}`, { token }); expectOk(r); });

  // Exports
  log('\nExports\n');
  await test('Exports', 'Tasks CSV', async () => { const r = await request('GET', `/exports/tasks?organization_id=${wsId}`, { token }); expectOk(r); });

  // Helpdesk
  log('\nHelpdesk\n');
  await test('Helpdesk', 'List', async () => { const r = await request('GET', `/helpdesk?organization_id=${orgId}`, { token }); expectOk(r); });

  // Wiki
  log('\nWiki\n');
  await test('Wiki', 'Spaces', async () => { const r = await request('GET', `/wiki/spaces?organization_id=${wsId}`, { token }); expectOk(r); });

  // Time
  log('\nTime\n');
  await test('Time', 'List', async () => { const r = await request('GET', `/time?organization_id=${orgId}`, { token }); expectOk(r); });

  // Whiteboards
  log('\nWhiteboards\n');
  await test('Whiteboards', 'List', async () => { const r = await request('GET', `/whiteboards?workspace_id=${wsId}`, { token }); expectOk(r); });

  // Forms
  log('\nForms\n');
  await test('Forms', 'List', async () => { const r = await request('GET', `/forms?workspace_id=${wsId}`, { token }); expectOk(r); });

  // Activity
  log('\nActivity\n');
  await test('Activity', 'Feed', async () => { const r = await request('GET', `/activity/feed?organization_id=${orgId}`, { token }); expectOk(r); });

  // Billing
  log('\nBilling\n');
  await test('Billing', 'Plans', async () => { const r = await request('GET', '/billing/plans', { token }); expectOk(r); });

  // Admin
  log('\nAdmin\n');
  await test('Admin', 'Users', async () => { const r = await request('GET', `/admin/users?organization_id=${orgId}`, { token }); expectOk(r); });

  // Webhooks
  log('\nWebhooks\n');
  await test('Webhooks', 'List', async () => { const r = await request('GET', `/webhooks?organization_id=${orgId}`, { token }); expectOk(r); });

  // Files
  log('\nFiles\n');
  await test('Files', 'List', async () => { const r = await request('GET', `/files?organization_id=${orgId}`, { token }); expectOk(r); });

  // Advanced features
  log('\nAdvanced Features\n');
  await test('Epics', 'List', async () => { const r = await request('GET', `/epics?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('Sprints', 'List', async () => { const r = await request('GET', `/sprints?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('Releases', 'List', async () => { const r = await request('GET', `/releases?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('Components', 'List', async () => { const r = await request('GET', `/components?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('CustomFields', 'List', async () => { const r = await request('GET', `/custom-fields?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('Workflows', 'List', async () => { const r = await request('GET', `/workflows?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('Approvals', 'List', async () => { const r = await request('GET', `/approvals?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('SLA', 'Policies', async () => { const r = await request('GET', `/sla/policies?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('Roadmap', 'List', async () => { const r = await request('GET', `/roadmap/items?workspace_id=${wsId}`, { token }); expectOk(r); });

  // Phase 2 features
  log('\nPhase 2 Features\n');
  await test('KB', 'Articles', async () => { const r = await request('GET', `/kb/articles?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('Queues', 'List', async () => { const r = await request('GET', `/queues?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('Canned', 'List', async () => { const r = await request('GET', `/canned?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('CSAT', 'List', async () => { const r = await request('GET', `/csat?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Assets', 'List', async () => { const r = await request('GET', `/assets?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Changes', 'List', async () => { const r = await request('GET', `/changes?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Incidents', 'List', async () => { const r = await request('GET', `/incidents?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Dashboards', 'List', async () => { const r = await request('GET', `/dashboards?workspace_id=${wsId}`, { token }); expectOk(r); });
  await test('Tags', 'List', async () => { const r = await request('GET', `/tags?workspace_id=${wsId}`, { token }); expectOk(r); });

  // Summary
  log(`\n═══ RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} ═══\n`);
  if (failed > 0) {
    log('\nFailures:\n');
    failures.forEach(f => log(`  ✗ ${f}\n`));
  }
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => { log(`\nFATAL: ${e.message}\n`); process.exit(1); });
