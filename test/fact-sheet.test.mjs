// Client fact sheet (Company set-up) - accreditation engine step 2. The facts
// held once, what each feeds on the portal, and the conflicts with answers and
// section dates. Node only. Run: npm test
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
const st = (company, accred) => ({ company: company || {}, accred: Object.assign({ roles: ['designer'], schemes: { cl: { on: true } }, answers: {} }, accred || {}) });
const kinds = s => J(A.factConflicts(s, TODAY).map(c => c.fact));

test('every fact on the sheet knows its field', () => {
  for (const [field, fact] of [['address', 'address'], ['headOffice', 'headOffice'], ['headIsReg', 'headOffice'], ['directors', 'directors'], ['hsLead', 'hsLead'],
    ['headBand', 'headBand'], ['paye', 'paye'], ['subcontractors', 'subcontractors'], ['hrb', 'hrb'], ['ssipExpiry', 'ssip'], ['plRenewal', 'insurance'], ['elciRenewal', 'insurance']])
    assert.equal(A.factOfField(field), fact, field);
  assert.equal(A.factOfField('phone'), null, 'a field that is not an accreditation fact');
});

test('changing the headcount or the address shows which portal sections it feeds', () => {
  const s = st();
  const head = A.factImpact(s, 'headBand', TODAY);
  assert.ok(head.sections.some(x => /^Health and Safety/.test(x)), 'headcount feeds the Health and Safety section: ' + head.sections.join('; '));
  assert.ok(head.lines.some(l => l.refs.includes('3374') && l.refs.includes('2814')), 'the size of company question, H&S and SSIP');
  const addr = A.factImpact(s, 'address', TODAY);
  assert.ok(addr.sections.includes('Registered Office'), 'the registered office feeds the Registered Office section');
  assert.ok(addr.lines.some(l => l.refs.includes('301')) && addr.lines.some(l => l.refs.includes('387')), 'and the company address held in the H&S sections');
  const head2 = A.factImpact(st({}, { roles: ['contractor'] }), 'headOffice', TODAY);
  assert.ok(head2.sections.includes('Head Office'));
  // without Constructionline the fact still names its CAS questions
  assert.deepEqual(J(A.factImpact(st({}, { schemes: {} }), 'subcontractors', TODAY).cas), ['HS-20']);
});

test('the warning panel lists a fact that disagrees with an answer or a date', () => {
  assert.deepEqual(kinds(st()), [], 'nothing recorded, nothing to warn about');
  assert.ok(kinds(st({ headBand: '1-4', employees: '6' })).includes('headBand'), 'band 1 to 4 against 6 employees');
  assert.ok(kinds(st({ headBand: '5+', paye: '3', employees: '3' })).includes('paye'), 'band 5 or more with 3 on PAYE');
  assert.ok(kinds(st({ employees: '4', paye: '6' })).includes('paye'), 'more on PAYE than employees');
  assert.ok(kinds(st({ headBand: '1-4' }, { answers: { 'HS-16': { text: '7' } } })).includes('headBand'), 'HS-16 answered 7 against band 1 to 4');
  assert.ok(kinds(st({ subcontractors: 'no' }, { answers: { 'HS-20': { decl: 'yes' } } })).includes('subcontractors'));
  assert.deepEqual(kinds(st({ subcontractors: 'no' }, { answers: { 'HS-20': { decl: 'no' } } })), [], 'agreeing facts are not listed');
  assert.ok(kinds(st({ hrb: 'yes' }, { answers: { 'BS-08': { decl: 'no' } } })).includes('hrb'));
  assert.ok(kinds(st({ hsLead: 'Robert Smith' }, { answers: { 'HS-01': { text: 'Jane Doe, Director' } } })).includes('hsLead'));
  assert.deepEqual(kinds(st({ hsLead: 'Robert Smith' }, { answers: { 'HS-01': { text: 'Robert Smith, Managing Director' } } })), []);
  assert.ok(kinds(st({}, { roles: ['contractor'], cl: { set: 'designer' } })).includes('roles'), 'question set and roles disagree');
  // dates in the section view
  assert.ok(kinds(st({ ssipExpiry: '2026-12-01' }, { cl: { valid: { 'Health and Safety Third Party / Exemption certificates': '2027-02-01' } } })).includes('ssip'), 'a section valid beyond the SSIP certificate');
  assert.ok(kinds(st({ ssipExpiry: '2026-09-01' })).includes('ssip'), 'an expired SSIP certificate');
  assert.ok(kinds(st({ elciRenewal: '2026-11-01' }, { cl: { valid: { Insurances: '2027-03-24' } } })).includes('insurance'), 'insurances valid beyond the first renewal');
  assert.deepEqual(kinds(st({ elciRenewal: '2027-06-01' }, { cl: { valid: { Insurances: '2027-03-24' } } })), []);
});

test('the section view reads its answers from the fact sheet', () => {
  const s = st({ address: '1 Example Street\nLeeds\nLS1 1AA', headBand: '1-4', subcontractors: 'no', hsLead: 'Robert Smith', hsLeadRole: 'Managing Director' });
  const v = A.clView(s, TODAY, 'EDL');
  const line = ref => { for (const b of v.blocks) for (const l of b.lines) if (l.hsRefs.includes(ref) || l.ssipRefs.includes(ref)) return l; };
  assert.equal(line('301').evidence, 'From the client fact sheet: 1 Example Street, Leeds, LS1 1AA.');
  assert.match(line('3374').evidence, /Fact sheet: 1 to 4\./);
  assert.match(line('3482').evidence, /Fact sheet: No\./);
  assert.equal(line('3455').action, 'AHS Ltd enters it in the portal: Robert Smith, Managing Director.');
  // a client fact AHS Ltd suggests an answer for
  const sub = line('3482');
  assert.equal(sub.st, 'client');
  assert.equal(sub.action, 'EDL to confirm. Suggested answer: No.');
});
