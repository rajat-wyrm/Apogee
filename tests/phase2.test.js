/* Test for Apogee 3.5 — Phase 2 features (KB, Service Desk, Dashboards, etc.) */
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
const request = async (method, path, { body, token, headers = {}, timeout = 45000 } = {}) => {
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
const run = async () => {
  log(colors.bold(colors.cyan('\n═══════════ APOGEE 3.5 — PHASE 2 TESTS ═══════════\n')));

  // Setup
  section('Setup');
  const ts = Date.now();
  await test('Setup', 'Register', async () => {
    const r = await request('POST', '/auth/register', { body: { email: `p2-${ts}@x.com`, password: 'P2Pass12345!', full_name: 'P2' } });
    expectOk(r); Object.assign(state, r.body.data);
  });
  await test('Setup', 'Get workspace', async () => {
    const r = await request('GET', `/workspaces?organization_id=${state.organization.id}`, { token: state.access });
    expectOk(r); state.ws = r.body.data[0];
  });
  await test('Setup', 'Create project', async () => {
    const r = await request('POST', '/projects', { token: state.access, body: { workspace_id: state.ws.id, name: 'P2' } });
    expectOk(r); state.proj = r.body.data;
  });

  // Knowledge Base
  section('Knowledge Base (Notion-style)');
  await test('KB', 'Create category', async () => { const r = await request('POST', '/kb/categories', { token: state.access, body: { workspace_id: state.ws.id, name: 'Getting Started' } }); expectOk(r); state.kbCat = r.body.data; });
  await test('KB', 'List categories', async () => { const r = await request('GET', `/kb/categories?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 1, true); });
  await test('KB', 'Create article', async () => { const r = await request('POST', '/kb/articles', { token: state.access, body: { workspace_id: state.ws.id, category_id: state.kbCat.id, title: 'How to get started', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Welcome to Apogee!' }] }] }, content_text: 'Welcome to Apogee!', status: 'published' } }); expectOk(r); state.kbArticle = r.body.data; });
  await test('KB', 'List articles', async () => { const r = await request('GET', `/kb/articles?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 1, true); });
  await test('KB', 'Get article', async () => { const r = await request('GET', `/kb/articles/${state.kbArticle.id}`, { token: state.access }); expectOk(r); });
  await test('KB', 'Helpful vote', async () => { const r = await request('POST', `/kb/articles/${state.kbArticle.id}/helpful`, { token: state.access, body: { helpful: true } }); expectOk(r); });

  // Service Queues
  section('Service Queues (Jira Service Management)');
  await test('Queues', 'Create', async () => { const r = await request('POST', '/queues', { token: state.access, body: { workspace_id: state.ws.id, name: 'Support', is_public: true, greeting: 'Welcome to support!' } }); expectOk(r); state.queue = r.body.data; });
  await test('Queues', 'List', async () => { const r = await request('GET', `/queues?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 1, true); });
  await test('Queues', 'Update', async () => { const r = await request('PATCH', `/queues/${state.queue.id}`, { token: state.access, body: { auto_assign: true } }); expectOk(r); });

  // Canned Responses
  section('Canned Responses');
  await test('Canned', 'Create', async () => { const r = await request('POST', '/canned', { token: state.access, body: { workspace_id: state.ws.id, title: 'Greeting', content: 'Hi! How can I help?' } }); expectOk(r); state.canned = r.body.data; });
  await test('Canned', 'List', async () => { const r = await request('GET', `/canned?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Canned', 'Use', async () => { const r = await request('POST', `/canned/${state.canned.id}/use`, { token: state.access }); expectOk(r); });

  // CSAT
  section('CSAT (Customer Satisfaction)');
  await test('CSAT', 'Send survey', async () => { const r = await request('POST', '/csat/send', { token: state.access, body: { organization_id: state.organization.id, ticket_id: state.proj.id, customer_email: 'customer@x.com', customer_name: 'Customer' } }); expectOk(r); state.csat = r.body.data; });
  await test('CSAT', 'Stats', async () => { const r = await request('GET', `/csat/stats?organization_id=${state.organization.id}`, { token: state.access }); expectOk(r); });
  await test('CSAT', 'List', async () => { const r = await request('GET', `/csat?organization_id=${state.organization.id}`, { token: state.access }); expectOk(r); });

  // Assets / CMDB
  section('Assets (CMDB)');
  await test('Assets', 'Create', async () => { const r = await request('POST', '/assets', { token: state.access, body: { workspace_id: state.ws.id, name: 'MacBook Pro 16', type: 'hardware', manufacturer: 'Apple', model: 'MBP16', serial_number: 'ABC123' } }); expectOk(r); state.asset = r.body.data; });
  await test('Assets', 'List', async () => { const r = await request('GET', `/assets?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 1, true); });
  await test('Assets', 'Update', async () => { const r = await request('PATCH', `/assets/${state.asset.id}`, { token: state.access, body: { status: 'deployed' } }); expectOk(r); });
  await test('Assets', 'Filter by type', async () => { const r = await request('GET', `/assets?workspace_id=${state.ws.id}&type=hardware`, { token: state.access }); expectOk(r); expect(r.body.data.every(a => a.type === 'hardware'), true); });

  // Changes (Change Management)
  section('Change Management');
  await test('Changes', 'Create', async () => { const r = await request('POST', '/changes', { token: state.access, body: { workspace_id: state.ws.id, title: 'Deploy v2.0', type: 'standard', risk: 'medium', change_plan: '1. Deploy 2. Test', rollback_plan: 'Revert' } }); expectOk(r); state.change = r.body.data; });
  await test('Changes', 'List', async () => { const r = await request('GET', `/changes?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Changes', 'Approve', async () => { const r = await request('PATCH', `/changes/${state.change.id}`, { token: state.access, body: { status: 'approved' } }); expectOk(r); });

  // Incidents
  section('Incidents');
  await test('Incidents', 'Create', async () => { const r = await request('POST', '/incidents', { token: state.access, body: { workspace_id: state.ws.id, title: 'API outage', severity: 'critical', category: 'outage', affected_services: ['api', 'web'] } }); expectOk(r); state.incident = r.body.data; });
  await test('Incidents', 'List', async () => { const r = await request('GET', `/incidents?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Incidents', 'Resolve', async () => { const r = await request('PATCH', `/incidents/${state.incident.id}`, { token: state.access, body: { status: 'resolved', resolved_at: new Date().toISOString() } }); expectOk(r); });

  // Dashboards
  section('Dashboards with Widgets');
  await test('Dashboards', 'Create', async () => { const r = await request('POST', '/dashboards', { token: state.access, body: { workspace_id: state.ws.id, name: 'Main Dashboard', layout: { rows: [[]] } } }); expectOk(r); state.dash = r.body.data; });
  await test('Dashboards', 'List', async () => { const r = await request('GET', `/dashboards?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Dashboards', 'Get with widgets', async () => { const r = await request('GET', `/dashboards/${state.dash.id}`, { token: state.access }); expectOk(r); });
  await test('Dashboards', 'Add KPI widget', async () => { const r = await request('POST', `/dashboards/${state.dash.id}/widgets`, { token: state.access, body: { type: 'kpi', title: 'Total Tasks', position: { x: 0, y: 0, w: 3, h: 2 }, config: { table: 'tasks', organization_id: state.organization.id } } }); expectOk(r); state.widget = r.body.data; });
  await test('Dashboards', 'Add chart widget', async () => { const r = await request('POST', `/dashboards/${state.dash.id}/widgets`, { token: state.access, body: { type: 'bar_chart', title: 'Tasks by Priority', position: { x: 3, y: 0, w: 6, h: 4 }, config: { table: 'tasks', organization_id: state.organization.id } } }); expectOk(r); });
  await test('Dashboards', 'Get widget data', async () => { const r = await request('GET', `/dashboards/${state.dash.id}/widgets/${state.widget.id}/data`, { token: state.access }); expectOk(r); expect(r.body.data.type, 'kpi'); });
  await test('Dashboards', 'Update widget', async () => { const r = await request('PATCH', `/dashboards/${state.dash.id}/widgets/${state.widget.id}`, { token: state.access, body: { title: 'Updated KPI' } }); expectOk(r); });
  await test('Dashboards', 'Update layout', async () => { const r = await request('PATCH', `/dashboards/${state.dash.id}`, { token: state.access, body: { layout: { rows: [[]] } } }); expectOk(r); });

  // Incoming Webhooks
  section('Incoming Webhooks');
  await test('Webhooks', 'Create', async () => { const r = await request('POST', '/incoming-webhooks', { token: state.access, body: { workspace_id: state.ws.id, name: 'GitHub', source: 'github', events: ['push', 'pull_request'] } }); expectOk(r); state.inWebhook = r.body.data; expect(state.inWebhook.token?.length > 0, true, 'has token'); });
  await test('Webhooks', 'List', async () => { const r = await request('GET', `/incoming-webhooks?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Webhooks', 'Delete', async () => { const r = await request('DELETE', `/incoming-webhooks/${state.inWebhook.id}`, { token: state.access }); expectOk(r); });

  // Tags
  section('Tags (Universal)');
  await test('Tags', 'Create', async () => { const r = await request('POST', '/tags', { token: state.access, body: { workspace_id: state.ws.id, name: 'urgent', color: '#ef4444' } }); expectOk(r); state.tag = r.body.data; });
  await test('Tags', 'List', async () => { const r = await request('GET', `/tags?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Tags', 'Assign', async () => { const task = await request('POST', '/tasks', { token: state.access, body: { project_id: state.proj.id, title: 'Tagged' } }); await request('POST', '/tags/assign', { token: state.access, body: { tag_id: state.tag.id, entity_type: 'task', entity_id: task.body.data.id } }); });

  // Approval Chains
  section('Approval Chains');
  await test('Approval Chains', 'Create', async () => { const r = await request('POST', '/approval-chains', { token: state.access, body: { workspace_id: state.ws.id, name: 'Release Approval', steps: [{ approver_id: state.user.id, required: true }], entity_type: 'release' } }); expectOk(r); });
  await test('Approval Chains', 'List', async () => { const r = await request('GET', `/approval-chains?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });

  // Export Jobs
  section('Export Jobs (Async)');
  await test('Export', 'Create job', async () => { const r = await request('POST', '/export-jobs', { token: state.access, body: { organization_id: state.organization.id, type: 'pdf', entity_type: 'tasks' } }); expectOk(r); state.exportJob = r.body.data; });
  await test('Export', 'List jobs', async () => { const r = await request('GET', `/export-jobs?organization_id=${state.organization.id}`, { token: state.access }); expectOk(r); });

  // SSO
  section('SAML SSO (Enterprise)');
  await test('SSO', 'Add config', async () => { const r = await request('POST', '/sso', { token: state.access, body: { organization_id: state.organization.id, provider: 'saml', metadata_url: 'https://idp.example.com/metadata', entity_id: 'apogee', sso_url: 'https://idp.example.com/sso', certificate: '-----BEGIN CERTIFICATE-----\nMIIT...-----END CERTIFICATE-----' } }); expectOk(r); state.sso = r.body.data; });
  await test('SSO', 'List', async () => { const r = await request('GET', `/sso?organization_id=${state.organization.id}`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 1, true); });

  // Page Analytics
  section('Page Analytics');
  await test('Analytics', 'Track view', async () => { const r = await request('POST', '/analytics/track', { token: state.access, body: { organization_id: state.organization.id, page_type: 'document', page_id: state.ws.id, event_type: 'view', duration_seconds: 30 } }); expectOk(r); });
  await test('Analytics', 'Page stats', async () => { const r = await request('GET', `/analytics/page/document/${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Analytics', 'Workspace stats', async () => { const r = await request('GET', `/analytics/workspace?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });

  // PDF Export
  section('PDF Export');
  await test('PDF', 'Export document', async () => { const r = await request('POST', '/exports/pdf', { token: state.access, body: { organization_id: state.organization.id, type: 'document', entity_id: state.ws.id, content: '<h2>Test</h2><p>Hello</p>', title: 'Test PDF' } }); expect(r.status, 200); expect(r.headers['content-type'].includes('text/html'), true); });

  // Public Service Portal (no auth)
  section('Public Service Portal (Customer-facing)');
  await test('Portal', 'List public queues', async () => { const r = await request('GET', `/portal/queues?organization_id=${state.organization.id}`); expectOk(r); expect(r.body.data.length >= 1, true); });
  await test('Portal', 'List KB categories', async () => { const r = await request('GET', `/portal/kb/categories?organization_id=${state.organization.id}`); expectOk(r); expect(r.body.data.length >= 1, true); });
  await test('Portal', 'List KB articles', async () => { const r = await request('GET', `/portal/kb/articles?organization_id=${state.organization.id}`); expectOk(r); expect(r.body.data.length >= 1, true); });
  await test('Portal', 'Get KB article', async () => { const r = await request('GET', `/portal/kb/articles/${state.kbArticle.id}`); expectOk(r); });
  await test('Portal', 'Submit ticket (public)', async () => { const r = await request('POST', '/portal/tickets', { body: { organization_id: state.organization.id, queue_id: state.queue.id, subject: 'Need help', customer_email: 'customer@x.com', customer_name: 'Cust', description: 'Help me' } }); expectOk(r); state.publicTicket = r.body.data; });
  await test('Portal', 'KB helpful vote (public)', async () => { const r = await request('POST', `/portal/kb/articles/${state.kbArticle.id}/helpful`, { body: { helpful: true } }); expectOk(r); });
  await test('Portal', 'AI suggest (public)', async () => { const r = await request('POST', '/portal/ai-suggest', { body: { organization_id: state.organization.id, description: 'Apogee getting started' } }); expectOk(r); });

  // CSAT public
  await test('Portal', 'CSAT submit (public)', async () => { const r = await request('POST', `/portal/csat/${state.csat.token}`, { body: { rating: 5, comment: 'Great!', nps_score: 9 } }); expectOk(r); });

  // Public sharing
  await test('Public Pages', 'Get public page', async () => { const r = await request('GET', '/public/test-token'); expect(r.status === 404 || r.status === 200, true); });

  // Report
  const total = passed + failed;
  log('\n');
  log(colors.bold('═══════════ PHASE 2 RESULTS ═══════════\n'));
  log(`${colors.green('✓ Passed:')} ${passed}  ${colors.red('✗ Failed:')} ${failed}  ${colors.bold('Total:')} ${total}\n\n`);
  log(colors.bold('By module:\n'));
  for (const [m, s] of Object.entries(stats.byModule)) {
    const c = s.f > 0 ? colors.red : colors.green;
    log(`  ${c(m.padEnd(18))} ${colors.green(s.p + '✓')} ${s.f > 0 ? colors.red(s.f + '✗') : ''}\n`);
  }
  if (failures.length) {
    log('\n' + colors.bold(colors.red('Failures:\n')));
    for (const f of failures) log(`  ${colors.red('•')} ${colors.bold(f.module + ' › ' + f.name)}  ${colors.gray(f.error)}\n`);
  }
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => { console.error('Fatal:', e); process.exit(2); });
