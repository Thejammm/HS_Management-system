// Render the management plan against a realistic client so it can be read the
// way it will be handed over - a worked profile with themes, delivered actions
// that were closed out, routines, sign-offs and documents.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer-core';
import { createRequire } from 'node:module';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const OUT = process.argv[2] || root;
const need = createRequire(import.meta.url);
const CHROME = need(path.join(root, 'lib', 'chromium.js')).findChromium();

const tpl = await import(url.pathToFileURL(path.join(root, 'public', 'reports', 'templates', 'index.js')).href);
const eng = await import(url.pathToFileURL(path.join(root, 'public', 'reports', 'engine.js')).href);

const STATE = {
  company: { legalName: 'Testing Client Ltd', tradingName: 'Testing Client', employees: '9', siteCount: '1',
    sector: 'Vehicle repair and passenger transport',
    description: 'A garage and a small assisted passenger transport service run from one site.',
    personnel: [ { name: 'S Archer', role: 'Managing Director', contact: 'simon@example.com' },
                 { name: 'Dee Marsh', role: 'Fire warden', contact: '' },
                 { name: 'Bev Hall', role: 'Transport manager', contact: '' } ] },
  policyDoc: { signedDate: '2026-04-02', signedBy: 'S Archer' },
  riskProfile: [
    { id: 'r1', activity: 'Fire breaking out at the premises', libKey: 'fire', category: 'Fire', area: 'Workshop',
      assocRisk: 'A fire starting in the workshop and spreading to the office', inherentL: '4', inherentS: '5',
      likelihood: '2', severity: '5', targetL: '2', targetS: '5', reviewed: true, reviewDue: '2027-04-01',
      controls: 'Extinguishers serviced annually; hot work permit; alarm tested weekly',
      linked: [{ id: 'l1', ref: 'Fire risk assessment 2026', actionId: 'r1a1' }],
      actions: [ { id: 'r1a1', desc: 'Write the fire evacuation procedure', owner: 'Dee Marsh', due: '2026-08-30', status: 'Complete',
        completedDate: '2026-08-28', completedBy: 'Dee Marsh',
        embed: { at: '2026-08-28', by: 'Dee Marsh',
          doc: { name: 'Fire evacuation procedure v1', path: '' },
          routine: { item: 'Fire drill and alarm test', frequency: '6-monthly', owner: 'Dee Marsh', due: '2027-02-28' },
          owner: { name: 'Dee Marsh', role: 'Fire warden' } } } ] },
    { id: 'r2', activity: 'A serious road collision driving for work', libKey: 'roadrisk', category: 'Physical', area: 'Transport',
      assocRisk: 'A minibus collision carrying assisted passengers', inherentL: '4', inherentS: '5',
      likelihood: '3', severity: '5', targetL: '2', targetS: '5',
      controls: 'Licence checks twice a year; daily walkaround; journey planning',
      actions: [ { id: 'r2a1', desc: 'Write the driving-for-work policy and brief the drivers', owner: 'Bev Hall', due: '2026-07-01',
        status: 'Complete', completedDate: '2026-07-04', completedBy: 'Bev Hall',
        embed: { at: '2026-07-04', by: 'Bev Hall',
          brief: { title: 'Driving for work', type: 'Procedure', date: '2026-07-04' },
          routine: { item: 'Driving licence check', frequency: '6-monthly', owner: 'Bev Hall', due: '2027-01-04' } } },
        { id: 'r2a2', desc: 'Fit telematics to both minibuses', owner: 'Bev Hall', due: '2026-12-01', status: 'In progress', priority: 'High' } ] },
    { id: 'r3', activity: 'A fall from height working on vehicle roofs', libKey: 'workatheight', category: 'Physical', area: 'Workshop',
      assocRisk: 'Falling from a minibus roof while cleaning or repairing', inherentL: '4', inherentS: '4',
      likelihood: '3', severity: '4',
      controls: 'Step platform in the bay; no roof work outside',
      actions: [ { id: 'r3a1', desc: 'Buy a proper mobile access platform', owner: 'S Archer', due: '2026-02-01', status: 'Not started', priority: 'Critical' } ] },
    { id: 'r4', activity: 'Manual handling injury in the stores', libKey: 'manualhandling', category: 'Ergonomic', area: 'Stores',
      inherentL: '3', inherentS: '3', likelihood: '2', severity: '3', targetL: '2', targetS: '3', reviewed: true,
      controls: 'Racking re-laid so nothing is lifted above shoulder height', actions: [] },
    { id: 'r5', activity: 'Aggression from passengers on assisted runs', libKey: 'violence', category: 'Psychosocial', area: 'Transport',
      inherentL: '3', inherentS: '3', likelihood: '2', severity: '3',
      controls: 'De-escalation training; lone worker check-in',
      actions: [ { id: 'r5a1', desc: 'Refresh the de-escalation training', owner: 'Bev Hall', due: '2027-03-01', status: 'Not started' } ] },
    { id: 'r6', activity: 'Losing the key transport contract', libKey: 'contractloss', mode: 'ops', category: 'Business continuity',
      inherentL: '3', inherentS: '4', likelihood: '3', severity: '4', actions: [] },
  ],
  actionPlan: [ { id: 'f1', desc: 'Renew the employers liability certificate', owner: 'Bev Hall', due: '2027-01-31', status: 'Not started', source: 'Assurance' } ],
  requirements: [ { id: 'sec1', heading: 'Health and safety essentials', items: [
      { id: 'i1', requirement: 'A written health and safety policy', present: 'Yes', adequate: 'Yes', reviewed: true, actions: [] },
      { id: 'i2', requirement: 'Employers liability insurance displayed', present: 'Yes', adequate: 'Yes', reviewed: true, actions: [] },
      { id: 'i3', requirement: 'First aid needs assessed', present: 'No', adequate: '', actions: [] } ] } ],
  monitoring: { regSections: [
    { id: 'rs1', name: 'Ongoing controls', items: [
      { id: 'g1', item: 'Fire drill and alarm test', frequency: '6-monthly', resultDate: '2026-08-28', dueDate: '2027-02-28', notes: 'Owner: Dee Marsh. Kept in place from a completed plan action.' },
      { id: 'g2', item: 'Driving licence check', frequency: '6-monthly', resultDate: '2026-07-04', dueDate: '2027-01-04', notes: 'Owner: Bev Hall. Kept in place from a completed plan action.' } ] },
    { id: 'rs2', name: 'Statutory examinations', items: [
      { id: 'g3', item: 'LOLER thorough examination - four post lifts', area: 'Workshop', frequency: '6-monthly', resultDate: '2026-03-14', dueDate: '2026-09-14', result: 'Pass' },
      { id: 'g4', item: 'Fixed wiring inspection (EICR)', area: 'Premises', frequency: '5-yearly', resultDate: '2023-06-01', dueDate: '2028-06-01' } ] } ] },
  policySignoff: { policies: [
      { id: 'p1', title: 'Fire evacuation procedure', type: 'Procedure', version: '1', delivered: '2026-08-28', riskIds: ['r1'] },
      { id: 'p2', title: 'Driving for work', type: 'Procedure', version: '1', delivered: '2026-07-04', riskIds: ['r2'] } ],
    staff: [ { id: 's1', name: 'Dee Marsh' }, { id: 's2', name: 'Bev Hall' }, { id: 's3', name: 'Ash Novak' } ],
    signed: { 's1|p1': true, 's2|p1': true, 's2|p2': true } },
  toolbox: { deliveries: [ { id: 'd1', title: 'Working around vehicles', date: '2026-09-02', presenter: 'S Archer',
      attendees: [ { signed: true }, { signed: true }, { signed: false } ] } ] },
  documents: [ { id: 'dc1', name: 'Fire evacuation procedure v1', category: 'Procedure' },
    { id: 'dc2', name: 'Fire risk assessment 2026', category: 'Risk assessment' },
    { id: 'dc3', name: 'Employers liability certificate', category: 'Certificate' } ],
  siteInspections: [ { type: 'Workshop inspection', planned: '2026-06-01', actual: '2026-06-03', outcome: 'Completed' },
    { type: 'Workshop inspection', planned: '2026-12-01', actual: '', outcome: '' } ],
};

const report = tpl.buildReport(STATE, 'management-plan', { today: '2026-09-28', tenant: { name: 'Testing Client Ltd' } });
console.log('pages: ' + report.pages.length + ' -> ' + report.pages.map(p => p.label).join(' | '));
const html = '<!doctype html><html><head><meta charset="utf-8"><base href="file://' + root.replace(/\\/g, '/') + '/public/">'
  + '<link rel="stylesheet" href="reports/report.css"><style>body{margin:0;background:#fff}</style></head><body>'
  + eng.reportHTML(report) + '</body></html>';
const tmp = path.join(OUT, '_plan.html');
fs.writeFileSync(tmp, html);

const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--headless=new', '--disable-gpu'], defaultViewport: { width: 1000, height: 1400 } });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(url.pathToFileURL(tmp).href, { waitUntil: 'networkidle0' });
try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}
const secs = await page.$$('.r-page');
for (let i = 0; i < secs.length; i++) {
  await secs[i].screenshot({ path: path.join(OUT, '_plan_' + String(i + 1).padStart(2, '0') + '_' + report.pages[i].label.replace(/\W+/g, '') + '.png') });
}
console.log('wrote ' + secs.length + ' page images');
// measure: nothing may run past the page edge on a real client's data either
const over = await page.evaluate(() => [...document.querySelectorAll('.r-page')].map((el, i) => {
  const body = el.querySelector('.r-page-body'); const foot = el.querySelector('.r-foot');
  const limit = foot ? foot.getBoundingClientRect().top : el.getBoundingClientRect().bottom;
  let past = 0;
  [...body.children].forEach(c => { const b = c.getBoundingClientRect().bottom; if (b > limit) past = Math.max(past, Math.round(b - limit)); });
  return { i: i + 1, past };
}).filter(x => x.past > 0));
console.log(over.length ? ('OVERFLOW: ' + over.map(o => 'page ' + o.i + ' by ' + o.past + 'px').join(', ')) : 'no page overflows on the worked client');
console.log(errs.length ? ('PAGE ERRORS: ' + errs.join(' | ')) : 'no page errors');
await browser.close();
