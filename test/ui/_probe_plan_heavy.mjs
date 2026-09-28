// Reproduce Simon's report: on a real, fully worked client the management
// plan's rows get tall and the content bleeds into the footer. The fixtures
// have short cells, so the overflow check never saw it. This builds a client
// with the cells a consultant actually fills in - long control text, all four
// kinds of close-out, evidence and policies - and measures every page.
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

export const HEAVY = (() => {
  const NAMES = [
    'Fire breaking out at the premises during hot work in the vehicle workshop',
    'A serious road collision while driving for work, including the grey fleet',
    'A fall from height working on vehicle roofs and from the mezzanine store',
    'Asbestos disturbance during intrusive survey work in pre-2000 buildings',
    'Manual handling injury moving stock, wheels and archive boxes between bays',
    'Aggression and violence from passengers on assisted travel runs',
    'Exposure to welding fume, brake dust and solvents in the workshop',
    'Contact with moving machinery on the tyre and brake bays',
    'Electrical injury from live testing and from the fixed installation',
    'Lone working on call-outs and out-of-hours recovery',
    'Slips, trips and falls on the yard and in the wash bay',
    'Losing the key passenger transport contract',
    'Noise and hand-arm vibration from workshop power tools',
    'Legionella risk from the wash bay and the building water system',
    'A workplace transport strike between vehicles and pedestrians in the yard',
    'Failure to maintain statutory examination of lifting equipment',
  ];
  const CONTROLS = 'Hot work permit issued and countersigned by the workshop supervisor before any cutting, grinding or welding; extinguishers serviced annually and checked monthly on the walkaround; fire alarm tested weekly and the log signed; escape routes kept clear and checked on every inspection.';
  const risks = NAMES.map((n, i) => {
    const done = i % 3 !== 2;
    const r = {
      id: 'h' + i, ref: 'R-' + String(i + 1).padStart(3, '0'), activity: n, libKey: ['fire', 'roadrisk', 'workatheight', 'asbestos', 'manualhandling', 'violence'][i % 6],
      mode: i === 11 ? 'ops' : undefined,
      assocRisk: 'The specific scenario this shows up in on site, written out at the length a consultant actually types it into the box.',
      likelihood: String((i % 4) + 1), severity: String(((i + 2) % 4) + 2),
      scoreHistory: i % 2 ? [{ at: '2026-01-01', l: '4', s: '5' }] : [],
      targetL: '2', targetS: '4', reviewed: i % 4 === 0, reviewDue: '2027-03-01',
      controls: CONTROLS.slice(0, 120 + (i % 4) * 80),
      linked: [{ id: 'e' + i, ref: 'Risk assessment ' + (i + 1) + ' rev B, filed in the H&S folder', actionId: 'ha' + i },
               { id: 'f' + i, ref: 'Inspection record ' + (i + 1) + ' signed by the supervisor', actionId: 'ha' + i }],
      actions: [{ id: 'ha' + i, desc: 'Write, issue and brief the procedure covering ' + n.toLowerCase(),
        owner: ['Dee Marsh', 'Bev Hall', 'S Archer'][i % 3], due: '2026-0' + ((i % 8) + 1) + '-15',
        status: done ? 'Complete' : 'In progress', completedDate: done ? '2026-08-2' + (i % 9) : '' }],
    };
    if (done) r.actions[0].embed = { at: '2026-08-28', by: 'Dee Marsh',
      doc: { name: 'Procedure ' + (i + 1) + ' - ' + n.slice(0, 40) + ' v1', path: 'S:\\HS\\procedures\\proc-' + (i + 1) + '.pdf' },
      routine: { item: 'Check and record ' + n.toLowerCase().slice(0, 44), frequency: ['Monthly', 'Quarterly', '6-monthly', 'Annual'][i % 4], owner: ['Dee Marsh', 'Bev Hall', 'S Archer'][i % 3], due: '2027-0' + ((i % 9) + 1) + '-01' },
      brief: { title: 'Briefing on ' + n.slice(0, 44), type: 'Procedure', date: '2026-08-28' },
      owner: { name: ['Dee Marsh', 'Bev Hall', 'S Archer'][i % 3], role: ['Fire warden', 'Transport manager', 'Managing Director'][i % 3] } };
    return r;
  });
  return {
    company: { legalName: 'Heavyweight Motor and Transport Services Limited', employees: '24', siteCount: '2',
      sector: 'Vehicle repair and passenger transport',
      description: 'A vehicle workshop, a tyre and brake centre and an assisted passenger transport service operating from two sites.',
      personnel: [{ name: 'S Archer', role: 'Managing Director', contact: 'simon@example.com' },
        { name: 'Dee Marsh', role: 'Fire warden and first aider', contact: '' },
        { name: 'Bev Hall', role: 'Transport manager', contact: '' }] },
    policyDoc: { signedDate: '2026-04-02', signedBy: 'S Archer' },
    riskProfile: risks,
    actionPlan: [{ id: 'fa1', desc: 'Renew the employers liability certificate and display it', owner: 'Bev Hall', due: '2027-01-31', status: 'Not started', source: 'Assurance' }],
    requirements: [{ id: 'sc1', heading: 'Health and safety essentials', items: [
      { id: 'q1', requirement: 'A written health and safety policy', present: 'Yes', adequate: 'Yes', reviewed: true, actions: [] },
      { id: 'q2', requirement: 'First aid needs assessed', present: 'No', adequate: '', actions: [] }] }],
    monitoring: { regSections: [{ id: 'ms1', name: 'Ongoing controls', items: risks.filter(r => r.actions[0].embed)
      .map((r, i) => ({ id: 'mi' + i, item: r.actions[0].embed.routine.item, frequency: r.actions[0].embed.routine.frequency,
        resultDate: '2026-08-28', dueDate: r.actions[0].embed.routine.due, notes: 'Owner: ' + r.actions[0].embed.routine.owner + '. Kept in place from a completed plan action.' })) }] },
    policySignoff: { policies: risks.slice(0, 9).map((r, i) => ({ id: 'pp' + i, title: 'Procedure ' + (i + 1) + ' - ' + r.activity.slice(0, 34), type: 'Procedure', version: '1', delivered: '2026-08-28', riskIds: [r.id] })),
      staff: [{ id: 'st1', name: 'Dee Marsh' }, { id: 'st2', name: 'Bev Hall' }, { id: 'st3', name: 'Ash Novak' }],
      signed: { 'st1|pp0': true, 'st2|pp0': true, 'st2|pp1': true } },
    documents: risks.slice(0, 14).map((r, i) => ({ id: 'dd' + i, name: 'Procedure ' + (i + 1) + ' - ' + r.activity.slice(0, 30) + ' v1', category: 'Procedure' })),
    siteInspections: [{ type: 'Workshop inspection', planned: '2026-06-01', actual: '2026-06-03', outcome: 'Completed' },
      { type: 'Yard and transport inspection', planned: '2026-12-01', actual: '', outcome: '' }],
  };
})();

if (process.argv[1] && process.argv[1].endsWith('_probe_plan_heavy.mjs')) {
  const rep = tpl.buildReport(HEAVY, 'management-plan', { today: '2026-09-28', tenant: { name: 'Heavyweight Motor and Transport Services Limited' } });
  console.log('pages: ' + rep.pages.length + ' -> ' + rep.pages.map(p => p.label).join(' | '));
  const html = '<!doctype html><html><head><meta charset="utf-8"><base href="file://' + root.replace(/\\/g, '/') + '/public/">'
    + '<link rel="stylesheet" href="reports/report.css"><style>body{margin:0;background:#eceae6;padding:18px 0}.r-page{margin:0 auto 18px;box-shadow:0 2px 14px rgba(0,0,0,.18)}</style></head><body>'
    + eng.reportHTML(rep) + '</body></html>';
  const tmp = path.join(OUT, '_plan_heavy.html');
  fs.writeFileSync(tmp, html);
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--headless=new', '--disable-gpu'], defaultViewport: { width: 1000, height: 1400 } });
  const page = await browser.newPage();
  await page.emulateMediaType('print');
  await page.goto(url.pathToFileURL(tmp).href, { waitUntil: 'networkidle0' });
  try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}
  const over = await page.evaluate(() => [...document.querySelectorAll('.r-page')].map((p, i) => {
    const body = p.querySelector('.r-page-body') || p;
    const top = p.getBoundingClientRect().top;
    const bottom = Math.max(0, ...[...body.querySelectorAll('*')].map(c => c.getBoundingClientRect().bottom - top));
    const foot = p.querySelector('.r-foot');
    const footTop = foot ? Math.round(foot.getBoundingClientRect().top - top) : p.clientHeight;
    return { i: i + 1, label: p.getAttribute('data-label'), past: Math.round(bottom - p.clientHeight), intoFooter: Math.round(bottom - footTop) };
  }));
  over.forEach(o => console.log('  page ' + String(o.i).padStart(2) + ' ' + String(o.label).padEnd(12)
    + (o.past > 0 ? ('OFF THE PAGE by ' + o.past + 'px') : (o.intoFooter > 0 ? ('into the footer by ' + o.intoFooter + 'px') : 'clear'))));
  const secs = await page.$$('.r-page');
  for (let i = 0; i < secs.length; i++) {
    await secs[i].screenshot({ path: path.join(OUT, '_hv_' + String(i + 1).padStart(2, '0') + '_' + String(rep.pages[i].label).replace(/\W+/g, '') + '.png') });
  }
  console.log('wrote ' + secs.length + ' page images');
  await browser.close();
}
