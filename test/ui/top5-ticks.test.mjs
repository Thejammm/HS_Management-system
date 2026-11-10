// ══════════════════════════════════════════════════════════════
//  A ticked risk is on the Top 5, whatever its rank (Simon, 10 November 2026:
//  "if i tick it it should be in the top 5 ... even if its not the top five
//  risks", and "add the top five radio button to the risk profile screen").
//  In the user's order: tick on the register -> open a risk, tick at its top
//  -> the meeting opens with every tick on, the lowest unticked off -> a fifth
//  tick -> a sixth refused -> take one off in the meeting -> reopen -> reload
//  -> the action sheets screen -> one store with the ladder -> read only ->
//  first use with no data.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, openRegister, reporter } from './harness.mjs';

const R = reporter('Top 5 ticks - a ticked risk is on the Top 5, whatever its rank');
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const act = id => ({ id: id + 'a', desc: 'Action ' + id, owner: 'Ann Reed', due: day(20), status: 'Not started', priority: 'High' });
const risk = (id, activity, l, s, ops) => Object.assign({ id, activity, hazard: activity, likelihood: String(l), severity: String(s), targetL: '1', targetS: '1', controls: '', actions: [act(id)] }, ops ? { mode: 'ops' } : {});
// two operational risks rank highest; the five the consultant wants sit lower
const RISKS = () => [
  risk('r1', 'Loss of the main customer contract', 5, 5, true),
  risk('r2', 'Keeping pace with legal duties', 4, 5, true),
  risk('r3', 'Fire at the yard', 4, 4),
  risk('r4', 'Work at height on roofs', 3, 5),
  risk('r5', 'Excavations near services', 3, 4),
  risk('r6', 'Driving for work', 3, 3),
  risk('r7', 'Manual handling of kit', 2, 4),
  risk('r8', 'Slips on the stairs', 2, 3),
];
const ids = () => page.evaluate(() => _t5W().items.map(i => _execRiskOf({ ref: i.ref }).id).join());
const ticked = () => page.evaluate(() => S.riskProfile.filter(r => _riskTop5Picked(r)).map(r => r.id).join());
const toasts = () => page.evaluate(() => { const t = window.__toasts.slice(); window.__toasts.length = 0; return t; });
const watchToasts = () => page.evaluate(() => { window.__toasts = []; if (!window.__keepToast) window.__keepToast = showToast; window.showToast = (m, ...a) => { window.__toasts.push(String(m)); return window.__keepToast(m, ...a); }; });
const box = id => 'tr.rpt-row[onclick*="\'' + id + '\'"] td.rpt-t5 input';

await seed(page, { riskProfile: RISKS(), company: { tradingName: 'Testing Client Ltd', slt: [{ name: 'Jo Fine', role: 'MD', email: 'jo@example.test' }], personnel: [] } }, 'risk');
await page.evaluate(d => {
  // the last sheet went out a month ago with the ladder's five on it (the two operational risks among them)
  delete S.actionSheets; const st = _asState();
  st.list.push({ id: 'as_last', kind: 'top5', no: 1, formV: 3, colsV: 2, createdAt: d + 'T10:00:00.000Z', issuedAt: d, meetingDate: d, firstIssue: '', returnedAt: '', returnedBy: '', file: '',
    items: ['r1', 'r2', 'r3', 'r4', 'r5'].map(id => { const ref = { t: 'risk', a: id, b: id + 'a' }; return { key: _asKey(ref), ref, desc: 'Action ' + id, risk: id, riskRef: '', band: 'High', owner: 'Ann Reed', due: '', rec: '', carriedFrom: 0, why: 'ladder', resp: { outcome: '', what: '', date: '', by: '' }, decision: '', decidedAt: '', dnote: '', acceptedBy: '' }; }), stickOpen: [] });
  saveData();
}, day(-30));
await watchToasts();
const REF = await page.evaluate(() => Object.fromEntries((_riskRefsEnsure(), S.riskProfile).map(r => [r.id, _riskRefOf(r)])));

// ── the register: a Top 5 column, and a tick there does not open the risk ──
await openRegister(page);
{
  const t = await page.evaluate(() => { const th = [...document.querySelectorAll('table.rpt thead th')]; const rows = [...document.querySelectorAll('table.rpt tbody tr')];
    const span = tr => [...tr.children].reduce((n, td) => n + (+td.getAttribute('colspan') || 1), 0);
    return { heads: th.length, last: th[th.length - 1].innerText.trim(), tip: th[th.length - 1].title, spans: [...new Set(rows.map(span))].join(), boxes: document.querySelectorAll('table.rpt td.rpt-t5 input[type=checkbox]').length }; });
  R.ok(t.heads === 11 && /^top 5$/i.test(t.last), 'the register has a Top 5 column at the end: ' + t.last);
  R.ok(/whatever its rank/.test(t.tip) && /Five at most/.test(t.tip), 'its heading says what the tick does: ' + t.tip);
  R.ok(t.spans === '11', 'every row, band and theme heading spans the 11 columns: ' + t.spans);
  R.ok(t.boxes === 8, 'one tick box a risk');
}
for (const id of ['r6', 'r7', 'r8']) { await page.click(box(id)); await wait(page, 250); }
{
  const t = await page.evaluate(() => ({ open: _riskModalOpen, on: [...document.querySelectorAll('table.rpt td.rpt-t5 input:checked')].length }));
  R.ok(await ticked() === 'r6,r7,r8', 'ticking three lower risks on the register marks them for the Top 5: ' + await ticked());
  R.ok(!t.open && t.on === 3, 'the tick does not open the risk, and the boxes stay ticked after the screen redraws');
  const tt = await toasts();
  R.ok(tt.some(x => x.includes(REF.r6) && /is in the Top 5/.test(x)), 'each tick says so: ' + tt[0]);
}
// ── open a risk, edit it, tick it at the top ──
await page.click('tr.rpt-row[onclick*="\'r5\'"]'); await wait(page, 350);
{
  const t = await page.evaluate(() => { const l = document.querySelector('#riskModalOverlay .rp-t5'); return { open: _riskModalOpen, sel: _riskSel, has: !!l, word: l ? l.innerText.trim() : '', on: l ? l.querySelector('input').checked : null }; });
  R.ok(t.open && t.sel === 'r5' && t.has && /top 5/i.test(t.word) && t.on === false, 'an open risk has the same Top 5 tick at its top, unticked');
  await page.evaluate(() => updateRiskField('r5', 'harm', 'Strike on a buried cable'));
  await page.click('#riskModalOverlay .rp-t5 input'); await wait(page, 300);
  const a = await page.evaluate(() => ({ open: _riskModalOpen, on: document.querySelector('#riskModalOverlay .rp-t5 input').checked, harm: S.riskProfile.find(r => r.id === 'r5').harm }));
  R.ok(a.open && a.on && a.harm === 'Strike on a buried cable', 'ticked after editing: the risk stays open, the box stays ticked, the edit is kept');
  R.ok(await ticked() === 'r5,r6,r7,r8', 'four ticked now: ' + await ticked());
  await page.evaluate(() => _riskCloseModal()); await toasts();
}
// ── the meeting: every tick on, whatever its rank; the lowest unticked off to make room ──
{
  const t = await page.evaluate(() => { openLiveTop5(); const w = _t5W(); const i6 = w.items.findIndex(i => i.ref.a === 'r6'); return { why: _t5WhyOf(w.items[i6]), ladder: !!document.querySelector('.t5-strip-ladder'), ticksOff: [...document.querySelectorAll('.t5-strip')].some(s => /Send takes that tick off/.test(s.innerText)) }; });
  const on = await ids(), tt = await toasts();
  R.ok(on === 'r1,r5,r6,r7,r8', 'the meeting opens with every ticked risk on it, in the ladder\'s order: ' + on);
  R.ok(tt.some(x => x.includes('now on the sheet: ' + [REF.r6, REF.r7, REF.r8].join(', ') + '. Taken off to make room: ' + [REF.r2, REF.r3, REF.r4].join(', ') + ' (their actions stay on the plan)')), 'it says which went on and which came off, each in the ladder\'s order, and that their actions stay on the plan: ' + tt.join(' | '));
  R.ok(t.why === 'Ticked for the Top 5', 'each ticked page says why it is there: ' + t.why);
  R.ok(!t.ladder, 'no Swap is offered against a ticked risk');
  R.ok(!t.ticksOff, 'and no warning that Send would take a tick off');
  await page.evaluate(() => closeLiveTop5());
}
// ── a fifth tick: the operational risks are gone ──
await page.evaluate(() => switchTab('risk')); await openRegister(page);
await page.click(box('r4')); await wait(page, 300); await toasts();
{
  await page.evaluate(() => openLiveTop5());
  const on = await ids(), tt = await toasts();
  R.ok(on === 'r4,r5,r6,r7,r8', 'tick five and the sheet is exactly those five, the operational risks off: ' + on);
  R.ok(tt.some(x => x.includes('now on the sheet: ' + REF.r4 + '. Taken off to make room: ' + REF.r1 + ' (its actions stay on the plan)')), 'it says ' + REF.r4 + ' went on and ' + REF.r1 + ' came off: ' + tt.join(' | '));
  const t = await page.evaluate(() => ({ ladder: !!document.querySelector('.t5-strip-ladder'), five: _top5Five().map(f => f.z.id).join() }));
  R.ok(!t.ladder, 'with all five ticked there is nothing to swap');
  R.ok(t.five === 'r4,r5,r6,r7,r8', 'the cockpit\'s five read the same ticks: ' + t.five);
  await page.evaluate(() => closeLiveTop5());
}
// ── a sixth is refused, and the box does not lie ──
await page.evaluate(() => switchTab('risk')); await openRegister(page);
await page.click(box('r3')); await wait(page, 300);
{
  const tt = await toasts(), on = await page.evaluate(() => document.querySelector('tr.rpt-row[onclick*="\'r3\'"] td.rpt-t5 input').checked);
  R.ok(tt.some(x => /Five are already marked/.test(x)) && !on && await ticked() === 'r4,r5,r6,r7,r8', 'a sixth tick is refused, and its box shows unticked');
}
// ── take a ticked risk off in the meeting: its tick goes too, so it does not come back ──
{
  const before = await page.evaluate(() => JSON.stringify(S.riskProfile.find(r => r.id === 'r8').actions.map(a => [a.desc, a.owner, a.due, a.status])));
  await page.evaluate(() => { openLiveTop5(); const w = _t5W(); t5Go(w.items.findIndex(i => i.ref.a === 'r8')); }); await toasts();
  await page.click('.t5-off'); await wait(page, 250);
  const tt = await toasts();
  R.ok(await ids() === 'r4,r5,r6,r7' && await ticked() === 'r4,r5,r6,r7', 'Take this risk off the sheet takes it off, and its tick with it');
  R.ok(tt.some(x => x.includes(REF.r8) && /Top 5 tick with it/.test(x) && /stay on the plan/.test(x)), 'and says so: ' + tt.join(' | '));
  const after = await page.evaluate(() => JSON.stringify(S.riskProfile.find(r => r.id === 'r8').actions.map(a => [a.desc, a.owner, a.due, a.status])));
  R.ok(after === before, 'its action is otherwise exactly as it was');
  await page.evaluate(() => closeLiveTop5());
  await page.evaluate(() => openLiveTop5());
  const t = await page.evaluate(() => ({ room: !!document.querySelector('.t5-strip-add') }));
  R.ok(await ids() === 'r4,r5,r6,r7' && t.room, 'reopened, it has not come back, and the room left is offered: ' + await ids());
  await page.evaluate(() => closeLiveTop5());
}
// ── reload: the ticks and the sheet as left ──
await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"'); await wait(page, 300);
await watchToasts();
{
  await page.evaluate(() => openLiveTop5());
  R.ok(await ticked() === 'r4,r5,r6,r7' && await ids() === 'r4,r5,r6,r7', 'after a reload the ticks and the sheet are as you left them');
  await page.evaluate(() => closeLiveTop5());
}
// ── the action sheets screen: First five is the ticks, and a carried line never pushes a tick off ──
{
  await page.evaluate(() => { switchTab('risk'); }); await openRegister(page);
  await page.click(box('r8')); await wait(page, 250); await toasts();
  const t = await page.evaluate(d => {
    delete S.actionSheets; const st = _asState();
    const ref = { t: 'risk', a: 'r1', b: 'r1a' };
    st.list.push({ id: 'as_back', kind: 'top5', no: 1, formV: 3, colsV: 2, createdAt: d + 'T10:00:00.000Z', issuedAt: d, meetingDate: '', firstIssue: '', returnedAt: d, returnedBy: 'Jo Fine', file: '',
      items: [{ key: _asKey(ref), ref, desc: 'Action r1', risk: 'r1', riskRef: '', band: 'Critical', owner: 'Ann Reed', due: '', rec: 'Review the contract terms', carriedFrom: 0, why: 'ladder', resp: { outcome: 'carry', what: '', date: '', by: '' }, decision: 'carry', decidedAt: d, dnote: 'Carried', acceptedBy: '' }], stickOpen: [] });
    openActionSheets('top5');
    const b = [...document.querySelectorAll('#asOv button')].find(x => /asNewSheet/.test(x.getAttribute('onclick') || '') && x.offsetParent);
    const tip = b ? b.title : ''; if (b) b.click();
    const s = _asList('top5').find(x => x.id !== 'as_back');
    const out = { tip, on: s ? s.items.map(i => i.ref.a).sort().join() : '' };
    closeActionSheets(); return out;
  }, day(-40));
  R.ok(t.on === 'r4,r5,r6,r7,r8', 'First five on the action sheets screen is the five ticked, ahead of a line carried back from the client: ' + t.on);
  R.ok(/ticked for the Top 5 first, whatever its rank/.test(t.tip), 'its button says so: ' + t.tip);
}
// ── one store: a tick on the ladder shows on the register, and the other way ──
{
  await page.evaluate(() => { switchTab('ladder'); });
  await wait(page, 300);
  await page.evaluate(() => toggleRiskTop5('r8')); await wait(page, 200); await toasts();
  await page.evaluate(() => switchTab('risk')); await openRegister(page);
  const reg = await page.evaluate(() => document.querySelector('tr.rpt-row[onclick*="\'r8\'"] td.rpt-t5 input').checked);
  await page.click(box('r3')); await wait(page, 250); await toasts();
  const lad = await page.evaluate(() => { switchTab('ladder'); const i = [...document.querySelectorAll('#ladderContainer .ckl-t5 input')].find(x => /toggleRiskTop5\('r3'\)/.test(x.getAttribute('onchange') || '')); return i ? i.checked : null; });
  R.ok(reg === false && lad === true, 'the ladder and the register show and change the one tick');
}
// ── read only: the ticks show, nothing to press ──
{
  const t = await page.evaluate(() => { const keep = window._roLocked; window._roLocked = () => true; switchTab('risk'); _macroExpandAll(true);
    const cells = [...document.querySelectorAll('table.rpt td.rpt-t5')]; const o = { boxes: document.querySelectorAll('table.rpt td.rpt-t5 input').length, marks: cells.filter(c => c.innerText.includes('✓')).length };
    _riskOpenModal('r3'); const top = document.querySelector('#riskModalOverlay .rp-t5-ro'); o.top = top ? top.innerText : ''; o.topBox = !!document.querySelector('#riskModalOverlay .rp-t5 input');
    _riskCloseModal(); window._roLocked = keep; renderRiskProfile(); return o; });
  R.ok(t.boxes === 0 && t.marks === 5, 'read only, the register shows a tick mark on the five and no boxes: ' + t.marks);
  R.ok(/Top 5/.test(t.top) && !t.topBox, 'and an open risk says Top 5 with no box to press');
}
// ── a search that matches nothing: the one line still spans the table ──
{
  const t = await page.evaluate(() => { switchTab('risk'); setRiskSearch('nothing matches this'); const td = document.querySelector('table.rpt tbody td'); const o = { heads: document.querySelectorAll('table.rpt thead th').length, span: td ? +td.getAttribute('colspan') : 0, said: td ? td.innerText : '' }; setRiskSearch(''); return o; });
  R.ok(t.heads === 11 && t.span === 11 && /No risks match/.test(t.said), 'a search that finds nothing still spans all 11 columns: ' + t.span);
}
// ── first use: no risks, nothing ticked, nothing breaks ──
{
  await seed(page, { riskProfile: [], company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] } }, 'risk');
  await openRegister(page); await toasts();
  const t = await page.evaluate(() => { delete S.actionSheets; const said = document.getElementById('riskContainer').innerText; openLiveTop5(); const o = { said: /No risks recorded yet/.test(said), items: _t5W().items.length }; closeLiveTop5(); return o; });
  const tt = await toasts();
  R.ok(t.said && t.items === 0 && !tt.some(x => /Ticked for the Top 5/.test(x)), 'with no risks the profile says so, and the meeting opens empty with nothing said about ticks: ' + JSON.stringify(t));
}

await R.done(browser, errors);
