// Report layer tests — run with: npm test  (node --test test/)
// Covers the derivation rules, zero-safe copy, fixture builds, pagination and
// HTML snapshots per fixture (written on first run, compared thereafter).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { tierFor, bandsFrom, noneOrCount, countPhrase, isAre, hasHave, deriveBoard, residualOf } from '../public/reports/derive.js';
import { reportHTML, paginateRows } from '../public/reports/engine.js';
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

test('typical profile: seven pages, headline states the finding', () => {
  const r = buildReport(fixture('typical'), 'board-report', OPTS);
  assert.equal(r.pages.length, 7);
  const html = reportHTML(r);
  assert.match(html, /can still kill or maim/i);
  assert.match(html, /Page 7 of 7/);
  assert.doesNotMatch(html, /No have no/);
});

test('HSG65 review sections print by default', () => {
  const html = reportHTML(buildReport(fixture('typical'), 'board-report', OPTS));
  assert.match(html, /HSG65 review pack/);
  assert.match(html, /Active monitoring/);
  assert.match(html, /Issues raised by workers/);
  assert.match(html, /Checks required by law/);
  assert.match(html, /celebrate and promote/i);
});

test('hidden sections drop their pages; locked sections always print', () => {
  const state = fixture('typical');
  state.reportPrefs = { 'board-report': { hidden: {
    reactive: true, active: true, training: true, workers: true, statutory: true,
    wins: true, sinceLast: true, register: true, interpretation: true,
    position: true, maturity: true,   // locked — must be ignored
  } } };
  const r = buildReport(state, 'board-report', OPTS);
  assert.equal(r.pages.length, 2);   // position + maturity/sign-off survive
  const html = reportHTML(r);
  assert.doesNotMatch(html, /HSG65 review pack/);
  assert.match(html, /Decisions required/i);
  assert.match(html, /Sign-off/i);
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

test('snapshots per fixture are stable', () => {
  fs.mkdirSync(snapDir, { recursive: true });
  for (const fx of ['empty', 'typical', 'oversized']) {
    const html = reportHTML(buildReport(fixture(fx), 'board-report', OPTS));
    const file = path.join(snapDir, 'board-' + fx + '.html');
    if (!fs.existsSync(file)) { fs.writeFileSync(file, html); continue; }
    assert.equal(html, fs.readFileSync(file, 'utf8'), 'snapshot drift: ' + file + ' (delete it to accept the change)');
  }
});
