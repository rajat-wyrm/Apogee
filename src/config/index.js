require('dotenv').config();

const env = (key, fallback) =>
  process.env[key] !== undefined && process.env[key] !== '' ? process.env[key] : fallback;

const num = (key, fallback) => {
  const v = parseInt(process.env[key], 10);
  return Number.isFinite(v) ? v : fallback;
};

const bool = (key, fallback) => {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

const list = (key, fallback = []) => {
  const v = process.env[key];
  if (!v) return fallback;
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
};

module.exports = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV !== 'production',

  port: num('PORT', 5000),
  appUrl: env('APP_URL', 'http://localhost:5173'),
  backendUrl: env('BACKEND_URL', ''),
  frontendUrl: env('FRONTEND_URL', ''),
  corsOrigin: (env('CORS_ORIGIN', 'http://localhost:5173') || '').split(',').map((s) => s.trim()),

  apiKey: env('API_KEY', 'apogee-secret'),

  jwt: {
    secret: env('JWT_SECRET', 'dev-secret-change-me'),
    refreshSecret: env('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    accessExpires: env('JWT_EXPIRES_IN', '15m'),
    refreshExpires: env('JWT_REFRESH_EXPIRES_IN', '30d'),
  },

  database: {
    url: env('DATABASE_URL', ''),
    poolMax: num('DB_POOL_MAX', 20),
    idleTimeout: num('DB_IDLE_TIMEOUT', 30000),
  },

  redis: {
    url: env('UPSTASH_REDIS_REST_URL', ''),
    token: env('UPSTASH_REDIS_REST_TOKEN', ''),
  },

  google: {
    clientId: env('GOOGLE_CLIENT_ID', ''),
    clientSecret: env('GOOGLE_CLIENT_SECRET', ''),
  },

  otp: {
    provider: env('OTP_PROVIDER', 'fast2sms'),
    fast2smsKey: env('FAST2SMS_API_KEY', ''),
    ttlSeconds: num('OTP_TTL', 300),
  },

  ai: {
    provider: env('AI_PROVIDER', 'groq'),
    timeout: num('AI_TIMEOUT', 15000),
    groqKey: env('GROQ_API_KEY', ''),
    openaiKey: env('OPENAI_API_KEY', ''),
    geminiKey: env('GEMINI_API_KEY', ''),
    deepseekKey: env('DEEPSEEK_API_KEY', ''),
    deepseekBase: env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
    hfKey: env('HUGGINGFACE_API_KEY', env('HUGGINGFACE_TOKEN', '')),
    anthropicKey: env('ANTHROPIC_API_KEY', ''),
    fastapiUrl: env('FASTAPI_URL', ''),
    cacheTtl: num('AI_CACHE_TTL', 3600),
  },

  socket: {
    path: env('SOCKET_PATH', '/socket.io'),
    cors: list('SOCKET_CORS', ['http://localhost:5173']),
  },

  stripe: {
    secretKey: env('STRIPE_SECRET_KEY', ''),
    webhookSecret: env('STRIPE_WEBHOOK_SECRET', ''),
    publishableKey: env('STRIPE_PUBLISHABLE_KEY', ''),
  },

  cloudinary: {
    cloudName: env('CLOUDINARY_CLOUD_NAME', ''),
    apiKey: env('CLOUDINARY_API_KEY', ''),
    apiSecret: env('CLOUDINARY_API_SECRET', ''),
    folder: env('CLOUDINARY_FOLDER', 'apogee'),
    secure: bool('CLOUDINARY_SECURE', true),
  },

  email: {
    provider: env('EMAIL_PROVIDER', 'log'),
    from: env('EMAIL_FROM', 'noreply@apogee.local'),
    smtp: {
      host: env('SMTP_HOST', 'localhost'),
      port: num('SMTP_PORT', 1025),
      secure: bool('SMTP_SECURE', false),
      user: env('SMTP_USER', ''),
      pass: env('SMTP_PASS', ''),
    },
  },

  rateLimit: {
    windowMs: num('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    authMax: num('AUTH_RATE_LIMIT_MAX', 50),
  },

  features: {
    registration: bool('ENABLE_REGISTRATION', true),
    oauth: bool('ENABLE_OAUTH', true),
    twoFactor: bool('ENABLE_2FA', true),
    ai: bool('ENABLE_AI', true),
    billing: bool('ENABLE_BILLING', true),
    fileUploads: bool('ENABLE_FILE_UPLOADS', true),
    realtime: bool('ENABLE_REALTIME', true),
    analytics: bool('ENABLE_ANALYTICS', true),
    auditLogs: bool('ENABLE_AUDIT_LOGS', true),
    webhooks: bool('ENABLE_WEBHOOKS', true),
  },
};
