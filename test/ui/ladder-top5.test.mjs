// ══════════════════════════════════════════════════════════════
//  Choosing the month's five from the risk ladder. Simon, 2026-10-01, after
//  the SLT meeting: "the only screen that shows in order what is wrong and
//  how urgent it is is the risk ladder ... but when I was asked to put them
//  into a top 5 it meant I had to search the whole app for the ref of that
//  risk". The ladder now shows each risk's ref and a Top 5 tick; the tick
//  marks the risk's most pressing open action, so the execution plan, the
//  cockpit's five, the Top 5 action sheet and the board report all read the
//  same marks. (The Top 5 Risks report was removed on 2026-10-07.)
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter, RISKS } from './harness.mjs';

const R = reporter('Risk ladder - choose the Top 5 where the risks are');
const { browser, page, errors } = await openApp();

const month = new Date().toISOString().slice(0, 7);
const risks = RISKS();
risks[1].actions = [
  { id: 'v2a1', desc: 'Buy the edge protection kit', owner: 'Site lead', due: '2099-11-01', status: 'Not started' },
  { id: 'v2a2', desc: 'Survey every skylight before work starts', owner: 'Surveyor', due: '2020-01-10', status: 'In progress' },   // overdue - the most pressing
  { id: 'v2a3', desc: 'Already done', owner: 'Site lead', due: '2020-01-01', status: 'Complete' } ];
// v3, the road collision, has nothing open - it cannot be a priority yet
await seed(page, { company: { legalName: 'Fineline Group Ltd' }, riskProfile: risks, actionPlan: [] }, 'cockpit');
await wait(page, 700);

const ladder = () => page.evaluate(() => {
  const panel = [...document.querySelectorAll('.ckx-panel')].find(p => /Risk ladder/.test(p.querySelector('h4') ? p.querySelector('h4').textContent : ''));
  // the ref Compass gave each risk (theme letter + number), read from the record
  const want = n => { const r = S.riskProfile.find(x => x.activity && n.indexOf(x.activity) >= 0); return r ? _riskRefOf(r) : ''; };
  const lines = [...panel.querySelectorAll('.ckl-line')].map(l => ({ want: want(l.querySelector('.ckl-name').textContent), ref: (l.querySelector('.risk-ref') || {}).textContent || '', name: l.querySelector('.ckl-name').textContent,
    tick: !!l.querySelector('.ckl-t5 input'), on: !!(l.querySelector('.ckl-t5 input') || {}).checked }));
  return { lines, head: (panel.querySelector('.ckl-head') || {}).textContent || '', picks: [...panel.querySelectorAll('.ckl-pick')].map(p => p.textContent),
    five: ([...document.querySelectorAll('.ckx-panel')].find(p => /Putting us at risk today/.test(p.textContent)) || { innerText: '' }).innerText };
});

// ── each line has its ref and a tick, in a column of their own ──
{
  const t = await ladder();
  R.ok(t.lines.length >= 5 && t.lines.every(l => l.tick), 'every rated risk on the ladder has a Top 5 tick (' + t.lines.length + ' lines)');
  R.ok(t.lines.every(l => l.ref && l.ref === l.want), 'each line carries the risk\'s ref, the same chip as on the pathway (' + t.lines.map(l => l.ref).join(', ') + ')');
  R.ok(/Top 5 · 0 of 5 for /.test(t.head), 'the column head counts the five for the month: ' + t.head);
}

// ── tick: the risk's most pressing open action is marked ──
{
  const before = (await ladder()).lines.map(l => l.name).join('|');
  const t = await page.evaluate(() => {
    const line = [...document.querySelectorAll('.ckl-line')].find(l => /fall from height/.test(l.textContent));
    const box = line.querySelector('.ckl-t5 input'); box.checked = true; box.dispatchEvent(new Event('change'));
    const r = S.riskProfile.find(x => x.id === 'v2');
    return { marks: r.actions.map(a => a.id + ':' + (a.top5 || '')).join(','), plan: _top5List().map(a => a.desc).join('|') };
  });
  const after = await ladder();
  R.ok(t.marks === 'v2a1:,v2a2:' + month + ',v2a3:', 'ticking a risk marks its most pressing open action - the overdue one, not the later or the done one (' + t.marks + ')');
  R.ok(t.plan === 'Survey every skylight before work starts', 'and it is in the execution plan\'s Top 5');
  R.ok(after.lines.find(l => /fall from height/.test(l.name)).on && /Top 5 · 1 of 5/.test(after.head), 'the tick stays and the head counts it: ' + after.head);
  R.ok(after.picks.some(p => /Top 5 action\s*Survey every skylight before work starts\s*Surveyor · by /.test(p)), 'the line says which action is the priority');
  R.ok(after.lines.map(l => l.name).join('|') === before, 'nothing on the ladder moves when a box is ticked');
  R.ok(/This month.s five priorities[\s\S]*fall from height/.test(after.five), 'the cockpit\'s five priorities shows it straight away');
}

// ── a risk with nothing open cannot be a priority yet, and says why ──
{
  const t = await page.evaluate(() => {
    const line = [...document.querySelectorAll('.ckl-line')].find(l => /road collision/.test(l.textContent));
    const box = line.querySelector('.ckl-t5 input'); box.checked = true; box.dispatchEvent(new Event('change'));
    const again = [...document.querySelectorAll('.ckl-line')].find(l => /road collision/.test(l.textContent)).querySelector('.ckl-t5 input');
    return { toast: document.getElementById('toast').textContent, unticked: !again.checked, n: _top5List().length };
  });
  R.ok(/Nothing open on \S+ A serious road collision/.test(t.toast) && t.unticked && t.n === 1, 'a risk with no open action is refused with the reason, and the box unticks itself');
}

// ── five is the limit, the same limit as the plan ──
{
  const t = await page.evaluate(() => {
    S.actionPlan = [1, 2, 3, 4].map(i => ({ id: 'f' + i, desc: 'Free action ' + i, owner: 'Office', due: '2099-01-0' + i, status: 'Not started', top5: new Date().toISOString().slice(0, 7) }));
    renderCockpit();
    const line = [...document.querySelectorAll('.ckl-line')].find(l => /Fire breaking out/.test(l.textContent));
    const box = line.querySelector('.ckl-t5 input'); box.checked = true; box.dispatchEvent(new Event('change'));
    const again = [...document.querySelectorAll('.ckl-line')].find(l => /Fire breaking out/.test(l.textContent)).querySelector('.ckl-t5 input');
    return { toast: document.getElementById('toast').textContent, unticked: !again.checked, n: _top5List().length,
      head: document.querySelector('.ckl-head').textContent };
  });
  R.ok(/Five are already marked/.test(t.toast) && t.unticked && t.n === 5 && /5 of 5/.test(t.head), 'with five already marked, a sixth is refused and unticks itself');
}

// ── untick takes it off ──
{
  const t = await page.evaluate(() => {
    S.actionPlan = [];
    renderCockpit();
    const line = [...document.querySelectorAll('.ckl-line')].find(l => /fall from height/.test(l.textContent));
    const box = line.querySelector('.ckl-t5 input'); box.checked = false; box.dispatchEvent(new Event('change'));
    return { marks: S.riskProfile.find(x => x.id === 'v2').actions.filter(a => a.top5).length, n: _top5List().length,
      on: [...document.querySelectorAll('.ckl-line')].find(l => /fall from height/.test(l.textContent)).querySelector('.ckl-t5 input').checked };
  });
  R.ok(t.marks === 0 && t.n === 0 && !t.on, 'unticking a risk clears the month\'s mark from its actions');
}

// ── a client login sees the five, but cannot change them ──
{
  const t = await page.evaluate(() => {
    S.riskProfile.find(x => x.id === 'v2').actions[1].top5 = new Date().toISOString().slice(0, 7);
    const keep = window._roLocked; window._roLocked = () => true; renderCockpit();
    const out = { boxes: document.querySelectorAll('.ckl-t5 input').length, star: [...document.querySelectorAll('.ckl-line')].find(l => /fall from height/.test(l.textContent)).querySelector('.ckl-t5').textContent };
    window._roLocked = keep; renderCockpit();
    return out;
  });
  R.ok(t.boxes === 0 && t.star === '★', 'read-only, the column shows a star on the five and no boxes');
}

// ── no Top 5 Risks report any more ──
// Simon, 2026-10-07: "Remove the Top 5 Risks report - it now serves no
// purpose." The month's five go to the SLT on the Top 5 action sheet; the
// ticks here still choose them, and still lead the board report.
{
  const t = await page.evaluate(() => {
    renderCockpit();
    const panel = [...document.querySelectorAll('.ckx-panel')].find(p => /Risk ladder/.test(p.querySelector('h4') ? p.querySelector('h4').textContent : ''));
    const said = el => el ? (el.textContent + ' ' + [...el.querySelectorAll('[title]')].map(x => x.title).join(' ')) : '';
    const out = { tools: [...panel.querySelectorAll('.ckl-tools button')].map(b => b.textContent.trim()), cockpit: said(document.getElementById('tab-cockpit')) };
    switchTab('reports');
    const cards = [...document.querySelectorAll('#tab-reports .rep-card')];
    out.titles = cards.map(c => ((c.querySelector('h3') || {}).textContent || '').trim());
    out.cards = cards.map(said).join(' ');
    openActionSheets('top5'); out.top5 = said(document.getElementById('asOv'));
    asKind('risk'); out.risk = said(document.getElementById('asOv'));
    closeActionSheets(); switchTab('cockpit');
    try { out.fn = new Function('return typeof openTopFivePrint')() === 'function'; } catch (e) { out.fn = false; }
    out.picks = _top5List().length;
    return out;
  });
  const REPORT = /Top 5 (risks )?report|Top 5 Risks/i;
  R.ok(JSON.stringify(t.tools) === JSON.stringify(['Top 5 action sheet', 'Legal duties sheet', 'Risk action sheet', '✎ Minutes']), 'the ladder\'s tools have no Top 5 report button: ' + t.tools.join(' | '));
  R.ok(!REPORT.test(t.cockpit), 'nothing on the cockpit points at a Top 5 report');
  R.ok(!t.titles.includes('Top 5 Risks') && t.titles.includes('Top 5 Action Sheet') && !REPORT.test(t.cards), 'the Reports tab has no Top 5 Risks card, and no card mentions one');
  R.ok(!REPORT.test(t.top5) && !REPORT.test(t.risk), 'the action sheet screens no longer point at it');
  R.ok(!t.fn, 'and the app has no Top 5 report to open');
  R.ok(t.picks === 1, 'the month\'s ticks are still there - they choose the Top 5 action sheet\'s five');
}

await R.done(browser, errors);
