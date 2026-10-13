// Constructionline layer on the CAS core - the mapping, the extras and the
// section view (the portal mirror). Checked against the REFs and dates in the
// RSSC (designer) and MVL (contractor) trackers of October 2026, held in
// test/fixtures/cl-trackers.json. Node only. Run: npm test
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
const A = ctx.AccredCore, BANK = ctx.CLBank;
const J = x => JSON.parse(JSON.stringify(x));
const TRACKERS = JSON.parse(fs.readFileSync(R('test/fixtures/cl-trackers.json'), 'utf8'));
const TODAY = '2026-10-13';
const state = (roles, cl) => ({ accred: { roles, schemes: { cl: { on: true } }, answers: {}, cl: cl || {} } });

test('the banks are loaded whole: 418 designer and 377 contractor questions, word for word', () => {
  const n = s => BANK.sets[s].sections.reduce((t, x) => t + x.qs.length, 0);
  assert.equal(n('designer'), 418);
  assert.equal(n('contractor'), 377);
  assert.equal(BANK.sets.designer.sections.length, 35);
  assert.equal(BANK.sets.contractor.sections.length, 36);
  for (const set of ['designer', 'contractor']) {
    const file = JSON.parse(fs.readFileSync(R('data/constructionline/CL Question Bank - ' + (set === 'designer' ? 'Designer' : 'Contractor') + '.json'), 'utf8'));
    file.sections.forEach((s, i) => s.questions.forEach((q, j) => assert.deepEqual(J(BANK.sets[set].sections[i].qs[j]), q.map(String), set + ' ' + s.section + ' ' + q[0])));
  }
});

test('every Constructionline REF maps to a CAS question or is a Constructionline extra, once', () => {
  const refs = new Set();
  for (const set of ['designer', 'contractor']) BANK.sets[set].sections.forEach(s => s.qs.forEach(q => refs.add(q[0])));
  for (const r of refs) {
    const q = A.clQidOfRef(r), e = A.clExtraOfRef(r);
    assert.ok(!!q !== !!e, 'REF ' + r + ' must be either mapped or an extra, not ' + (q && e ? 'both' : 'neither'));
  }
  // CAS stays the master: still 77 questions, the extras sit apart
  assert.equal(A.MASTER.questions.length, 77);
  assert.ok(A.MASTER.extras.length > 0);
  for (const e of A.MASTER.extras) {
    assert.equal(e.scheme, 'constructionline');
    assert.ok(e.sections.length && e.text && e.ref, e.id + ' carries its section and its words');
    assert.ok(!A.MASTER.questions.some(q => q.id === e.id));
  }
  // the extras the spec names are all extras
  for (const sec of ['Social Value', 'Working Conditions', 'Memberships & Accreditations', 'Business Ownership', 'Community Engagement', 'BAM - Code of Conduct'])
    for (const set of ['designer', 'contractor']) {
      const s = BANK.sets[set].sections.find(x => x.name === sec); if (!s) continue;
      for (const q of s.qs) if (!A.clQidOfRef(q[0])) assert.ok(A.clExtraOfRef(q[0]).sections.includes(sec));
    }
  // refs.constructionline holds every per-set Constructionline REF a question already carried
  for (const q of A.MASTER.questions) {
    const cl = q.refs.constructionline || [];
    Object.keys(q.refs).filter(k => k !== 'constructionline').forEach(k => [].concat(q.refs[k]).forEach(r => {
      if (refs.has(String(r))) assert.ok(cl.includes(String(r)), q.id + ' lost REF ' + r);
    }));
  }
});

test('the mapping table is there for a person to read and check', () => {
  const csv = fs.readFileSync(R('public/reports/constructionline-mapping.csv'), 'utf8');
  const lines = csv.trim().split(/\r\n/);
  assert.match(lines[0], /Question set,Portal section,No in section,REF,Answer type,Constructionline question \(verbatim\),Maps to/);
  assert.equal(lines.length - 1, 418 + 377);
});

test('the section view puts every tracker REF in the same column, for both trackers', () => {
  for (const [name, t] of Object.entries(TRACKERS)) {
    const v = A.clView(state([t.set]), TODAY, name);
    const hs = new Set(), ss = new Set();
    v.blocks.forEach(b => b.lines.forEach(l => { l.hsRefs.forEach(r => hs.add(r)); l.ssipRefs.forEach(r => ss.add(r)); }));
    for (const row of t.rows) {
      row.hsRefs.forEach(r => assert.ok(hs.has(r), name + ' item ' + row.no + ': REF ' + r + ' is in the H&S column'));
      row.ssipRefs.forEach(r => assert.ok(ss.has(r), name + ' item ' + row.no + ': REF ' + r + ' is in the SSIP column'));
    }
  }
});

test('Building Safety Act sections come last, in portal order', () => {
  for (const set of ['designer', 'contractor']) {
    const b = A.clBlocks(set);
    const first = b.findIndex(x => x.bsa);
    assert.ok(first > 0 && b.slice(first).every(x => x.bsa), set + ': nothing follows the Building Safety Act sections');
    const order = BANK.sets[set].sections.map(s => s.name).filter(n => /^Building Safety Act/.test(n));
    assert.deepEqual(J(b.slice(first).map(x => x.id)), J(order));
  }
  // the designer Health and Safety section carries the SSIP set in its own column, as the RSSC tracker does
  const d = A.clBlocks('designer')[0];
  assert.equal(d.name, 'Health and Safety and Once For All Health & Safety - (SSIP)');
  const hs01 = d.items.find(i => i.cas === 'HS-01');
  assert.deepEqual(J([hs01.hsRefs, hs01.ssipRefs]), [['3455'], ['2906']]);
  // the contractor SSIP set stands on its own, as the MVL tracker does
  const c = A.clBlocks('contractor');
  assert.ok(c.some(b => b.name === 'Health and Safety and Health and Safety Third Party / Exemption certificates'));
  const ssip = c.find(b => b.id === 'Once For All Health & Safety - (SSIP)');
  assert.ok(ssip.items.find(i => i.cas === 'HS-15').ssipRefs.includes('2845'));
  // the SSIP question number is read from the portal's own words
  assert.equal(ssip.items.find(i => i.cas === 'HS-15').qno, '6');
});

test('expiry colours: red if expired or not yet valid, amber within 90 days, green otherwise', () => {
  const add = n => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  assert.equal(A.clExpiry('', TODAY).k, 'red');
  assert.equal(A.clExpiry('', TODAY).label, 'Not yet valid');
  assert.equal(A.clExpiry(add(-1), TODAY).k, 'red');
  assert.equal(A.clExpiry(add(0), TODAY).k, 'amber');
  assert.equal(A.clExpiry(add(90), TODAY).k, 'amber');
  assert.equal(A.clExpiry(add(91), TODAY).k, 'green');
});

test('the colours match the trackers once their valid until dates are entered', () => {
  for (const [name, t] of Object.entries(TRACKERS)) {
    // enter each tracker date against the sections its REFs sit in
    const blocks = A.clBlocks(t.set), valid = {};
    const blockOf = r => blocks.find(b => b.items.some(i => i.hsRefs.includes(r) || i.ssipRefs.includes(r)));
    for (const row of t.rows) {
      const iso = d => /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : '';
      if (row.hsRefs.length && iso(row.hsValid)) blockOf(row.hsRefs[0]).hsSections.forEach(s => { valid[s] = iso(row.hsValid); });
      if (row.ssipRefs.length && iso(row.ssipValid)) { const b = blockOf(row.ssipRefs[0]); valid[b.ssipSection] = iso(row.ssipValid); }
    }
    const v = A.clView(state([t.set], { valid }), TODAY, name);
    const line = r => { for (const b of v.blocks) for (const l of b.lines) if (l.hsRefs.includes(r) || l.ssipRefs.includes(r)) return l; return null; };
    for (const row of t.rows) {
      if (row.hsRefs.length) {
        const l = line(row.hsRefs[0]); const want = A.clExpiry(/^\d{4}/.test(row.hsValid) ? row.hsValid.slice(0, 10) : '', TODAY).k;
        assert.equal(l.hsColour.k, want, name + ' item ' + row.no + ' H&S valid until ' + (row.hsValid || 'blank'));
      }
      if (row.ssipRefs.length) {
        const l = line(row.ssipRefs[0]); const want = A.clExpiry(/^\d{4}/.test(row.ssipValid) ? row.ssipValid.slice(0, 10) : '', TODAY).k;
        assert.equal(l.ssipColour.k, want, name + ' item ' + row.no + ' SSIP valid until ' + (row.ssipValid || 'blank'));
      }
    }
  }
  // MVL insurances, 9 days from 13 October: amber, as the tracker says
  const v = A.clView(state(['contractor'], { valid: { Insurances: '2026-10-22' } }), TODAY, 'MVL');
  assert.equal(v.blocks.find(b => b.id === 'Insurances').colour.k, 'amber');
});

test('statuses: the five values, defaults from the question, what AHS records wins, counts as the tracker counts them', () => {
  assert.deepEqual(J(A.CL_STATUS.map(s => s.k)), ['ahs', 'client', 'ahs_sign', 'covered', 'already']);
  assert.equal(A.clStatusLabel('client', 'RSSC'), 'RSSC');
  assert.equal(A.clStatusLabel('ahs_sign', 'RSSC'), 'AHS Ltd, then RSSC signs');
  let v = A.clView(state(['designer']), TODAY, 'RSSC');
  const hs = v.blocks[0].lines;
  assert.equal(hs.find(l => l.cas === 'HS-02').st, 'ahs_sign', 'a policy: AHS Ltd writes, the client signs');
  assert.equal(hs.find(l => l.cas === 'HS-01').st, 'ahs', 'a fact: AHS Ltd enters it');
  // a section in date for more than 90 days is already in Constructionline
  v = A.clView(state(['designer'], { valid: { Insurances: '2027-03-24' } }), TODAY, 'RSSC');
  assert.equal(v.blocks.find(b => b.id === 'Insurances').lines[0].st, 'already');
  // what AHS records wins, and Done takes the line out of the to-do counts
  const key = hs.find(l => l.cas === 'HS-02').key;
  v = A.clView(state(['designer'], { rows: { [key]: { st: 'covered', act: 'Covered in item 3.', done: '2026-10-12' } } }), TODAY, 'RSSC');
  const l = v.blocks[0].lines.find(x => x.key === key);
  assert.equal(l.st, 'covered'); assert.equal(l.action, 'Covered in item 3.'); assert.equal(l.done, '2026-10-12');
  assert.equal(v.counts.done, 1);
  assert.equal(v.counts.client + v.counts.ahs + v.counts.covered + v.counts.done, v.counts.lines);
});

test('CHAS and SMAS work is untouched: no Constructionline, no section view, same questions', () => {
  const chas = { accred: { roles: ['contractor'], schemes: { chas: { on: true } }, answers: {} } };
  assert.equal(A.clOn(chas), false);
  const before = { accred: { roles: ['contractor'], schemes: { cl: { on: true } }, answers: {} } };
  const after = { accred: { roles: ['contractor'], schemes: { cl: { on: true } }, answers: {}, cl: { valid: { Quality: '2027-01-01' }, rows: { 'Quality|14564': { st: 'ahs' } } } } };
  assert.deepEqual(J(A.questions(before).map(q => q.id)), J(A.questions(after).map(q => q.id)));
  assert.deepEqual(J(A.summary(before, TODAY).counts), J(A.summary(after, TODAY).counts));
  assert.equal(A.questions(before).length, 72);
  // the set follows the role until AHS picks one
  assert.equal(A.clSetFor(state(['pd'])), 'designer');
  assert.equal(A.clSetFor(state(['pc'])), 'contractor');
  assert.equal(A.clSetFor(state(['designer'], { set: 'contractor' })), 'contractor');
});
