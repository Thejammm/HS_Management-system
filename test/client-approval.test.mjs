// Client approve or query - accreditation engine step 4. The rules behind the
// approval card: approval counts for the version approved, a query stays open
// until answered, every click is on the log. Node only. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const R = p => path.join(here, '..', p);
const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(R('public/reports/cl-bank.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(R('public/reports/accred-core.js'), 'utf8'), ctx);
const A = ctx.AccredCore;
const e = (action, o) => Object.assign({ id: 'e' + Math.random().toString(36).slice(2, 7), at: '2026-10-13T10:00:00Z', by: 'Robert Smith', role: 'client_user', action, version: 'v1' }, o || {});

test('a document not sent for approval has no approval status', () => {
  const ap = A.approvalOf({ id: 'd1', name: 'H&S Policy', version: 'v1' });
  assert.equal(ap.status, 'none'); assert.equal(ap.required, false); assert.equal(ap.log.length, 0);
});

test('sent, then approved and signed for that version', () => {
  const d = { id: 'd1', name: 'H&S Policy', version: 'v1', approval: { required: true }, approvalLog: [e('sent', { role: 'consultant', by: 'Simon Archer' })] };
  assert.equal(A.approvalOf(d).status, 'awaiting');
  assert.equal(A.approvalOf(d).label, 'Awaiting approval');
  d.approvalLog.push(e('approved'));
  const ap = A.approvalOf(d);
  assert.equal(ap.status, 'approved'); assert.equal(ap.approved.by, 'Robert Smith'); assert.equal(ap.approved.version, 'v1');
  // a new version needs approving again; the old approval stays on the log
  d.version = 'v2';
  const ap2 = A.approvalOf(d);
  assert.equal(ap2.status, 'awaiting'); assert.equal(ap2.label, 'New version to approve');
  assert.equal(ap2.lastApproved.version, 'v1');
  assert.equal(ap2.log.length, 2);
});

test('a query stays open until AHS Ltd answers it, and it is listed for Triage', () => {
  const q = e('query', { text: 'Section 4 names the wrong director.' });
  const d = { id: 'd1', name: 'H&S Policy', version: 'v1', approval: { required: true }, approvalLog: [q] };
  assert.equal(A.approvalOf(d).status, 'query');
  const open = A.openQueries({ documents: [d, { id: 'd2', name: 'Other' }] });
  assert.equal(open.length, 1); assert.equal(open[0].docId, 'd1'); assert.equal(open[0].query.text, 'Section 4 names the wrong director.');
  d.approvalLog.push(e('answered', { re: q.id, role: 'consultant', text: 'Corrected in v2.' }));
  assert.equal(A.openQueries({ documents: [d] }).length, 0);
  assert.equal(A.approvalOf(d).status, 'awaiting');
  assert.ok(A.approvalOf(d).answered[q.id]);
});

test('the version key is the version, else the date', () => {
  assert.equal(A.docVersionKey({ version: 'v3', dated: '2026-10-01' }), 'v3');
  assert.equal(A.docVersionKey({ dated: '2026-10-01' }), '2026-10-01');
  assert.equal(A.docVersionKey({}), 'unversioned');
});
