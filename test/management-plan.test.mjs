// ══════════════════════════════════════════════════════════════
//  The H&S Management Plan - the document a client is handed and an auditor
//  reads. It has to carry the whole journey (what we face, what we did, where
//  that got us, and how we keep it that way) in a clause order an auditor
//  recognises, and it may never say anything the app does not.
//  Run: node --test test/management-plan.test.mjs
// ══════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const mod = (p) => import(url.pathToFileURL(path.join(here, '..', 'public', 'reports', p)).href);
const { buildReport, REPORTS } = await mod('templates/index.js');
const { reportHTML } = await mod('engine.js');
const { deriveManagementPlan, planActionsOf, routinesOf } = await mod('plan-derive.js');
const { embedLinesOf, sifWordOf } = await mod('app-contract.js');

const TODAY = '2026-09-28';
const OPTS = { today: TODAY, tenant: { name: 'Testing Client Ltd' } };

// A worked client: a risk closed out with all four kinds of holding, an ops
// risk (so the flag wording has to change), one risk still open.
const STATE = () => ({
  company: { legalName: 'Testing Client Ltd', employees: '9', description: 'A garage and a passenger transport service.',
    personnel: [{ name: 'Dee Marsh', role: 'Fire warden', contact: '' }] },
  policyDoc: { signedDate: '2026-04-02', signedBy: 'S Archer' },
  riskProfile: [
    { id: 'r1', activity: 'Fire breaking out at the premises', libKey: 'fire', likelihood: '2', severity: '5',
      scoreHistory: [{ at: '2026-01-01', l: '4', s: '5' }], targetL: '2', targetS: '5', reviewed: true,
      controls: 'Extinguishers serviced annually', linked: [{ id: 'l1', ref: 'Fire risk assessment 2026', actionId: 'r1a1' }],
      actions: [{ id: 'r1a1', desc: 'Write the fire evacuation procedure', owner: 'Dee Marsh', due: '2026-08-30',
        status: 'Complete', completedDate: '2026-08-28',
        embed: { at: '2026-08-28', by: 'Dee Marsh',
          doc: { name: 'Fire evacuation procedure v1', path: '' },
          routine: { item: 'Fire drill and alarm test', frequency: '6-monthly', owner: 'Dee Marsh', due: '2027-02-28' },
          brief: { title: 'Fire evacuation', type: 'Procedure', date: '2026-08-28' },
          owner: { name: 'Dee Marsh', role: 'Fire warden' } } }] },
    { id: 'r2', activity: 'A fall from height on vehicle roofs', libKey: 'workatheight', likelihood: '3', severity: '4',
      controls: 'Step platform', actions: [{ id: 'r2a1', desc: 'Buy a mobile access platform', owner: 'S Archer', due: '2026-02-01', status: 'Not started' }] },
    { id: 'r3', activity: 'Losing the key transport contract', libKey: 'contractloss', mode: 'ops', likelihood: '3', severity: '4', actions: [] },
  ],
  monitoring: { regSections: [{ id: 'rs1', name: 'Ongoing controls', items: [
    { id: 'g1', item: 'Fire drill and alarm test', frequency: '6-monthly', resultDate: '2026-08-28', dueDate: '2027-02-28',
      notes: 'Owner: Dee Marsh. Kept in place from a completed plan action.' }] }] },
  policySignoff: { policies: [{ id: 'p1', title: 'Fire evacuation', type: 'Procedure', version: '1', delivered: '2026-08-28', riskIds: ['r1'] }],
    staff: [{ id: 's1', name: 'Dee Marsh' }], signed: { 's1|p1': true } },
  documents: [{ id: 'd1', name: 'Fire evacuation procedure v1', category: 'Procedure' }],
  requirements: [{ id: 'sec1', heading: 'Health and safety essentials', items: [
    { id: 'i1', requirement: 'A written policy', present: 'Yes', adequate: 'Yes', reviewed: true, actions: [] },
    { id: 'i2', requirement: 'First aid needs assessed', present: 'No', adequate: '', actions: [] }] }],
});

test('the plan is registered and offers the picker contract', () => {
  const r = REPORTS['management-plan'];
  assert.ok(r, 'management-plan is in the registry');
  assert.equal(r.title, 'Health & Safety Management Plan');
  assert.ok(r.formats.some(f => f.default));
});

test('it reads in the clause order an auditor follows', () => {
  const rep = buildReport(STATE(), 'management-plan', OPTS);
  const labels = rep.pages.map(p => p.label);
  assert.deepEqual(labels, ['Cover', 'Context', 'Leadership', 'Planning', 'Managed', 'Support', 'Checking', 'Improvement', 'Declaration']);
  const html = reportHTML(rep);
  ['What this business does', 'Who is answerable', 'What we found', 'How each risk is managed',
   'Competence, communication and documents', 'How we know it is still working', 'The plan from here',
   'Declaration and document control'].forEach(h => assert.match(html, new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), 'missing section: ' + h));
});

test('every risk reaches section 4 with its controls, how it is held, and its proof', () => {
  const html = reportHTML(buildReport(STATE(), 'management-plan', OPTS));
  assert.match(html, /Fire breaking out at the premises/);
  assert.match(html, /A fall from height on vehicle roofs/);
  assert.match(html, /Losing the key transport contract/);
  assert.match(html, /Extinguishers serviced annually/);
  // the four kinds of holding, in the app's own words
  assert.match(html, /Document: Fire evacuation procedure v1/);
  assert.match(html, /Routine: Fire drill and alarm test - 6-monthly, Dee Marsh, next due 28 Feb 2027/);
  assert.match(html, /Briefed: Fire evacuation \(procedure\)/);
  assert.match(html, /Owned by: Dee Marsh - Fire warden/);
  // proof
  assert.match(html, /Fire risk assessment 2026/);
  assert.match(html, /Signed for: Fire evacuation/);
});

test('a risk with the work still to do says so, rather than looking held', () => {
  const html = reportHTML(buildReport(STATE(), 'management-plan', OPTS));
  assert.match(html, /1 action still to deliver/);
});

test('a delivered action with nothing recorded is called out, not glossed over', () => {
  const s = STATE();
  delete s.riskProfile[0].actions[0].embed;
  const html = reportHTML(buildReport(s, 'management-plan', OPTS));
  assert.match(html, /Delivered, but nothing is recorded that keeps it in place/);
  assert.match(html, /1 action has been delivered, but nothing is yet recorded that keeps any of them in place/);
});

test('the score reads as found, now and target - and never invents a movement', () => {
  const html = reportHTML(buildReport(STATE(), 'management-plan', OPTS));
  assert.match(html, /as found <b>20<\/b>/);          // scoreHistory 4x5
  assert.match(html, /now <b[^>]*>10<\/b>/);          // 2x5 today
  assert.match(html, /as found <b>12<\/b>/);          // r2: never re-scored, so as found = now
  assert.match(html, /As found&quot; is the score before the plan moved it/);   // esc() quotes it in the HTML
});

test('a business risk is never described as able to kill someone', () => {
  const s = STATE();
  const P = deriveManagementPlan(s, { today: TODAY });
  const ops = P.rows.find(r => r.id === 'r3');
  const hs = P.rows.find(r => r.id === 'r2');
  assert.equal(ops.sifWord, 'business-critical');
  assert.equal(hs.sifWord, 'could kill or seriously injure');
  assert.equal(sifWordOf({ mode: 'ops' }), 'business-critical');
  const html = reportHTML(buildReport(s, 'management-plan', OPTS));
  assert.match(html, /business-critical/);
});

test('the routines that keep controls in place are reported, with what is overdue', () => {
  const P = deriveManagementPlan(STATE(), { today: TODAY });
  assert.equal(P.routines.length, 1);
  assert.equal(P.routines[0].owner, 'Dee Marsh');     // read back out of the register note
  assert.equal(P.routines[0].frequency, '6-monthly');
  const html = reportHTML(buildReport(STATE(), 'management-plan', OPTS));
  assert.match(html, /A control that nobody checks is a control that quietly stops/);
  assert.match(html, /Fire drill and alarm test/);
});

test('the plan counts the same actions the execution plan does', () => {
  const s = STATE();
  const acts = planActionsOf(s);
  // r1a1 (complete) + r2a1 (open) = 2; nothing hidden, nothing double counted
  assert.equal(acts.length, 2);
  const P = deriveManagementPlan(s, { today: TODAY });
  assert.equal(P.closedActs, 1);
  assert.equal(P.openActs, 1);
  assert.equal(P.heldActs, 1);
});

test('the report layer reads the close-out in exactly the app\'s words', () => {
  const a = STATE().riskProfile[0].actions[0];
  const lines = embedLinesOf(a).map(l => l.label + ': ' + l.text);
  assert.deepEqual(lines, [
    'Document: Fire evacuation procedure v1',
    'Routine: Fire drill and alarm test - 6-monthly, Dee Marsh, next due 28 Feb 2027',
    'Briefed: Fire evacuation (procedure) - 28 Aug 2026',
    'Owned by: Dee Marsh - Fire warden',
  ]);
  assert.deepEqual(embedLinesOf({ embed: { none: true } }), [{ label: 'One-off', text: 'Nothing recurring - the action stands on its own.' }]);
  assert.deepEqual(embedLinesOf({}), []);
});

test('an empty client gets a plan that says it is empty, not a broken one', () => {
  const html = reportHTML(buildReport({}, 'management-plan', OPTS));
  assert.match(html, /The risk profile is not yet built/);
  assert.match(html, /no risks on the profile yet/i);
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ' '), /\[object Object\]|NaN/);
});

test('the legal duties assessment is reported, gaps included', () => {
  const P = deriveManagementPlan(STATE(), { today: TODAY });
  assert.equal(P.duties.total, 2);
  assert.equal(P.duties.compliant, 1);
  assert.equal(P.duties.gaps, 1);
  const html = reportHTML(buildReport(STATE(), 'management-plan', OPTS));
  assert.match(html, /Health and safety essentials/);
});

test('the brief format drops the cover but keeps every section', () => {
  const sig = buildReport(STATE(), 'management-plan', { ...OPTS, format: 'signal' });
  const bri = buildReport(STATE(), 'management-plan', { ...OPTS, format: 'brief' });
  assert.equal(sig.pages.length - bri.pages.length, 1);
  assert.equal(bri.pages[0].label, 'Context');
  assert.equal(sig.pages[0].label, 'Cover');
});
