const { fetch: undiciFetch } = require('undici');

class Cache {
  constructor({ baseUrl, token, namespace = 'apogee' }) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.namespace = namespace;
    this.enabled = Boolean(baseUrl && token);
  }

  async request(path, { method = 'GET', body } = {}) {
    if (!this.enabled) return null;
    const url = `${this.baseUrl}${path}`;
    const headers = { Authorization: `Bearer ${this.token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      const r = await undiciFetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) return null;
      const data = await r.json();
      return data.result ?? data;
    } catch (e) {
      console.warn('[cache] request failed', e.message);
      return null;
    }
  }

  key(...parts) {
    return `${this.namespace}:${parts.join(':')}`;
  }

  async get(...parts) {
    return this.request(`/get/${this.key(...parts)}`);
  }

  async set(...partsAndValue) {
    const value = partsAndValue.pop();
    const parts = partsAndValue;
    return this.request(`/set/${this.key(...parts)}/EX?`, { method: 'POST', body: value });
  }

  async del(...parts) {
    return this.request(`/del/${this.key(...parts)}`, { method: 'POST' });
  }

  async incr(...parts) {
    return this.request(`/incr/${this.key(...parts)}`);
  }

  async expire(...partsAndSeconds) {
    const seconds = partsAndSeconds.pop();
    const parts = partsAndSeconds;
    return this.request(`/expire/${this.key(...parts)}/${seconds}`, { method: 'POST' });
  }

  // High-level helpers
  async remember(key, ttl, factory) {
    const cached = await this.get(key);
    if (cached !== null) return cached;
    const value = await factory();
    if (value !== undefined && value !== null) {
      await this.request(`/set/${this.key(key)}/EX/${ttl}`, { method: 'POST', body: value });
    }
    return value;
  }
}

module.exports = new Cache({
  baseUrl: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  namespace: 'apogee',
});
