// ══════════════════════════════════════════════════════════════
//  Three gaps from walking the journey (Simon, 6 November 2026). In the user's
//  order: the meeting opens with no leadership team -> one press brings them
//  across -> the sheet is full, and the ladder's top five are named with a Swap
//  -> the typed notes wait on the record's screen until someone confirms them
//  -> reload -> read only -> first use with no data.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Three gaps from the walk - team, ladder Swap, notes confirmed');
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const act = (id, n) => ({ id, desc: 'Action ' + id, owner: 'Ann Reed', due: day(n), status: 'Not started', priority: 'High' });
const risk = (id, activity, l, s, controls, extra) => Object.assign({ id, activity, hazard: activity, likelihood: String(l), severity: String(s), targetL: '1', targetS: '1', controls: controls || '', actions: [act(id + 'a', 20)] }, extra || {});
const RISKS = () => [
  risk('r1', 'Asbestos on intrusive surveys', 5, 5, 'Asbestos-awareness training for one in-house surveyor.'),
  risk('r2', 'Falls through fragile roofs', 4, 5, 'None'),
  risk('r3', 'Fire at the studio', 4, 4, 'nothing'),
  risk('r4', 'Driving for work', 3, 5, 'Nothing is currently in place'),
  risk('r5', 'Lone working on site', 3, 4, 'No formal process or procedure exists to date'),
  risk('r6', 'Manual handling of kit', 3, 3, 'Training matrix although not managed'),
  risk('r7', 'Display screen work', 2, 4, 'DSE self-assessments done each year.'),
  risk('r8', 'Slips on the stairs', 2, 3, ''),
];
const PEOPLE = [{ name: 'Jo Fine', role: 'Managing Director', contact: 'jo@example.test' }, { name: 'Sam Line', role: 'Operations Director', contact: 'sam@example.test' }, { name: 'Pat Reed', role: 'Fire Marshal', contact: '' }];
const sheetOf = ids => ({ id: 'as_last', kind: 'top5', no: 1, formV: 3, createdAt: day(-30) + 'T10:00:00.000Z', issuedAt: day(-30), meetingDate: day(-30), firstIssue: '', returnedAt: '', returnedBy: '', file: '',
  items: ids.map(id => ({ key: 'risk:' + id + ':' + id + 'a', ref: { t: 'risk', a: id, b: id + 'a' }, desc: 'Action ' + id + 'a', risk: id, riskRef: '', band: 'High', owner: 'Ann Reed', due: '', rec: '', carriedFrom: 0, why: 'tick', resp: { outcome: '', what: '', date: '', by: '' }, decision: '', decidedAt: '', dnote: '', acceptedBy: '' })) });
const go = async (extra) => { await seed(page, Object.assign({ riskProfile: RISKS(), actionPlan: [], company: { tradingName: 'Testing Client Ltd', slt: [], personnel: PEOPLE.map(p => Object.assign({}, p)) } }, extra || {}), 'cockpit'); await wait(page, 300); };

// ── gap 5: the leadership team ──
await go();
{
  const t = await page.evaluate(() => { delete S.actionSheets; openLiveTop5(); const st = document.querySelector('.t5-strip-team'); return { said: st ? st.innerText.replace(/\s+/g, ' ') : '', btn: st ? (st.querySelector('button') || {}).innerText : '', tip: st && st.querySelector('button') ? st.querySelector('button').title : '' }; });
  R.ok(/No leadership team recorded yet/.test(t.said) && /nobody on it/.test(t.said), 'the meeting says so as it opens, not after Send: ' + t.said.slice(0, 80));
  R.ok(t.btn === 'Add from Key personnel (2)' && /Jo Fine, Sam Line/.test(t.tip), 'and offers the two leaders already in Key personnel, not the fire marshal: ' + t.tip);
  const a = await page.evaluate(() => { document.querySelector('.t5-strip-team button').click(); const m = _t5Mail({ meetingDate: _asToday(), items: [], kind: 'top5', no: 2 }); return { team: S.company.slt.map(p => p.name + ':' + p.email).join(), strip: !!document.querySelector('.t5-strip-team'), to: m.to.join(), open: !!document.getElementById('t5Ov') }; });
  R.ok(a.team === 'Jo Fine:jo@example.test,Sam Line:sam@example.test' && a.to === 'jo@example.test,sam@example.test', 'one press brings them across with their emails, and the Top 5 email now reaches them');
  R.ok(!a.strip && a.open, 'the warning goes, and the meeting stays open');
  await page.evaluate(() => closeLiveTop5());
  const n = await page.evaluate(() => { S.company.slt = []; S.company.personnel = [{ name: 'Pat Reed', role: 'Fire Marshal', contact: '' }]; openLiveTop5(); const st = document.querySelector('.t5-strip-team'); const out = { said: st ? st.innerText : '', btn: st ? st.querySelectorAll('button').length : -1 }; closeLiveTop5(); return out; });
  R.ok(/Company setup/.test(n.said) && n.btn === 0, 'with no leader in Key personnel it says where to add them');
}
// ── gap 2: the ladder's top five against a full sheet ──
await go({ company: { tradingName: 'Testing Client Ltd', slt: [{ name: 'Jo Fine', role: 'MD', email: 'jo@example.test' }], personnel: [] } });
{
  await page.evaluate(s => { delete S.actionSheets; const st = _asState(); st.list.push(s); }, sheetOf(['r1', 'r2', 'r6', 'r7', 'r8']));
  const refs = await page.evaluate(() => Object.fromEntries((_riskRefsEnsure(), S.riskProfile).map(r => [r.id, _riskRefOf(r)])));
  const t = await page.evaluate(() => { openLiveTop5(); const st = document.querySelector('.t5-strip-ladder'); return { on: _t5W().items.map(i => i.ref.a).join(), said: st ? st.innerText.replace(/\s+/g, ' ') : '', swaps: st ? [...st.querySelectorAll('button')].map(b => b.innerText.trim()) : [], tip: st ? st.querySelector('button').title : '' }; });
  R.ok(t.on === 'r1,r2,r6,r7,r8', 'the meeting opens on the five carried from the last sheet');
  R.ok(/On the ladder.s top five, not on this sheet \(3\)/.test(t.said) && t.said.includes(refs.r3) && t.said.includes(refs.r4) && t.said.includes(refs.r5), 'a strip names the ladder\'s top five that are not on it: ' + t.said.slice(0, 130));
  R.ok(t.swaps.length === 3 && t.swaps.every(x => x === 'Swap for ' + refs.r8) && /stay on the plan/.test(t.tip), 'each offers to swap for the lowest on the sheet, and says what happens to its actions: ' + t.tip);
  const before = await page.evaluate(() => JSON.stringify(S.riskProfile.find(r => r.id === 'r8').actions));
  const a = await page.evaluate(() => { const w = _t5W(); document.querySelector('.t5-strip-ladder button').click(); const st = document.querySelector('.t5-strip-ladder'); return { on: _t5W().items.map(i => i.ref.a).join(), at: _t5W().items[_t5At].ref.a, why: _t5WhyOf(_t5W().items[_t5At]), said: st ? st.innerText.replace(/\s+/g, ' ') : '', swaps: st ? [...st.querySelectorAll('button')].map(b => b.innerText.trim()) : [], list: S.actionSheets.list.length, kept: JSON.stringify(S.riskProfile.find(r => r.id === 'r8').actions) }; });
  R.ok(a.on === 'r1,r2,r3,r6,r7' && a.at === 'r3', 'Swap takes the lowest off and puts the higher one on, in the ladder\'s order, and goes to it: ' + a.on);
  R.ok(/top five/.test(a.why) && a.list === 1, 'the page says why it is there, and no new sheet exists until Send: ' + a.why);
  R.ok(a.kept === before, 'the actions on the risk taken off are exactly as they were');
  R.ok(a.swaps.length === 2 && a.swaps.every(x => x === 'Swap for ' + refs.r7), 'the next offers swap for the next lowest');
  const b = await page.evaluate(() => { document.querySelector('.t5-strip-ladder button').click(); document.querySelector('.t5-strip-ladder button').click(); return { on: _t5W().items.map(i => i.ref.a).join(), strip: !!document.querySelector('.t5-strip-ladder') }; });
  R.ok(b.on === 'r1,r2,r3,r4,r5' && !b.strip, 'when the sheet is the ladder\'s top five the strip goes: ' + b.on);
  await page.evaluate(() => { closeLiveTop5(); delete S.actionSheets.working; });
  const room = await page.evaluate(s => { S.actionSheets.list = [s]; openLiveTop5(); const o = { ladder: !!document.querySelector('.t5-strip-ladder'), sug: !!document.querySelector('.t5-strip-add') }; closeLiveTop5(); delete S.actionSheets.working; return o; }, sheetOf(['r6', 'r7']));
  R.ok(!room.ladder && room.sug, 'with room on the sheet the suggestions offer them, so the strip stays away');
  const ro = await page.evaluate(s => { S.actionSheets.list = [s]; const keep = window._roLocked; window._roLocked = () => true; openLiveTop5(); const o = { ladder: !!document.querySelector('.t5-strip-ladder'), team: !!document.querySelector('.t5-strip-team') }; closeLiveTop5(); window._roLocked = keep; return o; }, sheetOf(['r1', 'r2', 'r6', 'r7', 'r8']));
  R.ok(!ro.ladder && !ro.team, 'a read-only login sees neither strip');
  // the star on the register has gone; a saved star stays in the data, unread
  const star = await page.evaluate(() => { S.riskProfile[0].chosen = true; _riskOpenModal('r1'); const list = document.querySelector('#riskModalOverlay .rp-list, #riskModalOverlay') ; const html = document.getElementById('riskModalOverlay').innerHTML; const has = /Pin to our chosen five|In our five/.test(html); _riskCloseModal(); switchTab('risk'); return { has, fn: typeof window._riskChosenToggle, kept: S.riskProfile[0].chosen === true }; });
  R.ok(!star.has && star.fn === 'undefined' && star.kept, 'the register\'s star has gone, and a star already saved stays in the data');
}
// ── gap 1: the notes on the risks ──
await go();
{
  const t = await page.evaluate(() => { switchTab('works'); const n = document.querySelector('#worksContainer .wk-notes'); return { h: n ? n.querySelector('.wk-h').innerText : '', lines: n ? [...n.querySelectorAll('.wk-note')].map(l => l.innerText.replace(/\s+/g, ' ')) : [], rows: _wkRows().length, empty: !!document.querySelector('#worksContainer .wk-empty'), said: n ? n.innerText : '' }; });
  R.ok(t.empty && t.rows === 0, 'nothing typed is on the record to begin with');
  R.ok(/\(2\)/.test(t.h) && t.lines.length === 2 && /Asbestos-awareness/.test(t.lines[0]) && /DSE self-assessments/.test(t.lines[1]), 'the list holds the two notes that claim something is there: ' + t.h);
  R.ok(!t.lines.join().match(/Nothing is currently|No formal process|although not managed/) && !/\bNone\b/.test(t.lines.join()), '"None", "nothing", "No formal..." and "not managed" are left out');
  R.ok(/not on the record|none of it is on the record/i.test(t.said) && /Only you see this/.test(t.said), 'and it says plainly they are not on the record yet');
  const a = await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'r1'), keep = r.controls; document.querySelector('#worksContainer .wk-note button').click(); const row = r.actions.find(x => x.fromNote); const L = _rsRows(r); return { row: row ? [row.desc, row.status, row.hideFromPlan, row.completedDate || ''].join('|') : '', onRecord: _wkRows().filter(l => l.r && l.r.id === 'r1').map(l => l.text + ':' + l.kind).join(), placed: L.placed.map(x => x.a.desc + ' / ' + x.line).join(), left: document.querySelectorAll('#worksContainer .wk-note').length, box: r.controls === keep, checked: r.typedChecked, log: (r.log || []).map(x => x.text).join(), table: !!document.querySelector('#worksContainer .wk-table') }; });
  R.ok(a.row === 'Asbestos-awareness training for one in-house surveyor.|Complete|true|', 'In place makes it a standing arrangement, with no invented date: ' + a.row);
  R.ok(/^Asbestos-awareness.*:standing$/.test(a.onRecord) && a.table, 'it is on the record: ' + a.onRecord);
  R.ok(/Asbestos-awareness.* \/ In place$/.test(a.placed), 'and under Already in place on the risk\'s overview: ' + a.placed);
  R.ok(a.left === 1 && a.box && a.checked === 'yes' && /Confirmed in place/.test(a.log), 'it leaves the list, the typed words stay on the risk, and the log says who said so by when');
  const b = await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'r7'), n = r.actions.length; [...document.querySelectorAll('#worksContainer .wk-note button')].find(x => x.textContent === 'Not in place').click(); return { notes: !!document.querySelector('#worksContainer .wk-notes'), rows: r.actions.length === n, onRec: _wkRows().filter(l => l.r && l.r.id === 'r7').length, checked: r.typedChecked, box: r.controls }; });
  R.ok(!b.notes && b.rows && b.onRec === 0 && b.checked === 'no' && /DSE/.test(b.box), 'Not in place clears it with nothing on the record, and the list goes when it is empty');
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"'); await wait(page, 300);
  const c = await page.evaluate(() => { switchTab('works'); return { notes: !!document.querySelector('#worksContainer .wk-notes'), on: _wkRows().filter(l => l.r && l.r.id === 'r1').length }; });
  R.ok(!c.notes && c.on === 1, 'after a reload it is all still as you left it');
  // the pathway no longer calls a typed "Nothing" controls in place
  const p = await page.evaluate(() => { const lines = id => { const r = S.riskProfile.find(x => x.id === id), st = _pathwayOf(r).stations.find(s => /control/i.test(s.k + ' ' + s.label)); return JSON.stringify(st ? st.lines : []); };
    const r2 = S.riskProfile.find(x => x.id === 'r2'), keep = r2.controls; const none = lines('r2'); r2.controls = 'Permit to work in use on every roof.'; const note = lines('r2'); r2.typedChecked = 'yes'; const done = lines('r2'); delete r2.typedChecked; r2.controls = keep;
    return { none, note, done }; });
  R.ok(!/None/.test(p.none) && !/controls in place, as recorded/.test(p.none), 'the Risk pathway no longer lists a typed "None" as controls in place');
  R.ok(/Permit to work in use/.test(p.note) && /noted on the risk, not yet confirmed/.test(p.note), 'a typed note shows there as noted, not yet confirmed');
  R.ok(!/Permit to work in use/.test(p.done), 'and once it has been checked it is not listed twice');
  // read only and the client's view: the list is the consultant's
  const v = await page.evaluate(() => { S.riskProfile.forEach(r => { delete r.typedChecked; }); const keep = window._roLocked; window._roLocked = () => true; switchTab('works'); const ro = !!document.querySelector('#worksContainer .wk-notes'); window._roLocked = keep; const was = _viewMode; _viewMode = 'management'; renderWorksNow(); const client = !!document.querySelector('#worksContainer .wk-notes'); _viewMode = was; renderWorksNow(); const back = !!document.querySelector('#worksContainer .wk-notes'); return { ro, client, back }; });
  R.ok(!v.ro && !v.client && v.back, 'only the consultant sees the list: not a read-only login, not the client\'s view');
  // the guide says all this
  const g = await page.evaluate(() => { switchTab('howto'); const t = document.getElementById('howtoContainer').innerText; switchTab('cockpit'); return t; });
  R.ok(/From key personnel/.test(g) && /Swap takes the lowest risk off/.test(g) && /Nothing typed reaches the record/.test(g), 'the guide covers all three');
}
// ── first use: nothing to list, nothing breaks ──
{
  await seed(page, { riskProfile: [], actionPlan: [], company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] } }, 'works');
  await wait(page, 300);
  const t = await page.evaluate(() => { delete S.actionSheets; const notes = !!document.querySelector('#worksContainer .wk-notes'); openLiveTop5(); const o = { notes, ladder: !!document.querySelector('.t5-strip-ladder'), team: (document.querySelector('.t5-strip-team') || {}).innerText || '' }; closeLiveTop5(); return o; });
  R.ok(!t.notes && !t.ladder && /Company setup/.test(t.team), 'with no risks there is no list and no strip, only where to add the team');
}

await R.done(browser, errors);
