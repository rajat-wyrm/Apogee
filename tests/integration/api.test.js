const request = require('supertest');
const { app } = require('../../src/index');
const db = require('../../src/db/pool');

let token;
const testUser = {
  email: `test+${Date.now()}@apogee.dev`,
  password: 'Test1234!',
  full_name: 'Test User',
};

beforeAll(async () => {
  await db.ensureSchema();
});

describe('Health', () => {
  test('returns ok', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });
});

describe('Auth', () => {
  test('registers a new user', async () => {
    const r = await request(app).post('/api/auth/register').send(testUser);
    expect(r.status).toBe(201);
    expect(r.body.success).toBe(true);
    expect(r.body.data.user.email).toBe(testUser.email);
    expect(r.body.data.access).toBeDefined();
    token = r.body.data.access;
  });

  test('rejects duplicate email', async () => {
    const r = await request(app).post('/api/auth/register').send(testUser);
    expect(r.status).toBe(409);
  });

  test('logs in', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: testUser.email, password: testUser.password });
    expect(r.status).toBe(200);
    expect(r.body.data.access).toBeDefined();
    token = r.body.data.access;
  });

  test('rejects bad password', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: testUser.email, password: 'wrong' });
    expect(r.status).toBe(401);
  });

  test('validates input', async () => {
    const r = await request(app).post('/api/auth/register').send({ email: 'bad', password: '1' });
    expect(r.status).toBe(422);
  });
});

describe('Authed', () => {
  test('me returns user', async () => {
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data.user.email).toBe(testUser.email);
  });

  test('rejects unauthed', async () => {
    const r = await request(app).get('/api/auth/me');
    expect(r.status).toBe(401);
  });
});

describe('Projects', () => {
  let workspaceId;
  let projectId;

  test('list workspaces', async () => {
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const orgId = r.body.data.organizations[0].id;
    const w = await request(app).get(`/api/workspaces?organization_id=${orgId}`).set('Authorization', `Bearer ${token}`);
    expect(w.status).toBe(200);
    workspaceId = w.body.data[0].id;
  });

  test('create project', async () => {
    const r = await request(app).post('/api/projects').set('Authorization', `Bearer ${token}`).send({ workspace_id: workspaceId, name: 'Test project' });
    expect(r.status).toBe(201);
    projectId = r.body.data.id;
  });

  test('create task', async () => {
    const r = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ project_id: projectId, title: 'Test task', priority: 'high' });
    expect(r.status).toBe(201);
    expect(r.body.data.title).toBe('Test task');
  });

  test('list tasks', async () => {
    const r = await request(app).get(`/api/projects/${projectId}/tasks`).set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThan(0);
  });
});

describe('AI', () => {
  test('chat works (may use fallback)', async () => {
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const orgId = me.body.data.organizations[0].id;
    const r = await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${token}`).send({ messages: [{ role: 'user', content: 'Hi' }], organization_id: orgId });
    expect(r.status).toBe(200);
  });
});
