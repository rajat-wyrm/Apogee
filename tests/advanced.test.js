/* Test for Apogee 3.0 advanced features */
require('dotenv').config();
const http = require('http');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5050';
const API = `${BASE}/api`;
let passed = 0, failed = 0;
const failures = [];
const stats = { byModule: {} };
const log = (m) => { process.stdout.write(m); if (process.stdout.flush) process.stdout.flush(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const colors = { green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, cyan: (s) => `\x1b[36m${s}\x1b[0m`, gray: (s) => `\x1b[90m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };

let _cookies = '';
const request = async (method, path, { body, token, headers = {}, timeout = 45000 } = {}) => {
  const fullPath = path.startsWith('http') ? new URL(path).pathname : `/api${path}`;
  const opts = {
    hostname: 'localhost', port: 5050, path: fullPath, method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(_cookies && !token ? { Cookie: _cookies } : {}), ...headers },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
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
    req.setTimeout(timeout, () => req.destroy(new Error(`timeout ${timeout}ms`)));
    if (opts.body) req.write(opts.body);
    req.end();
  });
};

const test = async (module, name, fn) => {
  const t0 = Date.now();
  try { await fn(); passed++; stats.byModule[module] = stats.byModule[module] || { p: 0, f: 0 }; stats.byModule[module].p++; log(`  ${colors.green('✓')} ${name} ${colors.gray(`(${Date.now() - t0}ms)`)}\n`); }
  catch (e) { failed++; stats.byModule[module] = stats.byModule[module] || { p: 0, f: 0 }; stats.byModule[module].f++; failures.push({ module, name, error: e.message.slice(0, 200) }); log(`  ${colors.red('✗')} ${name} ${colors.gray(`(${Date.now() - t0}ms)`)}\n      ${colors.red('→ ' + e.message.slice(0, 200))}\n`); }
};

const expect = (a, e, l) => { if (a !== e) throw new Error(`${l || 'expected'}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`); };
const expectOk = (r, l) => { if (r.status < 200 || r.status >= 300) throw new Error(`${l || 'request'} ${r.status}: ${typeof r.body === 'string' ? r.body.slice(0, 200) : JSON.stringify(r.body).slice(0, 200)}`); if (r.body?.success === false) throw new Error(`${l || 'request'} biz: ${r.body?.error?.message || ''}`); };
const section = (s) => log(`\n${colors.bold(colors.cyan('▶ ' + s))}\n`);

const state = {};
const run = async () => {
  log(colors.bold(colors.cyan('\n═══════════ APOGEE 3.0 — ADVANCED FEATURES ═══════════\n')));

  // Setup
  section('Setup');
  const ts = Date.now();
  await test('Setup', 'Register user', async () => {
    const r = await request('POST', '/auth/register', { body: { email: `a3-${ts}@x.com`, password: 'A3Pass12345!', full_name: 'A3' } });
    expectOk(r); Object.assign(state, r.body.data);
  });
  await test('Setup', 'Get workspace', async () => {
    const r = await request('GET', `/workspaces?organization_id=${state.organization.id}`, { token: state.access });
    expectOk(r); state.ws = r.body.data[0];
  });
  await test('Setup', 'Create project', async () => {
    const r = await request('POST', '/projects', { token: state.access, body: { workspace_id: state.ws.id, name: 'P3' } });
    expectOk(r); state.proj = r.body.data;
  });

  // EPICS
  section('Epics (Notion + Jira hierarchy)');
  await test('Epics', 'Create', async () => { const r = await request('POST', '/epics', { token: state.access, body: { workspace_id: state.ws.id, name: 'Auth Epic', color: '#ff0000' } }); expectOk(r); state.epic = r.body.data; });
  await test('Epics', 'List', async () => { const r = await request('GET', `/epics?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 1, true); });
  await test('Epics', 'Get', async () => { const r = await request('GET', `/epics/${state.epic.id}`, { token: state.access }); expectOk(r); });
  await test('Epics', 'Update', async () => { const r = await request('PATCH', `/epics/${state.epic.id}`, { token: state.access, body: { status: 'in_progress', progress: 25 } }); expectOk(r); });
  await test('Epics', 'Delete', async () => { const r = await request('DELETE', `/epics/${state.epic.id}`, { token: state.access }); expectOk(r); });

  // RELEASES
  section('Releases (Jira versions)');
  await test('Releases', 'Create', async () => { const r = await request('POST', '/releases', { token: state.access, body: { workspace_id: state.ws.id, name: 'v1.0.0', version: '1.0.0', release_date: '2026-12-31' } }); expectOk(r); state.release = r.body.data; });
  await test('Releases', 'List', async () => { const r = await request('GET', `/releases?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Releases', 'Update', async () => { const r = await request('PATCH', `/releases/${state.release.id}`, { token: state.access, body: { status: 'released' } }); expectOk(r); });
  await test('Releases', 'Get tasks', async () => { const r = await request('GET', `/releases/${state.release.id}/tasks`, { token: state.access }); expectOk(r); });

  // SPRINTS
  section('Sprints (Jira agile)');
  await test('Sprints', 'Create', async () => { const r = await request('POST', '/sprints', { token: state.access, body: { project_id: state.proj.id, name: 'Sprint 1', start_date: '2026-01-01', end_date: '2026-01-14', capacity_hours: 80 } }); expectOk(r); state.sprint = r.body.data; });
  await test('Sprints', 'List', async () => { const r = await request('GET', `/sprints?project_id=${state.proj.id}`, { token: state.access }); expectOk(r); });
  await test('Sprints', 'Add task to sprint', async () => {
    const tr = await request('POST', '/tasks', { token: state.access, body: { project_id: state.proj.id, title: 'Sprint task', priority: 'high' } });
    expectOk(tr);
    const r = await request('POST', `/sprints/${state.sprint.id}/tasks`, { token: state.access, body: { task_id: tr.body.data.id } });
    expectOk(r);
    state.sprintTask = tr.body.data;
  });
  await test('Sprints', 'Get sprint tasks', async () => { const r = await request('GET', `/sprints/${state.sprint.id}/tasks`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 1, true); });
  await test('Sprints', 'Burndown chart', async () => { const r = await request('GET', `/sprints/${state.sprint.id}/burndown`, { token: state.access }); expectOk(r); expect(r.body.data.ideal.length > 0, true); expect(r.body.data.actual.length > 0, true); });
  await test('Sprints', 'Start sprint', async () => { const r = await request('PATCH', `/sprints/${state.sprint.id}`, { token: state.access, body: { status: 'active' } }); expectOk(r); });
  await test('Sprints', 'Capacity', async () => { const r = await request('POST', '/capacity', { token: state.access, body: { workspace_id: state.ws.id, user_id: state.user.id, sprint_id: state.sprint.id, hours: 20 } }); expectOk(r); });
  await test('Sprints', 'Remove task', async () => { const r = await request('DELETE', `/sprints/${state.sprint.id}/tasks/${state.sprintTask.id}`, { token: state.access }); expectOk(r); });

  // COMPONENTS
  section('Components (Jira)');
  await test('Components', 'Create', async () => { const r = await request('POST', '/components', { token: state.access, body: { project_id: state.proj.id, name: 'API', description: 'Backend' } }); expectOk(r); state.comp = r.body.data; });
  await test('Components', 'List', async () => { const r = await request('GET', `/components?project_id=${state.proj.id}`, { token: state.access }); expectOk(r); });

  // WORKFLOWS
  section('Workflows (Custom status flows)');
  let wfId;
  await test('Workflows', 'Create', async () => { const r = await request('POST', '/workflows', { token: state.access, body: { workspace_id: state.ws.id, name: 'Dev Workflow', entity_type: 'task' } }); expectOk(r); wfId = r.body.data.id; });
  await test('Workflows', 'Add status', async () => { const r = await request('POST', `/workflows/${wfId}/statuses`, { token: state.access, body: { name: 'Code Review', category: 'review', color: '#8b5cf6' } }); expectOk(r); state.wfStatus = r.body.data; });
  await test('Workflows', 'Add transition', async () => { const r = await request('POST', `/workflows/${wfId}/transitions`, { token: state.access, body: { from_status_id: state.wfStatus.id, to_status_id: state.wfStatus.id, name: 'Self' } }); expectOk(r); });
  await test('Workflows', 'Get with statuses', async () => { const r = await request('GET', `/workflows/${wfId}`, { token: state.access }); expectOk(r); expect(r.body.data.statuses.length >= 1, true); });

  // CUSTOM FIELDS
  section('Custom Fields (Jira-style)');
  let fieldId;
  await test('Custom Fields', 'Create', async () => { const r = await request('POST', '/custom-fields', { token: state.access, body: { workspace_id: state.ws.id, entity_type: 'task', name: 'Story Points', type: 'number' } }); expectOk(r); fieldId = r.body.data.id; });
  await test('Custom Fields', 'Set value', async () => {
    const t = await request('POST', '/tasks', { token: state.access, body: { project_id: state.proj.id, title: 'CF' } });
    const r = await request('POST', `/custom-fields/${fieldId}/values`, { token: state.access, body: { entity_id: t.body.data.id, value: 8 } });
    expectOk(r);
  });
  await test('Custom Fields', 'List', async () => { const r = await request('GET', `/custom-fields?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });

  // ROADMAP
  section('Roadmap / Timeline (Jira Plans)');
  await test('Roadmap', 'Create item', async () => { const r = await request('POST', '/roadmap/items', { token: state.access, body: { workspace_id: state.ws.id, title: 'Q1 Launch', start_date: '2026-01-01', end_date: '2026-03-31', category: 'now' } }); expectOk(r); state.roadmap = r.body.data; });
  await test('Roadmap', 'List', async () => { const r = await request('GET', `/roadmap/items?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 1, true); });
  await test('Roadmap', 'Update', async () => { const r = await request('PATCH', `/roadmap/items/${state.roadmap.id}`, { token: state.access, body: { progress: 50 } }); expectOk(r); });
  await test('Roadmap', 'Delete', async () => { const r = await request('DELETE', `/roadmap/items/${state.roadmap.id}`, { token: state.access }); expectOk(r); });

  // ADVANCED SEARCH
  section('Advanced Search (JQL-equivalent)');
  await test('Search', 'Basic query', async () => { const r = await request('POST', '/search-v2/search', { token: state.access, body: { workspace_id: state.ws.id, jql: 'priority = high' } }); expectOk(r); });
  await test('Search', 'ORDER BY', async () => { const r = await request('POST', '/search-v2/search', { token: state.access, body: { workspace_id: state.ws.id, jql: 'ORDER BY created_at' } }); expectOk(r); });
  await test('Search', 'Multiple conditions', async () => { const r = await request('POST', '/search-v2/search', { token: state.access, body: { workspace_id: state.ws.id, jql: 'priority != low' } }); expectOk(r); });

  // SAVED FILTERS
  section('Saved Filters (Jira)');
  await test('Filters', 'Create', async () => { const r = await request('POST', '/filters', { token: state.access, body: { workspace_id: state.ws.id, name: 'My urgent', jql: 'priority = urgent', entity_type: 'task' } }); expectOk(r); state.filter = r.body.data; });
  await test('Filters', 'List', async () => { const r = await request('GET', `/filters?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });

  // APPROVALS
  section('Approvals (Jira)');
  let appId;
  await test('Approvals', 'Create', async () => { const r = await request('POST', '/approvals', { token: state.access, body: { organization_id: state.organization.id, entity_type: 'task', entity_id: state.proj.id, title: 'Approve release' } }); expectOk(r); appId = r.body.data.id; });
  await test('Approvals', 'Decide', async () => { const r = await request('POST', `/approvals/${appId}/decide`, { token: state.access, body: { decision: 'approved', comment: 'Looks good' } }); expectOk(r); });
  await test('Approvals', 'List', async () => { const r = await request('GET', `/approvals?organization_id=${state.organization.id}`, { token: state.access }); expectOk(r); });

  // SLA
  section('SLA Policies (Jira Service Management)');
  await test('SLA', 'Create policy', async () => { const r = await request('POST', '/sla/policies', { token: state.access, body: { workspace_id: state.ws.id, name: 'P1 SLA', response_time_minutes: 60, resolution_time_minutes: 480 } }); expectOk(r); state.sla = r.body.data; });
  await test('SLA', 'List policies', async () => { const r = await request('GET', `/sla/policies?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });

  // PAGE VERSIONS
  section('Page Versions (Notion-style history)');
  let docId;
  await test('Versions', 'Create document', async () => { const r = await request('POST', '/documents', { token: state.access, body: { workspace_id: state.ws.id, title: 'V1', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'v1' }] }] } } }); expectOk(r); docId = r.body.data.id; });
  await test('Versions', 'Save version', async () => { const r = await request('POST', `/page-versions/${docId}`, { token: state.access, body: { summary: 'first' } }); expectOk(r); state.version = r.body.data; });
  await test('Versions', 'List versions', async () => { const r = await request('GET', `/page-versions/${docId}`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 1, true); });

  // REACTIONS
  section('Reactions (Notion-style)');
  let commentId;
  await test('Reactions', 'Create comment', async () => { const r = await request('POST', `/documents/${docId}/comments`, { token: state.access, body: { body: 'Nice!' } }); expectOk(r); commentId = r.body.data.id; });
  await test('Reactions', 'Add', async () => { const r = await request('POST', '/reactions', { token: state.access, body: { page_type: 'comment', page_id: commentId, emoji: '👍' } }); expectOk(r); });
  await test('Reactions', 'Remove', async () => { const r = await request('DELETE', `/reactions?page_type=comment&page_id=${commentId}&emoji=${encodeURIComponent('👍')}`, { token: state.access }); expectOk(r); });

  // VIEWS
  section('Database Views (Notion-style)');
  await test('Views', 'Create', async () => { const r = await request('POST', '/views', { token: state.access, body: { workspace_id: state.ws.id, name: 'Board view', type: 'board', entity_type: 'task', entity_id: state.proj.id, config: { filters: [], sorts: [], groups: [] } } }); expectOk(r); state.view = r.body.data; });
  await test('Views', 'List', async () => { const r = await request('GET', `/views?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });
  await test('Views', 'Update', async () => { const r = await request('PATCH', `/views/${state.view.id}`, { token: state.access, body: { name: 'Updated' } }); expectOk(r); });

  // RELATIONS
  section('Database Relations (Notion-style)');
  let task1, task2;
  await test('Relations', 'Create tasks', async () => {
    const r1 = await request('POST', '/tasks', { token: state.access, body: { project_id: state.proj.id, title: 'R1' } });
    const r2 = await request('POST', '/tasks', { token: state.access, body: { project_id: state.proj.id, title: 'R2' } });
    task1 = r1.body.data.id; task2 = r2.body.data.id;
  });
  await test('Relations', 'Create', async () => { const r = await request('POST', '/relations', { token: state.access, body: { workspace_id: state.ws.id, source_type: 'task', source_id: task1, target_type: 'task', target_id: task2, relation_type: 'blocks' } }); expectOk(r); state.relation = r.body.data; });
  await test('Relations', 'List', async () => { const r = await request('GET', `/relations?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });

  // SYNCED BLOCKS
  section('Synced Blocks (Notion)');
  await test('Synced Blocks', 'Create', async () => { const r = await request('POST', '/synced-blocks', { token: state.access, body: { workspace_id: state.ws.id, name: 'Disclaimer', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Standard disclaimer' }] }] } } }); expectOk(r); state.synced = r.body.data; });
  await test('Synced Blocks', 'List', async () => { const r = await request('GET', `/synced-blocks?workspace_id=${state.ws.id}`, { token: state.access }); expectOk(r); });

  // BACKLINKS
  section('Backlinks (Notion)');
  await test('Backlinks', 'Create', async () => { const r = await request('POST', '/backlinks', { token: state.access, body: { source_type: 'task', source_id: task1, target_type: 'document', target_id: docId, context: 'see also' } }); expectOk(r); });
  await test('Backlinks', 'Get', async () => { const r = await request('GET', `/backlinks/document/${docId}`, { token: state.access }); expectOk(r); });

  // INTEGRATIONS
  section('Integrations Framework');
  await test('Integrations', 'Add Slack', async () => { const r = await request('POST', '/integrations-v2', { token: state.access, body: { organization_id: state.organization.id, provider: 'slack', config: { workspace: 'T123' } } }); expectOk(r); state.integration = r.body.data; });
  await test('Integrations', 'Add GitHub', async () => { const r = await request('POST', '/integrations-v2', { token: state.access, body: { organization_id: state.organization.id, provider: 'github' } }); expectOk(r); });
  await test('Integrations', 'List', async () => { const r = await request('GET', `/integrations-v2?organization_id=${state.organization.id}`, { token: state.access }); expectOk(r); expect(r.body.data.length >= 2, true); });
  await test('Integrations', 'Delete', async () => { const r = await request('DELETE', `/integrations-v2/${state.integration.id}?organization_id=${state.organization.id}`, { token: state.access }); expectOk(r); });

  // Report
  const total = passed + failed;
  const dur = ((Date.now() - 0) / 1000).toFixed(1);
  log('\n');
  log(colors.bold('═══════════ ADVANCED RESULTS ═══════════\n'));
  log(`${colors.green('✓ Passed:')} ${passed}  ${colors.red('✗ Failed:')} ${failed}  ${colors.bold('Total:')} ${total}\n\n`);
  log(colors.bold('By module:\n'));
  for (const [m, s] of Object.entries(stats.byModule)) {
    const c = s.f > 0 ? colors.red : colors.green;
    log(`  ${c(m.padEnd(16))} ${colors.green(s.p + '✓')} ${s.f > 0 ? colors.red(s.f + '✗') : ''}\n`);
  }
  if (failures.length) {
    log('\n' + colors.bold(colors.red('Failures:\n')));
    for (const f of failures) log(`  ${colors.red('•')} ${colors.bold(f.module + ' › ' + f.name)}  ${colors.gray(f.error)}\n`);
  }
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => { console.error('Fatal:', e); process.exit(2); });
