// ══════════════════════════════════════════════════════════════
//  What puts a risk on the Top 5 action sheet (Simon, 2026-10-07: "it is
//  bringing up the wrong risks"). The ticks on the cockpit risk ladder come
//  first - always, even when the ticked action is also on a risk action
//  sheet; fewer than five ticked, the sheet is topped up with the next
//  highest current rating on the ladder; each line says why it is there.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Top 5 action sheet - the ticks first, then the ladder');
const { browser, page, errors } = await openApp();

const month = new Date().toISOString().slice(0, 7);
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const r = (id, activity, l, s, extra) => Object.assign({ id, activity, likelihood: String(l), severity: String(s), targetL: '1', targetS: String(s),
  actions: [{ id: id + 'a', desc: 'Action on ' + activity, owner: 'Jo', due: day(20), status: 'Not started' }] }, extra || {});
await seed(page, { company: { legalName: 'Fineline Group Ltd' }, riskProfile: [
  r('a', 'Asbestos on intrusive surveys', 4, 5),        // 20 - top of the ladder
  r('b', 'Fall through a fragile roof', 4, 4),          // 16
  r('c', 'Fire at the studio', 3, 5),                   // 15
  r('d', 'Driving for work', 3, 4),                     // 12
  r('e', 'Lone working', 3, 3),                         // 9
  r('f', 'Manual handling', 2, 3),                      // 6
  r('g', 'Display screens', 2, 2),                      // 4
  r('h', 'Slips and trips', 1, 3),                      // 3
] }, 'cockpit');
await wait(page, 400);

const t = await page.evaluate(async () => {
  delete S.actionSheets;
  // Simon ticks three on the ladder - not the three highest - and one of them is also on the risk action sheet
  ['d', 'f', 'h'].forEach(id => toggleRiskTop5(id));
  S.riskProfile.find(x => x.id === 'h').sheet = new Date().toISOString().slice(0, 7);
  asNewSheet('risk');                                  // the risk action sheet takes h's action first
  const onRisk = _asList('risk').slice(-1)[0].items.map(i => i.ref.a);
  asNewSheet();                                        // then the Top 5 sheet
  const s = _asList('top5').slice(-1)[0];
  openActionSheets('top5'); await new Promise(x => setTimeout(x, 150));
  const tags = [...document.querySelectorAll('#asOv .as-item')].map(el => ({ t: el.querySelector('.as-desc').textContent }));
  closeActionSheets();
  return { onRisk, risks: s.items.map(i => i.ref.a), why: s.items.map(i => i.why), tags };
});
R.ok(t.onRisk.indexOf('h') >= 0, 'the setup: the ticked slips-and-trips action is already on the risk action sheet');
R.ok(['d', 'f', 'h'].every(id => t.risks.indexOf(id) >= 0), 'every ticked risk is on the Top 5 sheet - including the one also on the risk action sheet (' + t.risks.join(',') + ')');
R.ok(t.risks.slice(0, 3).join(',') === 'd,f,h', 'the ticks lead, in the ladder\'s order: driving 12, manual handling 6, slips 3 (' + t.risks.join(',') + ')');
R.ok(t.risks.length === 5 && t.risks.slice(3).join(',') === 'a,b', 'two short, it is topped up with the next highest on the ladder - asbestos 20, then the fragile roof 16 (' + t.risks.join(',') + ')');
R.ok(t.why.join(',') === 'tick,tick,tick,ladder,ladder', 'each line knows why it is there (' + t.why.join(',') + ')');
R.ok(t.tags.slice(0, 3).every(x => /Ticked Top 5/.test(x.t)) && t.tags.slice(3).every(x => /Next highest on the ladder/.test(x.t)), 'and the draft says so on each line');

// ── the ticks come after a sheet was already made (Simon: "no, it's still not working - my ticks are missing") ──
{
  const u = await page.evaluate(async () => {
    delete S.actionSheets;
    S.riskProfile.forEach(r => { r.sheet = ''; (r.actions || []).forEach(a => { a.top5 = ''; }); });
    asNewSheet();                                       // sheet 1, before any tick: the top of the ladder
    const s1 = _asList('top5').slice(-1)[0]; s1.issuedAt = s1.createdAt.slice(0, 10);    // downloaded - with the client
    const first = s1.items.map(i => i.ref.a);
    ['f', 'g', 'h'].forEach(id => toggleRiskTop5(id));  // then Simon ticks his Top 5 on the ladder
    openActionSheets('top5'); await new Promise(x => setTimeout(x, 150));
    const warn = ((document.querySelector('#asOv .as-ticks') || {}).textContent) || '';
    const btn = !!document.querySelector('#asOv .as-ticks button');
    asRebuild(s1.id);                                   // the earlier sheet, rebuilt from the ticks
    const rebuilt = s1.items.map(i => i.ref.a), issued = s1.issuedAt;
    s1.issuedAt = s1.createdAt.slice(0, 10);            // sent again
    asNewSheet();                                       // Next five
    const s2 = _asList('top5').slice(-1)[0], second = s2.items.map(i => i.ref.a);
    closeActionSheets();
    return { first, warn, btn, second, rebuilt, issued };
  });
  R.ok(u.first.join(',') === 'a,b,c,d,e', 'a sheet made before any tick is the top of the ladder (' + u.first.join(',') + ')');
  R.ok(/Ticked Top 5 on the risk ladder but not on this sheet/.test(u.warn) && /Manual handling/.test(u.warn) && /Display screens/.test(u.warn) && /Slips and trips/.test(u.warn) && u.btn,
    'once risks are ticked, that sheet names the ticks it does not carry and offers to rebuild');
  R.ok(u.rebuilt.slice(0, 3).join(',') === 'f,g,h' && u.rebuilt.length === 5 && u.issued === '', 'Rebuild re-takes the earlier sheet from the ticks, topped up from the ladder, and makes it a draft to send again (' + u.rebuilt.join(',') + ')');
  R.ok(!['f', 'g', 'h'].some(id => u.second.indexOf(id) >= 0) && u.second.length > 0, 'the next sheet then moves on down the ladder - an action is never on two Top 5 sheets at once (' + u.second.join(',') + ')');
}

await R.done(browser, errors);
