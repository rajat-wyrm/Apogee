const config = require('../config');

let transporter = null;
const init = () => {
  if (transporter) return transporter;
  if (config.email.provider === 'log' || !config.email.smtp.host) {
    transporter = { sendMail: async (opts) => { console.log('[email]', opts.to, opts.subject); return { messageId: 'logged' }; } };
    return transporter;
  }
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: config.email.smtp.user ? { user: config.email.smtp.user, pass: config.email.smtp.pass } : undefined,
    });
  } catch (e) {
    console.warn('[email] transporter init failed', e.message);
    transporter = { sendMail: async (opts) => { console.log('[email-fallback]', opts.to, opts.subject); return { messageId: 'logged' }; } };
  }
  return transporter;
};

const send = async ({ to, subject, html, text, from }) => {
  const t = init();
  return t.sendMail({ from: from || config.email.from, to, subject, html, text });
};

const sendTemplate = async ({ to, subject, template, data }) => {
  const html = renderTemplate(template, data);
  return send({ to, subject, html });
};

const renderTemplate = (name, data) => {
  const wrap = (inner) => `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;color:#0f172a">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6)"></div>
      <strong style="font-size:18px">Apogee</strong>
    </div>
    ${inner}
    <hr style="margin:32px 0;border:none;border-top:1px solid #e2e8f0"/>
    <small style="color:#64748b">© ${new Date().getFullYear()} Apogee. All rights reserved.</small>
  </div>`;
  if (name === 'welcome') {
    return wrap(`<h1 style="font-size:24px;margin:0 0 12px">Welcome, ${data.name}!</h1><p>${data.message || 'Your productivity platform is ready.'}</p><a href="${data.url}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open Apogee</a>`);
  }
  if (name === 'reset') {
    return wrap(`<h1 style="font-size:24px;margin:0 0 12px">Reset your password</h1><p>Click below to reset. The link expires in 1 hour.</p><a href="${data.url}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a>`);
  }
  if (name === 'verify') {
    return wrap(`<h1 style="font-size:24px;margin:0 0 12px">Verify your email</h1><p>Confirm your email to finish setting up your account.</p><a href="${data.url}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify email</a>`);
  }
  if (name === 'invite') {
    return wrap(`<h1 style="font-size:24px;margin:0 0 12px">${data.inviter} invited you to ${data.org}</h1><p>Join your team on Apogee to start collaborating.</p><a href="${data.url}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Accept invitation</a>`);
  }
  return wrap(`<pre>${JSON.stringify(data, null, 2)}</pre>`);
};

module.exports = { send, sendTemplate, renderTemplate };
