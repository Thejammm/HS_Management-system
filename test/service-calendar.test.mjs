// Packages and the service calendar - accreditation engine step 5. The three
// packages from the costing workbook, prices left to AHS Ltd, the year's
// schedule by role, and a completed service filed as tagged evidence.
// Node only. Run: npm test
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
const J = x => JSON.parse(JSON.stringify(x));
const TODAY = '2026-10-13';
const st = (roles, pkg, extra) => Object.assign({ accred: Object.assign({ roles, schemes: { cl: { on: true } }, answers: {}, package: pkg }, extra || {}) });
const count = (sched, code) => sched.filter(x => x.code === code).length;

test('the three packages hold the services ticked in the costing workbook', () => {
  assert.equal(A.SERVICES.length, 23);
  assert.deepEqual(J(A.PACKAGES.map(p => p.label)), ['Essentials', 'Standard', 'Complete']);
  assert.deepEqual(J(A.packageOf('essentials').codes), ['S1', 'S2', 'S3', 'S4', 'B2', 'B7', 'B8']);
  assert.deepEqual(J(A.packageOf('standard').codes), ['S1', 'S2', 'S3', 'S4', 'C1', 'C2', 'C5', 'C6', 'D1', 'D3', 'B1', 'B2', 'B4', 'B7', 'B8']);
  assert.equal(A.packageOf('complete').codes.length, 23);
  // every service that answers a question names real CAS questions
  A.SERVICES.forEach(s => s.qids.forEach(id => assert.ok(A.byId(id), s.code + ' names ' + id)));
});

test('prices are AHS Ltd\'s to enter: none by default; a typed price wins; else hours at the day rate', () => {
  const s = st(['contractor'], { id: 'standard', start: '2026-11' });
  const c1 = A.serviceOf('C1');
  assert.equal(A.servicePrice(s, c1).each, null, 'no default price');
  assert.equal(A.packageValue(s).yearly, 0);
  s.accred.package.dayRate = '500';
  assert.equal(A.servicePrice(s, c1).each, 266.67, '4 hours at £500 a 7.5 hour day');
  s.accred.package.prices = { C1: '300' };
  assert.deepEqual(J(A.servicePrice(s, c1)), { each: 300, typed: true, yearly: 3600 });
});

test('a client on Standard gets monthly inspections and toolbox talks scheduled', () => {
  const s = st(['contractor'], { id: 'standard', start: '2026-11' });
  const sched = A.serviceSchedule(s, TODAY);
  assert.equal(count(sched, 'C1'), 12, 'twelve site inspections');
  assert.equal(count(sched, 'C2'), 12, 'twelve toolbox talks');
  assert.equal(count(sched, 'D1'), 0, 'no designer audit for a contractor');
  assert.equal(count(sched, 'B8'), 0, 'Compass access is not a task');
  assert.equal(sched.find(x => x.code === 'C1').month, '2026-11');
  assert.equal(sched.filter(x => x.code === 'C1').pop().month, '2027-10');
  // a designer on Standard gets the designer services, not the contractor ones
  const d = A.serviceSchedule(st(['designer'], { id: 'standard', start: '2026-11' }), TODAY);
  assert.equal(count(d, 'C1'), 0); assert.equal(count(d, 'D1'), 1); assert.equal(count(d, 'D3'), 4);
  // Essentials has neither
  assert.equal(count(A.serviceSchedule(st(['contractor'], { id: 'essentials', start: '2026-11' }), TODAY), 'C1'), 0);
  // AHS can switch a service off for one client
  assert.equal(count(A.serviceSchedule(st(['contractor'], { id: 'standard', start: '2026-11', off: { C2: true } }), TODAY), 'C2'), 0);
  // no package, no calendar
  assert.deepEqual(J(A.serviceSchedule(st(['contractor'], {}), TODAY)), []);
});

test('statuses follow the date: done, overdue, due this month, planned', () => {
  const s = st(['contractor'], { id: 'standard', start: '2026-09' });
  const c1 = A.serviceSchedule(s, TODAY).filter(x => x.code === 'C1');
  assert.deepEqual(J(c1.slice(0, 3).map(x => x.status)), ['overdue', 'due', 'upcoming']);
  s.accred.serviceLog = [{ id: 'x1', key: c1[0].key, code: 'C1', month: '2026-09', done: '2026-09-28', by: 'Simon Archer' }];
  assert.equal(A.serviceSchedule(s, TODAY).find(x => x.key === c1[0].key).status, 'done');
});

test('completing a service files a tagged record in the evidence register', () => {
  const s = st(['contractor'], { id: 'standard', start: '2026-11' });
  const c1 = A.serviceSchedule(s, TODAY).find(x => x.code === 'C1');
  s.accred.serviceLog = [{ id: 'x1', key: c1.key, code: 'C1', month: c1.month, done: '2026-11-20', by: 'Simon Archer', title: 'Site inspection report, Genesis', link: 'https://example.com/r.pdf' }];
  const rec = A.evidenceItems(s).find(i => i.key === 'service:x1');
  assert.ok(rec, 'the record is in the register');
  assert.deepEqual(J(rec.qids), ['HS-15', 'HS-11']);
  assert.equal(rec.dated, '2026-11-20');
  assert.match(rec.source, /AHS Ltd service C1, Simon Archer/);
  assert.ok(rec.refs.includes('2845'), 'SSIP Q6 REF follows');
  const q6 = A.evidenceByQuestion(s, '2026-12-01').find(q => q.id === 'HS-15');
  assert.equal(q6.flag.k, 'ok'); assert.equal(q6.newest.key, 'service:x1');
});

test('the submission service falls a month before each section\'s valid until date', () => {
  const s = st(['contractor'], { id: 'standard', start: '2026-11' }, { cl: { valid: { Insurances: '2027-03-24', Quality: '2027-07-01' } } });
  const s3 = A.serviceSchedule(s, TODAY).filter(x => x.code === 'S3').map(x => x.month);
  assert.deepEqual(J(s3), ['2027-02', '2027-06']);
});
