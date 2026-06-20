/* WORLD-CLASS E2E TEST — Every endpoint, every module, every edge case */
require('dotenv').config();
const http = require('http');
const { performance } = require('perf_hooks');

const BASE = 'http://localhost:5050';
const API = `${BASE}/api`;
let totalPass = 0, totalFail = 0;
const results = [];
const log = (m) => { process.stdout.write(m); if (process.stdout.flush) process.stdout.flush(); };

const request = async (method, path, { body, token, headers = {}, timeout = 30000 } = {}) => {
  const opts = {
    hostname: 'localhost', port: 5050,
    path: `/api${path}`, method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  };
  if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Length'] = Buffer.byteLength(opts.body); }
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed = data;
        if ((res.headers['content-type'] || '').includes('application/json')) try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, body: parsed, ms: Math.round(performance.now() - start) });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    if (opts.body) req.write(opts.body);
    req.end();
  });
};

const test = (mod, name, fn) => async () => {
  const start = performance.now();
  try { await fn(); const ms = Math.round(performance.now() - start); totalPass++; results.push({ mod, name, pass: true, ms }); log(`  \x1b[32m✓\x1b[0m ${name} \x1b[90m(${ms}ms)\x1b[0m\n`); }
  catch (e) { const ms = Math.round(performance.now() - start); totalFail++; results.push({ mod, name, pass: false, error: e.message.slice(0, 100), ms }); log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message.slice(0, 80)}\n`); }
};

const expectOk = (r) => { if (r.status < 200 || r.status >= 300) throw new Error(`${r.status}: ${JSON.stringify(r.body).slice(0, 150)}`); if (r.body?.success === false) throw new Error(r.body.error?.message); };

const run = async () => {
  log('\n\x1b[1m\x1b[36m╔═══════════════════════════════════════════════════════════╗\n');
  log('║         APOGEE 4.0 — WORLD-CLASS E2E TEST SUITE           ║\n');
  log('╚═══════════════════════════════════════════════════════════╝\x1b[0m\n\n');

  const ts = Date.now();
  const t = (mod, name, fn) => test(mod, name, fn)();

  // === AUTH ===
  log('\x1b[1m\x1b[33m▶ AUTH & SECURITY\x1b[0m\n');
  let token, refresh, userId, orgId, wsId;
  await t('Auth', 'Register user', async () => {
    const r = await request('POST', '/auth/register', { body: { email: `wc+${ts}@x.com`, password: 'WorldClass1!', full_name: 'World Class' } });
    expectOk(r); token = r.body.data.access; refresh = r.body.data.refresh; userId = r.body.data.user.id; orgId = r.body.data.organization.id; wsId = r.body.data.workspace.id;
  });
  await t('Auth', 'Login', async () => { const r = await request('POST', '/auth/login', { body: { email: `wc+${ts}@x.com`, password: 'WorldClass1!' } }); expectOk(r); });
  await t('Auth', 'Me', async () => { const r = await request('GET', '/auth/me', { token }); expectOk(r); });
  await t('Auth', 'Refresh token', async () => { const r = await request('POST', '/auth/refresh', { body: { refresh_token: refresh } }); expectOk(r); });
  await t('Auth', 'Update profile', async () => { const r = await request('PATCH', '/auth/me', { token, body: { phone: '+1234567890' } }); expectOk(r); });
  await t('Auth', 'Change password', async () => { const r = await request('POST', '/auth/change-password', { token, body: { current_password: 'WorldClass1!', new_password: 'WorldClass2!' } }); expectOk(r); });
  await t('Auth', 'Forgot password', async () => { const r = await request('POST', '/auth/forgot-password', { body: { email: `wc+${ts}@x.com` } }); expectOk(r); });
  await t('Auth', 'Google OAuth redirect', async () => { const r = await request('GET', '/oauth/google'); if (r.status !== 302) throw new Error(`Expected 302, got ${r.status}`); });
  await t('Auth', 'OAuth providers', async () => { const r = await request('GET', '/oauth/providers'); expectOk(r); });
  await t('Auth', 'Logout', async () => { const r = await request('POST', '/auth/logout', { token, body: { refresh_token: refresh } }); expectOk(r); });
  await t('Auth', 'Me without token', async () => { const r = await request('GET', '/auth/me'); if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`); });
  await t('Auth', 'Invalid token', async () => { const r = await request('GET', '/auth/me', { token: 'invalid' }); if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`); });

  // === ORGANIZATIONS ===
  log('\n\x1b[1m\x1b[33m▶ ORGANIZATIONS\x1b[0m\n');
  await t('Orgs', 'List', async () => { const r = await request('GET', '/organizations', { token }); expectOk(r); });
  await t('Orgs', 'Get', async () => { const r = await request('GET', `/organizations/${orgId}`, { token }); expectOk(r); });
  await t('Orgs', 'Update', async () => { const r = await request('PATCH', `/organizations/${orgId}`, { token, body: { name: 'Updated Org' } }); expectOk(r); });
  await t('Orgs', 'List members', async () => { const r = await request('GET', `/organizations/${orgId}/members`, { token }); expectOk(r); });
  await t('Orgs', 'Usage', async () => { const r = await request('GET', `/organizations/${orgId}/usage`, { token }); expectOk(r); });
  await t('Orgs', 'Workspaces', async () => { const r = await request('GET', `/organizations/${orgId}/workspaces`, { token }); expectOk(r); });

  // === WORKSPACES ===
  log('\n\x1b[1m\x1b[33m▶ WORKSPACES\x1b[0m\n');
  await t('WS', 'List', async () => { const r = await request('GET', `/workspaces?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('WS', 'Get', async () => { const r = await request('GET', `/workspaces/${wsId}`, { token }); expectOk(r); });
  await t('WS', 'Update', async () => { const r = await request('PATCH', `/workspaces/${wsId}`, { token, body: { description: 'Test workspace' } }); expectOk(r); });
  await t('WS', 'Members', async () => { const r = await request('GET', `/workspaces/${wsId}/members`, { token }); expectOk(r); });

  // === PROJECTS ===
  log('\n\x1b[1m\x1b[33m▶ PROJECTS\x1b[0m\n');
  let projectId;
  await t('Projects', 'Create', async () => { const r = await request('POST', '/projects', { token, body: { workspace_id: wsId, name: 'Test Project' } }); expectOk(r); projectId = r.body.data.id; });
  await t('Projects', 'List', async () => { const r = await request('GET', `/projects?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Projects', 'Get', async () => { const r = await request('GET', `/projects/${projectId}`, { token }); expectOk(r); });
  await t('Projects', 'Update', async () => { const r = await request('PATCH', `/projects/${projectId}`, { token, body: { name: 'Updated Project' } }); expectOk(r); });
  await t('Projects', 'Members', async () => { const r = await request('GET', `/projects/${projectId}/members`, { token }); expectOk(r); });

  // === TASKS ===
  log('\n\x1b[1m\x1b[33m▶ TASKS\x1b[0m\n');
  let taskId;
  await t('Tasks', 'Create', async () => { const r = await request('POST', '/tasks', { token, body: { project_id: projectId, title: 'Test Task', priority: 'high' } }); expectOk(r); taskId = r.body.data.id; });
  await t('Tasks', 'List', async () => { const r = await request('GET', `/tasks?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Tasks', 'Get', async () => { const r = await request('GET', `/tasks/${taskId}`, { token }); expectOk(r); });
  await t('Tasks', 'Update', async () => { const r = await request('PATCH', `/tasks/${taskId}`, { token, body: { title: 'Updated Task' } }); expectOk(r); });
  await t('Tasks', 'Add comment', async () => { const r = await request('POST', `/tasks/${taskId}/comments`, { token, body: { body: 'Test comment' } }); expectOk(r); });
  await t('Tasks', 'List comments', async () => { const r = await request('GET', `/tasks/${taskId}/comments`, { token }); expectOk(r); });
  await t('Tasks', 'Time entry', async () => { const r = await request('POST', `/tasks/${taskId}/time`, { token, body: { duration_seconds: 3600 } }); expectOk(r); });

  // === DOCUMENTS ===
  log('\n\x1b[1m\x1b[33m▶ DOCUMENTS & WIKI\x1b[0m\n');
  let docId;
  await t('Documents', 'List', async () => { const r = await request('GET', `/documents?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Documents', 'Create', async () => { const r = await request('POST', '/documents', { token, body: { workspace_id: wsId, title: 'Test Doc', content: { type: 'doc', content: [] } } }); expectOk(r); docId = r.body.data.id; });
  await t('Documents', 'Get', async () => { const r = await request('GET', `/documents/${docId}`, { token }); expectOk(r); });
  await t('Documents', 'Update', async () => { const r = await request('PATCH', `/documents/${docId}`, { token, body: { title: 'Updated Doc' } }); expectOk(r); });
  await t('Wiki', 'Spaces', async () => { const r = await request('GET', `/wiki/spaces?organization_id=${orgId}`, { token }); expectOk(r); });

  // === NOTIFICATIONS ===
  log('\n\x1b[1m\x1b[33m▶ NOTIFICATIONS & ACTIVITY\x1b[0m\n');
  await t('Notifications', 'List', async () => { const r = await request('GET', '/notifications', { token }); expectOk(r); });
  await t('Notifications', 'Unread count', async () => { const r = await request('GET', '/notifications/unread-count', { token }); expectOk(r); });
  await t('Activity', 'Feed', async () => { const r = await request('GET', `/activity/feed?organization_id=${orgId}`, { token }); expectOk(r); });

  // === SEARCH ===
  log('\n\x1b[1m\x1b[33m▶ SEARCH & ANALYTICS\x1b[0m\n');
  await t('Search', 'Global', async () => { const r = await request('GET', '/search?q=test', { token }); expectOk(r); });
  await t('Analytics', 'Overview', async () => { const r = await request('GET', `/analytics/overview?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('AI', 'Usage', async () => { const r = await request('GET', '/ai/usage', { token }); expectOk(r); });

  // === CRM — Full Industrial Suite ===
  log('\n\x1b[1m\x1b[33m▶ INDUSTRIAL CRM\x1b[0m\n');
  let companyId, contactId, pipelineId, stageId, wonStageId, dealId;
  await t('CRM', 'Create company', async () => { const r = await request('POST', `/crm/companies?organization_id=${orgId}`, { token, body: { name: 'Acme Corp', domain: 'acme.com', industry: 'Technology', size: '100-500', annual_revenue: 5000000 } }); expectOk(r); companyId = r.body.data.id; });
  await t('CRM', 'List companies', async () => { const r = await request('GET', `/crm/companies?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('CRM', 'Get company', async () => { const r = await request('GET', `/crm/companies/${companyId}?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('CRM', 'Update company', async () => { const r = await request('PATCH', `/crm/companies/${companyId}?organization_id=${orgId}`, { token, body: { name: 'Acme Corporation' } }); expectOk(r); });
  await t('CRM', 'Search companies', async () => { const r = await request('GET', `/crm/companies?organization_id=${orgId}&search=Acme`, { token }); expectOk(r); });
  await t('CRM', 'Create contact', async () => { const r = await request('POST', `/crm/contacts?organization_id=${orgId}`, { token, body: { first_name: 'John', last_name: 'Doe', email: 'john@acme.com', phone: '+1234567890', job_title: 'CEO', company_id: companyId, lifecycle_stage: 'customer' } }); expectOk(r); contactId = r.body.data.id; });
  await t('CRM', 'List contacts', async () => { const r = await request('GET', `/crm/contacts?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('CRM', 'Get contact', async () => { const r = await request('GET', `/crm/contacts/${contactId}?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('CRM', 'Update contact', async () => { const r = await request('PATCH', `/crm/contacts/${contactId}?organization_id=${orgId}`, { token, body: { job_title: 'CTO' } }); expectOk(r); });
  await t('CRM', 'Create pipeline', async () => { const r = await request('POST', `/crm/pipelines?organization_id=${orgId}`, { token, body: { name: 'Enterprise Sales' } }); expectOk(r); pipelineId = r.body.data.id; stageId = r.body.data.stages[0].id; wonStageId = r.body.data.stages.find(s => s.is_won)?.id; });
  await t('CRM', 'List pipelines', async () => { const r = await request('GET', `/crm/pipelines?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('CRM', 'Create deal', async () => { const r = await request('POST', `/crm/deals?organization_id=${orgId}`, { token, body: { title: 'Enterprise Deal', pipeline_id: pipelineId, stage_id: stageId, value: 100000, contact_id: contactId, company_id: companyId, priority: 'high' } }); expectOk(r); dealId = r.body.data.id; });
  await t('CRM', 'List deals', async () => { const r = await request('GET', `/crm/deals?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('CRM', 'Get deal', async () => { const r = await request('GET', `/crm/deals/${dealId}?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('CRM', 'Update deal', async () => { const r = await request('PATCH', `/crm/deals/${dealId}?organization_id=${orgId}`, { token, body: { value: 150000 } }); expectOk(r); });
  await t('CRM', 'Move deal', async () => { const r = await request('POST', `/crm/deals/${dealId}/move?organization_id=${orgId}`, { token, body: { stage_id: wonStageId } }); expectOk(r); if (r.body.data.status !== 'won') throw new Error('Deal should be won'); });
  let leadId;
  await t('CRM', 'Create lead', async () => { const r = await request('POST', `/crm/leads?organization_id=${orgId}`, { token, body: { first_name: 'Jane', last_name: 'Smith', email: 'jane@startup.io', company_name: 'StartupIO', source: 'website', score: 75 } }); expectOk(r); leadId = r.body.data.id; });
  await t('CRM', 'Convert lead', async () => { const r = await request('POST', `/crm/leads/${leadId}/convert?organization_id=${orgId}`, { token }); expectOk(r); });
  let activityId;
  await t('CRM', 'Create activity', async () => { const r = await request('POST', `/crm/activities?organization_id=${orgId}`, { token, body: { type: 'call', subject: 'Discovery call', contact_id: contactId, deal_id: dealId, due_date: new Date(Date.now() + 86400000).toISOString(), duration_minutes: 30 } }); expectOk(r); activityId = r.body.data.id; });
  await t('CRM', 'Complete activity', async () => { const r = await request('PATCH', `/crm/activities/${activityId}?organization_id=${orgId}`, { token, body: { status: 'completed' } }); expectOk(r); });
  let quoteId;
  await t('CRM', 'Create quote', async () => { const r = await request('POST', `/crm/quotes?organization_id=${orgId}`, { token, body: { title: 'Q4 Proposal', deal_id: dealId, contact_id: contactId, company_id: companyId, line_items: [{ name: 'Platform License', quantity: 1, unit_price: 100000 }], tax_rate: 10 } }); expectOk(r); quoteId = r.body.data.id; if (parseFloat(r.body.data.total) !== 110000) throw new Error(`Expected total 110000, got ${r.body.data.total}`); });
  await t('CRM', 'Send quote', async () => { const r = await request('POST', `/crm/quotes/${quoteId}/send?organization_id=${orgId}`, { token }); expectOk(r); if (r.body.data.status !== 'sent') throw new Error('Quote should be sent'); });
  await t('CRM', 'Dashboard', async () => { const r = await request('GET', `/crm/dashboard?organization_id=${orgId}`, { token }); expectOk(r); if (r.body.data.pipeline_value === undefined) throw new Error('No pipeline value'); });

  // === SUPPORT & HELPDESK ===
  log('\n\x1b[1m\x1b[33m▶ HELPDESK & SUPPORT\x1b[0m\n');
  let ticketId;
  await t('Helpdesk', 'Create ticket', async () => { const r = await request('POST', `/helpdesk?organization_id=${orgId}`, { token, body: { subject: 'Test Ticket', description: 'Test description', priority: 'high' } }); expectOk(r); ticketId = r.body.data.id; });
  await t('Helpdesk', 'List tickets', async () => { const r = await request('GET', `/helpdesk?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Helpdesk', 'Update ticket', async () => { const r = await request('PATCH', `/helpdesk/${ticketId}?organization_id=${orgId}`, { token, body: { status: 'in_progress' } }); expectOk(r); });

  // === ADVANCED — Sprints, Epics, Releases ===
  log('\n\x1b[1m\x1b[33m▶ ADVANCED FEATURES\x1b[0m\n');
  await t('Epics', 'List', async () => { const r = await request('GET', `/epics?workspace_id=${wsId}`, { token }); expectOk(r); });
  let epicId;
  await t('Epics', 'Create', async () => { const r = await request('POST', '/epics', { token, body: { workspace_id: wsId, name: 'Test Epic' } }); expectOk(r); epicId = r.body.data.id; });
  await t('Sprints', 'List', async () => { const r = await request('GET', `/sprints?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Releases', 'List', async () => { const r = await request('GET', `/releases?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Components', 'List', async () => { const r = await request('GET', `/components?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Workflows', 'List', async () => { const r = await request('GET', `/workflows?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('CustomFields', 'List', async () => { const r = await request('GET', `/custom-fields?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Approvals', 'List', async () => { const r = await request('GET', `/approvals?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('SLA', 'Policies', async () => { const r = await request('GET', `/sla/policies?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Roadmap', 'Items', async () => { const r = await request('GET', `/roadmap/items?workspace_id=${wsId}`, { token }); expectOk(r); });

  // === COLLABORATION ===
  log('\n\x1b[1m\x1b[33m▶ COLLABORATION\x1b[0m\n');
  await t('Teams', 'List', async () => { const r = await request('GET', `/teams?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Labels', 'List', async () => { const r = await request('GET', `/labels?organization_id=${orgId}`, { token }); expectOk(r); });
  let labelId;
  await t('Labels', 'Create', async () => { const r = await request('POST', `/labels?organization_id=${orgId}`, { token, body: { name: 'urgent', color: '#ef4444' } }); expectOk(r); labelId = r.body.data.id; });
  await t('Automations', 'List', async () => { const r = await request('GET', `/automations?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Goals', 'List', async () => { const r = await request('GET', `/goals?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Calendar', 'List', async () => { const r = await request('GET', `/calendar?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Templates', 'List', async () => { const r = await request('GET', `/templates?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Whiteboards', 'List', async () => { const r = await request('GET', `/whiteboards?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Forms', 'List', async () => { const r = await request('GET', `/forms?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Time', 'List', async () => { const r = await request('GET', `/time?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Files', 'List', async () => { const r = await request('GET', `/files?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Webhooks', 'List', async () => { const r = await request('GET', `/webhooks?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Shares', 'List', async () => { const r = await request('GET', '/shares', { token }); expectOk(r); });
  await t('Presence', 'List', async () => { const r = await request('GET', `/presence?organization_id=${orgId}`, { token }); expectOk(r); });

  // === PHASE 2 ===
  log('\n\x1b[1m\x1b[33m▶ PHASE 2 — ADVANCED\x1b[0m\n');
  await t('KB', 'Articles', async () => { const r = await request('GET', `/kb/articles?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Queues', 'List', async () => { const r = await request('GET', `/queues?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Canned', 'List', async () => { const r = await request('GET', `/canned?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('CSAT', 'List', async () => { const r = await request('GET', `/csat?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Assets', 'List', async () => { const r = await request('GET', `/assets?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Changes', 'List', async () => { const r = await request('GET', `/changes?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Incidents', 'List', async () => { const r = await request('GET', `/incidents?organization_id=${orgId}`, { token }); expectOk(r); });
  await t('Dashboards', 'List', async () => { const r = await request('GET', `/dashboards?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Tags', 'List', async () => { const r = await request('GET', `/tags?workspace_id=${wsId}`, { token }); expectOk(r); });
  await t('Exports', 'Tasks CSV', async () => { const r = await request('GET', `/exports/tasks?organization_id=${orgId}`, { token }); expectOk(r); });

  // === SYSTEM ===
  log('\n\x1b[1m\x1b[33m▶ SYSTEM\x1b[0m\n');
  await t('System', 'Health', async () => { const r = await request('GET', '/health'); expectOk(r); if (r.body.db !== 'up') throw new Error('DB not up'); });
  await t('System', 'Version', async () => { const r = await request('GET', '/version'); expectOk(r); });
  await t('System', 'Status', async () => { const r = await request('GET', '/status'); expectOk(r); });

  // === SUMMARY ===
  const totalTests = totalPass + totalFail;
  const avgMs = results.reduce((s, r) => s + r.ms, 0) / results.length;
  const passRate = ((totalPass / totalTests) * 100).toFixed(1);
  
  log('\n\n');
  log('\x1b[1m\x1b[36m╔═══════════════════════════════════════════════════════════╗\n');
  log(`║              WORLD-CLASS E2E TEST RESULTS                     ║\n`);
  log('╠═══════════════════════════════════════════════════════════╣\n');
  log(`║  Total Tests:   ${totalTests}                                        ║\n`);
  log(`║  \x1b[32mPassed:        ${totalPass}\x1b[36m                                       ║\n`);
  log(`║  \x1b[${totalFail > 0 ? '31' : '32'}mFailed:        ${totalFail}\x1b[36m                                       ║\n`);
  log(`║  Pass Rate:     ${passRate}%                                    ║\n`);
  log(`║  Avg Response:  ${avgMs.toFixed(0)}ms                                   ║\n`);
  log('╚═══════════════════════════════════════════════════════════╝\x1b[0m\n');

  if (totalFail > 0) {
    log('\n\x1b[31mFailed tests:\x1b[0m\n');
    results.filter(r => !r.pass).forEach(r => log(`  ✗ [${r.mod}] ${r.name}: ${r.error}\n`));
  }

  process.exit(totalFail > 0 ? 1 : 0);
};

run().catch((e) => { log(`\n\x1b[31mFATAL: ${e.message}\x1b[0m\n`); process.exit(1); });
