// ══════════════════════════════════════════════════════════════
//  Top 5 action sheet: five actions out with the recommended controls, the
//  client's outcome back (imported, or keyed in from paper), and a decision
//  on each line - approve, compromise, client accepts the risk, or carry.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Top 5 action sheet');
const { browser, page, errors } = await openApp();

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const month = new Date().toISOString().slice(0, 7);
const RISKS = [
  { id: 'r1', ref: 'R-001', activity: 'Work at height on roofs', likelihood: '4', severity: '5', actions: [
    { id: 'a1', desc: 'Fit edge protection to the loading bay roof', owner: 'Dave', due: day(30), status: 'Not started' },
    { id: 'a2', desc: 'Write a rescue plan for harness work', owner: '', due: '', status: 'Not started' }] },
  { id: 'r2', ref: 'R-002', activity: 'Manual handling in the stores', likelihood: '2', severity: '3', actions: [
    { id: 'a3', desc: 'Buy a pallet truck for the stores', owner: 'Sam', due: day(10), status: 'In progress', top5: month },
    { id: 'a4', desc: 'Manual handling training for stores staff', owner: '', due: day(60), status: 'Not started' }] },
  { id: 'r3', ref: 'R-003', activity: 'Vehicle movements in the yard', likelihood: '3', severity: '4', actions: [
    { id: 'a5', desc: 'Mark pedestrian walkways in the yard', owner: 'Dave', due: day(-5), status: 'Not started' },
    { id: 'a6', desc: 'Banksman for reversing HGVs', owner: '', due: day(20), status: 'Not started' },
    { id: 'a7', desc: 'Speed limit signs at the gate', owner: 'Dave', due: day(-40), status: 'Complete' }] },
];
await seed(page, { riskProfile: RISKS, company: { tradingName: 'Fairbank Fabrications Ltd', slt: [{ name: 'Dave Morley', role: 'Operations Director' }] } }, 'execplan');
await page.evaluate(() => { delete S.actionSheets; });

const act = id => page.evaluate(id => { for (const r of S.riskProfile) { const a = (r.actions || []).find(x => x.id === id); if (a) return JSON.parse(JSON.stringify(a)); } return null; }, id);
const sheet = n => page.evaluate(n => JSON.parse(JSON.stringify((S.actionSheets.list || []).find(s => s.no === n) || null)), n);
const toast = () => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const lineIds = () => page.evaluate(() => [...document.querySelectorAll('#asOv .as-item')].map(x => x.id));

// ── opening it writes nothing; the way in is on the plan and the reports tab ──
{
  const t = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('#execPlanRoot button')].some(b => b.textContent.trim() === 'Action sheet');
    openActionSheets();
    const text = document.getElementById('asOv').innerText;
    switchTab('reports'); const card = /Top 5 Action Sheet/.test(document.getElementById('tab-reports').innerText); switchTab('execplan');
    return { btn, text, store: S.actionSheets, card };
  });
  R.ok(t.btn && t.card, 'the action sheet opens from the execution plan and has its card on the Reports tab');
  R.ok(t.store === undefined && /No sheet yet/.test(t.text), 'opening it adds nothing to the client record');
}

// ── the first five are the Top 5: the month's marks, then the Top 5 report's own ranking ──
await page.evaluate(() => asNewSheet());
await wait(page, 300);
let s1 = await sheet(1);
R.ok(s1 && s1.items.map(i => i.ref.b).join(',') === 'a3,a1,a5,a4,a2', 'the first five: one action a risk down the Top 5, then round again (' + (s1 && s1.items.map(i => i.ref.b).join(',')) + ')');
{
  const t = await page.evaluate(() => ({ five: _top5Five().map(f => f.z.id), lines: S.actionSheets.list[0].items.slice(0, 3).map(i => i.ref.a) }));
  R.ok(t.five.length === 3 && JSON.stringify(t.five) === JSON.stringify(t.lines), 'the sheet leads with the same risks, in the same order, as the Top 5 report (' + t.lines.join(',') + ')');
}
{
  const ownRef = await page.evaluate(() => S.riskProfile.find(r => r.id === 'r1').ref);   // the app numbers its own risks
  R.ok(!!ownRef && s1.items[1].riskRef === ownRef && s1.items[1].risk === 'Work at height on roofs' && s1.items[1].band === 'Critical' && s1.items[1].owner === 'Dave' && !!s1.items[1].due, 'each line carries its risk, band, owner and target from the plan');
}
{
  const t = await page.evaluate(() => ({ status: _asSheetStatus(S.actionSheets.list[0]).label, addShown: !!document.querySelector('#asOv .as-add'), newDisabled: [...document.querySelectorAll('#asOv .slt-bar button')].find(b => /Next five/.test(b.textContent)).disabled }));
  R.ok(/Draft/.test(t.status) && !t.addShown && t.newDisabled, 'five is the sheet: nothing more can be added, and no second sheet while this one is a draft');
}
// swap one: take the training off and put the banksman on from the plan
await page.evaluate(sid => { asRemoveItem(sid, 'risk:r2:a4:'); }, s1.id);
await wait(page, 200);
await page.select('#asAdd-' + s1.id, 'risk:r3:a6:');
await page.evaluate(sid => asAddItem(sid), s1.id);
await wait(page, 200);
R.ok((await sheet(1)).items.map(i => i.ref.b).join(',') === 'a3,a1,a5,a2,a6', 'an action can be taken off and another put on from the plan');

// ── a thin risk record is flagged before the sheet goes out ──
{
  const t = await page.evaluate(() => {
    const warn = () => [...document.querySelectorAll('#asOv .as-item')].map(x => (x.querySelector('.as-warn') || {}).innerText || '');
    const before = warn();
    const r = S.riskProfile.find(x => x.id === 'r1'); r.assocRisk = 'No edge protection on the loading bay roof.'; r.personsAtRisk = ['Employees']; r.targetL = '1'; r.targetS = '5';
    _asRender();
    return { before, after: warn() };
  });
  R.ok(/Its page will be thin: the risk has no what is wrong, who it affects or the target score recorded/.test(t.before[1]), 'a risk with nothing written about it is flagged on the draft, naming what is missing');
  R.ok(t.after[1] === '' && /will be thin/.test(t.after[0]), 'and the flag clears once the risk is filled in');
}

// ── the recommended controls, typed on the line ──
const RECS = ['A hand pallet truck rated 2,000 kg, kept in the stores and on the pre-use check sheet.',
  'Fixed guard rail to BS EN 13374 Class A around the full perimeter, installed by a competent contractor.',
  'Painted walkways with barriers at the two crossing points, separate from the HGV route.',
  'A written rescue plan naming who rescues, with what kit, practised once a year.',
  'A trained banksman for every reversing movement, in hi-vis, with agreed hand signals.'];
for (let i = 0; i < 5; i++) await page.type('#asI-' + s1.id + '-' + i + ' textarea.slt-notes', RECS[i]);
await wait(page, 200);
s1 = await sheet(1);
R.ok(s1.items.every((it, i) => it.rec === RECS[i]), 'the consultant writes the recommended control against each action');

// ── the sheet itself ──
const pdfPath = path.join(os.tmpdir(), 'action-sheet-test.pdf');
{
  const t = await page.evaluate(async sid => {
    const bytes = await buildActionSheetPDF(sid);
    const doc = await PDFLib.PDFDocument.load(bytes); const names = doc.getForm().getFields().map(f => f.getName());
    let b = ''; bytes.forEach(x => { b += String.fromCharCode(x); });
    return { names, meta: JSON.parse(doc.getForm().getTextField('as__meta').getText()), pages: doc.getPageCount(), b64: btoa(b) };
  }, s1.id);
  fs.writeFileSync(pdfPath, Buffer.from(t.b64, 'base64'));
  const per = n => ['o_done', 'o_diff', 'o_cannot', 'o_notyet', 'what', 'date', 'by'].every(f => t.names.includes('as_' + n + '_' + f));
  R.ok([1, 2, 3, 4, 5].every(per) && t.names.includes('as__name') && t.names.includes('as__general'), 'the sheet has four tick boxes, what was done, the date and by whom for each of the five');
  R.ok(t.meta.sheet === s1.id && t.meta.no === 1 && t.meta.keys.length === 5 && t.meta.client === 'Fairbank Fabrications Ltd', 'it knows which client and which sheet it is');
  R.ok(t.pages === 6, 'a cover, then a page an action that stands on its own (' + t.pages + ' pages)');
}
await page.evaluate(sid => downloadActionSheet(sid), s1.id);
await wait(page, 500);
R.ok(/With the client since/.test(await page.evaluate(() => _asSheetStatus(S.actionSheets.list[0]).label)), 'downloading it marks the sheet as with the client');

// ── what is refused on the way back ──
const fill = (answers, who, role, edit) => page.evaluate(async (sid, answers, who, role, edit) => {
  const bytes = await buildActionSheetPDF(sid);
  const doc = await PDFLib.PDFDocument.load(bytes); const form = doc.getForm();
  if (who) form.getTextField('as__name').setText(who); if (role) form.getTextField('as__role').setText(role);
  Object.keys(answers).forEach(k => { const v = answers[k]; if (v === true) form.getCheckBox(k).check(); else form.getTextField(k).setText(v); });
  if (edit === 'other') { const m = JSON.parse(form.getTextField('as__meta').getText()); m.client = 'Other Co Ltd'; form.getTextField('as__meta').enableReadOnly(false); form.getTextField('as__meta').setText(JSON.stringify(m)); }
  if (edit === 'flat') form.flatten();
  await _asImportFiles([new File([await doc.save()], (edit || 'returned') + '.pdf', { type: 'application/pdf' })]);
  return document.getElementById('toast').textContent;
}, s1.id, answers, who, role, edit);
{
  const other = await fill({ as_1_o_done: true }, 'Someone', '', 'other');
  const flat = await fill({ as_1_o_done: true }, 'Someone', '', 'flat');
  const blank = await fill({}, 'Someone', '', '');
  R.ok(/this sheet is for Other Co Ltd, not Fairbank Fabrications Ltd/.test(other), 'another client’s sheet is refused, with the reason');
  R.ok(/boxes may have been flattened/.test(flat) && /enter the answers by hand/.test(flat), 'a flattened sheet is refused, and says the answers can be entered by hand');
  R.ok(/nothing filled in/.test(blank), 'a sheet returned blank is refused');
  R.ok((await sheet(1)).items.every(i => !i.resp.outcome && !i.resp.what), 'and none of those changed anything');
}

// ── the client's outcome comes back ──
const before = { a3: (await act('a3')).status, a1: (await act('a1')).status };
const order0 = await lineIds();
{
  const msg = await fill({
    as_1_o_done: true, as_1_what: 'Bought and in use. On the pre-use check sheet.', as_1_date: '12/10/2026', as_1_by: 'Sam',
    as_2_o_cannot: true, as_2_what: 'The roof is leased and the landlord will not allow fixings.',
    as_3_o_notyet: true, as_3_what: 'Waiting for the line-marking contractor.',
    as_4_o_diff: true, as_4_what: 'Rescue is covered by the access contractor’s plan, a copy is on file.', as_4_date: '9 Oct 2026', as_4_by: 'Dave Morley',
    as_5_o_done: true, as_5_o_cannot: true, as_5_what: 'Not sure - see me.',
    as__general: 'Budget is tight until January.' }, 'Dave Morley', 'Operations Director', '');
  s1 = await sheet(1);
  R.ok(/Sheet 1: 5 answers in/.test(msg) && /1 with more than one box ticked/.test(msg), 'the returned sheet imports, and says one line needs a choice (' + msg.slice(0, 90) + ')');
  R.ok(s1.items[0].resp.outcome === 'done' && s1.items[0].resp.date === '2026-10-12' && s1.items[0].resp.by === 'Sam', 'tick, date and name are read off the sheet');
  R.ok(s1.items[3].resp.outcome === 'diff' && s1.items[3].resp.date === '2026-10-09', 'a date written as words is read too');
  R.ok(s1.items[4].resp.outcome === '' && /More than one box was ticked: Done as recommended, Cannot be done/.test(s1.items[4].resp.what), 'two ticks are not guessed at: the line says so and waits for a choice');
  R.ok(s1.returnedBy === 'Dave Morley (Operations Director)' && s1.general === 'Budget is tight until January.', 'who returned it and their general comment are kept');
  R.ok((await act('a3')).status === before.a3 && (await act('a1')).status === before.a1, 'nothing changes on the plan until each line is decided');
  R.ok(JSON.stringify(await lineIds()) === JSON.stringify(order0), 'the lines stay exactly where they were');
  R.ok(/5 to decide/.test(await page.evaluate(() => _asSheetStatus(S.actionSheets.list[0]).label)), 'the sheet reads 5 to decide');
}

// ── approve ──
await page.click('#asI-' + s1.id + '-0 .as-btns button.btn-primary');
await wait(page, 300);
{
  const a = await act('a3'); s1 = await sheet(1);
  R.ok(a.status === 'Complete' && a.completedDate === '2026-10-12' && a.completedBy === 'Sam', 'Approve completes the action on the plan, dated and named as the client reported');
  R.ok((a.log || []).some(l => l.type === 'completed' && /Action sheet 1: Done as recommended - Bought and in use/.test(l.text) && /Approved/.test(l.text)), 'and writes what was done on the action’s own history');
  R.ok(s1.items[0].decision === 'approved' && JSON.stringify(await lineIds()) === JSON.stringify(order0), 'the decided line stays in place, marked approved');
}

// ── go back with a compromise ──
await page.click('#asI-' + s1.id + '-1 .as-btns button.btn-outline');
await wait(page, 200);
R.ok(/Write the compromise first/.test(await toast()) && !(await sheet(1)).items[1].decision, 'a compromise with nothing written is refused');
const COMPROMISE = 'Free-standing counterweighted guard rail, no fixings into the roof. Landlord to be told in writing.';
await page.type('#asN-' + s1.id + '-1', COMPROMISE);
await page.click('#asI-' + s1.id + '-1 .as-btns button.btn-outline');
await wait(page, 300);
{
  const a = await act('a1'); s1 = await sheet(1);
  R.ok(s1.items[1].decision === 'compromise' && a.status === 'In progress', 'the compromise is recorded and the action stays open');
  R.ok((a.log || []).some(l => /Cannot be done - The roof is leased/.test(l.text) && /Compromise sent back: Free-standing/.test(l.text)), 'what the client said and the compromise are both on the action’s history');
}

// ── approve something done a different way ──
{
  const label = await page.evaluate(sid => document.querySelector('#asI-' + sid + '-3 .as-btns button.btn-primary').textContent, s1.id);
  await page.click('#asI-' + s1.id + '-3 .as-btns button.btn-primary');
  await wait(page, 300);
  R.ok(label === 'Approve what was done instead' && (await act('a2')).status === 'Complete' && (await act('a2')).completedBy === 'Dave Morley', 'work done a different way can be approved as it stands');
}

// ── carry forward ──
await page.evaluate(sid => { const b = [...document.querySelectorAll('#asI-' + sid + '-2 .as-btns button')].find(x => /Carry to the next sheet/.test(x.textContent)); b.click(); }, s1.id);
await wait(page, 300);
R.ok((await sheet(1)).items[2].decision === 'carry' && (await act('a5')).status === 'Not started', 'not done yet is carried forward, still open');

// ── client accepts the risk: keyed in by hand, as from a paper copy ──
{
  const noApprove = await page.evaluate(sid => document.querySelector('#asI-' + sid + '-4 .as-btns button.btn-primary').disabled, s1.id);
  R.ok(noApprove, 'a line with no outcome chosen cannot be approved');
  await page.select('#asI-' + s1.id + '-4 .as-resp select', 'cannot');
  await wait(page, 300);
  await page.evaluate(sid => { document.getElementById('asA-' + sid + '-4').value = ''; [...document.querySelectorAll('#asI-' + sid + '-4 .as-btns button')].find(x => /Client accepts the risk/.test(x.textContent)).click(); }, s1.id);
  await wait(page, 200);
  R.ok(/who at the client accepts the risk/.test(await toast()) && !(await sheet(1)).items[4].decision, 'an accepted risk needs the name of the person accepting it');
  await page.type('#asA-' + s1.id + '-4', 'Dave Morley, Operations Director');
  await page.type('#asN-' + s1.id + '-4', 'Reversing is under ten movements a week; a banksman is disproportionate. Reviewed at the next visit.');
  await page.evaluate(sid => { [...document.querySelectorAll('#asI-' + sid + '-4 .as-btns button')].find(x => /Client accepts the risk/.test(x.textContent)).click(); }, s1.id);
  await wait(page, 300);
  const a = await act('a6');
  const reg = await page.evaluate(() => _acceptedActions().map(x => x.id));
  R.ok(a.status === 'Accepted' && a.acceptedBy === 'Dave Morley, Operations Director' && /disproportionate/.test(a.acceptReason) && !!a.acceptDate, 'the action closes as an accepted risk, with who and why');
  R.ok(reg.includes('a6'), 'and it is on the Risk Acceptance Register by itself');
  R.ok(/Reviewed/.test(await page.evaluate(() => _asSheetStatus(S.actionSheets.list[0]).label)), 'with every line decided the sheet reads Reviewed');
}

// ── the next five ──
await page.evaluate(() => asNewSheet());
await wait(page, 300);
{
  const s2 = await sheet(2);
  // the two carried lines lead, in the Top 5's ranking as it stands now (it moves as risks are dealt with)
  const want = await page.evaluate(() => { const o = _asRiskOrder(); return ['a1', 'a5'].sort((x, y) => o.indexOf(x === 'a1' ? 'r1' : 'r3') - o.indexOf(y === 'a1' ? 'r1' : 'r3')).concat(['a4']).join(','); });
  R.ok(s2 && s2.items.map(i => i.ref.b).join(',') === want, 'the next sheet leads with what was carried back, then carries on down the Top 5 (' + (s2 && s2.items.map(i => i.ref.b).join(',')) + ')');
  const c1 = s2.items.find(i => i.ref.b === 'a1'), c5 = s2.items.find(i => i.ref.b === 'a5');
  R.ok(c1.rec === COMPROMISE && c1.carriedFrom === 1, 'the compromise goes out as that action’s recommended control');
  R.ok(c5.rec === RECS[2] && c5.carriedFrom === 1, 'a carried line keeps its recommendation');
  R.ok(await page.evaluate(() => _asCandidates(null).length) === 0, 'an action is never on two sheets at once');
  const older = await page.evaluate(() => { const d = document.querySelector('#asOv details.as-old'); return d ? { open: d.open, sum: d.querySelector('summary').textContent } : null; });
  R.ok(older && !older.open && /Sheet 1 · Reviewed/.test(older.sum), 'the finished sheet folds away under the new one, still there to read');
}

// ── taking a decision back ──
{
  const s = await sheet(1);
  await page.evaluate((sid) => asUndo(sid, 'risk:r1:a1:'), s.id);
  await wait(page, 200);
  R.ok(/already on a later sheet/.test(await toast()) && (await sheet(1)).items[1].decision === 'compromise', 'a compromise already sent out on the next sheet cannot be undone behind it');
  await page.evaluate((sid) => asUndo(sid, 'risk:r2:a3:'), s.id);
  await wait(page, 300);
  const a = await act('a3');
  R.ok(a.status === 'In progress' && !a.completedDate && (a.log || []).some(l => l.type === 'reopened') && !(await sheet(1)).items[0].decision, 'undoing an approval reopens the action and says so on its history');
}

// ── it all survives a reload ──
const saved = await page.evaluate(() => { saveData(); return JSON.stringify(S.actionSheets); });
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"');
await wait(page, 500);
R.ok(await page.evaluate(() => JSON.stringify(S.actionSheets)) === saved, 'after a reload every sheet reads back exactly as saved');
// ── the risk ladder's ticks are the sheet's five ──
await seed(page, { riskProfile: RISKS.concat([{ id: 'r4', activity: 'Asbestos in the plant room', likelihood: '5', severity: '5', actions: [] }]),
  company: { tradingName: 'Fairbank Fabrications Ltd' } }, 'cockpit');
{
  const t = await page.evaluate(() => {
    delete S.actionSheets;
    toggleRiskTop5('r3');                       // the tick on the risk ladder
    const marked = S.riskProfile.find(r => r.id === 'r3').actions.filter(a => a.top5).map(a => a.id);
    asNewSheet(); openActionSheets();
    const s = S.actionSheets.list[0];
    return { marked, five: _top5Five().map(f => f.z.id), lines: s.items.map(i => i.ref.b), risks: s.items.map(i => i.ref.a),
      gap: [...document.querySelectorAll('#asOv .as-warn')].map(x => x.innerText).find(t => /In the Top 5/.test(t)) || '' };
  });
  R.ok(t.marked.join() === 'a5' && t.lines.join(',') === 'a5,a3,a1,a6,a4', 'a risk ticked on the ladder puts its action at the head of the sheet (' + t.lines.join(',') + ')');
  R.ok(t.five.join(',') === 'r3,r2,r4,r1' && t.risks.slice(0, 3).join(',') === 'r3,r2,r1', 'the sheet follows the Top 5 report\u2019s five, in its order (' + t.five.join(',') + ')');
  R.ok(/In the Top 5 with nothing to send: .*Asbestos in the plant room/.test(t.gap) && /add one on the risk/.test(t.gap), 'a Top 5 risk with no open action is named, not silently left off');
  await page.evaluate(() => closeActionSheets());
}
console.log('  sheet written to ' + pdfPath);
await R.done(browser, errors);
