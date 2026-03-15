require('dotenv').config();
const db = require('../src/db/pool');
const { hashPassword, randomToken, slugify } = require('../src/utils/crypto');

const seed = async () => {
  console.log('[seed] starting…');

  const adminEmail = 'admin@apogee.dev';
  const adminPassword = 'Admin123!';

  const existing = await db.query('SELECT id FROM users WHERE email=$1', [adminEmail]);
  if (existing.rows[0]) {
    console.log('[seed] admin already exists, skipping');
  } else {
    const password_hash = await hashPassword(adminPassword);
    const u = await db.tx(async (c) => {
      const user = await c.query(
        `INSERT INTO users(email, password_hash, full_name, email_verified, preferences)
         VALUES ($1,$2,$3,true,$4) RETURNING id`,
        [adminEmail, password_hash, 'Admin', JSON.stringify({ theme: 'dark' })]
      );
      const org = await c.query(
        `INSERT INTO organizations(slug, name, plan, created_by) VALUES ($1,$2,'enterprise',$3) RETURNING *`,
        [`apogee-${randomToken(3).toLowerCase()}`, 'Apogee Demo', user.rows[0].id]
      );
      await c.query(`INSERT INTO memberships(user_id, organization_id, role) VALUES ($1,$2,'owner')`, [user.rows[0].id, org.rows[0].id]);
      const ws = await c.query(`INSERT INTO workspaces(organization_id, name, slug, created_by) VALUES ($1,'General','general',$2) RETURNING *`, [org.rows[0].id, user.rows[0].id]);
      await c.query(`INSERT INTO workspace_members(workspace_id, user_id, role) VALUES ($1,$2,'lead')`, [ws.rows[0].id, user.rows[0].id]);

      const project = await c.query(
        `INSERT INTO projects(workspace_id, organization_id, name, slug, description, color, icon, view_type, owner_id)
         VALUES ($1,$2,'Product launch','product-launch','Q3 launch checklist','#6366f1','🚀','kanban',$3) RETURNING *`,
        [ws.rows[0].id, org.rows[0].id, user.rows[0].id]
      );
      const statuses = [
        ['Backlog', '#94a3b8', 'backlog', 0],
        ['To Do', '#3b82f6', 'todo', 1],
        ['In Progress', '#f59e0b', 'in_progress', 2],
        ['In Review', '#8b5cf6', 'review', 3],
        ['Done', '#10b981', 'done', 4],
      ];
      const statusIds = {};
      for (const [n, color, cat, pos] of statuses) {
        const s = await c.query(`INSERT INTO project_statuses(project_id, name, color, category, position, is_default) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [project.rows[0].id, n, color, cat, pos, cat === 'todo']);
        statusIds[cat] = s.rows[0].id;
      }
      const tasks = [
        ['Define launch goals', 'Set KPIs and timelines', 'high', 'todo'],
        ['Build landing page', 'Marketing site with hero, features, pricing', 'high', 'in_progress'],
        ['Write launch blog post', 'Announce product on the blog', 'medium', 'todo'],
        ['Email announcement', 'Newsletter to 10k subscribers', 'medium', 'backlog'],
        ['Setup analytics', 'Mixpanel + GA4 events', 'low', 'done'],
        ['Test payment flow', 'End-to-end Stripe checkout', 'urgent', 'in_progress'],
      ];
      for (let i = 0; i < tasks.length; i++) {
        const [title, desc, prio, cat] = tasks[i];
        await c.query(
          `INSERT INTO tasks(project_id, workspace_id, organization_id, number, title, description, priority, status_id, reporter_id, assignee_id, position)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10)`,
          [project.rows[0].id, ws.rows[0].id, org.rows[0].id, i + 1, title, desc, prio, statusIds[cat], user.rows[0].id, i * 1000]
        );
      }

      const doc = await c.query(
        `INSERT INTO documents(workspace_id, organization_id, title, content, content_text, is_published, created_by, last_edited_by)
         VALUES ($1,$2,'Welcome to Apogee',$3,$4,true,$5,$5) RETURNING *`,
        [
          ws.rows[0].id, org.rows[0].id,
          JSON.stringify({
            type: 'doc',
            content: [
              { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Welcome to Apogee' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Your all-in-one workspace for projects, tasks, docs, and AI-powered productivity.' }] },
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Get started' }] },
              { type: 'bulletList', content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Create your first project' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Invite your team' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Try the AI assistant (Cmd+K → AI)' }] }] },
              ] },
            ],
          }),
          'Welcome to Apogee. Your all-in-one workspace for projects, tasks, docs, and AI-powered productivity.',
          user.rows[0].id,
        ]
      );

      return { user, org, project: project.rows[0], doc };
    });
    console.log('[seed] created admin user:', adminEmail, '/', adminPassword);
    console.log('[seed] created demo org, project, tasks, document');
  }
  process.exit(0);
};

seed().catch((e) => { console.error(e); process.exit(1); });
