// The policy drafts route on the real server, in local mode (in-memory
// database, the local seed's test logins). A consultant gets the drafts; a
// client login and an anonymous request do not. Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = 3917, BASE = 'http://127.0.0.1:' + PORT;
let srv;

before(async () => {
  const env = Object.assign({}, process.env, { PORT: String(PORT), SESSION_SECRET: 'local-test-session-secret-at-least-32-characters' });
  delete env.DATABASE_URL;
  srv = spawn(process.execPath, ['server.js'], { cwd: path.join(here, '..'), env, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/healthz'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('the local server did not start');
});
after(() => { if (srv) srv.kill(); });

async function login(email) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'local1234' }) });
  assert.equal(r.status, 200, 'login as ' + email);
  return (r.headers.get('set-cookie') || '').split(';')[0];
}
const ask = (cookie, body) => fetch(BASE + '/api/policy/drafts', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}), body: JSON.stringify(body) });

test('a consultant gets the drafts for the question set', async () => {
  const cookie = await login('consultant@local.test');
  const r = await ask(cookie, { set: 'contractor', facts: { legalName: 'Example Contracting Ltd', shortName: 'ECL' }, today: '2026-10-13' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.drafts.length >= 35, j.drafts.length + ' drafts');
  assert.ok(j.drafts.every(d => d.b64 && d.folder && /_ECL_10_26\.docx$/.test(d.file)));
  assert.ok(j.left.includes('Carbon Reduction Plan'), 'what is not drafted is named');
  const bad = await ask(cookie, { set: 'plumber', facts: {} });
  assert.equal(bad.status, 400);
});

test('a client login and an anonymous request are refused: the templates are AHS Ltd\'s', async () => {
  assert.equal((await ask(null, { set: 'designer', facts: {} })).status, 401);
  const cookie = await login('client@local.test');
  assert.equal((await ask(cookie, { set: 'designer', facts: {} })).status, 403);
});
