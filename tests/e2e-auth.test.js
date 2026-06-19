/* Comprehensive E2E auth test suite */
require('dotenv').config();
const speakeasy = require('speakeasy');
const { request, test, expect, expectOk, section, report, waitForServer, log, colors } = require('./e2e-helpers');

const state = {};

const run = async () => {
  log(colors.bold(colors.cyan(`\n═══════════ E2E AUTH TEST SUITE ═══════════\n`)));
  await waitForServer();

  const ts = Date.now();

  /* ==================== REGISTRATION ==================== */
  section('Registration');
  state.user1 = { email: `auth1+${ts}@e2e.dev`, password: 'Auth1Pass!', full_name: 'Auth One' };
  state.user2 = { email: `auth2+${ts}@e2e.dev`, password: 'Auth2Pass!', full_name: 'Auth Two' };

  await test('Auth', 'Register user1 (valid)', async () => {
    const r = await request('POST', '/auth/register', { body: state.user1 });
    expectOk(r); state.user1.id = r.body.data.user.id; state.user1.access = r.body.data.access; state.user1.refresh = r.body.data.refresh;
  });
  await test('Auth', 'Register user2 (valid)', async () => {
    const r = await request('POST', '/auth/register', { body: state.user2 });
    expectOk(r); state.user2.id = r.body.data.user.id; state.user2.access = r.body.data.access; state.user2.refresh = r.body.data.refresh;
  });
  await test('Auth', 'Reject duplicate email', async () => {
    const r = await request('POST', '/auth/register', { body: state.user1 });
    expect(r.status, 409);
  });
  await test('Auth', 'Reject short password', async () => {
    const r = await request('POST', '/auth/register', { body: { email: `a+${ts}@e2e.dev`, password: '1', full_name: 'X' } });
    expect(r.status, 422);
  });
  await test('Auth', 'Reject invalid email', async () => {
    const r = await request('POST', '/auth/register', { body: { email: 'not-an-email', password: 'validpass1', full_name: 'X' } });
    expect(r.status, 422);
  });
  await test('Auth', 'Reject missing full_name', async () => {
    const r = await request('POST', '/auth/register', { body: { email: `m+${ts}@e2e.dev`, password: 'validpass1' } });
    expect(r.status, 422);
  });
  await test('Auth', 'Reject missing email', async () => {
    const r = await request('POST', '/auth/register', { body: { password: 'validpass1', full_name: 'X' } });
    expect(r.status, 422);
  });
  await test('Auth', 'Register returns user+org+workspace+tokens', async () => {
    const r = await request('POST', '/auth/register', { body: { email: `reg+${ts}@e2e.dev`, password: 'RegPass1234!', full_name: 'Reg User' } });
    expectOk(r);
    if (!r.body.data.user) throw new Error('no user');
    if (!r.body.data.organization) throw new Error('no org');
    if (!r.body.data.workspace) throw new Error('no workspace');
    if (!r.body.data.access) throw new Error('no access token');
    if (!r.body.data.refresh) throw new Error('no refresh token');
  });
  await test('Auth', 'Register sets auth cookies', async () => {
    const r = await request('POST', '/auth/register', { body: { email: `cookie+${ts}@e2e.dev`, password: 'CookiePass1!', full_name: 'Cookie User' } });
    expectOk(r);
    if (!r.headers['set-cookie']) throw new Error('no Set-Cookie header');
  });
  await test('Auth', 'Register with extra fields accepted', async () => {
    const r = await request('POST', '/auth/register', { body: { email: `extra+${ts}@e2e.dev`, password: 'ExtraPass1!', full_name: 'Extra User', phone: '+1234567890', timezone: 'UTC' } });
    expectOk(r);
  });

  /* ==================== LOGIN ==================== */
  section('Login');
  await test('Auth', 'Login with email+password (success)', async () => {
    const r = await request('POST', '/auth/login', { body: { email: state.user1.email, password: state.user1.password } });
    expectOk(r);
    if (!r.body.data.access) throw new Error('no access token');
    if (!r.body.data.refresh) throw new Error('no refresh token');
    state.user1.access = r.body.data.access; state.user1.refresh = r.body.data.refresh;
  });
  await test('Auth', 'Login wrong password → 401', async () => {
    const r = await request('POST', '/auth/login', { body: { email: state.user1.email, password: 'wrongpass' } });
    expect(r.status, 401);
  });
  await test('Auth', 'Login nonexistent user → 401', async () => {
    const r = await request('POST', '/auth/login', { body: { email: `nobody+${ts}@e2e.dev`, password: 'whatever1' } });
    expect(r.status, 401);
  });
  await test('Auth', 'Login missing email → 422', async () => {
    const r = await request('POST', '/auth/login', { body: { password: 'whatever' } });
    expect(r.status, 422);
  });
  await test('Auth', 'Login missing password → 422', async () => {
    const r = await request('POST', '/auth/login', { body: { email: state.user1.email } });
    expect(r.status, 422);
  });
  await test('Auth', 'Login invalid email format → 422', async () => {
    const r = await request('POST', '/auth/login', { body: { email: 'notvalid', password: 'whatever' } });
    expect(r.status, 422);
  });
  await test('Auth', 'Login sets auth cookies', async () => {
    const r = await request('POST', '/auth/login', { body: { email: state.user1.email, password: state.user1.password } });
    expectOk(r);
    if (!r.headers['set-cookie']) throw new Error('no Set-Cookie');
  });

  /* ==================== PROFILE (me) ==================== */
  section('Profile');
  await test('Auth', 'GET /me returns user', async () => {
    const r = await request('GET', '/auth/me', { token: state.user1.access });
    expectOk(r);
    if (r.body.data.user.email !== state.user1.email) throw new Error('email mismatch');
    if (!Array.isArray(r.body.data.organizations)) throw new Error('organizations missing');
  });
  await test('Auth', 'GET /me without token → 401', async () => {
    const r = await request('GET', '/auth/me');
    expect(r.status, 401);
  });
  await test('Auth', 'GET /me invalid token → 401', async () => {
    const r = await request('GET', '/auth/me', { headers: { Authorization: 'Bearer invalid' } });
    expect(r.status, 401);
  });
  await test('Auth', 'PATCH /me update full_name', async () => {
    const r = await request('PATCH', '/auth/me', { token: state.user1.access, body: { full_name: 'Auth Updated' } });
    expectOk(r);
  });
  await test('Auth', 'PATCH /me update timezone', async () => {
    const r = await request('PATCH', '/auth/me', { token: state.user1.access, body: { timezone: 'America/Los_Angeles' } });
    expectOk(r);
  });
  await test('Auth', 'PATCH /me update locale', async () => {
    const r = await request('PATCH', '/auth/me', { token: state.user1.access, body: { locale: 'en-US' } });
    expectOk(r);
  });
  await test('Auth', 'PATCH /me update phone', async () => {
    const r = await request('PATCH', '/auth/me', { token: state.user1.access, body: { phone: '+15551234567' } });
    expectOk(r);
  });
  await test('Auth', 'PATCH /me update preferences', async () => {
    const r = await request('PATCH', '/auth/me', { token: state.user1.access, body: { preferences: { theme: 'dark', notifications: false } } });
    expectOk(r);
  });
  await test('Auth', 'PATCH /me empty body → 400', async () => {
    const r = await request('PATCH', '/auth/me', { token: state.user1.access, body: {} });
    expect(r.status, 400);
  });
  await test('Auth', 'PATCH /me too long full_name → 422', async () => {
    const r = await request('PATCH', '/auth/me', { token: state.user1.access, body: { full_name: 'x'.repeat(300) } });
    expect(r.status, 422);
  });
  await test('Auth', 'PATCH /me without token → 401', async () => {
    const r = await request('PATCH', '/auth/me', { body: { full_name: 'Y' } });
    expect(r.status, 401);
  });

  /* ==================== TOKEN REFRESH ==================== */
  section('Token Refresh');
  await test('Auth', 'Refresh token works', async () => {
    const r = await request('POST', '/auth/refresh', { body: { refresh_token: state.user1.refresh } });
    expectOk(r);
    if (!r.body.data.access) throw new Error('no new access token');
    if (!r.body.data.refresh) throw new Error('no new refresh token');
    state.user1.access = r.body.data.access; state.user1.refresh = r.body.data.refresh;
  });
  await test('Auth', 'Refresh invalid token → 401', async () => {
    const r = await request('POST', '/auth/refresh', { body: { refresh_token: 'invalid-refresh-token' } });
    expect(r.status, 401);
  });
  await test('Auth', 'Refresh token rotation (old revoked)', async () => {
    const oldRefresh = state.user1.refresh;
    const r1 = await request('POST', '/auth/refresh', { body: { refresh_token: oldRefresh } });
    expectOk(r1);
    const r2 = await request('POST', '/auth/refresh', { body: { refresh_token: oldRefresh } });
    expect(r2.status, 401);
    state.user1.access = r1.body.data.access; state.user1.refresh = r1.body.data.refresh;
  });

  /* ==================== PASSWORD RESET ==================== */
  section('Password Reset');
  await test('Auth', 'Forgot password with valid email', async () => {
    const r = await request('POST', '/auth/forgot-password', { body: { email: state.user1.email } });
    expectOk(r);
  });
  await test('Auth', 'Forgot password with unknown email (no leak)', async () => {
    const r = await request('POST', '/auth/forgot-password', { body: { email: `unknown+${ts}@e2e.dev` } });
    expectOk(r);
  });
  await test('Auth', 'Forgot password invalid email → 422', async () => {
    const r = await request('POST', '/auth/forgot-password', { body: { email: 'not-valid' } });
    expect(r.status, 422);
  });
  await test('Auth', 'Reset password with invalid token → 400', async () => {
    const r = await request('POST', '/auth/reset-password', { body: { token: 'invalid-token', password: 'NewPass1234!' } });
    expect(r.status, 400);
  });
  await test('Auth', 'Reset password missing token → 422', async () => {
    const r = await request('POST', '/auth/reset-password', { body: { password: 'NewPass1234!' } });
    expect(r.status, 422);
  });
  await test('Auth', 'Reset password short → 422', async () => {
    const r = await request('POST', '/auth/reset-password', { body: { token: 'x', password: '1' } });
    expect(r.status, 422);
  });

  /* ==================== CHANGE PASSWORD ==================== */
  section('Change Password');
  await test('Auth', 'Change password wrong current → 401', async () => {
    const r = await request('POST', '/auth/change-password', { token: state.user1.access, body: { current_password: 'wrong', new_password: 'NewAuth1Pass!' } });
    expect(r.status, 401);
  });
  await test('Auth', 'Change password too short → 422', async () => {
    const r = await request('POST', '/auth/change-password', { token: state.user1.access, body: { current_password: state.user1.password, new_password: '1' } });
    expect(r.status, 422);
  });
  await test('Auth', 'Change password missing current → 422', async () => {
    const r = await request('POST', '/auth/change-password', { token: state.user1.access, body: { new_password: 'NewAuth1Pass!' } });
    expect(r.status, 422);
  });
  await test('Auth', 'Change password success', async () => {
    const newPw = 'NewAuth1Pass!';
    const r = await request('POST', '/auth/change-password', { token: state.user1.access, body: { current_password: state.user1.password, new_password: newPw } });
    expectOk(r);
    state.user1.password = newPw;
  });
  await test('Auth', 'Login with new password', async () => {
    const r = await request('POST', '/auth/login', { body: { email: state.user1.email, password: state.user1.password } });
    expectOk(r);
    state.user1.access = r.body.data.access; state.user1.refresh = r.body.data.refresh;
  });
  await test('Auth', 'Change password without auth → 401', async () => {
    const r = await request('POST', '/auth/change-password', { body: { current_password: 'whatever', new_password: 'NewPass1234!' } });
    expect(r.status, 401);
  });

  /* ==================== 2FA ==================== */
  section('Two-Factor Authentication');
  state.tfaUser = { email: `tfa+${ts}@e2e.dev`, password: 'TfaPass1234!', full_name: 'Tfa User' };
  await test('Auth', 'Register 2FA test user', async () => {
    const r = await request('POST', '/auth/register', { body: state.tfaUser });
    expectOk(r);
    state.tfaUser.access = r.body.data.access; state.tfaUser.refresh = r.body.data.refresh; state.tfaUser.id = r.body.data.user.id;
  });
  await test('Auth', '2FA enable returns secret + QR', async () => {
    const r = await request('POST', '/auth/2fa/enable', { token: state.tfaUser.access });
    expectOk(r);
    if (!r.body.data.secret) throw new Error('no secret');
    if (!r.body.data.qr) throw new Error('no QR');
    if (!r.body.data.qr.startsWith('data:image/')) throw new Error('QR not a data URL');
    state.tfaSecret = r.body.data.secret;
  });
  await test('Auth', '2FA enable without auth → 401', async () => {
    const r = await request('POST', '/auth/2fa/enable');
    expect(r.status, 401);
  });
  await test('Auth', '2FA confirm with valid code', async () => {
    const code = speakeasy.totp({ secret: state.tfaSecret, encoding: 'base32' });
    const r = await request('POST', '/auth/2fa/confirm', { token: state.tfaUser.access, body: { code } });
    expectOk(r);
    if (!Array.isArray(r.body.data.backup_codes)) throw new Error('no backup codes');
    if (r.body.data.backup_codes.length !== 10) throw new Error('expected 10 backup codes');
  });
  await test('Auth', '2FA confirm with bad code → 400', async () => {
    const r = await request('POST', '/auth/2fa/confirm', { token: state.tfaUser.access, body: { code: '000000' } });
    expect(r.status, 400);
  });
  await test('Auth', '2FA confirm missing code → 422', async () => {
    const r = await request('POST', '/auth/2fa/confirm', { token: state.tfaUser.access, body: {} });
    expect(r.status, 422);
  });
  await test('Auth', 'Login user with 2FA enabled → require2fa', async () => {
    const r = await request('POST', '/auth/login', { body: { email: state.tfaUser.email, password: state.tfaUser.password } });
    expectOk(r);
    if (r.body.data.require2fa !== true) throw new Error('did not return require2fa');
    if (!r.body.data.userId) throw new Error('no userId');
  });
  await test('Auth', '2FA verify with valid code', async () => {
    const code = speakeasy.totp({ secret: state.tfaSecret, encoding: 'base32' });
    const r = await request('POST', '/auth/2fa/verify', { body: { userId: state.tfaUser.id, code } });
    expectOk(r);
    if (!r.body.data.access) throw new Error('no access after 2fa');
  });
  await test('Auth', '2FA verify with bad code → 401', async () => {
    const r = await request('POST', '/auth/2fa/verify', { body: { userId: state.tfaUser.id, code: '000000' } });
    expect(r.status, 401);
  });
  await test('Auth', '2FA disable with bad code → 400', async () => {
    const code = speakeasy.totp({ secret: state.tfaSecret, encoding: 'base32' });
    const loginR = await request('POST', '/auth/2fa/verify', { body: { userId: state.tfaUser.id, code } });
    if (loginR.body?.data?.access) state.tfaUser.access = loginR.body.data.access;
    const r = await request('POST', '/auth/2fa/disable', { token: state.tfaUser.access, body: { code: '000000' } });
    expect(r.status, 400);
  });
  await test('Auth', '2FA disable without auth → 401', async () => {
    const r = await request('POST', '/auth/2fa/disable', { body: { code: '123456' } });
    expect(r.status, 401);
  });

  /* ==================== SESSION MANAGEMENT ==================== */
  section('Session Management');
  await test('Auth', 'Logout success', async () => {
    const r = await request('POST', '/auth/logout', { token: state.user2.access });
    expectOk(r);
  });
  await test('Auth', 'Logout without auth (still ok)', async () => {
    const r = await request('POST', '/auth/logout');
    expectOk(r);
  });
  await test('Auth', 'Logout clears cookies', async () => {
    const r = await request('POST', '/auth/logout', { token: state.user1.access });
    expectOk(r);
    if (!r.headers['set-cookie']) throw new Error('no Set-Cookie');
  });

  /* ==================== OAUTH ==================== */
  section('OAuth');
  await test('OAuth', 'GET /oauth/google (redirect)', async () => {
    const r = await request('GET', '/oauth/google');
    expect(r.status >= 200 && r.status < 400, true, `got ${r.status}`);
  });
  await test('OAuth', 'GET /oauth/github (redirect or 503)', async () => {
    const r = await request('GET', '/oauth/github');
    const ok = (r.status >= 200 && r.status < 400) || r.status === 503;
    expect(ok, true, `got ${r.status}`);
  });
  await test('OAuth', 'GET /oauth/providers', async () => {
    const r = await request('GET', '/oauth/providers');
    expect(r.status >= 200 && r.status < 400, true, `got ${r.status}`);
  });
  await test('OAuth', 'GET /oauth/google/callback (no code)', async () => {
    const r = await request('GET', '/oauth/google/callback');
    expect(r.status >= 200 && r.status < 400, true, `got ${r.status}`);
  });

  report('E2E AUTH');
};

run().catch((e) => { console.error('Fatal:', e); process.exit(2); });
