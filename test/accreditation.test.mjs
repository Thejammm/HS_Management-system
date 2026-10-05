// Accreditation journey - the rules in public/reports/accred-core.js, which the
// Accreditation tab, the cockpit and the board report all read. Node only.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';
import { buildReport } from '../public/reports/templates/index.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const CORE = path.join(here, '..', 'public', 'reports', 'accred-core.js');
const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(CORE, 'utf8'), ctx);
const A = ctx.AccredCore;

const TODAY = '2026-10-05';
const ago = months => A.addMonths(TODAY, -months);
const ahead = days => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const base = (answers, extra) => Object.assign({ accred: { roles: ['contractor'], schemes: { cl: { on: true } }, answers: answers || {} } }, extra || {});
const st = (state, id) => A.statusOf(state, A.byId(id), TODAY);
// The core runs in its own context; copy what it returns before comparing
// structures, or strict equality trips over the other context's Array.
const J = x => JSON.parse(JSON.stringify(x));

test('the master list is the seed, whole: 77 questions keyed by common id', () => {
  assert.equal(A.MASTER.questions.length, 77);
  const ids = A.MASTER.questions.map(q => q.id);
  assert.equal(new Set(ids).size, 77, 'a common id appears twice');
  assert.ok(ids.every(id => /^[A-Z]{2}-\d{2}$/.test(id)));
  assert.equal(A.MASTER.questions.filter(q => q.site).length, 14, 'the seed names 14 questions a site inspection can evidence');
  assert.ok(A.MASTER.questions.every(q => A.AREAS.includes(q.area)), 'a question sits in an area the journey does not walk');
  assert.equal(A.MASTER.questions.filter(q => q.cas).length, 25, 'the seed marks 25 questions mandatory under the Common Assessment Standard');
});

test('only the questions for the chosen scheme and role appear', () => {
  assert.equal(A.questions({}).length, 0, 'nothing shows before a scheme and role are chosen');
  assert.equal(A.questions(base()).length, 72, 'contractor');
  assert.equal(A.questions({ accred: { roles: ['designer'], schemes: { cl: { on: true } } } }).length, 69, 'designer');
  assert.equal(A.questions({ accred: { roles: ['pc'], schemes: { cl: { on: true } } } }).length, 72, 'a principal contractor answers the contractor questions');
  assert.equal(A.questions({ accred: { roles: ['contractor', 'designer'], schemes: { cl: { on: true } } } }).length, 77);
  assert.equal(A.questions({ accred: { roles: ['contractor'], schemes: { chas: { on: true } } } }).length, 0, 'CHAS has no questions captured, so it shows none rather than inventing them');
  // a set named for the other role never appears for a contractor
  assert.ok(!A.setsOn(A.cfgOf(base()), 'cl').includes('cl_ssip_designer'));
  // switching a requirement off takes its questions out
  const off = base(); off.accred.schemes.cl.setsOff = { cl_bsa_hrb_infractions: true };
  assert.ok(!A.questions(off).some(q => q.id === 'BS-09'), 'BS-09 is only asked in the HRB infractions set');
});

test('freshness and expiry are worked out from the dates, never typed', () => {
  const docs = [
    { id: 'old', name: 'Old policy', dated: ago(13) },
    { id: 'near', name: 'Near policy', dated: A.addMonths(ahead(30), -12) },
    { id: 'fresh', name: 'Fresh policy', dated: ago(2) },
    { id: 'undated', name: 'Undated policy' },
    { id: 'signed', name: 'Signed policy', dated: ago(2), signedBy: 'J Morley', signedDirector: true },
    { id: 'unsigned', name: 'Unsigned policy', dated: ago(2), signedBy: 'Office manager', signedDirector: false },
  ];
  const mems = [{ id: 'm-past', name: 'SSIP', expiry: ahead(-3) }, { id: 'm-soon', name: 'SSIP', expiry: ahead(20) }, { id: 'm-long', name: 'SSIP', expiry: ahead(300) }, { id: 'm-none', name: 'SSIP' }];
  const s = (qid, ev) => st(base({ [qid]: { ev } }, { documents: docs, memberships: mems }), qid);
  // HS-03: "Dated within last 12 months"
  assert.deepEqual([s('HS-03', { src: 'doc', id: 'old' }).k, s('HS-03', { src: 'doc', id: 'old' }).why], ['gap', 'Older than 12 months']);
  const near = s('HS-03', { src: 'doc', id: 'near' });
  assert.equal(near.k, 'due'); assert.equal(near.days, 30); assert.equal(near.expires, ahead(30));
  assert.equal(s('HS-03', { src: 'doc', id: 'fresh' }).k, 'evidenced');
  assert.match(s('HS-03', { src: 'doc', id: 'undated' }).why, /date of Undated policy is not recorded/);
  // GV-01: "Signed and dated by a director within last 12 months"
  assert.equal(s('GV-01', { src: 'doc', id: 'signed' }).k, 'evidenced');
  assert.deepEqual([s('GV-01', { src: 'doc', id: 'unsigned' }).k, s('GV-01', { src: 'doc', id: 'unsigned' }).why], ['gap', 'Not signed by a director']);
  // SS-01: "Certificate in date"
  assert.deepEqual([s('SS-01', { src: 'mem', id: 'm-past' }).k, s('SS-01', { src: 'mem', id: 'm-past' }).why], ['gap', 'Expired']);
  assert.equal(s('SS-01', { src: 'mem', id: 'm-soon' }).k, 'due');
  assert.equal(s('SS-01', { src: 'mem', id: 'm-long' }).k, 'evidenced');
  assert.match(s('SS-01', { src: 'mem', id: 'm-none' }).why, /expiry date .* is not recorded/);
  // nothing picked is a gap; a picked record that has gone says so
  assert.equal(st(base(), 'HS-03').why, 'No evidence picked');
  assert.match(s('HS-03', { src: 'doc', id: 'gone' }).why, /no longer in the register/);
  // the leap-year edge: 29 Feb plus a year is 28 Feb
  assert.equal(A.addMonths('2024-02-29', 12), '2025-02-28');
});

test('the awkward states: not applicable and answered elsewhere carry their reason', () => {
  assert.deepEqual(['na', 'No higher-risk buildings'], (x => [x.k, x.why])(st(base({ 'BS-08': { na: 'No higher-risk buildings' } }), 'BS-08')));
  assert.equal(st(base({ 'SS-01': { elsewhere: 'SSIP held through CHAS' } }), 'SS-01').k, 'elsewhere');
  assert.equal(st(base({ 'BS-08': { na: '   ' } }), 'BS-08').k, 'gap', 'a blank reason is no reason');
  assert.equal(st(base({ 'HS-01': { text: 'J Morley' } }), 'HS-01').k, 'evidenced');
  assert.equal(st(base({ 'HS-05': { decl: 'no' } }), 'HS-05').why, 'Declared No');
});

test('a rejection keeps its history, and resubmitting clears the rejected state', () => {
  const rej = { ev: { src: 'doc', id: 'd' }, hist: [{ t: 'rejected', at: '2026-08-13', note: 'This is the anti-bribery policy', ev: 'Anti-bribery policy' }] };
  const docs = [{ id: 'd', name: 'Anti-bullying policy', dated: ago(1) }];
  const r1 = st(base({ 'GV-09': rej }, { documents: docs }), 'GV-09');
  assert.equal(r1.k, 'rejected'); assert.match(r1.why, /2026-08-13: This is the anti-bribery policy/);
  const resub = JSON.parse(JSON.stringify(rej)); resub.hist.push({ t: 'resubmitted', at: '2026-08-20', ev: 'Anti-bullying policy' });
  const r2 = st(base({ 'GV-09': resub }, { documents: docs }), 'GV-09');
  assert.equal(r2.k, 'evidenced', 'once resubmitted the line reads from its evidence again');
  assert.equal(resub.hist.length, 2, 'the history is kept, not replaced');
});

test('answer once: one answer covers every scheme question that shares the id', () => {
  const s = base({ 'HS-01': { text: 'J Morley, Managing Director' } });
  const used = J(A.usedIn(A.byId('HS-01'), s).map(u => u.set));
  assert.deepEqual(used, ['cl_ssip_contractor', 'cl_hs_thirdparty'], 'HS-01 is asked in the SSIP contractor set and the third-party set');
  const groups = J(A.packRows(s, 'cl', TODAY));
  const hits = groups.flatMap(g => g.rows.filter(r => r.id === 'HS-01').map(r => ({ set: g.set, answer: r.answer, refs: r.refs })));
  assert.deepEqual(hits.map(h => h.set), ['cl_ssip_contractor', 'cl_hs_thirdparty']);
  assert.ok(hits.every(h => h.answer === 'J Morley, Managing Director'), 'every set carries the one answer');
  assert.deepEqual(hits[0].refs, [2827]);
  // the pack keeps the scheme's own order: sets as listed, REF ascending within each
  const crg = groups.find(g => g.set === 'cl_crg');
  const firsts = crg.rows.map(r => r.first);
  assert.deepEqual(firsts, firsts.slice().sort((a, b) => a - b));
});

test('site inspection evidence stands in only where nothing was picked', () => {
  const siteEvidence = { la1: { records: [{ inspectionId: 'i1', project: 'Woldgate School', visit: 3, date: ago(1), items: [{ qids: ['HS-17'], check: 'Workforce consultation', note: 'Weekly TBT signed', photo: '' }] }] } };
  const free = st(base({}, { siteEvidence }), 'HS-17');
  assert.equal(free.k, 'evidenced'); assert.equal(free.why, 'From a site inspection');
  assert.equal(free.ev.picked, false);
  const docs = [{ id: 'd', name: 'Consultation minutes', dated: ago(14) }];
  const chosen = st(base({ 'HS-17': { ev: { src: 'doc', id: 'd' } } }, { siteEvidence, documents: docs }), 'HS-17');
  assert.equal(chosen.ev.facts.name, 'Consultation minutes', 'the client’s chosen document is never overwritten');
  assert.equal(chosen.k, 'gap', 'and its own freshness still applies');
  // a site inspection older than 12 months does not count
  const stale = { la1: { records: [{ inspectionId: 'i0', project: 'X', date: ago(13), items: [{ qids: ['HS-17'], check: 'c' }] }] } };
  assert.equal(st(base({}, { siteEvidence: stale }), 'HS-17').k, 'gap');
});

test('focus areas are the open questions a site inspection can evidence', () => {
  const f = A.focusFor(base({ 'CN-02': { na: 'No hazardous substances' } }), TODAY).map(x => x.id);
  assert.ok(f.length && f.every(id => A.byId(id).site), 'only questions a site inspection can evidence');
  assert.ok(!f.includes('CN-02'), 'a question marked not applicable is not asked for');
  assert.ok(!f.some(id => !A.byId(id).roles.includes('contractor')));
});

test('the summary counts are the lines, and the readiness figure follows them', () => {
  const s = base({ 'HS-01': { text: 'x' }, 'HS-05': { decl: 'yes' }, 'BS-08': { na: 'none' } });
  const m = A.summary(s, TODAY);
  assert.equal(m.total, 72);
  assert.equal(Object.values(m.counts).reduce((a, b) => a + b, 0), m.total, 'every line is counted once');
  assert.equal(m.ready, 2); assert.equal(m.assessable, 71); assert.equal(m.pct, Math.round(2 / 71 * 100));
  assert.ok(m.mandatoryGap.every(id => A.byId(id).cas));
  assert.equal(A.summary({}, TODAY).started, false);
});

test('the board report reads the journey once it is started, and the CAS assessment until then', () => {
  const OPTS = { period: 'Q4 2026', today: TODAY };
  const pageOf = r => (r.pages || []).find(p => p.section === 'readiness');
  const titleOf = p => (p.blocks.find(b => b.type === 'titleBlock') || {});
  const old = { cas: { status: { '71': { v: 'ready' }, '72': { v: 'gap' } } } };
  const before = titleOf(pageOf(buildReport(old, 'board-report', OPTS)));
  assert.match(before.kicker, /Common Assessment Standard/, 'a client who has not started the journey keeps the CAS page');
  const started = Object.assign({}, old, base({ 'GV-09': { hist: [{ t: 'rejected', at: '2026-08-13', note: 'wrong policy' }] } }));
  const page = pageOf(buildReport(started, 'board-report', OPTS));
  const t = titleOf(page);
  assert.match(t.kicker, /Constructionline Gold/);
  assert.match(t.headline, /1 answer was rejected/);
  const bars = page.blocks.find(b => b.type === 'distributionBars');
  const m = A.summary(started, TODAY);
  assert.deepEqual(bars.items.map(i => i.n), [m.counts.evidenced, m.counts.due, m.counts.rejected, m.counts.gap, m.counts.na + m.counts.elsewhere], 'the report shows exactly what the tab counts');
});
