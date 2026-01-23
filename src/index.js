require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const http = require('http');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const db = require('./db/pool');
const { errorHandler, notFound, requestId, corsHeaders, accessLog } = require('./middleware');
const { rateLimitAuth } = require('./middleware/rate');
const sockets = require('./sockets');

const app = express();
const httpServer = http.createServer(app);

app.set('trust proxy', 1);
app.set('x-powered-by', false);
app.set('etag', 'strong');
app.enable('case-sensitive routing');
app.disable('strict routing');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.use(corsHeaders);
app.use(cors({ origin: config.corsOrigin, credentials: true, maxAge: 86400 }));

app.use(compression({
  level: 6,
  threshold: 512,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(requestId);
app.use(accessLog);
if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

app.get('/api/health', async (_req, res) => {
  const result = {
    status: 'ok',
    name: 'Apogee',
    version: '2.0.0',
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };
  try {
    const r = await db.query('SELECT 1 AS ok');
    result.db = r.rows[0]?.ok === 1 ? 'up' : 'down';
  } catch { result.db = 'down'; result.status = 'degraded'; }
  try {
    if (config.redis.url) {
      const r = await fetch(`${config.redis.url}/ping`, {
        headers: { Authorization: `Bearer ${config.redis.token}` },
        signal: AbortSignal.timeout(2000),
      });
      result.cache = r.ok ? 'up' : 'down';
    } else {
      result.cache = 'disabled';
    }
  } catch { result.cache = 'down'; }
  res.set('Cache-Control', 'no-store');
  res.json(result);
});

app.get('/api/version', (_req, res) =>
  res.json({ version: '2.0.0', build: process.env.BUILD_SHA || 'dev', node: process.version })
);

app.get('/api/status', async (_req, res) => {
  const r = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL)::int AS users,
       (SELECT COUNT(*) FROM organizations WHERE deleted_at IS NULL)::int AS organizations,
       (SELECT COUNT(*) FROM workspaces WHERE archived_at IS NULL)::int AS workspaces,
       (SELECT COUNT(*) FROM projects WHERE archived_at IS NULL)::int AS projects,
       (SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL)::int AS tasks,
       (SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL)::int AS documents`
  );
  res.json({ success: true, data: r.rows[0] });
});

const webDist = path.join(__dirname, '..', 'apps', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(
    express.static(webDist, {
      maxAge: '7d',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        if (filePath.endsWith('.webmanifest') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    })
  );
}

// Auth rate limiting is per-route in the auth module

const mount = (path, mod) => app.use(`/api/${path}`, mod);

mount('auth', require('./modules/auth/routes'));
mount('organizations', require('./modules/organizations/routes'));
mount('workspaces', require('./modules/workspaces/routes'));
mount('projects', require('./modules/projects/routes'));
mount('tasks', require('./modules/tasks/routes'));
mount('documents', require('./modules/documents/routes'));
mount('notifications', require('./modules/notifications/routes'));
mount('files', require('./modules/files/routes'));
mount('search', require('./modules/search/routes'));
mount('ai', require('./modules/ai/routes'));
mount('billing', require('./modules/billing/routes'));
mount('admin', require('./modules/admin/routes'));
mount('analytics', require('./modules/analytics/routes'));
mount('webhooks', require('./modules/webhooks/routes'));
mount('teams', require('./modules/teams/routes'));
mount('teams/additional', require('./modules/teams/additional'));
mount('labels', require('./modules/labels/routes'));
mount('shares', require('./modules/shares/routes'));
mount('presence', require('./modules/presence/routes'));
mount('crm', require('./modules/crm/routes'));
mount('automations', require('./modules/automations/routes'));
mount('goals', require('./modules/goals/routes'));
mount('calendar', require('./modules/calendar/routes'));
mount('templates', require('./modules/templates/routes'));
mount('exports', require('./modules/exports/routes'));
mount('helpdesk', require('./modules/helpdesk/routes'));
mount('wiki', require('./modules/wiki/routes'));
mount('time', require('./modules/time/routes'));
mount('whiteboards', require('./modules/whiteboards/routes'));
mount('forms', require('./modules/forms/routes'));
mount('activity', require('./modules/activity/routes'));
mount('oauth', require('./modules/oauth/routes'));

const advanced = require('./modules/advanced/routes');
const phase2 = require('./modules/phase2/routes');

mount('epics', advanced.epicsRouter);
mount('releases', advanced.releasesRouter);
mount('sprints', advanced.sprintsRouter);
mount('components', advanced.componentsRouter);
mount('custom-fields', advanced.customFieldsRouter);
mount('workflows', advanced.workflowsRouter);
mount('approvals', advanced.approvalsRouter);
mount('sla', advanced.slaRouter);
mount('roadmap', advanced.roadmapRouter);
mount('search-v2', advanced.searchV2Router);
mount('filters', advanced.filtersRouter);
mount('capacity', advanced.capacityRouter);
mount('page-versions', advanced.pageVersionsRouter);
mount('backlinks', advanced.backlinksRouter);
mount('reactions', advanced.reactionsRouter);
mount('synced-blocks', advanced.syncedBlocksRouter);
mount('views', advanced.viewsRouter);
mount('relations', advanced.relationsRouter);
mount('integrations-v2', advanced.integrationsV2Router);

mount('kb', phase2.kbRouter);
mount('queues', phase2.queuesRouter);
mount('canned', phase2.cannedRouter);
mount('csat', phase2.csatRouter);
mount('assets', phase2.assetsRouter);
mount('changes', phase2.changesRouter);
mount('incidents', phase2.incidentsRouter);
mount('dashboards', phase2.dashboardsRouter);
mount('incoming-webhooks', phase2.incomingWebhooksRouter);
mount('approval-chains', phase2.approvalChainsRouter);
mount('export-jobs', phase2.exportJobsRouter);
mount('tags', phase2.tagsRouter);
mount('sso', phase2.ssoRouter);
mount('analytics-v2', phase2.analyticsRouter);

app.use('/api/portal', require('./modules/phase2/portal'));
app.use('/api/public', phase2.publicPagesRouter);

if (fs.existsSync(webDist)) {
  app.get(
    /^(?!\/api|\/socket\.io|\/sw\.js|\/manifest|\/icon|\/assets|\/__|\/healthz).*/,
    (_req, res) => res.sendFile(path.join(webDist, 'index.html'))
  );
}

app.use('/api/*', notFound);
app.use(errorHandler);

sockets.build(httpServer);

const start = async () => {
  try {
    await db.query('SELECT 1');
    console.log('[boot] database connected');
    db.warmConnections(2).catch(() => {});
    db.keepAlive();
  } catch (e) {
    console.error('[boot] database connection failed', e.message);
  }
  httpServer.listen(config.port, () => {
    console.log(`[boot] Apogee ${config.isProd ? 'production' : 'dev'} server on http://localhost:${config.port}`);
    console.log(`[boot] API: http://localhost:${config.port}/api  |  WS: ${config.socket.path}`);
  });
};

if (require.main === module) start();

module.exports = { app, httpServer, start };
