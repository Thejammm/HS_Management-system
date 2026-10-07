// ══════════════════════════════════════════════════════════════
//  The Legal Duties sheet (Simon, 2026-10-07): "a very similar report for the
//  legal duties ... put it next to the top 5 report and structure it the
//  same". A third action-sheet kind, built like the Risk Action Sheet: every
//  risk under Legal duties, a page each, gap lines to say what needs doing.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Legal duties sheet - every legal duty, a page each, built like the Top 5');
const { browser, page, errors } = await openApp();

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const D = (id, activity, extra) => Object.assign({ id, activity, hazard: activity, macroKey: 'legal', likelihood: '', severity: '', actions: [] }, extra || {});
await seed(page, { company: { legalName: 'Fineline Group Ltd' }, riskProfile: [
  D('m31', 'Health & Safety Policy', { likelihood: '3', severity: '3', actions: [{ id: 'm31a', desc: 'Review and re-sign the policy statement', owner: 'James Boyes', due: day(30), status: 'Not started' }] }),
  D('m33', 'Competent person(s)'),
  D('m37', 'First-aid provision'),
  { id: 'p1', activity: 'Fire breaking out at the studio', likelihood: '4', severity: '4', actions: [{ id: 'p1a', desc: 'Fire risk assessment', owner: 'Jo', due: day(10), status: 'Not started' }] },   // not a legal duty
] }, 'cockpit');
await wait(page, 500);

// ── beside the Top 5, on the ladder and on the Reports tab ──
{
  const t = await page.evaluate(() => {
    const tools = [...document.querySelectorAll('.ckl-tools button')].map(b => b.textContent.trim());
    switchTab('reports');
    const cards = [...document.querySelectorAll('#tab-reports *')].filter(e => e.children.length === 0).map(e => e.textContent.trim());
    return { tools, i5: cards.indexOf('Top 5 Action Sheet'), iL: cards.indexOf('Legal Duties Sheet'), iR: cards.indexOf('Risk Action Sheet'), duties: _legalDutyRisks().map(z => z.id) };
  });
  R.ok(t.tools[0] === 'Top 5 action sheet' && t.tools[1] === 'Legal duties sheet', 'the ladder has Legal duties sheet right beside the Top 5 action sheet: ' + t.tools.join(' | '));
  R.ok(t.i5 >= 0 && t.iL > t.i5 && t.iR > t.iL, 'the Reports tab has a Legal Duties Sheet card straight after the Top 5 Action Sheet');
  R.ok(t.duties.length === 3 && t.duties.indexOf('p1') < 0, 'the legal duties are the risks under Legal duties - no others (' + t.duties.join(', ') + ')');
}

// ── a new legal duties sheet: one action each, gap lines for the rest ──
{
  const t = await page.evaluate(async () => {
    delete S.actionSheets;
    openActionSheets('legal'); await new Promise(x => setTimeout(x, 150));
    const tabs = [...document.querySelectorAll('.as-kind')].map(b => b.textContent.trim()), on = (document.querySelector('.as-kind-on') || {}).textContent;
    asNewSheet('legal'); await new Promise(x => setTimeout(x, 150));
    const s = _asList('legal').slice(-1)[0];
    const first = { kind: s.kind, no: s.no, name: _asName(s), items: s.items.map(i => i.key) };
    const gaps = [...document.querySelectorAll('.as-gap .as-gap-n')].map(g => g.textContent);
    const inp = document.getElementById('asGi-' + s.id + '-' + _top5Fid('m33')); inp.value = 'Appoint a competent person'; asAddRiskAction(s.id, 'm33');
    await new Promise(x => setTimeout(x, 100));
    const after = s.items.length, top5 = _asList('top5').length, risk = _asList('risk').length;
    // the PDF: the cover, a page a duty, headed Duty n of N; no meeting record
    const said = [], orig = PDFLib.PDFPage.prototype.drawText;
    PDFLib.PDFPage.prototype.drawText = function (txt, o) { said.push(String(txt)); return orig.call(this, txt, o); };
    let bytes; try { bytes = await buildActionSheetPDF(s.id); } finally { PDFLib.PDFPage.prototype.drawText = orig; }
    const doc = await PDFLib.PDFDocument.load(bytes), meta = JSON.parse(doc.getForm().getTextField('as__meta').getText());
    closeActionSheets();
    return { tabs, on, first, gaps, after, top5, risk, said, pages: doc.getPageCount(), meta: { kind: meta.kind, v: meta.v } };
  });
  R.ok(t.tabs.join('|') === 'Top 5 action sheets|Legal duties sheets|Risk action sheets' && t.on === 'Legal duties sheets', 'the sheets screen opens on its own tab: ' + t.tabs.join(' | '));
  R.ok(t.first.kind === 'legal' && t.first.no === 1 && t.first.name === 'Legal duties sheet 1', 'it is Legal duties sheet 1, numbered on its own');
  R.ok(t.first.items.length === 1 && /m31/.test(t.first.items[0]), 'the duty with an open action goes on it; the fire risk does not');
  R.ok(t.gaps.length === 2 && t.gaps.some(g => /Competent/.test(g)) && t.gaps.some(g => /First-aid/.test(g)), 'the duties with nothing planned get a line to say what needs to be done');
  R.ok(t.after === 2, 'what is typed on that line becomes an action on the duty and goes on the sheet');
  R.ok(t.top5 === 0 && t.risk === 0, 'it touches neither the Top 5 nor the risk action sheets');
  R.ok(t.pages === 3, 'the PDF is the cover and a page a duty (' + t.pages + ' pages)');
  R.ok(t.said.includes('LEGAL DUTIES') && t.said.some(x => /^Legal duties and recommended actions for senior leadership review/.test(x)), 'its cover is LEGAL DUTIES, for senior leadership review');
  R.ok(t.said.some(x => /^SUMMARY OF LEGAL DUTIES/.test(x)) && t.said.some(x => /^DUTY 1 OF 2/.test(x)) && t.said.some(x => /^DUTY 2 OF 2/.test(x)), 'structured as the Top 5: a summary of legal duties, then Duty n of N');
  R.ok(t.said.includes('RECOMMENDED ACTIONS') && t.said.includes('GENERAL COMMENTS') && !t.said.includes('MEETING RECORD'), 'with Recommended actions and General comments, and no meeting record');
  R.ok(t.meta.kind === 'legal' && t.meta.v === 3, 'and it comes back like the other sheets (meta v3, kind legal)');
}

await R.done(browser, errors);
