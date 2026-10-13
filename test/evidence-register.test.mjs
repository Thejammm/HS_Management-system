// Evidence register - accreditation engine step 3. Every record with its date,
// the CAS questions it answers (Constructionline REFs following through the
// mapping) and its source; flags anything older than 11 months and any
// question with no evidence. Node only. Run: npm test
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
const base = extra => Object.assign({ accred: { roles: ['contractor'], schemes: { cl: { on: true } }, answers: {} } }, extra || {});
const item = (s, key) => A.evidenceItems(s).find(i => i.key === key);

test('a document carries its date, its questions and its source; the REFs follow the mapping', () => {
  const s = base({ documents: [{ id: 'd1', name: 'Health and Safety Policy', version: 'v3', dated: '2026-09-01', qids: ['HS-02', 'XX-99'], source: 'AHS Ltd' }] });
  const d = item(s, 'doc:d1');
  assert.equal(d.title, 'Health and Safety Policy v3');
  assert.equal(d.dated, '2026-09-01');
  assert.equal(d.source, 'AHS Ltd');
  assert.deepEqual(J(d.qids), ['HS-02'], 'an id that is not a question is dropped');
  assert.ok(d.refs.includes('2828') && d.refs.includes('3456') && d.refs.includes('2907'), 'the contractor, designer and SSIP REFs of HS-02');
  assert.deepEqual(J(d.ssip), ['1.2']);
  assert.equal(A.evFlag(d, TODAY).k, 'ok');
});

test('records from the other tabs are tagged by what they are, from the moment they exist', () => {
  const s = base({
    siteEvidence: { L1: { records: [{ inspectionId: 'i9', project: 'Genesis', date: '2026-09-15', inspector: 'Simon Archer', items: [{ qids: ['CN-01', 'HS-15'] }] }] } },
    siteInspections: [{ id: 'v1', kind: 'Site inspection', site: 'Riverside Depot', actual: '2026-08-01', outcome: 'Satisfactory' }, { id: 'v2', kind: 'Site inspection', planned: '2026-11-01' }],
    inspections: [{ id: 'w1', title: 'Garage inspection', periodTo: '2026-09-30', submittedBy: 'Jo' }],
    policySignoff: { policies: [{ id: 'p1', title: 'Working at height', type: 'Toolbox talk', delivered: '2026-09-20', presenter: 'Supervisor' }, { id: 'p2', title: 'BS 7273-4 update', type: 'Training / CPD', delivered: '2026-07-10' }, { id: 'p3', title: 'Lone working', type: 'Policy' }] },
    monitoring: { months: { '2026-09': { enteredAt: '2026-10-02' }, '2026-10': {} } }
  });
  assert.deepEqual(J(item(s, 'site:L1|i9').qids), ['CN-01', 'HS-15'], 'a site inspection carries the questions the inspector tagged');
  assert.deepEqual(J(item(s, 'visit:v1').qids), ['HS-15', 'HS-11'], 'a process assurance visit: SSIP Q6 monitoring and Q3.3 adviser advice');
  assert.equal(item(s, 'visit:v2'), undefined, 'a visit not yet done is not evidence');
  assert.deepEqual(J(item(s, 'inspection:w1').qids), ['HS-15']);
  assert.deepEqual(J(item(s, 'toolbox:p1').qids), ['HS-17'], 'a toolbox talk: SSIP Q7.4 consultation');
  assert.deepEqual(J(item(s, 'cpd:p2').qids), ['HS-12', 'QA-05'], 'CPD: training and keeping up to date');
  assert.equal(item(s, 'toolbox:p3'), undefined, 'a policy on the sign-off register is not a toolbox talk');
  assert.deepEqual(J(item(s, 'monthly:2026-09').qids), ['HS-15', 'HS-18']);
  assert.equal(item(s, 'monthly:2026-10'), undefined, 'a month whose figures were not saved');
  assert.equal(item(s, 'toolbox:p1').source, 'Toolbox talks, Supervisor');
});

test('a site inspection more than 11 months old needs replacing against SSIP Q6', () => {
  const s = base({ siteInspections: [{ id: 'v1', kind: 'Site inspection', site: 'Riverside Depot', actual: '2025-10-01', outcome: 'Satisfactory' }] });
  const v = item(s, 'visit:v1');
  assert.equal(A.evFlag(v, TODAY).k, 'stale');
  assert.match(A.evFlag(v, TODAY).label, /Older than 11 months/);
  const q6 = A.evidenceByQuestion(s, TODAY).find(q => q.id === 'HS-15');
  assert.equal(q6.ssip, '6');
  assert.equal(q6.flag.k, 'stale');
  assert.equal(q6.newest.key, 'visit:v1');
  // 11 months to the day is still in date; a day more is not
  assert.equal(A.evStale(A.addMonths(TODAY, -11), TODAY), false);
  const dayBefore = (() => { const d = new Date(A.addMonths(TODAY, -11) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
  assert.equal(A.evStale(dayBefore, TODAY), true);
});

test('questions with no evidence are listed; info and declarations are not evidence questions', () => {
  const byQ = A.evidenceByQuestion(base(), TODAY);
  assert.ok(byQ.length > 0 && byQ.every(q => q.flag.k === 'none'), 'a new client has no evidence for anything');
  assert.ok(!byQ.some(q => ['HS-01', 'HS-05', 'HS-20'].includes(q.id)), 'questions answered in words are not listed');
  assert.ok(byQ.some(q => q.id === 'HS-15'));
  assert.deepEqual(J(A.evidenceByQuestion({}, TODAY)), [], 'no scheme or role, no questions');
});

test('AHS can change the questions on any record, and a resynced record keeps them', () => {
  const s = base({ policySignoff: { policies: [{ id: 'p1', title: 'Fire awareness', type: 'Toolbox talk', delivered: '2026-09-20' }] },
    evidenceTags: { 'toolbox:p1': { qids: ['HS-17', 'BS-11'], source: 'AHS Ltd' } } });
  const t = item(s, 'toolbox:p1');
  assert.deepEqual(J(t.qids), ['HS-17', 'BS-11']); assert.equal(t.source, 'AHS Ltd'); assert.equal(t.tagged, true);
  s.evidenceTags['toolbox:p1'] = { qids: [] };
  assert.deepEqual(J(item(s, 'toolbox:p1').qids), [], 'unticking everything takes it off every question');
});

test('evidence out of step with the section expiry is flagged', () => {
  const s = base({ siteInspections: [{ id: 'v1', kind: 'Site inspection', actual: '2026-06-01', outcome: 'Satisfactory' }] });
  s.accred.cl = { valid: { 'Once For All Health & Safety - (SSIP)': '2027-09-26' } };
  const q = A.evidenceByQuestion(s, TODAY).find(x => x.id === 'HS-15');
  assert.deepEqual(J(q.outOfStep), ['Once For All Health & Safety - (SSIP)'], 'June 2026 evidence is over 12 months old by September 2027');
  s.accred.cl.valid['Once For All Health & Safety - (SSIP)'] = '2027-04-01';
  assert.deepEqual(J(A.evidenceByQuestion(s, TODAY).find(x => x.id === 'HS-15').outOfStep), []);
});

test('the journey uses register evidence when nothing is picked; a pick always wins', () => {
  const s = base({ policySignoff: { policies: [{ id: 'p1', title: 'Working at height', type: 'Toolbox talk', delivered: '2026-09-20' }] },
    documents: [{ id: 'd1', name: 'Consultation minutes', dated: '2026-05-01' }] });
  let st = A.statusOf(s, A.byId('HS-17'), TODAY);
  assert.equal(st.k, 'evidenced'); assert.equal(st.why, 'From the evidence register');
  assert.equal(st.ev.facts.name, 'Working at height');
  s.accred.answers['HS-17'] = { ev: { src: 'doc', id: 'd1' } };
  st = A.statusOf(s, A.byId('HS-17'), TODAY);
  assert.equal(st.ev.facts.name, 'Consultation minutes', 'the picked document wins over the newer toolbox talk');
  // a client with nothing in the register is unchanged
  assert.equal(A.statusOf(base(), A.byId('HS-17'), TODAY).k, 'gap');
});
