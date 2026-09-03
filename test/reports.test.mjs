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
import { docFor, trainingRowsOf } from '../public/reports/app-contract.js';
import { REPORTS, BOARD_SECTIONS, buildReport, getReportFormat, setReportFormat } from '../public/reports/templates/index.js';

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
    { likelihood: '3', severity: '4', targetL: '5', targetS: '5' },
    { likelihood: '3', severity: '4' },
    { likelihood: '1', severity: '1' },
  ] });
  assert.equal(D.matrix['3|4'], 2);
  assert.equal(D.matrix['1|1'], 1);
  assert.equal(D.matrix['5|5'], undefined);    // the projection never lands in the matrix
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
  // A deliberate tripwire: adding a board section changes this. If that was
  // intended, update the number - it is here so page growth is never silent.
  // 14 since the Actions page split in two (outstanding / high-risk); 16 since
  // the director's risk picture pages (picture/journey + ladder/five) joined
  // straight after the executive summary, mirroring the cockpit's Board zone.
  assert.equal(r.pages.length, 16);
  const html = reportHTML(r);
  assert.match(html, /not yet complete enough/i);
  assert.doesNotMatch(html, /No have no/);
  assert.doesNotMatch(html, /NaN|undefined/);
});

test('typical profile paginates, and the last footer agrees with the total', () => {
  const r = buildReport(fixture('typical'), 'board-report', OPTS);
  assert.equal(r.pages.length, 16);   // tripwire - see the note above
  const html = reportHTML(r);
  assert.match(html, /can still kill or maim/i);
  // The invariant that actually matters, derived so it cannot go stale: the
  // final footer must name the true page count.
  const n = r.pages.length;
  assert.match(html, new RegExp('Page ' + n + ' of ' + n));
  assert.doesNotMatch(html, new RegExp('Page ' + (n + 1) + ' of'));
  assert.doesNotMatch(html, /No have no/);
});

// The director's risk picture pages mirror the cockpit's Board zone: the
// split strip, the journey with its blue target line, the ladder and the two
// five-lists - and each responds to its own customiser toggle.
test('the risk picture pages carry the cockpit sections and obey their toggles', () => {
  const st = fixture('typical');
  const r = buildReport(st, 'board-report', OPTS);
  const html = reportHTML(r);
  assert.match(html, /The same picture the cockpit leads with/);
  assert.match(html, /significant risks/);
  assert.match(html, /TARGET - the controls you have set|No projected scores set yet|Rate the risks/);
  assert.match(html, /Top 5 by size - worst first/);
  assert.match(html, /Our chosen 5 - working on now/);
  assert.match(html, /the line never disappears, it moves|Rate the risks/);
  const off = JSON.parse(JSON.stringify(st));
  off.reportPrefs = { 'board-report': { hidden: { riskPicture: true, riskJourney: true, riskLadder: true, fiveInHand: true } } };
  const r2 = buildReport(off, 'board-report', OPTS);
  const html2 = reportHTML(r2);
  assert.equal(r2.pages.length, r.pages.length - 2);
  assert.doesNotMatch(html2, /The same picture the cockpit leads with/);
  assert.doesNotMatch(html2, /Our chosen 5 - working on now/);
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

// ── Document control: every report pulls its details from the register ──
test('docFor resolves the register row with org-default fallbacks', () => {
  const state = { docControl: {
    defaults: { author: 'Simon Archer', approverName: 'J Board', approverRole: 'Managing Director', reviewMonths: 6, refPrefix: '' },
    docs: { boardReport: { version: '2.1' }, riskProfile: { ref: 'CUSTOM-1', author: 'A N Other', omit: false } },
  }, branding: { name: 'Easy Travel' } };
  const b = docFor(state, 'boardReport', { today: '2026-08-18' });
  assert.equal(b.author, 'Simon Archer');                 // org default fills the blank
  assert.equal(b.approverName, 'J Board');
  assert.equal(b.version, '2.1');
  assert.equal(b.ref, 'AHS-EASY-BR');                     // auto ref: prefix + client code + doc code, no version
  assert.equal(b.issued, '2026-08-18');                   // defaults to generation day
  assert.equal(b.nextReview, '2027-02-18');               // issued + reviewMonths
  const r = docFor(state, 'riskProfile', { today: '2026-08-18', clientName: 'Tenant Co' });
  assert.equal(r.ref, 'CUSTOM-1');                        // explicit ref wins
  assert.equal(r.author, 'A N Other');                    // row beats default
  const o = docFor({ docControl: { docs: { boardReport: { omit: true } } } }, 'boardReport', { today: '2026-08-18' });
  assert.equal(o.omit, true);
});

test('board and risk-assessment print the document-control details', () => {
  const state = fixture('typical');
  state.docControl = { defaults: { author: 'Simon Archer', approverName: 'J Board', approverRole: 'Managing Director', reviewMonths: 12, refPrefix: '' },
    docs: { boardReport: { version: '3.0' } } };
  const html = reportHTML(buildReport(state, 'board-report', OPTS));
  assert.match(html, /Simon Archer/);                      // prepared-by on the sign-off grid
  assert.match(html, /J Board/);                           // approver
  assert.match(html, /Managing Director/);
  assert.match(html, /-BR[^-]/);                           // controlled reference in the masthead
  assert.doesNotMatch(html, /-BR-v3\.0/);                  // the version is its own field, not baked into the ref
  assert.match(html, /Version 3\.0/);
  assert.match(html, /next review/i);
  const ra = reportHTML(buildReport(state, 'risk-assessment', OPTS));
  assert.match(ra, /prepared by Simon Archer/);
  assert.match(ra, /approved by J Board, Managing Director/);
  assert.match(ra, /-RP[^-]/);
});

test('training rows come from the v2 people store, legacy migrates identically', () => {
  const v2 = { trainingData: { people: [
    { firstName: 'Jo', lastName: 'Hart', status: 'active', cells: { 'First aid': { type: 'date', v: '2027-01-01' }, 'IPAF': { type: 'text', v: 'Trainer' }, 'Empty': { type: 'empty', v: '' } } },
    { firstName: 'Old', lastName: 'Leaver', status: 'left', cells: { 'First aid': { type: 'date', v: '2020-01-01' } } },
  ] } };
  const rows = trainingRowsOf(v2);
  assert.equal(rows.length, 2);                                   // empty cell skipped, leaver skipped
  assert.deepEqual(rows.find(r => r.course === 'First aid'), { employee: 'Jo Hart', course: 'First aid', completed: '', expiry: '2027-01-01' });
  assert.equal(rows.find(r => r.course === 'IPAF').expiry, '');   // text entries carry no expiry
  const legacy = trainingRowsOf({ training: [ { employee: 'A. Jones', course: 'Manual handling', expiry: '2021-05-01' } ] });
  assert.deepEqual(legacy, [{ employee: 'A. Jones', course: 'Manual handling', completed: '', expiry: '2021-05-01' }]);
});

test('no long dashes anywhere in the rendered report', () => {
  for (const fx of ['empty', 'typical', 'oversized']) {
    const html = reportHTML(buildReport(fixture(fx), 'board-report', OPTS));
    assert.doesNotMatch(html, /—|–/, fx + ' contains an em/en dash');
  }
});

// A value that reaches the page unrendered - "[object Object]", "undefined",
// "NaN" - is invisible to tests that assert on the data structure, because the
// structure is right and the RENDER is wrong. dataTable understood plain
// strings and {html} but not the {text, color, bold} cells the sections pass
// for a value carrying a verdict, and printed the literal words "[object
// Object]" in finished client PDFs. Rendered output is the only place to catch
// it, so every report, format and fixture is swept here.
test('no unrendered values reach any report', () => {
  for (const reportId of Object.keys(REPORTS)) {
    for (const f of (REPORTS[reportId].formats || [{ id: undefined }])) {
      for (const fx of ['empty', 'typical', 'oversized']) {
        const html = reportHTML(buildReport(fixture(fx), reportId, { ...OPTS, format: f.id }));
        const seen = html.replace(/<[^>]*>/g, ' ');   // what a reader actually sees
        const where = reportId + '/' + (f.id || 'default') + '/' + fx;
        assert.doesNotMatch(seen, /\[object Object\]/, where + ' prints [object Object]');
        assert.doesNotMatch(seen, /(^|[>\s(\[,:])undefined([<\s).\],]|$)/, where + ' prints undefined');
        assert.doesNotMatch(seen, /(^|[>\s(\[,:])NaN([<\s).\],%]|$)/, where + ' prints NaN');
        assert.doesNotMatch(seen, /(^|[>\s(\[,:])null([<\s).\],]|$)/, where + ' prints null');
      }
    }
  }
});

test('review sections print by default, with no framework name-drop', () => {
  const html = reportHTML(buildReport(fixture('typical'), 'board-report', OPTS));
  assert.match(html, /Leadership review/);
  assert.match(html, /Inspection performance/);   // was one "Active monitoring" section
  assert.match(html, /Audit performance/);        // until the split gave each its own
  assert.match(html, /Issues raised by workers/);
  assert.match(html, /Checks required by law/);
  assert.match(html, /Successes this period|Closed off|actions delivered/);
  assert.doesNotMatch(html, /HSG65/);   // guidance shapes the report; the name never prints
});

test('hidden sections drop their pages; locked sections always print', () => {
  const state = fixture('typical');
  // Hide EVERY unlocked section, derived from the registry rather than listed
  // by hand - a new section then joins this test automatically instead of
  // quietly slipping past it.
  const hidden = {};
  BOARD_SECTIONS.filter(s => !s.locked).forEach(s => { hidden[s.id] = true; });
  BOARD_SECTIONS.filter(s => s.locked).forEach(s => { hidden[s.id] = true; });   // locked - must be ignored
  state.reportPrefs = { 'board-report': { hidden } };
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
test('H&S control maturity grades every level and catches both breach kinds', () => {
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
  // h2 is a CRITICAL risk run on acceptance alone. It used to count as
  // 4 Assured and as needing attention first at the same time, so the cockpit
  // could read "all risks assured" beside "1 needs attention first".
  // Acceptance earns Assured only where accepting is a defensible answer.
  assert.equal(D.holdS.held, 1);        // 4 Assured: h1 only, delivered + signed off
  assert.equal(D.holdS.working, 1);     // h3
  assert.equal(D.holdS.slipping, 2);    // h4 overdue, h2 accepted-but-critical
  assert.equal(D.holdS.notheld, 1);     // h5
  const kinds = D.holdS.breaches.map(b => b.breach).join(' | ');
  assert.match(kinds, /run on acceptance alone/);   // h2: named before the generic state, so the precise reason survives
  assert.match(kinds, /is vulnerable/i);           // h4: high band at 2 Vulnerable
  assert.equal(D.holdS.breaches.length, 2);         // h5 is Low — no Medium/High rule engaged
  assert.match(D.holdS.verdict, /1 of 5 risks identified/);
  // Plan delivery: closed = every action complete; accepted is a caveat.
  assert.equal(D.planDone, 1);                      // h1 (all actions Complete)
  assert.equal(D.planAccepted, 1);                  // h2 (all actions Accepted)
});

test('board report speaks the H&S control maturity scale, never the retired labels', () => {
  const state = fixture('typical');
  state.profiler = state.profiler || {};
  state.profiler.judgement = { leadership: { level: 'strong', note: 'Board reviews quarterly' } };
  const html = reportHTML(buildReport(state, 'board-report', OPTS));
  assert.match(html, /Risks identified/);                    // the app's chip label since the assured rename
  assert.doesNotMatch(html, /Risks assured/);                // the metric label never says assured now
  assert.match(html, /Risks fully actioned/);                // plan-delivery tile (positive)
  assert.doesNotMatch(html, /Risks sitting High or Critical/); // removed — added nothing
  assert.match(html, /What it means/);                       // state definitions table
  assert.match(html, /Consultant judgement/);
  assert.match(html, /Board reviews quarterly/);             // the judgement note prints
  assert.doesNotMatch(html, /properly held|Being worked|Not held/);   // the retired labels
  assert.doesNotMatch(html, /HSG65 scale/);
  assert.doesNotMatch(html, /shortfall/i);
  assert.match(html, /H&amp;S control maturity/);                      // the scale is named
  assert.match(html, /4 · Assured/);
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
