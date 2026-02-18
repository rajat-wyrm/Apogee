const express = require('express');
const { body } = require('express-validator');
const { asyncHandler, ok, created, HttpError, paginated } = require('../../utils/http');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware');
const db = require('../../db/pool');
const ai = require('../../services/ai');

const router = express.Router();
router.use(authenticate());

router.get('/usage', asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT feature, provider, model, COUNT(*)::int AS calls, COALESCE(SUM(prompt_tokens+completion_tokens),0)::int AS tokens, COALESCE(SUM(cost),0)::numeric AS cost
     FROM ai_usage WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '30 days'
     GROUP BY feature, provider, model ORDER BY calls DESC`,
    [req.query.organization_id]
  );
  return ok(res, r.rows);
}));

router.post('/chat', [body('messages').isArray({ min: 1 }), body('feature').optional()], validate, asyncHandler(async (req, res) => {
  const result = await ai.chat({
    messages: req.body.messages,
    feature: req.body.feature || 'chat',
    organizationId: req.body.organization_id,
    userId: req.userId,
    prefer: req.body.provider,
    opts: { temperature: req.body.temperature, maxTokens: req.body.max_tokens },
  });
  return ok(res, result);
}));

router.post('/summarize', [body('text').notEmpty()], validate, asyncHandler(async (req, res) => {
  const result = await ai.summarize(req.body.text);
  return ok(res, result);
}));

router.post('/predict-task', [body('task_id').isUUID()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT t.*, p.name AS project_name, u.full_name AS assignee_name
     FROM tasks t JOIN projects p ON p.id=t.project_id LEFT JOIN users u ON u.id=t.assignee_id
     WHERE t.id=$1`,
    [req.body.task_id]
  );
  const task = r.rows[0];
  if (!task) throw HttpError.notFound();
  const result = await ai.chat({
    feature: 'predict_task',
    organizationId: task.organization_id, userId: req.userId,
    messages: [
      { role: 'system', content: 'You predict task completion time. Respond with JSON: { "estimated_hours": number, "confidence": 0-1, "factors": [string], "recommendation": string }' },
      { role: 'user', content: `Title: ${task.title}\nDescription: ${task.description || '(none)'}\nPriority: ${task.priority}\nProject: ${task.project_name}\nAssignee: ${task.assignee_name || 'unassigned'}\nEstimate: ${task.estimate_minutes || '?'} minutes` },
    ],
  });
  try { return ok(res, { ...JSON.parse(result.text), provider: result.provider }); }
  catch { return ok(res, { raw: result.text, provider: result.provider }); }
}));

router.post('/productivity-forecast', [body('organization_id').isUUID()], validate, asyncHandler(async (req, res) => {
  const stats = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM tasks WHERE organization_id=$1 AND completed_at > NOW() - INTERVAL '7 days') AS done_7d,
       (SELECT COUNT(*)::int FROM tasks WHERE organization_id=$1 AND created_at > NOW() - INTERVAL '7 days') AS created_7d,
       (SELECT COUNT(*)::int FROM tasks WHERE organization_id=$1 AND is_archived=false) AS open,
       (SELECT COUNT(*)::int FROM tasks WHERE organization_id=$1 AND due_date < NOW() AND completed_at IS NULL) AS overdue`,
    [req.body.organization_id]
  );
  const s = stats.rows[0];
  const result = await ai.chat({
    feature: 'productivity_forecast',
    organizationId: req.body.organization_id, userId: req.userId,
    messages: [
      { role: 'system', content: 'You are a productivity coach. Respond with JSON: { "score": 0-100, "trend": "up"|"down"|"flat", "insights": [string], "actions": [string] }' },
      { role: 'user', content: `Last 7d: ${s.done_7d} done, ${s.created_7d} created. Open: ${s.open}. Overdue: ${s.overdue}.` },
    ],
  });
  try { return ok(res, { ...JSON.parse(result.text), stats: s, provider: result.provider }); }
  catch { return ok(res, { raw: result.text, stats: s, provider: result.provider }); }
}));

router.post('/smart-recommendations', [body('organization_id').isUUID()], validate, asyncHandler(async (req, res) => {
  const r = await db.query(
    `SELECT id, title, priority, due_date, status_id, assignee_id, project_id FROM tasks
     WHERE organization_id=$1 AND is_archived=false AND completed_at IS NULL
     ORDER BY (CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END), due_date ASC NULLS LAST LIMIT 50`,
    [req.body.organization_id]
  );
  const result = await ai.chat({
    feature: 'smart_recommendations',
    organizationId: req.body.organization_id, userId: req.userId,
    messages: [
      { role: 'system', content: 'You suggest the 3 most important next actions. Respond with JSON: { "recommendations": [ { "task_id": string, "reason": string, "urgency": "now"|"today"|"this_week" } ] }' },
      { role: 'user', content: `Top open tasks: ${JSON.stringify(r.rows)}` },
    ],
  });
  try { return ok(res, { ...JSON.parse(result.text), provider: result.provider }); }
  catch { return ok(res, { raw: result.text, provider: result.provider }); }
}));

router.post('/generate-subtasks', [body('title').notEmpty(), body('description').optional()], validate, asyncHandler(async (req, res) => {
  const result = await ai.chat({
    feature: 'generate_subtasks',
    organizationId: req.body.organization_id, userId: req.userId,
    messages: [
      { role: 'system', content: 'You break a task into clear subtasks. Respond with JSON: { "subtasks": [ { "title": string, "estimate_minutes": number } ] }' },
      { role: 'user', content: `Task: ${req.body.title}\n${req.body.description || ''}` },
    ],
  });
  try { return ok(res, { ...JSON.parse(result.text), provider: result.provider }); }
  catch { return ok(res, { raw: result.text, provider: result.provider }); }
}));

router.post('/rewrite', [body('text').notEmpty()], validate, asyncHandler(async (req, res) => {
  const result = await ai.chat({
    feature: 'rewrite',
    organizationId: req.body.organization_id, userId: req.userId,
    messages: [
      { role: 'system', content: 'You rewrite text in a clear, professional tone.' },
      { role: 'user', content: `Tone: ${req.body.tone || 'professional'}.\n\n${req.body.text}` },
    ],
  });
  return ok(res, result);
}));

router.post('/translate', [body('text').notEmpty(), body('to').notEmpty()], validate, asyncHandler(async (req, res) => {
  const result = await ai.chat({
    feature: 'translate',
    organizationId: req.body.organization_id, userId: req.userId,
    messages: [
      { role: 'system', content: `You are a professional translator. Translate to ${req.body.to}. Preserve formatting and tone.` },
      { role: 'user', content: req.body.text },
    ],
  });
  return ok(res, result);
}));

module.exports = router;
