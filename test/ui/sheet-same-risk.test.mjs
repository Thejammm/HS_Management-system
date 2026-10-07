// ══════════════════════════════════════════════════════════════
//  Two lines on one action sheet on the same risk (Simon, 2026-10-07):
//  the risk's actions table prints once, on the first line's page; the
//  later line lists only its own action, under a note naming that page,
//  so nothing - gap rows above all - is answered twice.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Action sheet - two lines on one risk');
const { browser, page, errors } = await openApp();

const month = new Date().toISOString().slice(0, 7);
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
await seed(page, {
  company: { legalName: 'Fineline Architects Ltd' },
  riskProfile: [{ id: 'r1', activity: 'Disturbing asbestos on survey', hazard: 'Asbestos in void property', likelihood: '4', severity: '5', targetL: '1', targetS: '5',
    actions: [
      { id: 'c1', desc: 'Asbestos register checked before every survey', owner: 'Jo Fine', status: 'Not started', hideFromPlan: true },
      { id: 'c2', desc: 'Asbestos awareness training for every surveyor', owner: 'Sam Line', status: 'Not started', hideFromPlan: true },
      { id: 'a1', desc: 'Write the register check into the booking procedure', owner: 'Jo Fine', due: day(10), status: 'Not started', forCtl: 'c1', top5: month },
      { id: 'a2', desc: 'Buy FFP3 masks for the kit bags', owner: 'Sam Line', due: day(20), status: 'Not started' },
    ] }],
}, 'execplan');
await wait(page, 400);

const t = await page.evaluate(async () => {
  delete S.actionSheets;
  asNewSheet();
  const s = _asList('top5').slice(-1)[0];
  const items = (s.items || []).map(i => i.key);
  // what the sheet prints: collect the words drawn, and read the meta back
  const said = [], orig = PDFLib.PDFPage.prototype.drawText;
  PDFLib.PDFPage.prototype.drawText = function (txt, o) { said.push(String(txt)); return orig.call(this, txt, o); };
  let bytes; try { bytes = await buildActionSheetPDF(s.id); } finally { PDFLib.PDFPage.prototype.drawText = orig; }
  const doc = await PDFLib.PDFDocument.load(bytes), meta = JSON.parse(doc.getForm().getTextField('as__meta').getText());
  const names = doc.getForm().getFields().map(f => f.getName());
  openActionSheets('top5'); await new Promise(r => setTimeout(r, 200));
  const screen = (document.getElementById('asOv') || {}).innerText || '';
  closeActionSheets();
  return { n: items.length, rows: meta.rows, said, names, screen };
});
R.ok(t.n === 2, 'the sheet carries both actions on the one risk (' + t.n + ')');
R.ok(Array.isArray(t.rows) && t.rows[0].length >= 3, 'the first line\'s page has the risk\'s full table: both actions and the gap row (' + (t.rows && t.rows[0].length) + ' rows)');
R.ok(t.rows && t.rows[1].length === 1 && !!t.rows[1][0].a, 'the second line lists only its own action - no gap row, nothing twice');
R.ok(t.said.some(x => /FURTHER RECOMMENDED ACTIONS FOR THIS RISK ARE LISTED UNDER PRIORITY 1/.test(x)), 'its page says where the rest of the table is');
R.ok(!t.names.some(f => /^as_2_r2_/.test(f)), 'the second page has one row of boxes');
R.ok(/Same risk as line 1/.test(t.screen), 'the draft screen warns on the second line');

await R.done(browser, errors);
