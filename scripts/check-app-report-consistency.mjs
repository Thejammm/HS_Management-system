// ══════════════════════════════════════════════════════════════
// APP ↔ REPORT CONSISTENCY CHECK — run before deploying anything that
// touches either side:  node scripts/check-app-report-consistency.mjs
//
// Boots the real index.html headless, seeds an edge-case state, reads the
// numbers the SCREENS compute, computes the same numbers via the report
// layer's derive.js on the identical state, and diffs them. Also asserts the
// generated app-contract.js still matches the app's live library tables.
// Any mismatch exits non-zero. (House rule: a report may never count
// differently from a screen — found live by Simon: board said 4
// fatal-potential, cockpit said 3.)
// ══════════════════════════════════════════════════════════════
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const here = path.dirname(url.fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const puppeteer = require(path.join(repo, 'node_modules', 'puppeteer-core'));
const { deriveBoard } = await import(url.pathToFileURL(path.join(repo, 'public', 'reports', 'derive.js')));
const contract = await import(url.pathToFileURL(path.join(repo, 'public', 'reports', 'app-contract.js')));

const TODAY = '2026-08-19';
// Edge cases on purpose: severity-4 SIF (the live bug), explicit sif:false
// override on a severity-5, unrated risk with inherent 5, target-severity-4
// only, unmapped category (excluded from maturity), crit-veto domain,
// overdue actions in all three sources.
const STATE = {
  riskProfile: [
    { id: 'r1', activity: 'Sev-4 machine risk', category: 'Physical', likelihood: '3', severity: '4', inherentL: '4', inherentS: '4', controls: 'guards', controlLevel: 'prevent',
      actions: [{ id: 'a1', desc: 'Guard check', owner: 'Ops', due: '2026-08-01', status: 'In progress' }] },
    { id: 'r2', activity: 'Sev-5 but formally not SIF', category: 'Fire', likelihood: '2', severity: '5', inherentL: '3', inherentS: '5', sif: false, controls: 'suppression', controlLevel: 'protect', actions: [] },
    { id: 'r3', activity: 'Unrated, inherent fatal', category: 'Chemical', inherentL: '3', inherentS: '5', actions: [] },
    { id: 'r4', activity: 'Target-severity-4 only', category: 'Electrical', likelihood: '2', severity: '3', targetS: '4', controls: '', actions: [] },
    { id: 'r5', activity: 'Low risk, no controls recorded', category: 'Ergonomic', likelihood: '1', severity: '5', actions: [{ id: 'a2', desc: 'Done thing', status: 'Complete', completedDate: '2026-08-10' }] },
    { id: 'r6', activity: 'Unmapped category risk', category: 'Made-up category', likelihood: '3', severity: '3', actions: [] },
  ],
  requirements: [{ id: 's1', heading: 'Duty', items: [{ id: 'i1', criteria: [], actions: [{ id: 'ma1', desc: 'Mgmt overdue action', owner: '', due: '2026-07-01', status: 'Not started' }] }] }],
  actionPlan: [
    { id: 'ap1', desc: 'Free overdue, no owner', due: '2026-06-30', status: 'Not started' },
    { id: 'ap2', desc: 'Free undated', status: 'In progress' },
    { id: 'ap3', desc: 'Deleted — must not count', due: '2026-01-01', status: 'Not started', deleted: true },
  ],
  profiler: { maturity: {}, exposure: {} },
  riskAssurance: { leading: [{ id: 'l1', measure: 'x' }], lagging: [], assurance: [] },
};

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--headless=new', '--allow-file-access-from-files', '--disable-gpu'],
});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 120)));
await page.goto(url.pathToFileURL(path.join(repo, 'public', 'index.html')).href, { waitUntil: 'load', timeout: 30000 });

const app = await page.evaluate((STATE, TODAY) => {
  // Seed maturity through the app's own library: leadership 3s with one crit
  // item at 1 (veto), opcontrol 2s, ohealth 3s and one N/A, others unscored.
  const doms = _maturityDomains();
  const seed = { leadership: 3, opcontrol: 2, ohealth: 3 };
  doms.forEach(d => { if (seed[d.id] != null) d.items.forEach(it => { STATE.profiler.maturity[it.id] = seed[d.id]; }); });
  const lead = doms.find(d => d.id === 'leadership');
  const crit = lead.items.find(it => it.crit); if (crit) STATE.profiler.maturity[crit.id] = 1;   // veto
  const oh = doms.find(d => d.id === 'ohealth'); STATE.profiler.maturity[oh.items[0].id] = 'na';
  S = STATE; migrateLoadedState();
  const RD = _reportData();
  const M = _riskPanelModel();
  const ex = _execActions();
  return {
    maturitySeed: STATE.profiler.maturity,
    sif: RD.sif.length,
    sifUncontrolled: RD.sifUncontrolled.length,
    completeness: RD.completeness,
    byBand: _riskProfileLevel(),
    panelMaturity: M.maturity == null ? null : +M.maturity.toFixed(6),
    meanScore: M.meanScore == null ? null : +M.meanScore.toFixed(6),
    cells: Object.fromEntries(Object.entries(M.cells).map(([k, c]) => [k, c.items.length])),
    open: ex.filter(a => a.status !== 'Complete' && a.status !== 'Accepted').length,
    overdue: ex.filter(a => a.rag === 'red').length,
    panelRequired: M.required == null ? null : M.required,
    panelShortfall: M.shortfall == null ? null : +(+M.shortfall).toFixed(1),
    liveRequired: RISK_REQUIRED_MATURITY,
    liveMap: RISK_MATURITY_DOMAIN,
    liveDomains: PROF_LIBRARY.domains.filter(d => d.type === 'maturity').map(d => ({ id: d.id, name: d.name, items: d.items.map(it => ({ id: it.id, crit: !!it.crit })) })),
  };
}, STATE, TODAY);
await browser.close();

// Same state (with the maturity the page seeded) through the report layer.
STATE.profiler.maturity = app.maturitySeed;
const D = deriveBoard(STATE, { today: TODAY });

const diffs = [];
const eq = (label, a, b) => { const ja = JSON.stringify(a), jb = JSON.stringify(b); if (ja !== jb) diffs.push(label + ': app=' + ja + ' report=' + jb); };
eq('fatal-potential count', app.sif, D.fatal);
eq('fatal-potential uncontrolled', app.sifUncontrolled, D.fatalUncontrolled);
eq('assessment completeness %', app.completeness, D.completeness);
eq('high band', app.byBand.high, D.byTier.High);
eq('critical band', app.byBand.crit, D.byTier.Critical);
eq('medium band', app.byBand.med, D.byTier.Medium);
eq('low band', app.byBand.low, D.byTier.Low);
eq('management maturity (risk-weighted)', app.panelMaturity, D.maturityAvg == null ? null : +D.maturityAvg.toFixed(6));
eq('mean risk score', app.meanScore, D.meanScore == null ? null : +D.meanScore.toFixed(6));
eq('matrix cells', app.cells, D.matrix);
eq('open actions (all sources)', app.open, D.openActions);
eq('overdue actions (all sources)', app.overdue, D.overdue);
eq('required maturity for the profile', app.panelRequired, D.requiredMaturity == null ? null : D.requiredMaturity);
eq('maturity shortfall', app.panelShortfall, D.maturityShortfall == null ? null : +D.maturityShortfall.toFixed(1));
eq('contract: required-maturity map', app.liveRequired, contract.REQUIRED_MATURITY);
eq('contract: category→domain map', app.liveMap, contract.RISK_MATURITY_DOMAIN);
eq('contract: maturity domains/items', app.liveDomains, contract.MATURITY_DOMAINS);

if (pageErrors.length) diffs.push('page errors: ' + pageErrors.join(' | '));
if (diffs.length) {
  console.error('✗ APP ↔ REPORT MISMATCH (' + diffs.length + '):');
  diffs.forEach(d => console.error('  · ' + d));
  process.exit(1);
}
console.log('✓ app and report agree on every checked figure (fatal, uncontrolled, bands, matrix, maturity, mean score, completeness, open/overdue) and the contract matches the live app.');
