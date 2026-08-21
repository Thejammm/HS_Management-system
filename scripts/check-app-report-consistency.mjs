// ══════════════════════════════════════════════════════════════
// APP ↔ REPORT CONSISTENCY CHECK — run before deploying anything that
// touches either side:  node scripts/check-app-report-consistency.mjs
//
// Boots the real index.html headless, seeds an edge-case state, reads the
// numbers the SCREENS compute, computes the same numbers via the report
// layer's derive.js on the identical state, and diffs them. Also asserts the
// generated app-contract.js still matches the app's live library tables and
// that the HOLD MODEL (risk control status) grades every risk identically.
// Any mismatch exits non-zero. (House rule: a report may never count
// differently from a screen — found live by Simon: board said 4
// fatal-potential, cockpit said 3.)
// ══════════════════════════════════════════════════════════════
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

// Discover a browser rather than assuming one Windows path, so this check runs
// on someone else's machine - and in CI - not only on mine. Without it, the
// script that guards "a report may never count differently from a screen" was
// unrunnable anywhere but this laptop.
const CHROME = (() => {
  const need = createRequire(import.meta.url);
  const found = need('../lib/chromium.js').findChromium();
  if (!found) { console.error('X No Chromium found. Set PUPPETEER_EXECUTABLE_PATH or CHROMIUM_PATH.'); process.exit(2); }
  return found;
})();
const require = createRequire(import.meta.url);
const here = path.dirname(url.fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const puppeteer = require(path.join(repo, 'node_modules', 'puppeteer-core'));
const { deriveBoard, deriveBoardExtras } = await import(url.pathToFileURL(path.join(repo, 'public', 'reports', 'derive.js')));
const contract = await import(url.pathToFileURL(path.join(repo, 'public', 'reports', 'app-contract.js')));

const TODAY = new Date().toISOString().slice(0, 10);
// Edge cases on purpose: severity-4 SIF (the live bug), explicit sif:false
// override on a severity-5, unrated risk with inherent 5, target-severity-4
// only, unmapped category, and every hold state the model can produce —
// held (delivered+signed off), held on acceptance alone at a high band
// (rule breach), working (open on time), slipping (overdue / unowned /
// undated), not held (no controls / unrated / no plan).
const STATE = {
  riskProfile: [
    { id: 'r1', activity: 'Sev-4 machine risk, action overdue', category: 'Physical', likelihood: '3', severity: '4', inherentL: '4', inherentS: '4', controls: 'guards', controlLevel: 'prevent',
      actions: [{ id: 'a1', desc: 'Guard check', owner: 'Ops', due: '2020-08-01', status: 'In progress' }] },
    { id: 'r2', activity: 'Sev-5 but formally not SIF, no plan', category: 'Fire', likelihood: '2', severity: '5', inherentL: '3', inherentS: '5', sif: false, controls: 'suppression', controlLevel: 'protect', actions: [] },
    { id: 'r3', activity: 'Unrated, inherent fatal', category: 'Chemical', inherentL: '3', inherentS: '5', actions: [] },
    { id: 'r4', activity: 'Target-severity-4 only, no controls', category: 'Electrical', likelihood: '2', severity: '3', targetS: '4', controls: '', actions: [] },
    { id: 'r5', activity: 'Rated, no controls, plan done', category: 'Ergonomic', likelihood: '1', severity: '5', actions: [{ id: 'a2', desc: 'Done thing', status: 'Complete', completedDate: '2026-08-10' }] },
    { id: 'r6', activity: 'Unmapped category risk', category: 'Made-up category', likelihood: '3', severity: '3', actions: [] },
    { id: 'r7', activity: 'Held: delivered and signed off', category: 'Physical', likelihood: '4', severity: '5', controls: 'guardrails, permits', controlLevel: 'prevent', reviewed: true,
      actions: [{ id: 'a3', desc: 'Install guardrails', owner: 'AB', due: '2026-01-01', status: 'Complete' }] },
    { id: 'r8', activity: 'Critical run on acceptance alone', category: 'Physical', likelihood: '4', severity: '5', controls: 'rescue plan', controlLevel: 'protect',
      actions: [{ id: 'a4', desc: 'Run on current controls', owner: 'SA', due: '2026-01-01', status: 'Accepted' }] },
    { id: 'r9', activity: 'Working: open action on time', category: 'Ergonomic', likelihood: '2', severity: '2', controls: 'training', controlLevel: 'protect',
      actions: [{ id: 'a5', desc: 'Refresher', owner: 'AB', due: '2099-01-01', status: 'In progress' }] },
    { id: 'r10', activity: 'Slipping: open action without owner or date', category: 'Fire', likelihood: '2', severity: '3', controls: 'alarms', controlLevel: 'protect',
      actions: [{ id: 'a6', desc: 'Service alarms', status: 'Not started' }] },
  ],
  requirements: [{ id: 's1', heading: 'Duty', items: [{ id: 'i1', criteria: [], actions: [{ id: 'ma1', desc: 'Mgmt overdue action', owner: '', due: '2020-07-01', status: 'Not started' }] }] }],
  actionPlan: [
    { id: 'ap1', desc: 'Free overdue, no owner', due: '2020-06-30', status: 'Not started' },
    { id: 'ap2', desc: 'Free undated', status: 'In progress' },
    { id: 'ap3', desc: 'Deleted — must not count', due: '2020-01-01', status: 'Not started', deleted: true },
  ],
  profiler: { maturity: {}, exposure: {}, judgement: { leadership: { level: 'adequate', note: 'Visible but informal' }, opcontrol: { level: 'weak', note: 'Permits not enforced' } } },
  riskAssurance: { leading: [{ id: 'l1', measure: 'x' }], lagging: [], assurance: [] },
  docControl: { defaults: { author: 'Simon Archer', approverName: 'J Board', approverRole: 'Managing Director', reviewMonths: 6, refPrefix: '' },
    docs: { boardReport: { version: '2.0' }, riskProfile: { ref: 'FIXED-REF-1' } } },
  trainingData: { people: [
    { firstName: 'Jo', lastName: 'Hart', status: 'active', cells: { 'First aid': { type: 'date', v: '2020-01-01' }, 'IPAF': { type: 'text', v: 'Trainer' } } },
    { firstName: 'Old', lastName: 'Leaver', status: 'left', cells: { 'First aid': { type: 'date', v: '2019-01-01' } } },
  ] },
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--headless=new', '--allow-file-access-from-files', '--disable-gpu'],
});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 120)));
await page.goto(url.pathToFileURL(path.join(repo, 'public', 'index.html')).href, { waitUntil: 'load', timeout: 30000 });

const app = await page.evaluate((STATE) => {
  S = STATE; migrateLoadedState();
  const RD = _reportData();
  const M = _riskPanelModel();
  const ex = _execActions();
  const H = _holdSummary();
  return {
    sif: RD.sif.length,
    sifUncontrolled: RD.sifUncontrolled.length,
    complete: RD.complete,
    matJudged: RD.matJudged,
    byBand: _riskProfileLevel(),
    meanScore: M.meanScore == null ? null : +M.meanScore.toFixed(6),
    cells: Object.fromEntries(Object.entries(M.cells).map(([k, c]) => [k, c.items.length])),
    open: ex.filter(a => a.status !== 'Complete' && a.status !== 'Accepted').length,
    overdue: ex.filter(a => a.rag === 'red').length,
    // Plan delivery (the "risks fully actioned" tile): the app's own
    // per-risk plan state, counted the same way the report counts it.
    planDone: (S.riskProfile || []).filter(r => _riskPlanState(r).k === 'managed').length,
    planAccepted: (S.riskProfile || []).filter(r => _riskPlanState(r).k === 'accepted').length,
    trnExp: _auditMetricsNow().trainingExpired,
    // Wins (board "Successes" page): the app's aggregator is the truth -
    // every action closed in the report period (or undated) from all three
    // sources, removed/deleted excluded.
    winsAll: (function () {
      const t = new Date(); t.setDate(t.getDate() - 90); const p90 = t.toISOString().slice(0, 10);
      return _execActions().filter(a => (a.status === 'Complete' || a.status === 'Accepted') && ((a.resolvedDate || '') === '' || a.resolvedDate >= p90)).length;
    })(),
    // The hold model as the SCREEN computes it — per-risk states + summary.
    hold: { total: H.total, held: H.held, working: H.working, slipping: H.slipping, notheld: H.notheld,
            breaches: H.breaches.map(b => ({ id: b.id, band: b.band, k: b.hold.k, breach: b.breach })),
            pillT: H.pillT, pillC: H.pillC, verdict: H.verdict,
            rows: H.rows.map(r => ({ id: r.id, k: r.hold.k, reasons: r.hold.reasons })) },
    panelPill: (function () { const bits = _rpVerdictBits(M); return { pill: bits.pillT, pillColor: bits.pillC }; })(),
    // Document control: the record the app itself would stamp on each PDF.
    docBoard: _docFor('boardReport'), docRisk: _docFor('riskProfile'),
    liveHoldStates: HOLD_STATES, liveHoldOrder: HOLD_ORDER,
    liveDomains: PROF_LIBRARY.domains.filter(d => d.type === 'maturity').map(d => ({ id: d.id, name: d.name, items: d.items.map(it => ({ id: it.id, crit: !!it.crit })) })),
  };
}, STATE);
await browser.close();

// The identical state through the report layer.
const D = deriveBoard(STATE, { today: TODAY });

const diffs = [];
const eq = (label, a, b) => { const ja = JSON.stringify(a), jb = JSON.stringify(b); if (ja !== jb) diffs.push(label + ': app=' + ja + ' report=' + jb); };
eq('fatal-potential count', app.sif, D.fatal);
eq('fatal-potential uncontrolled', app.sifUncontrolled, D.fatalUncontrolled);
eq('assessment checks clear', app.complete.clear, D.complete.clear);
eq('assessment checks total', app.complete.total, D.complete.total);
eq('high band', app.byBand.high, D.byTier.High);
eq('critical band', app.byBand.crit, D.byTier.Critical);
eq('medium band', app.byBand.med, D.byTier.Medium);
eq('low band', app.byBand.low, D.byTier.Low);
eq('mean risk score', app.meanScore, D.meanScore == null ? null : +D.meanScore.toFixed(6));
eq('matrix cells', app.cells, D.matrix);
eq('open actions (all sources)', app.open, D.openActions);
eq('overdue actions (all sources)', app.overdue, D.overdue);
eq('risks fully actioned (plan complete)', app.planDone, D.planDone);
eq('risks formally accepted', app.planAccepted, D.planAccepted);
// Wins: with every closure inside the report period, the board's successes
// list must carry exactly what the app's execution plan calls delivered.
eq('wins = app delivered (all sources)', app.winsAll, deriveBoardExtras(STATE, { today: TODAY }).wins.length);
// Hold model: counts, per-risk states, breaches, and the exact pill/verdict
// wording — the report must speak the app's words, not a paraphrase.
eq('hold: state counts', { t: app.hold.total, h: app.hold.held, w: app.hold.working, s: app.hold.slipping, n: app.hold.notheld },
  { t: D.holdS.total, h: D.holdS.held, w: D.holdS.working, s: D.holdS.slipping, n: D.holdS.notheld });
eq('hold: per-risk states', app.hold.rows, D.holdS.rows.map(r => ({ id: r.id, k: r.hold.k, reasons: r.hold.reasons })));
eq('hold: breaches', app.hold.breaches, D.holdS.breaches.map(b => ({ id: b.id, band: b.band, k: b.hold.k, breach: b.breach })));
eq('hold: pill text', app.hold.pillT, D.holdS.pillT);
eq('hold: pill colour', app.hold.pillC, D.holdS.pillC);
eq('hold: verdict sentence', app.hold.verdict, D.holdS.verdict);
eq('panel pill = hold pill', app.panelPill.pill, D.holdS.pillT);
eq('judged areas count', app.matJudged, Object.values(STATE.profiler.judgement).filter(j => j && j.level).length);
// Training: the audit metric and the report read the SAME v2 rows.
eq('training expired (v2 store)', app.trnExp, deriveBoardExtras(STATE, { today: TODAY }).trnExpired.length);
// Document control resolves identically (the app returns legacy aliases and
// an underscored omit flag on top; compare the shared fields).
const dcPick = (d) => ({ ref: d.ref, version: d.version, author: d.author, approverName: d.approverName, approverRole: d.approverRole, issued: d.issued, nextReview: d.nextReview, omit: !!(d.omit || d._omit) });
eq('doc control: board report row', dcPick(app.docBoard), dcPick(contract.docFor(STATE, 'boardReport', { today: TODAY })));
eq('doc control: risk profile row', dcPick(app.docRisk), dcPick(contract.docFor(STATE, 'riskProfile', { today: TODAY })));
// Contract tables still mirror the live app.
eq('contract: hold states', app.liveHoldStates, contract.HOLD_STATES);
eq('contract: hold order', app.liveHoldOrder, contract.HOLD_ORDER);
eq('contract: maturity domains/items', app.liveDomains, contract.MATURITY_DOMAINS);

if (pageErrors.length) diffs.push('page errors: ' + pageErrors.join(' | '));
if (diffs.length) {
  console.error('✗ APP ↔ REPORT MISMATCH (' + diffs.length + '):');
  diffs.forEach(d => console.error('  · ' + d));
  process.exit(1);
}
console.log('✓ app and report agree on every checked figure (fatal, uncontrolled, bands, matrix, mean score, completeness, open/overdue, hold states, breaches, pill and verdict wording) and the contract matches the live app.');
