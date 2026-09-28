// ══════════════════════════════════════════════════════════════
//  UI test harness - drives the real app in a real browser.
//
//  The app is one file (public/index.html) that runs from file://, so a test
//  loads it, seeds S (the client state) and then clicks what the consultant
//  clicks. These live in the repo, run by `npm run test:ui`, because the
//  regression net has to outlive any one working session.
// ══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer-core';
import { createRequire } from 'node:module';

const here = path.dirname(url.fileURLToPath(import.meta.url));
export const root = path.join(here, '..', '..');
export const APP = path.join(root, 'public', 'index.html');

const CHROME = (() => {
  const need = createRequire(import.meta.url);
  const found = need(path.join(root, 'lib', 'chromium.js')).findChromium();
  if (!found) { console.error('X No Chromium found. Set PUPPETEER_EXECUTABLE_PATH or CHROMIUM_PATH.'); process.exit(2); }
  return found;
})();

// Open the app with a clean slate. It tests what ships (public/index.html)
// unless COMPASS_APP points somewhere else, which is how a change is proved
// before it is promoted.
export async function openApp(opts = {}) {
  const file = opts.file || process.env.COMPASS_APP || APP;
  if (!fs.existsSync(file)) { console.error('X App not found: ' + file); process.exit(2); }
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--headless=new', '--disable-gpu'], defaultViewport: { width: opts.width || 1366, height: opts.height || 950 } });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  page.on('dialog', d => d.accept());          // confirms are the consultant saying yes
  await page.goto(url.pathToFileURL(file).href, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"', { timeout: 30000 });
  await wait(page, 300);
  return { browser, page, errors };
}

export const wait = (page, ms) => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);

// Seed the client state, then render the tab under test. Anything not named
// is cleared, so one test never inherits another's data.
export async function seed(page, state, tab) {
  await page.evaluate((st, t) => {
    // riskRefSeq is per client: seeding a fresh client resets it, or every
    // suite in the same page would carry on numbering where the last left off.
    const blank = { riskProfile: [], actionPlan: [], requirements: [], documents: [], raRegister: [], recycleBin: [], riskRefSeq: 0, macroLetters: {},
      // the client's own registers, or a fresh client inherits the last one's
      trainingData: { sheets: [], people: [], filename: '' }, monitoring: { months: {}, meta: {}, regulatory: [], regSections: [] },
      incidents: [], decisions: [], siteInspections: [], units: [], memberships: [], healthSurveillance: [],
      supplyChain: [], buildingSafety: [],
      // the sign-off register and the two libraries that feed it
      policySignoff: { policies: [], staff: [], signed: {}, log: [], logMigrated: true },
      toolbox: { custom: [], deliveries: [], hidden: [] }, cpd: { items: [], log: [], issued: {}, intro: '' } };
    Object.assign(S, blank, st || {});
    if (typeof _riskSearch !== 'undefined') { _riskSearch = ''; _riskMacroOpen = {}; _riskMacroLast = null; _riskSel = null; _riskModalOpen = false; }
    if (typeof _riskModeFilter !== 'undefined') _riskModeFilter = 'all';
    if (t) switchTab(t);
  }, state, tab);
  await wait(page, 450);
}

// Open the register's collapsed section and expand every macro group.
export async function openRegister(page) {
  await page.evaluate(() => {
    switchTab('risk');
    const sec = document.getElementById('wfRegister'); if (sec) sec.open = true;
    _macroExpandAll(true);
  });
  await wait(page, 450);
}

// A tiny reporter so a failure names the behaviour, not a line number.
export function reporter(title) {
  let fails = 0;
  console.log('\n── ' + title + ' ' + '─'.repeat(Math.max(0, 62 - title.length)));
  return {
    ok(cond, name) { console.log((cond ? '  ok   ' : '  FAIL ') + name); if (!cond) fails++; return !!cond; },
    async done(browser, errors) {
      this.ok(!errors.length, 'no page errors' + (errors.length ? ' (' + errors.join(' | ') + ')' : ''));
      await browser.close();
      if (fails) { console.error('\n' + fails + ' FAILURE' + (fails !== 1 ? 'S' : '') + ' in ' + title); process.exit(1); }
      console.log('  ALL PASS - ' + title);
    },
  };
}

// Fixtures the suites share: a small profile that covers every band, both
// kinds, a control row, a plan action and a piece of evidence.
export const RISKS = () => ([
  { id: 'v1', activity: 'Fire breaking out at the premises', libKey: 'fire', category: 'Fire', area: 'Premises',
    likelihood: '5', severity: '5', assocRisk: 'A fire starting in the workshop and spreading', personsAtRisk: ['Employees'],
    controls: 'Extinguishers serviced annually', actions: [
      { id: 'v1c1', desc: 'Fire risk assessment reviewed annually', owner: 'S. Archer', due: '2026-12-01', status: 'Not started', hideFromPlan: true },
      { id: 'v1a1', desc: 'Write the fire evacuation procedure', owner: 'Charlie', due: '2026-11-30', status: 'In progress', priority: 'High' }],
    linked: [{ id: 'v1l1', ref: 'Fire risk assessment 2026', url: '' }] },
  { id: 'v2', activity: 'A fall from height during survey work', libKey: 'workatheight', category: 'Physical', area: 'Sites',
    likelihood: '4', severity: '5', targetL: '2', targetS: '3', assocRisk: 'The fragile skylight giving way', actions: [] },
  { id: 'v3', activity: 'A serious road collision driving for work', libKey: 'roadrisk', category: 'Physical', area: 'Transport',
    likelihood: '3', severity: '4', actions: [] },
  { id: 'v4', activity: 'Manual handling injury in the stores', libKey: 'manualhandling', category: 'Ergonomic', area: 'Operations',
    likelihood: '2', severity: '3', targetL: '2', targetS: '3', actions: [] },
  { id: 'v5', activity: 'Losing the key client', libKey: 'contractloss', mode: 'ops', category: 'Business continuity', area: 'Commercial',
    likelihood: '3', severity: '4', actions: [] },
  { id: 'v6', activity: 'Not yet scored', actions: [] },
]);
