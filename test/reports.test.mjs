// Report layer tests — run with: npm test  (node --test test/)
// Covers the derivation rules, zero-safe copy, fixture builds, pagination and
// HTML snapshots per fixture (written on first run, compared thereafter).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { tierFor, bandsFrom, noneOrCount, countPhrase, isAre, hasHave, deriveBoard, deriveBoardExtras, residualOf } from '../public/reports/derive.js';
import { reportHTML, paginateRows } from '../public/reports/engine.js';
import { matrix5x5 } from '../public/reports/blocks.js';
import { REPORTS, buildReport, getReportFormat, setReportFormat } from '../public/reports/templates/index.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const fixDir = path.join(here, '..', 'public', 'reports', 'fixtures');
const snapDir = path.join(here, '__snapshots__');
const fixture = n => JSON.parse(fs.readFileSync(path.join(fixDir, n + '.json'), 'utf8'));
const OPTS = { period: 'Q3 2026', today: '2026-08-18' };

test('tier banding follows tenant bands with app defaults', () => {
  assert.equal(tierFor(16), 'Critical');
  assert.equal(tierFor(15), 'High');           // app default crit is 16, not 15
  assert.equal(tierFor(10), 'High');
  assert.equal(tierFor(9), 'Medium');
  assert.equal(tierFor(5), 'Medium');
  assert.equal(tierFor(4), 'Low');
  assert.equal(tierFor(0), null);
  const custom = bandsFrom({ riskConfig: { bands: { med: 4, high: 8, crit: 20 } } });
  assert.equal(tierFor(19, custom), 'High');
  assert.equal(tierFor(20, custom), 'Critical');
});

test('zero-safe copy reads correctly at 0, 1 and n', () => {
  assert.equal(noneOrCount(0, 'risk has no named owner', 'risks have no named owner'), 'No risks have no named owner');
  assert.equal(noneOrCount(1, 'risk has no named owner', 'risks have no named owner'), '1 risk has no named owner');
  assert.equal(noneOrCount(4, 'risk has no named owner', 'risks have no named owner'), '4 risks have no named owner');
  assert.equal(countPhrase(1, 'action'), '1 action');
  assert.equal(countPhrase(3, 'action'), '3 actions');
  assert.equal(isAre(1), 'is'); assert.equal(isAre(2), 'are');
  assert.equal(hasHave(1), 'has'); assert.equal(hasHave(0), 'have');
});

test('matrix counts come from residual likelihood × severity only', () => {
  const D = deriveBoard({ riskProfile: [
    { likelihood: '3', severity: '4', inherentL: '5', inherentS: '5' },
    { likelihood: '3', severity: '4' },
    { likelihood: '1', severity: '1' },
  ] });
  assert.equal(D.matrix['3|4'], 2);
  assert.equal(D.matrix['1|1'], 1);
  assert.equal(D.matrix['5|5'], undefined);    // inherent never lands in the matrix
});

test('residualOf rejects malformed scores', () => {
  assert.equal(residualOf({ likelihood: '9', severity: '2' }), null);
  assert.equal(residualOf({ likelihood: '', severity: '2' }), null);
  assert.deepEqual(residualOf({ likelihood: '2', severity: '5' }), { l: 2, s: 5, score: 10 });
});

test('paginateRows: first page short, continuations larger, empty safe', () => {
  assert.deepEqual(paginateRows([], 16, 20), [[]]);
  const rows = Array.from({ length: 45 }, (_, i) => i);
  const slices = paginateRows(rows, 16, 20);
  assert.equal(slices.length, 3);
  assert.equal(slices[0].length, 16);
  assert.equal(slices[1].length, 20);
  assert.equal(slices[2].length, 9);
});

// Default structure: position + 3 HSG65 review pages (monitoring, people,
// progress) + register + interpretation + maturity/sign-off = 7 pages.
test('empty profile renders a valid report that says so', () => {
  const r = buildReport(fixture('empty'), 'board-report', OPTS);
  assert.equal(r.pages.length, 7);
  const html = reportHTML(r);
  assert.match(html, /not yet complete enough/i);
  assert.doesNotMatch(html, /No have no/);
  assert.doesNotMatch(html, /NaN|undefined/);
});

test('typical profile: eight pages (attention page prints), headline states the finding', () => {
  const r = buildReport(fixture('typical'), 'board-report', OPTS);
  assert.equal(r.pages.length, 8);   // 7 + the needs-attention page (3 breaches)
  const html = reportHTML(r);
  assert.match(html, /can still kill or maim/i);
  assert.match(html, /Page 8 of 8/);
  assert.doesNotMatch(html, /No have no/);
});

test('attention list lives on its own page, never the front page', () => {
  const state = fixture('typical');
  const html = reportHTML(buildReport(state, 'board-report', OPTS));
  assert.match(html, /the named list has its own page/);       // front-page verdict: counts only
  assert.match(html, /risks need attention first\./);           // the attention page headline
  assert.match(html, /The named list follows this page/);       // decision: no names inline
  // Oversized: 13 breaches spill across two attention pages.
  const big = reportHTML(buildReport(fixture('oversized'), 'board-report', OPTS));
  assert.match(big, /Needs attention first - part 1 of 2/);
  assert.match(big, /Needs attention first - part 2 of 2/);
});

test('matrix squares are coloured by their band, on the tenant bands', () => {
  const html = matrix5x5({ counts: { '5|5': 2, '1|1': 1 }, bands: { med: 5, high: 10, crit: 16 } });
  assert.match(html, /border-color:#DC2626;background:#DC2626/);  // 5x5 occupied = Critical red fill
  assert.match(html, /border-color:#16A34A;background:#16A34A/);  // 1x1 occupied = Low green fill
  assert.match(html, /style="border-color:#F59E0B"/);             // an empty Medium square keeps its border
  // Tenant bands are honoured: crit at 4 turns a 2x2 square red.
  const custom = matrix5x5({ counts: { '2|2': 1 }, bands: { med: 2, high: 3, crit: 4 } });
  assert.match(custom, /border-color:#DC2626;background:#DC2626/);
});

test('no long dashes anywhere in the rendered report', () => {
  for (const fx of ['empty', 'typical', 'oversized']) {
    const html = reportHTML(buildReport(fixture(fx), 'board-report', OPTS));
    assert.doesNotMatch(html, /—|–/, fx + ' contains an em/en dash');
  }
});

test('review sections print by default, with no framework name-drop', () => {
  const html = reportHTML(buildReport(fixture('typical'), 'board-report', OPTS));
  assert.match(html, /Leadership review/);
  assert.match(html, /Active monitoring/);
  assert.match(html, /Issues raised by workers/);
  assert.match(html, /Checks required by law/);
  assert.match(html, /Successes this period|Closed off|actions delivered/);
  assert.doesNotMatch(html, /HSG65/);   // guidance shapes the report; the name never prints
});

test('hidden sections drop their pages; locked sections always print', () => {
  const state = fixture('typical');
  state.reportPrefs = { 'board-report': { hidden: {
    reactive: true, active: true, training: true, workers: true, statutory: true,
    wins: true, sinceLast: true, register: true, interpretation: true,
    position: true, maturity: true,   // locked — must be ignored
  } } };
  const r = buildReport(state, 'board-report', OPTS);
  assert.equal(r.pages.length, 3);   // position + attention (locked with position) + status/sign-off survive
  const html = reportHTML(r);
  assert.doesNotMatch(html, /Leadership review ·/);
  assert.match(html, /Decisions required/i);
  assert.match(html, /Sign-off/i);
});

// ── Wins must mirror the app's execution-plan aggregator: all three action
//    sources, removed/deleted never counted, accepted labelled, legacy
//    single-action management items still read. ──
test('wins picks up every action source and honours removals', () => {

  const state = {
    riskProfile: [
      { id: 'r1', activity: 'Guarding', category: 'Physical', likelihood: '2', severity: '4', controls: 'guards', actions: [
        { id: 'a1', desc: 'Fit interlock', owner: 'AB', due: '2026-08-01', status: 'Complete', completedDate: '2026-08-10' },
        { id: 'a2', desc: 'Removed for demo', owner: 'AB', due: '2026-08-01', status: 'Complete', completedDate: '2026-08-10', hideFromPlan: true },
        { id: 'a3', desc: 'Deleted one', owner: 'AB', due: '2026-08-01', status: 'Complete', completedDate: '2026-08-10', deleted: true },
      ] },
    ],
    requirements: [
      { id: 's1', heading: 'Training', items: [
        { id: 'i1', actions: [{ id: 'm1', desc: 'Induction pack written', owner: 'SA', status: 'Complete', completedDate: '2026-08-12' }] },
        { id: 'i2', action: 'Legacy single action', actionOwner: 'SA', actionStatus: 'Complete', completedDate: '2026-08-11' },   // pre-actions[] shape
      ] },
    ],
    actionPlan: [
      { id: 'p1', desc: 'Poster displayed', owner: 'Office', status: 'Complete', completedDate: '2026-08-09' },
      { id: 'p2', desc: 'Old accepted item', owner: 'SA', due: '2026-01-01', status: 'Accepted', acceptDate: '2026-08-08' },
      { id: 'p3', desc: 'Deleted plan item', status: 'Complete', completedDate: '2026-08-09', deleted: true },
    ],
  };
  const X = deriveBoardExtras(state, { today: '2026-08-18' });
  const descs = X.wins.map(w => w.desc);
  assert.deepEqual(descs.sort(), ['Fit interlock', 'Induction pack written', 'Legacy single action', 'Old accepted item', 'Poster displayed'].sort());
  assert.equal(X.wins.filter(w => w.accepted).length, 1);
  assert.ok(X.wins.every(w => w.source), 'every win carries its source');
  assert.ok(!descs.includes('Removed for demo') && !descs.includes('Deleted one') && !descs.includes('Deleted plan item'));
});

test('oversized profile spills the register and renumbers footers', () => {
  const r = buildReport(fixture('oversized'), 'board-report', OPTS);
  assert.ok(r.pages.length > 7, 'register must spill beyond the default seven pages');
  const html = reportHTML(r);
  assert.match(html, new RegExp('Page ' + r.pages.length + ' of ' + r.pages.length));
  assert.match(html, /part 1 of \d/i);
});

test('format switch changes the skin, not the content', () => {
  const state = fixture('typical');
  const a = buildReport(state, 'board-report', { ...OPTS, format: 'signal' });
  const b = buildReport(state, 'board-report', { ...OPTS, format: 'brief' });
  const skin = h => h.match(/r-fmt-\w+/)[0];
  assert.equal(skin(reportHTML(a)), 'r-fmt-signal');
  assert.equal(skin(reportHTML(b)), 'r-fmt-brief');
  const strip = (r) => JSON.stringify(r.pages.map(p => p.blocks.map(x => x.type)));
  assert.equal(strip(a), strip(b));            // same blocks, same order
});

test('reportPrefs round-trip via state blob', () => {
  const state = fixture('typical');
  assert.equal(getReportFormat(state, 'board-report'), 'signal');
  setReportFormat(state, 'board-report', 'brief');
  assert.equal(getReportFormat(state, 'board-report'), 'brief');
  assert.equal(state.reportPrefs['board-report'].format, 'brief');
  setReportFormat(state, 'board-report', 'nonsense');
  assert.equal(getReportFormat(state, 'board-report'), 'signal'); // unknown → default
});

test('second report type renders through the same engine', () => {
  const r = buildReport(fixture('typical'), 'risk-assessment', OPTS);
  assert.ok(r.pages.length >= 2);
  const html = reportHTML(r);
  assert.match(html, /Risk Assessment/i);
  assert.match(html, /r-table/);
});

test('registry exposes the picker contract', () => {
  for (const id of Object.keys(REPORTS)) {
    const r = REPORTS[id];
    assert.equal(r.id, id);
    assert.ok(r.title && Array.isArray(r.formats) && r.formats.length >= 1);
    assert.ok(r.formats.some(f => f.default));
    assert.equal(typeof r.build, 'function');
  }
});

// ── Hold model (risk control status) — the replacement for the 0-5 maturity
//    number: facts per risk, counts for the company, HSG65 rule for breaches.
test('hold model grades every state and catches both breach kinds', () => {
  const state = { riskProfile: [
    // held: plan delivered (all Complete) + signed off
    { id: 'h1', activity: 'Held risk', category: 'Physical', likelihood: '4', severity: '5', controls: 'guards', reviewed: true, actions: [{ desc: 'Fit guards', owner: 'AB', due: '2026-01-01', status: 'Complete' }] },
    // breach: critical band run on acceptance alone
    { id: 'h2', activity: 'Accepted critical', category: 'Physical', likelihood: '4', severity: '5', controls: 'rescue plan', actions: [{ desc: 'Run as is', owner: 'SA', due: '2026-01-01', status: 'Accepted' }] },
    // working: open action, owned, dated, on time
    { id: 'h3', activity: 'Being worked', category: 'Ergonomic', likelihood: '2', severity: '2', controls: 'training', actions: [{ desc: 'Refresher', owner: 'AB', due: '2099-01-01' }] },
    // slipping + breach: high band with an overdue action
    { id: 'h4', activity: 'Slipping high', category: 'Electrical', likelihood: '4', severity: '4', controls: 'permits', actions: [{ desc: 'Isolate', owner: 'CD', due: '2020-01-01' }] },
    // not held: no controls recorded
    { id: 'h5', activity: 'Not held', category: 'Fire', likelihood: '2', severity: '2', controls: '', actions: [] },
  ] };
  const D = deriveBoard(state, { today: '2026-08-18' });
  assert.equal(D.holdS.total, 5);
  assert.equal(D.holdS.held, 2);        // h1 delivered+signed off, h2 accepted
  assert.equal(D.holdS.working, 1);     // h3
  assert.equal(D.holdS.slipping, 1);    // h4
  assert.equal(D.holdS.notheld, 1);     // h5
  const kinds = D.holdS.breaches.map(b => b.breach).join(' | ');
  assert.match(kinds, /run on acceptance alone/);   // h2: high band held by acceptance only
  assert.match(kinds, /is slipping/i);              // h4: high band slipping
  assert.equal(D.holdS.breaches.length, 2);         // h5 is Low — no Medium/High rule engaged
  assert.match(D.holdS.verdict, /2 of 5 risks properly held/);
  // Plan delivery: closed = every action complete; accepted is a caveat.
  assert.equal(D.planDone, 1);                      // h1 (all actions Complete)
  assert.equal(D.planAccepted, 1);                  // h2 (all actions Accepted)
});

test('board report speaks hold language and never the 0-5 scale', () => {
  const state = fixture('typical');
  state.profiler = state.profiler || {};
  state.profiler.judgement = { leadership: { level: 'strong', note: 'Board reviews quarterly' } };
  const html = reportHTML(buildReport(state, 'board-report', OPTS));
  assert.match(html, /Risks properly held/);
  assert.match(html, /Risks fully actioned/);                // plan-delivery tile (positive)
  assert.doesNotMatch(html, /Risks sitting High or Critical/); // removed — added nothing
  assert.match(html, /What it means/);                       // state definitions table
  assert.match(html, /Consultant judgement/);
  assert.match(html, /Board reviews quarterly/);             // the judgement note prints
  assert.doesNotMatch(html, /maturity/i);                    // the old scale is gone
  assert.doesNotMatch(html, /HSG65 scale/);
  assert.doesNotMatch(html, /shortfall/i);
  assert.doesNotMatch(html, /rule breach|breaches of the rule/i); // renamed: needs attention first
});

test('snapshots per fixture are stable', () => {
  fs.mkdirSync(snapDir, { recursive: true });
  for (const fx of ['empty', 'typical', 'oversized']) {
    const html = reportHTML(buildReport(fixture(fx), 'board-report', OPTS));
    const file = path.join(snapDir, 'board-' + fx + '.html');
    if (!fs.existsSync(file)) { fs.writeFileSync(file, html); continue; }
    assert.equal(html, fs.readFileSync(file, 'utf8'), 'snapshot drift: ' + file + ' (delete it to accept the change)');
  }
});
