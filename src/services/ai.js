const config = require('../config');
const cache = require('./cache');
const db = require('../db/pool');
const { HttpError } = require('../utils/http');

const PROVIDERS = ['groq', 'gemini', 'openai', 'deepseek', 'huggingface', 'anthropic'];

const recordUsage = async ({ organizationId, userId, feature, provider, model, promptTokens = 0, completionTokens = 0, cost = 0, metadata = {} }) => {
  try {
    await db.query(
      `INSERT INTO ai_usage(organization_id, user_id, feature, provider, model, prompt_tokens, completion_tokens, cost, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [organizationId, userId, feature, provider, model, promptTokens, completionTokens, cost, JSON.stringify(metadata)]
    );
  } catch (e) {
    console.error('[ai] usage log failed', e.message);
  }
};

const cacheKey = (feature, input) =>
  `ai:${feature}:${Buffer.from(JSON.stringify(input)).toString('base64').slice(0, 64)}`;

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, r) => setTimeout(() => r(new Error('AI timeout')), ms))]);

const httpPost = async (url, body, headers) => {
  const r = await withTimeout(
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }),
    config.ai.timeout
  );
  return r;
};

const callGroq = async (messages, opts = {}) => {
  if (!config.ai.groqKey) throw new Error('groq no key');
  const r = await httpPost(
    'https://api.groq.com/openai/v1/chat/completions',
    { model: opts.model || 'llama-3.3-70b-versatile', messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 1024 },
    { Authorization: `Bearer ${config.ai.groqKey}` }
  );
  if (!r.ok) throw new Error(`groq ${r.status}`);
  const j = await r.json();
  return { provider: 'groq', text: j.choices?.[0]?.message?.content || '', model: j.model, usage: j.usage };
};

const callOpenAI = async (messages, opts = {}) => {
  if (!config.ai.openaiKey) throw new Error('openai no key');
  const r = await httpPost(
    'https://api.openai.com/v1/chat/completions',
    { model: opts.model || 'gpt-4o-mini', messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 1024 },
    { Authorization: `Bearer ${config.ai.openaiKey}` }
  );
  if (!r.ok) throw new Error(`openai ${r.status}`);
  const j = await r.json();
  return { provider: 'openai', text: j.choices?.[0]?.message?.content || '', model: j.model, usage: j.usage };
};

const callGemini = async (messages, opts = {}) => {
  if (!config.ai.geminiKey) throw new Error('gemini no key');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const system = messages.find((m) => m.role === 'system')?.content;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model || 'gemini-1.5-flash'}:generateContent?key=${config.ai.geminiKey}`;
  const body = { contents, ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}) };
  const r = await httpPost(url, body);
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return { provider: 'gemini', text, model: opts.model || 'gemini-1.5-flash' };
};

const callDeepSeek = async (messages, opts = {}) => {
  if (!config.ai.deepseekKey) throw new Error('deepseek no key');
  const r = await httpPost(
    `${config.ai.deepseekBase}/v1/chat/completions`,
    { model: opts.model || 'deepseek-chat', messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 1024 },
    { Authorization: `Bearer ${config.ai.deepseekKey}` }
  );
  if (!r.ok) throw new Error(`deepseek ${r.status}`);
  const j = await r.json();
  return { provider: 'deepseek', text: j.choices?.[0]?.message?.content || '', model: j.model, usage: j.usage };
};

const callHuggingFace = async (messages, opts = {}) => {
  if (!config.ai.hfKey) throw new Error('huggingface no key');
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const r = await httpPost(
    'https://api-inference.huggingface.co/models/microsoft/DialoGPT-large',
    { inputs: prompt, parameters: { max_new_tokens: opts.maxTokens || 256 } },
    { Authorization: `Bearer ${config.ai.hfKey}` }
  );
  if (!r.ok) throw new Error(`huggingface ${r.status}`);
  const j = await r.json();
  const text = (Array.isArray(j) ? j[0]?.generated_text : j?.generated_text) || '';
  return { provider: 'huggingface', text, model: 'DialoGPT-large' };
};

const callAnthropic = async (messages, opts = {}) => {
  if (!config.ai.anthropicKey) throw new Error('anthropic no key');
  const r = await httpPost(
    'https://api.anthropic.com/v1/messages',
    { model: opts.model || 'claude-3-5-sonnet-20241022', max_tokens: opts.maxTokens || 1024, messages: messages.filter((m) => m.role !== 'system'), system: messages.find((m) => m.role === 'system')?.content },
    { 'x-api-key': config.ai.anthropicKey, 'anthropic-version': '2023-06-01' }
  );
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const j = await r.json();
  return { provider: 'anthropic', text: j.content?.[0]?.text || '', model: j.model, usage: j.usage };
};

const order = (preferred) => {
  const list = [preferred, ...PROVIDERS].filter(Boolean);
  return [...new Set(list)];
};

const chat = async ({ messages, feature = 'chat', organizationId, userId, prefer, opts = {}, useCache = true }) => {
  if (!config.features.ai) throw HttpError.forbidden('AI disabled');
  const ck = cacheKey(feature, { messages, opts });
  if (useCache) {
    const cached = await cache.get(ck);
    if (cached) return { ...cached, cached: true };
  }
  const errors = [];
  for (const provider of order(prefer || config.ai.provider)) {
    try {
      let result;
      if (provider === 'groq') result = await callGroq(messages, opts);
      else if (provider === 'openai') result = await callOpenAI(messages, opts);
      else if (provider === 'gemini') result = await callGemini(messages, opts);
      else if (provider === 'deepseek') result = await callDeepSeek(messages, opts);
      else if (provider === 'huggingface') result = await callHuggingFace(messages, opts);
      else if (provider === 'anthropic') result = await callAnthropic(messages, opts);
      else continue;
      await recordUsage({
        organizationId, userId, feature, provider: result.provider, model: result.model,
        promptTokens: result.usage?.prompt_tokens, completionTokens: result.usage?.completion_tokens,
      });
      const payload = { text: result.text, provider: result.provider, model: result.model };
      if (useCache) cache.request(`/set/${cache.key(ck)}/EX/${config.ai.cacheTtl}`, { method: 'POST', body: payload }).catch(() => {});
      return payload;
    } catch (e) {
      errors.push({ provider, error: e.message });
    }
  }
  return {
    text: '',
    provider: null,
    model: null,
    fallback: true,
    errors,
  };
};

const generateJSON = async ({ system, user, feature, organizationId, userId, prefer, opts = {} }) => {
  const res = await chat({
    feature,
    organizationId,
    userId,
    prefer,
    opts: { ...opts, response_format: { type: 'json_object' } },
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user + '\n\nRespond ONLY with valid JSON.' },
    ],
  });
  try { return JSON.parse(res.text); } catch { return { raw: res.text, fallback: res.fallback }; }
};

const summarize = (text) => chat({
  feature: 'summarize',
  messages: [
    { role: 'system', content: 'You are a concise summarizer. Output 3-5 bullet points.' },
    { role: 'user', content: text },
  ],
  opts: { maxTokens: 400 },
});

const embed = async (input) => {
  if (config.ai.openaiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.openaiKey}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input }),
      });
      if (r.ok) {
        const j = await r.json();
        return j.data?.[0]?.embedding || null;
      }
    } catch {}
  }
  return null;
};

module.exports = { chat, generateJSON, summarize, embed, PROVIDERS };
