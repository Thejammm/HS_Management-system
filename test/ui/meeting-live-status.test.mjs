// ══════════════════════════════════════════════════════════════
//  Meeting actions read live from the plan, and the action sheet's WHO box
//  fits its names (Simon, 2026-10-07): "link the meeting actions to the plan
//  so status is live" - and four owners on one action overflowed the box.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Meeting actions live from the plan, and the WHO box fits');
const { browser, page, errors } = await openApp();

const month = new Date().toISOString().slice(0, 7);
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
await seed(page, {
  company: { legalName: 'Fineline Group', slt: [{ name: 'Jo Fine', role: 'Managing Director' }] },
  riskProfile: [{ id: 'r1', activity: 'Surveys on or in pre-2000 buildings, sites or premises', hazard: 'Asbestos', likelihood: '4', severity: '5', targetL: '2', targetS: '3',
    actions: [
      { id: 'c1', desc: 'Pre construction information procedure', owner: 'James Boyes', due: day(30), status: 'Not started', hideFromPlan: true },
      { id: 'a1', desc: 'Establish the presence of ACM prior to visit', owner: 'James Boyes, Jason Smithies, Haydn Scarborough, Simon Archer', due: day(29), status: 'Not started', priority: 'High', forCtl: 'c1', top5: month },
      { id: 'a2', desc: 'Provide UKATA accredited asbestos awareness training to in house surveyors', owner: 'James Boyes, Jason Smithies, Haydn Scarborough, Simon Archer', due: day(29), status: 'Not started', priority: 'High', forCtl: 'c1' },
    ] }],
}, 'cockpit');
await wait(page, 400);

// ── live status ──
{
  const t = await page.evaluate(() => {
    openQuickMinutes();
    const m = _qmCurrent(); qmSet('note', 'Walked through the asbestos risk.');
    const d1 = _qmNewAction(m, { decision: 'Chase the landlord for the R&D survey', owner: 'Jo Fine', due: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10) });
    qmDone();
    const d = _decisions().find(x => x.id === d1.id);
    const ap = _apList().find(a => (d.actIds || []).indexOf(a.id) >= 0);
    const out = { linked: !!ap, ids: (d.actIds || []).length, w0: _qmActWord(d) };
    ap.status = 'In progress'; out.w1 = _qmActWord(d);
    ap.status = 'Not started'; ap.due = '2020-01-01'; out.w2 = _qmActWord(d); out.late = _qmActLate(d);
    ap.status = 'Complete'; out.w3 = _qmActWord(d); out.late3 = _qmActLate(d);
    // an older decision, raised before the link was kept: found by its words and owner
    const old = { id: 'dec_old', decision: 'Book the van in for its service', owner: 'Sam Line', due: '2026-11-01', status: 'Agreed', raised: 1 };
    _decisions().push(old); _apList().push({ id: 'ap_old', desc: 'Book the van in for its service', owner: 'Sam Line', due: '2026-11-01', status: 'In progress' });
    out.old = _qmActWord(old);
    // one not on the plan reads as before
    out.agreed = _qmActWord({ decision: 'x', status: 'Agreed', raised: 0 });
    return out;
  });
  R.ok(t.linked && t.ids === 1, 'Done keeps the id of the plan action each meeting action became');
  R.ok(t.w0 === 'Not started' && t.w1 === 'In progress', 'its status is the plan action\'s own - Not started, then In progress (' + t.w0 + ', ' + t.w1 + ')');
  R.ok(t.w2 === 'Overdue' && t.late, 'past its date on the plan it reads Overdue, and its date prints red');
  R.ok(t.w3 === 'Complete' && !t.late3, 'completed on the plan it reads Complete, and is no longer red');
  R.ok(t.old === 'In progress', 'an older meeting action, raised before the link, is found by its words and owner (' + t.old + ')');
  R.ok(t.agreed === 'Agreed', 'an action never put on the plan still reads Agreed');
}

// ── the WHO box fits four owners ──
{
  const t = await page.evaluate(async () => {
    delete S.actionSheets;
    asNewSheet();
    const s = _asList('top5').slice(-1)[0];
    const bytes = await buildActionSheetPDF(s.id);
    const doc = await PDFLib.PDFDocument.load(bytes), form = doc.getForm();
    const out = [];
    form.getFields().filter(f => /^as_1_r\d+_who$/.test(f.getName())).forEach(f => {
      const w = f.acroField.getWidgets()[0], rc = w.getRectangle();
      const da = String(w.getDefaultAppearance() || f.acroField.getDefaultAppearance() || '');
      const size = +((/([\d.]+) Tf/.exec(da) || [])[1] || 0);
      out.push({ name: f.getName(), text: f.getText(), h: rc.height, size });
    });
    return out;
  });
  R.ok(t.length === 2 && t.every(x => /Simon Archer/.test(x.text || '')), 'both rows carry all four owners in the WHO box (' + t.length + ')');
  R.ok(t.every(x => x.size === 8.6), 'four names print at the original size (' + t.map(x => x.size).join(', ') + ')');
  // four names in a box this wide wrap to about four lines: the box must hold them all
  R.ok(t.every(x => x.h >= 4 * x.size * 1.15 + 6), 'and the row is tall enough for every line (' + t.map(x => Math.round(x.h)).join(', ') + 'pt)');
}

await R.done(browser, errors);
