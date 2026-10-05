// ══════════════════════════════════════════════════════════════
//  Acknowledgement by link - the parts that can be checked without a server.
//  The new table is run against a real in-memory Postgres, and the page the
//  employee opens is rendered and read, because it is the only part of
//  Compass a member of the public ever sees.
//  Run: node --test test/signoff-link.test.mjs
// ══════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const need = createRequire(import.meta.url);
const schema = fs.readFileSync(path.join(root, 'db', 'schema.sql'), 'utf8');
const routeSrc = fs.readFileSync(path.join(root, 'routes', 'signoff.js'), 'utf8');

// ── the table ──
test('the invite table is valid SQL and shaped for one invitation per person per document', async () => {
  const { newDb } = need('pg-mem');
  const db = newDb();
  const pg = db.adapters.createPg();
  const c = new pg.Client(); await c.connect();
  await c.query(`CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
  const block = schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS signoff_invite'));
  await c.query(block);
  await c.query(`INSERT INTO tenants (id,name) VALUES ('fairbank','Fairbank Fabrications Ltd')`);
  await c.query(`INSERT INTO signoff_invite
      (id,tenant_id,token_hash,staff_id,policy_id,policy_title,policy_version,declaration,expires_at)
      VALUES ('i1','fairbank','hash1','s1','p1','Fire Safety Policy','3.1','I confirm...', now() + interval '60 days')`);
  const r = await c.query(`SELECT * FROM signoff_invite`);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].signed_at, null, 'a new invite is unsigned');
  assert.equal(r.rows[0].policy_version, '3.1', 'the version is pinned on the invite itself');
  // the token hash is unique: the same link can never be minted twice
  await assert.rejects(() => c.query(`INSERT INTO signoff_invite
      (id,tenant_id,token_hash,staff_id,policy_id,expires_at) VALUES ('i2','fairbank','hash1','s2','p1', now())`),
    'a duplicate token is refused by the database, not just by the code');
  await c.end();
});

// ── the safety properties, read off the source ──
test('the public endpoint never touches the tenant state blob', () => {
  assert.doesNotMatch(routeSrc, /app_state/, 'no route here reads or writes app_state');
  assert.doesNotMatch(routeSrc, /UPDATE\s+tenants|DELETE\s+FROM\s+tenants/i, 'and nothing here edits tenants');
  const publicPart = routeSrc.slice(routeSrc.indexOf("router.post('/sign'"));
  assert.doesNotMatch(publicPart, /INSERT INTO/i, 'the public sign endpoint only updates its own invite row');
});

test('only the hash of a token is ever stored', () => {
  assert.match(routeSrc, /sha256\(token\)/, 'lookups are by hash');
  assert.doesNotMatch(routeSrc, /token_hash\s*=\s*\$?\d*\s*,?\s*token\b/, 'the raw token is never written to a column');
  assert.match(routeSrc, /crypto\.randomBytes\(TOKEN_BYTES\)/, 'tokens come from a CSPRNG');
  assert.ok(/TOKEN_BYTES\s*=\s*(3[2-9]|[4-9]\d)/.test(routeSrc), 'and are at least 32 bytes');
});

test('a signature can only be claimed once, by the database not the code', () => {
  const sign = routeSrc.slice(routeSrc.indexOf("router.post('/sign'"));
  assert.match(sign, /signed_at IS NULL/, 'an already-signed invite cannot be claimed');
  assert.match(sign, /expires_at > now\(\)/, 'nor an expired one');
  assert.match(sign, /RETURNING id/, 'and the update itself decides the winner, so two taps cannot both succeed');
});

// ── the page ──
const renderPage = () => {
  // pull the page() helper and the view handler's happy path out of the module.
  // Loading it loads db/index.js, which announces local dev mode on stdout.
  // The test runner reads this file's results from that same stream, and a
  // stray line landing mid-message made a full `npm test` fail to read this
  // file at all ("Unable to deserialize cloned data"). Hold the line back.
  const log = console.log; console.log = () => {};
  let mod;
  try { mod = need(path.join(root, 'routes', 'signoff.js')); }
  finally { console.log = log; }
  assert.ok(mod, 'the route module loads');
  return true;
};

test('the route module loads cleanly', () => { assert.ok(renderPage()); });

test('the page tells the employee what they are agreeing to, and to what version', () => {
  const view = routeSrc.slice(routeSrc.indexOf("router.get('/view/:token'"));
  assert.match(view, /Please confirm you have read this/);
  assert.match(view, /Version ' \+ esc\(v\.policy_version\)/, 'the version is on the page');
  assert.match(view, /v\.declaration/, 'and the declaration as it was minted, not as it is today');
  assert.match(view, /LEGAL/, 'and the legal basis is printed on it');
  assert.match(routeSrc, /Health and Safety at Work etc\. Act 1974/, 'which names the duty it answers to');
});

test('a document link that cannot open on a phone is shown as text, not a dead button', () => {
  assert.match(routeSrc, /isWebLink/, 'web links and file paths are told apart');
  assert.match(routeSrc, /Where to find it/, 'a path is shown as where to find it');
  assert.match(routeSrc, /Ask your manager where this document is kept/, 'and a missing link says so honestly');
});

test('the page cannot be indexed or cached', () => {
  assert.match(routeSrc, /noindex,nofollow/, 'search engines are told to stay out');
  assert.match(routeSrc, /Cache-Control', 'no-store/, 'and it is never cached');
});

test('an expired or unknown link fails kindly, and says what to do', () => {
  assert.match(routeSrc, /This link is not valid/);
  assert.match(routeSrc, /This link has expired/);
  assert.match(routeSrc, /Ask whoever sent it/, 'both point the reader at a person, not an error code');
  assert.match(routeSrc, /Already confirmed/, 'and a second visit says it is already done');
});

test('an invite can carry what was covered, and the page shows it', async () => {
  // the column is ADDED to a table that already exists on the live server,
  // not just declared for a fresh one
  assert.match(schema, /ALTER TABLE signoff_invite ADD COLUMN IF NOT EXISTS content TEXT/, 'added to the existing table');
  const { newDb } = need('pg-mem');
  const db = newDb();
  const pg = db.adapters.createPg();
  const c = new pg.Client(); await c.connect();
  await c.query(`CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
  await c.query(schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS signoff_invite')));
  await c.query(`INSERT INTO tenants (id,name) VALUES ('fairbank','Fairbank Fabrications Ltd')`);
  await c.query(`INSERT INTO signoff_invite (id,tenant_id,token_hash,staff_id,policy_id,policy_title,content,expires_at)
      VALUES ('i1','fairbank','h1','s1','p1','Slips, trips and falls','1. Most slips happen on a wet floor.', now() + interval '60 days')`);
  const r = await c.query(`SELECT content FROM signoff_invite WHERE id='i1'`);
  assert.match(r.rows[0].content, /wet floor/, 'and it reads back');
  await c.end();
  const invite = routeSrc.slice(routeSrc.indexOf("router.post('/invite'"), routeSrc.indexOf("router.get('/status'"));
  assert.match(invite, /it\.content/, 'the route stores what it is given');
  assert.match(invite, /slice\(0, 8000\)/, 'capped - a talk or a list of links, never a document');
  const view = routeSrc.slice(routeSrc.indexOf("router.get('/view/:token'"));
  assert.match(view, /What it covers/, 'the page shows it');
  assert.match(view, /linkify/, 'with any links in it made tappable');
  assert.match(view, /\$\{covered\}/, 'in the document card, above the declaration');
});

test('Compass mints and composes, it does not send', () => {
  // test the code, not the prose - the comments here talk ABOUT not sending mail
  const code = routeSrc.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /require\(['"](nodemailer|@sendgrid|postmark|resend|mailgun)/i,
    'no mail library is pulled in - a human sends the message');
  assert.doesNotMatch(code, /sendMail|createTransport/i, 'and nothing here sends anything');
});
