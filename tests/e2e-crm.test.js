/* Comprehensive CRM E2E test */
require('dotenv').config();
const http = require('http');

const BASE = 'http://localhost:5050';
const API = `${BASE}/api`;
let passed = 0, failed = 0;
const failures = [];
const log = (m) => { process.stdout.write(m); if (process.stdout.flush) process.stdout.flush(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const request = async (method, path, { body, token, headers = {}, timeout = 30000 } = {}) => {
  const opts = {
    hostname: 'localhost', port: 5050,
    path: `/api${path}`, method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
  };
  if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Length'] = Buffer.byteLength(opts.body); }
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
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

const test = async (name, fn) => {
  try { await fn(); passed++; log(`  ✓ ${name}\n`); }
  catch (e) { failed++; failures.push(`${name}: ${e.message}`); log(`  ✗ ${name}: ${e.message}\n`); }
};

const expectOk = (r) => { if (r.status < 200 || r.status >= 300) throw new Error(`${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`); if (r.body?.success === false) throw new Error(r.body.error?.message); };

const run = async () => {
  log('\n═══ CRM E2E TESTS ═══\n');
  const ts = Date.now();
  const reg = await request('POST', '/auth/register', { body: { email: `crm+${ts}@x.com`, password: 'CRM12345!', full_name: 'CRM Test' } });
  expectOk(reg);
  const token = reg.body.data.access;
  const orgId = reg.body.data.organization.id;
  const wsId = reg.body.data.workspace.id;

  // Companies
  log('\nCompanies\n');
  let companyId;
  await test('Create company', async () => {
    const r = await request('POST', `/crm/companies?organization_id=${orgId}`, { token, body: { name: 'Acme Corp', domain: 'acme.com', industry: 'Technology', phone: '+1234567890', email: 'info@acme.com' } });
    expectOk(r); companyId = r.body.data.id;
  });
  await test('List companies', async () => { const r = await request('GET', `/crm/companies?organization_id=${orgId}`, { token }); expectOk(r); if (!r.body.data.find(c => c.id === companyId)) throw new Error('company not in list'); });
  await test('Get company', async () => { const r = await request('GET', `/crm/companies/${companyId}?organization_id=${orgId}`, { token }); expectOk(r); if (r.body.data.name !== 'Acme Corp') throw new Error('name mismatch'); });
  await test('Update company', async () => { const r = await request('PATCH', `/crm/companies/${companyId}?organization_id=${orgId}`, { token, body: { name: 'Acme Corporation' } }); expectOk(r); if (r.body.data.name !== 'Acme Corporation') throw new Error('update failed'); });
  await test('Search companies', async () => { const r = await request('GET', `/crm/companies?organization_id=${orgId}&search=Acme`, { token }); expectOk(r); });

  // Contacts
  log('\nContacts\n');
  let contactId;
  await test('Create contact', async () => {
    const r = await request('POST', `/crm/contacts?organization_id=${orgId}`, { token, body: { first_name: 'John', last_name: 'Doe', email: 'john@acme.com', phone: '+1234567890', job_title: 'CEO', company_id: companyId } });
    expectOk(r); contactId = r.body.data.id;
  });
  await test('List contacts', async () => { const r = await request('GET', `/crm/contacts?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Get contact', async () => { const r = await request('GET', `/crm/contacts/${contactId}?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Update contact', async () => { const r = await request('PATCH', `/crm/contacts/${contactId}?organization_id=${orgId}`, { token, body: { job_title: 'CTO' } }); expectOk(r); });

  // Pipelines
  log('\nPipelines\n');
  let pipelineId, stageId, wonStageId;
  await test('Create pipeline', async () => {
    const r = await request('POST', `/crm/pipelines?organization_id=${orgId}`, { token, body: { name: 'Sales Pipeline' } });
    expectOk(r); pipelineId = r.body.data.id; stageId = r.body.data.stages[0].id; wonStageId = r.body.data.stages.find(s => s.is_won)?.id;
  });
  await test('List pipelines', async () => { const r = await request('GET', `/crm/pipelines?organization_id=${orgId}`, { token }); expectOk(r); if (!r.body.data.find(p => p.id === pipelineId)) throw new Error('pipeline not found'); });

  // Deals
  log('\nDeals\n');
  let dealId;
  await test('Create deal', async () => {
    const r = await request('POST', `/crm/deals?organization_id=${orgId}`, { token, body: { title: 'Big Deal', pipeline_id: pipelineId, stage_id: stageId, value: 50000, contact_id: contactId, company_id: companyId } });
    expectOk(r); dealId = r.body.data.id;
  });
  await test('List deals', async () => { const r = await request('GET', `/crm/deals?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Get deal', async () => { const r = await request('GET', `/crm/deals/${dealId}?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Update deal', async () => { const r = await request('PATCH', `/crm/deals/${dealId}?organization_id=${orgId}`, { token, body: { value: 75000 } }); expectOk(r); });
  await test('Move deal to stage', async () => { const r = await request('POST', `/crm/deals/${dealId}/move?organization_id=${orgId}`, { token, body: { stage_id: stageId } }); expectOk(r); });

  // Leads
  log('\nLeads\n');
  let leadId;
  await test('Create lead', async () => {
    const r = await request('POST', `/crm/leads?organization_id=${orgId}`, { token, body: { first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', company_name: 'Example Inc', source: 'website' } });
    expectOk(r); leadId = r.body.data.id;
  });
  await test('List leads', async () => { const r = await request('GET', `/crm/leads?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Convert lead', async () => { const r = await request('POST', `/crm/leads/${leadId}/convert?organization_id=${orgId}`, { token }); expectOk(r); });

  // Activities
  log('\nActivities\n');
  let activityId;
  await test('Create activity', async () => {
    const r = await request('POST', `/crm/activities?organization_id=${orgId}`, { token, body: { type: 'call', subject: 'Follow up call', contact_id: contactId, deal_id: dealId, due_date: new Date(Date.now() + 86400000).toISOString() } });
    expectOk(r); activityId = r.body.data.id;
  });
  await test('List activities', async () => { const r = await request('GET', `/crm/activities?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Complete activity', async () => { const r = await request('PATCH', `/crm/activities/${activityId}?organization_id=${orgId}`, { token, body: { status: 'completed', completed_at: new Date().toISOString() } }); expectOk(r); });

  // Quotes
  log('\nQuotes\n');
  let quoteId;
  await test('Create quote', async () => {
    const r = await request('POST', `/crm/quotes?organization_id=${orgId}`, { token, body: { title: 'Q1 Proposal', deal_id: dealId, contact_id: contactId, company_id: companyId, line_items: [{ name: 'Service A', quantity: 1, unit_price: 10000 }], tax_rate: 10 } });
    expectOk(r); quoteId = r.body.data.id;
    if (parseFloat(r.body.data.total) !== 11000) throw new Error(`Expected total 11000, got ${r.body.data.total}`);
  });
  await test('List quotes', async () => { const r = await request('GET', `/crm/quotes?organization_id=${orgId}`, { token }); expectOk(r); });
  await test('Send quote', async () => { const r = await request('POST', `/crm/quotes/${quoteId}/send?organization_id=${orgId}`, { token }); expectOk(r); });

  // Dashboard
  log('\nDashboard\n');
  await test('CRM dashboard', async () => { const r = await request('GET', `/crm/dashboard?organization_id=${orgId}`, { token }); expectOk(r); if (typeof r.body.data.pipeline_value !== 'number') throw new Error('no pipeline value'); });

  // Summary
  log(`\n═══ CRM RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} ═══\n`);
  if (failed > 0) { log('\nFailures:\n'); failures.forEach(f => log(`  ✗ ${f}\n`)); }
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((e) => { log(`\nFATAL: ${e.message}\n`); process.exit(1); });
