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
  R.ok(/From key personnel/.test(g) && /Swap takes the lowest unticked risk off/.test(g) && /Nothing typed reaches the record/.test(g), 'the guide covers all three');
}
// ── gap 4: not yet rated, flagged on the ladder with the boxes inline. Simon: "do not set any likelihood, severity or target scores yourself" ──
{
  const UN = () => [
    { id: 'u1', activity: 'Occupational Health judged Weak', judgeKey: 'oh', hazard: '', actions: [act('u1a', 20)] },
    { id: 'u2', activity: 'Employers Liability Insurance', reqKey: 'x', hazard: '', actions: [Object.assign(act('u2a', 20), { desc: 'Employers Liability Insurance' })] },
    { id: 'u3', activity: 'Late invoices upsetting suppliers', mode: 'ops', hazard: '', actions: [] },
  ];
  await go({ riskProfile: RISKS().slice(0, 3).concat(UN()) });
  const blank = () => page.evaluate(() => S.riskProfile.filter(r => /^u/.test(r.id)).map(r => [r.likelihood || '', r.severity || '', r.targetL || '', r.targetS || ''].join('')).join(''));
  const t = await page.evaluate(() => { switchTab('ladder'); const sec = document.getElementById('ckrSec'), rows = sec ? [...sec.querySelectorAll('.ckr')] : [];
    return { head: sec ? sec.querySelector('.ckl-band-h').innerText.replace(/\s+/g, ' ') : '', top: (document.querySelector('.ckl-head-nr') || {}).innerText || '', n: rows.length, flags: rows.filter(r => /Not yet rated/i.test(r.querySelector('.ckr-flag').innerText)).length, ref: rows.every(r => !!r.querySelector('.risk-ref')), subs: rows.map(r => r.querySelector('.ckr-sub').innerText), boxes: rows.map(r => r.querySelectorAll('select').length).join(), empty: [...sec.querySelectorAll('select')].every(x => x.value === ''), save: [...sec.querySelectorAll('.ckr button.btn')].every(b => b.disabled), labels: rows.map(r => [...r.querySelectorAll('.ckr-f span')].map(x => x.innerText).join('/')), onChart: [...document.querySelectorAll('#tab-ladder .ckl-band .ckl-title')].some(x => /judged Weak/.test(x.textContent)), chartNo: document.querySelectorAll('#tab-ladder .ckl-band .ckl-line').length }; });
  R.ok(/NOT YET RATED 3 risks/.test(t.head) && /Compass suggests none/.test(t.head) && /Not yet rated · 3/i.test(t.top), 'the ladder flags them twice: at its head and in their own section: ' + t.head.slice(0, 70));
  R.ok(t.n === 3 && t.flags === 3 && t.ref, 'each unrated risk has a line with its reference and a Not yet rated flag');
  R.ok(t.boxes === '4,4,4' && t.empty && t.save, 'four boxes on each line, every one empty, Save not available yet');
  R.ok(!t.onChart && t.chartNo === 3, 'they are off the chart, and the chart still holds the three rated risks');
  R.ok(/Raised from Maturity level/.test(t.subs.join()) && /Raised from Legal duties/.test(t.subs.join()) && /Action u1a/.test(t.subs.join()), 'each line says where it came from and shows its action');
  R.ok(t.subs.some(x => x === 'Raised from Legal duties'), 'an action that only repeats the title is left out');
  R.ok(t.labels.some(l => /Probability\/Impact/.test(l)) && t.labels.some(l => /Likelihood\/Severity/.test(l)), 'an operational risk reads Probability and Impact, like the register');
  R.ok(await blank() === '', 'Compass has set no score on any of them: drawing the list wrote nothing');
  const set = (id, k, v) => page.evaluate((id, k, v) => { const e = document.getElementById('ckr-' + k + '-' + id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, id, k, v);
  const q = id => page.evaluate(id => ({ say: (document.getElementById('ckr-say-' + id) || {}).textContent || '', off: (document.getElementById('ckr-save-' + id) || {}).disabled }), id);
  await set('u1', 'l', '3'); const a1 = await q('u1'); R.ok(a1.off && a1.say === '', 'one box chosen: Save still off');
  const dim = await page.evaluate(() => { const off = parseFloat(getComputedStyle(document.getElementById('ckr-save-u1')).opacity); return off; });
  R.ok(dim < 0.6, 'and it looks off');
  R.ok(await blank() === '', 'and nothing is written to the risk until Save');
  await set('u1', 's', '4'); const a2 = await q('u1'); R.ok(!a2.off && /Score 12/.test(a2.say), 'both chosen: it shows the score and Save comes on: ' + a2.say);
  await set('u1', 'tl', '2'); const a3 = await q('u1'); R.ok(a3.off && /both target boxes, or neither/.test(a3.say), 'half a target stops Save and says why');
  await set('u1', 'ts', '2');
  // a part-filled line elsewhere survives another line being saved
  await set('u2', 'l', '5');
  const s1 = await page.evaluate(() => { const others = JSON.stringify(S.riskProfile.filter(r => r.id !== 'u1').map(r => [r.id, r.likelihood, r.severity, r.targetL, r.targetS])); document.getElementById('ckr-save-u1').click(); const r = S.riskProfile.find(x => x.id === 'u1'), sec = document.getElementById('ckrSec'); return { saved: [r.likelihood, r.severity, r.targetL, r.targetS].join(), others: others === JSON.stringify(S.riskProfile.filter(x => x.id !== 'u1').map(x => [x.id, x.likelihood, x.severity, x.targetL, x.targetS])), rows: sec.querySelectorAll('.ckr').length, kept: document.getElementById('ckr-l-u2').value, chart: [...document.querySelectorAll('#tab-ladder .ckl-band .ckl-title')].map(x => x.textContent), log: (r.log || []).map(l => l.text).join(), toast: document.getElementById('toast').textContent, top: (document.querySelector('.ckl-head-nr') || {}).innerText || '' }; });
  R.ok(s1.saved === '3,4,2,2' && s1.others, 'Save writes those four scores on that risk only: ' + s1.saved);
  R.ok(s1.rows === 2 && s1.chart.some(x => /judged Weak/.test(x)) && /Not yet rated · 2/i.test(s1.top), 'it leaves the list and joins the chart, and the count falls');
  R.ok(s1.kept === '5', 'what you had chosen on the next line is still there');
  R.ok(/Rated 12 on the risk ladder/.test(s1.log) && /now number \d+ on the ladder/.test(s1.toast), 'the log records it, and it says where it landed: ' + s1.toast);
  const foc = await page.evaluate(() => new Promise(res => setTimeout(() => res((document.activeElement || {}).id || ''), 200)));
  R.ok(foc === 'ckr-l-u3', 'saving the last line, the cursor moves to the line still waiting above it: ' + foc);
  // a score at or below its target goes straight to Dropped out, and it says so first
  await set('u2', 's', '1'); await set('u2', 'tl', '5'); await set('u2', 'ts', '1');
  const a4 = await q('u2'); R.ok(/straight to Dropped out/.test(a4.say), 'a score at its target warns before Save: ' + a4.say);
  await page.evaluate(() => document.getElementById('ckr-save-u2').click());
  const foc2 = await page.evaluate(() => new Promise(res => setTimeout(() => res((document.activeElement || {}).id || ''), 200)));
  R.ok(foc2 === 'ckr-l-u3', 'and saving a line with one under it, the cursor moves down to it, ready for the next score: ' + foc2);
  const d = await page.evaluate(() => [...document.querySelectorAll('#tab-ladder .ckc-outs .ckl-title')].map(x => x.textContent).join());
  R.ok(/Employers Liability/.test(d), 'and it does: ' + d);
  // no target is fine; reload keeps it all
  await set('u3', 'l', '2'); await set('u3', 's', '3');
  await page.evaluate(() => document.getElementById('ckr-save-u3').click());
  const e = await page.evaluate(() => ({ sec: !!document.getElementById('ckrSec'), top: !!document.querySelector('.ckl-head-nr:not(.ckl-head-nt)'), en: _riskEnough(S.riskProfile.find(r => r.id === 'u3')).t }));
  R.ok(!e.sec && !e.top && e.en === 'No target', 'with none left the section and the flag go; a risk saved with no target reads No target');
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"'); await wait(page, 300);
  const f = await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'u1'); return [r.likelihood, r.severity, r.targetL, r.targetS].join(); });
  R.ok(f === '3,4,2,2', 'after a reload the scores are still there');
  // read only and the client's view see the flag, not the boxes
  const v = await page.evaluate(() => { S.riskProfile.push({ id: 'u9', activity: 'Another unrated risk', hazard: '', actions: [] }); const keep = window._roLocked; window._roLocked = () => true; switchTab('ladder'); const sec = document.getElementById('ckrSec'); const ro = { flag: !!sec && /Not yet rated/i.test(sec.innerText), boxes: sec ? sec.querySelectorAll('select').length : -1, says: sec ? /Compass suggests/.test(sec.innerText) : true }; window._roLocked = keep; const was = _viewMode; _viewMode = 'management'; renderLadder(); const s2 = document.getElementById('ckrSec'); const cl = { flag: !!s2, boxes: s2 ? s2.querySelectorAll('select').length : -1 }; _viewMode = was; renderLadder(); return { ro, cl }; });
  R.ok(v.ro.flag && v.ro.boxes === 0 && !v.ro.says && v.cl.flag && v.cl.boxes === 0, 'a read-only login and the client\'s view see the flag, with no boxes');
  const col = await page.evaluate(() => { const bad = []; const hot = c => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c); if (!m) return false; const r = +m[1], g = +m[2], b = +m[3], a = m[4] === undefined ? 1 : +m[4]; return a > 0.05 && r > 150 && r - b > 90 && g < r - 50; }; document.querySelectorAll('#ckrSec, #ckrSec *').forEach(el => { const st = getComputedStyle(el); for (const k of ['color', 'backgroundColor']) if (hot(st[k])) bad.push(el.className); }); return bad; });
  R.ok(!col.length, 'no red in the section');
  const g = await page.evaluate(() => { switchTab('howto'); const t = document.getElementById('howtoContainer').innerText; switchTab('cockpit'); return t; });
  R.ok(/flagged Not yet rated/.test(g) && /Compass suggests no score/.test(g), 'the guide covers it');
}
// ── the rest of the list: no target, the plan's total, Legal duties, Maturity, Settings, the sidebar ──
{
  await go({ riskProfile: [
    { id: 'n1', activity: 'Rated with no target', hazard: 'x', likelihood: '4', severity: '3', actions: [act('n1a', 20)] },
    { id: 'n2', activity: 'Second with no target', hazard: 'x', likelihood: '2', severity: '3', actions: [Object.assign(act('n2c', 20), { hideFromPlan: true })] },
    { id: 'n3', activity: 'Rated with a target', hazard: 'x', likelihood: '5', severity: '5', targetL: '2', targetS: '2', actions: [act('n3a', 20), act('n3b', 21)] },
  ] });
  const t = await page.evaluate(() => { switchTab('ladder'); const sec = document.getElementById('cktSec'), rows = sec ? [...sec.querySelectorAll('.ckr')] : []; return { head: sec ? sec.querySelector('.ckl-band-h').innerText.replace(/\s+/g, ' ') : '', chip: (document.querySelector('.ckl-head-nt') || {}).innerText || '', n: rows.length, boxes: rows.map(r => r.querySelectorAll('select').length).join(), empty: rows.every(r => [...r.querySelectorAll('select')].every(x => x.value === '')), off: rows.every(r => r.querySelector('button.btn').disabled), flags: rows.map(r => r.querySelector('.ckr-flag').innerText).join(), chart: document.querySelectorAll('#tab-ladder .ckl-band .ckl-line').length, none: S.riskProfile.filter(r => r.targetL).length }; });
  R.ok(/NO TARGET YET 2 risks/.test(t.head) && /No target · 2/i.test(t.chip) && t.n === 2, 'the risks with no target have their own list, flagged at the head: ' + t.head.slice(0, 60));
  R.ok(t.boxes === '2,2' && t.empty && t.off && t.none === 1 && t.chart === 3, 'two empty boxes on each line and nothing saved; they stay on the chart');
  const set = (id, k, v) => page.evaluate((id, k, v) => { const e = document.getElementById('ckr-' + k + '-' + id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, id, k, v);
  await set('n1', 'tl', '2'); const half = await page.evaluate(() => ({ off: document.getElementById('ckr-save-n1').disabled, say: document.getElementById('ckr-say-n1').textContent }));
  await set('n1', 'ts', '2'); const full = await page.evaluate(() => ({ off: document.getElementById('ckr-save-n1').disabled, say: document.getElementById('ckr-say-n1').textContent }));
  R.ok(half.off && /both target boxes/.test(half.say) && !full.off && /Target 4/.test(full.say), 'half a target stops Save; both show the target: ' + full.say);
  const s1 = await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'n1'); document.getElementById('ckr-save-n1').click(); return { saved: [r.likelihood, r.severity, r.targetL, r.targetS].join(), left: document.querySelectorAll('#cktSec .ckr').length, log: (r.log || []).map(l => l.text).join(), status: _riskControlStatus(r), enough: _riskEnough(r).t, onChart: [...document.querySelectorAll('#tab-ladder .ckl-band .ckl-title')].some(x => /Rated with no target/.test(x.textContent)) }; });
  R.ok(s1.saved === '4,3,2,2' && s1.left === 1 && /Target set on the risk ladder: 4/.test(s1.log) && s1.onChart && s1.enough === 'Not yet', 'Save writes the target only, leaves the score alone, and the risk reads Not yet: ' + s1.saved);
  await set('n2', 'tl', '2'); await set('n2', 'ts', '3');
  const w1 = await page.evaluate(() => document.getElementById('ckr-say-n2').textContent);
  R.ok(/straight to Dropped out/.test(w1), 'a target at or above the score warns first: ' + w1);
  const s2 = await page.evaluate(() => { document.getElementById('ckr-save-n2').click(); return { sec: !!document.getElementById('cktSec'), chip: !!document.querySelector('.ckl-head-nt'), out: [...document.querySelectorAll('#tab-ladder .ckc-outs .ckl-title')].some(x => /Second with no target/.test(x.textContent)) }; });
  R.ok(!s2.sec && !s2.chip && s2.out, 'and it goes there; with none left the list and the flag go');
  const ro = await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'n1'); delete r.targetL; delete r.targetS; const keep = window._roLocked; window._roLocked = () => true; renderLadder(); const sec = document.getElementById('cktSec'), o = { flag: !!sec, boxes: sec ? sec.querySelectorAll('select').length : -1 }; window._roLocked = keep; r.targetL = '2'; r.targetS = '2'; renderLadder(); return o; });
  R.ok(ro.flag && ro.boxes === 0, 'a read-only login sees the list with no boxes');
  // gap 8
  // Simon, 6 November 2026: the total is the plan's actions plus the arrangements no action delivers, each once. A risk is not counted.
  const d = await page.evaluate(() => { switchTab('cockpit'); const B = _boardModel(), el = document.querySelector('#tab-cockpit .ck-dep-parts'); return { said: el ? el.innerText : '', parts: B.dep.onPlan + B.dep.rows, total: B.dep.total, shown: new RegExp(B.dep.done + ' of ' + B.dep.total + ' planned').test(document.getElementById('tab-cockpit').innerText) }; });
  R.ok(d.shown && d.parts === d.total && /actions on the plan/.test(d.said) && /standing arrangement/.test(d.said) && !/reaching their target/.test(d.said), 'the plan delivered total says what it is made of, and the parts add up to ' + d.total + ': ' + d.said);
  const dc = await page.evaluate(() => { const r = { id: 'x', likelihood: '4', severity: '4', targetL: '2', targetS: '2', actions: [{ id: 'c1', desc: 'Control one', hideFromPlan: true }, { id: 'c2', desc: 'Control two', hideFromPlan: true }, { id: 'a1', desc: 'Delivers control one', forCtl: 'c1' }, { id: 'a2', desc: 'Also delivers control one', forCtl: 'c1', status: 'Complete' }, { id: 'a3', desc: 'Free action' }] }; const pick = o => ({ total: o.total, done: o.done, onPlan: o.onPlan, rows: o.rows, merged: o.merged }); const a = pick(_journeyDepCounts(r)), w1 = _depPartsWords(a); r.actions[2].deleted = true; r.actions[3].deleted = true; const b = pick(_journeyDepCounts(r)); const e = _journeyDepCounts({ id: 'y', likelihood: '1', severity: '1', targetL: '1', targetS: '1', actions: [] }); return { a, w1, b, e: pick(e), ctl: e.ctl, w2: _depPartsWords({ onPlan: 1, rows: 1, merged: 2 }) }; });
  R.ok(dc.a.total === 4 && dc.a.onPlan === 3 && dc.a.rows === 1 && dc.a.merged === 1 && dc.a.done === 1, 'a control and the actions that deliver it count once, as the actions: ' + dc.w1);
  R.ok(dc.b.total === 3 && dc.b.rows === 2 && dc.b.merged === 0 && dc.b.done === 0, 'delete the actions that delivered it and the control counts again on its own');
  R.ok(dc.e.total === 0 && dc.ctl === 'In place', 'a risk at its target with nothing recorded adds nothing: a risk is not a thing delivered');
  R.ok(/The 2 arrangements an action delivers are counted once, as that action\.$/.test(dc.w2), 'and the words say so: ' + dc.w2);
  // gap 9
  const L = await page.evaluate(() => { S.requirements = [{ id: 'sec1', heading: 'Legal essentials - what you must have in place', legal: true, stage: '', items: [{ id: 'i1', legalKey: 'policy', requirement: 'Health & Safety Policy', citation: '', present: 'No', adequate: '', action: '', crit: {} }, { id: 'i2', legalKey: 'insurance', requirement: 'Insurance', citation: '', present: '', adequate: '', action: '', crit: {} }] }]; _policyState().signedDate = '2026-01-05'; switchTab('requirements'); const tab = document.getElementById('tab-requirements'); const note = tab.querySelector('.req-pol-note'); const txt = tab.innerText.replace(/\s+/g, ' '); const st = _reqStats(), g = _reqGaps(), sec = S.requirements.find(x => x.legal), items = sec.items, inP = items.filter(_reqItemMet).length, un = items.filter(it => !_reqItemAssessed(it)).length; return { note: note ? note.innerText : '', head: txt.includes(g.assessed + ' of ' + st.total + ' lines assessed · ' + g.gaps + ' with gaps'), ess: un > 0 && txt.includes(inP + '/' + items.length + ' in place · ' + un + ' not assessed'), old: /\d+ gaps? \/ \d+ assessed/.test(txt), says: g.assessed + ' of ' + st.total + ' / ' + inP + '/' + items.length + ' un ' + un }; });
  R.ok(L.head && !L.old, 'the Legal duties headline says what it counts: lines assessed, then how many have gaps (' + L.says + ')');
  R.ok(L.ess, 'the essentials headline says how many are not assessed yet');
  R.ok(/statement of intent was signed/.test(L.note) && /whole policy/.test(L.note), 'a signed statement above "Not in place" is explained: ' + L.note);
  // gap 10
  const M = await page.evaluate(() => { switchTab('maturity'); const t = document.getElementById('tab-maturity').innerText; switchTab('cockpit'); return { old: /lives above/.test(t), now: /measured position is on the cockpit/.test(t), there: /H&S (control )?maturity/i.test(document.getElementById('tab-cockpit').innerText) }; });
  R.ok(!M.old && M.now && M.there, 'Maturity level points to where the measured position really is, and it is there');
  // gap 11
  const G = await page.evaluate(() => { const pane = () => (document.querySelector('.setup-nav-btn.active') || {}).getAttribute('data-spane'); window._setupPicked = false; try { _setupPicked = false; } catch (e) {} S.linkedApps = []; S.inspections = []; S.actions = []; switchTab('setup'); const a = pane(); switchSetupPane('my-checklist'); switchTab('cockpit'); switchTab('setup'); const b = pane(); _setupPicked = false; S.inspections = [{ id: 'x' }]; switchTab('setup'); const c = pane(); S.inspections = []; _setupPicked = false; switchTab('cockpit'); return { a, b, c }; });
  R.ok(G.a === 'branding' && G.b === 'my-checklist' && G.c === 'my-checklist', 'Settings opens on report branding for a client not on the Inspection app, on the checklist for one who is, and stays where you chose');
  // gap 12
  const N = await page.evaluate(() => { const front = [...document.querySelectorAll('.nav-grp-front .tab-btn')].map(b => b.getAttribute('data-tab')).join(); const label = () => document.querySelector('.nav-grp[data-grp="tools"] .nav-grp-btn').textContent.trim(); const was = _viewMode, cons = label(); _viewMode = 'management'; applyViewMode(); const client = label(), shows = document.querySelector('.tab-btn[data-tab="execplan"]').style.display !== 'none'; _viewMode = was; applyViewMode(); return { front, cons, client, back: label(), shows }; });
  R.ok(N.front === 'cockpit,risk,ladder,execplan,works' && N.shows, 'the Client execution plan sits in the Front door group, after the Risk ladder');
  R.ok(N.cons === 'Consultant tools' && N.client === 'Tools' && N.back === 'Consultant tools', 'the group reads Tools to a client, Consultant tools to you');
}
// ── first use: nothing to list, nothing breaks ──
{
  await seed(page, { riskProfile: [], actionPlan: [], company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] } }, 'works');
  await wait(page, 300);
  const t = await page.evaluate(() => { delete S.actionSheets; const notes = !!document.querySelector('#worksContainer .wk-notes'); openLiveTop5(); const o = { notes, ladder: !!document.querySelector('.t5-strip-ladder'), team: (document.querySelector('.t5-strip-team') || {}).innerText || '' }; closeLiveTop5(); return o; });
  R.ok(!t.notes && !t.ladder && /Company setup/.test(t.team), 'with no risks there is no list and no strip, only where to add the team');
}

await R.done(browser, errors);
