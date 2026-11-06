// ══════════════════════════════════════════════════════════════
//  From a risk assessment (Simon, 6 November 2026): the file OpRAMS writes
//  with Send to Compass, imported on a risk's overview. In the user's order:
//  the file arrives -> its still-to-arrange notes are rows to do, its in-place
//  notes are already in place, the assessment is on the RA register against
//  the risk -> read back on tabs 3 and 4 and the execution plan -> sent again
//  unchanged, nothing doubles -> a note gone in place on the assessment closes
//  its row here, filed against the assessment -> a wrong file is refused ->
//  another risk's assessment is asked about -> reload -> read only.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('From a risk assessment - OpRAMS notes into the loop');
const { browser, page, errors } = await openApp();
const today = new Date().toISOString().slice(0, 10);
const file = (over) => Object.assign({ app: 'oprams', kind: 'ra-for-compass', v: 1, made: '2026-11-06', ref: 'FL-12', task: 'Roof inspection from a ladder', location: 'Client sites', project: '', assessor: 'S. Archer', date: '05/11/2026',
  hazards: [
    { no: 1, hazard: 'Fall from the ladder', notes: [{ kind: 'Training', text: 'Ladder association training for every surveyor', status: 'todo' }, { kind: 'Equipment', text: 'Ladder tied and footed, stand-off fitted', status: 'have' }] },
    { no: 3, hazard: 'Fragile roof lights', notes: [{ kind: 'Information', text: 'Roof light register checked before each visit', status: 'todo' }] }] }, over || {});
const risk = id => page.evaluate(id => JSON.parse(JSON.stringify(S.riskProfile.find(r => r.id === id))), id);
const apply = (rid, f) => page.evaluate((rid, f) => { const r = S.riskProfile.find(x => x.id === rid); return _rsApplyRA(r, _rsRaParse(JSON.stringify(f))); }, rid, f);
const toast = () => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');

await seed(page, { riskProfile: [
  { id: 'r1', activity: 'Falls from roofs during surveys', hazard: 'Unprotected roof edges', likelihood: '5', severity: '5', targetL: '2', targetS: '3', actions: [
    { id: 'c1', desc: 'Safe access arrangements for every roof inspection', owner: 'Ben Cole', due: '', status: 'Not started', hideFromPlan: true },
    { id: 'a1', desc: 'Fit edge protection to the loading bay', owner: 'Ben Cole', due: '2027-01-10', status: 'Not started', priority: 'High', forCtl: 'c1' }] },
  { id: 'r2', activity: 'Fire at the office', likelihood: '3', severity: '5', targetL: '2', targetS: '5', actions: [] }],
  company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] }, documents: [], raRegister: [] }, 'risk');

// ── the file arrives on the overview ──
{
  await page.evaluate(() => { _riskOpenModal('r1'); });
  await wait(page, 200);
  const btn = await page.evaluate(() => { const b = [...document.querySelectorAll('#rpBody .rs-add button')].find(x => /From a risk assessment/.test(x.textContent)); return !!b; });
  R.ok(btn, 'the overview offers "From a risk assessment" beside Add what we\'re doing');
  const before = await page.evaluate(() => JSON.stringify(S.riskProfile.find(r => r.id === 'r1').actions));
  const t = await page.evaluate(async f => { const blob = new File([JSON.stringify(f)], 'RA-FL-12-for-Compass.json', { type: 'application/json' }); return await _rsReadRA('r1', blob); }, file());
  R.ok(t && t.todo === 2 && t.placed === 1 && t.closed === 0 && t.same === 0, 'the file goes in through the same reader the picker uses: 2 to do, 1 already in place (' + JSON.stringify(t && { todo: t.todo, placed: t.placed }) + ')');
  R.ok(/From risk assessment FL-12: 2 to do, 1 already in place\. On the RA register/.test(await toast()), 'the toast says what happened: ' + (await toast()).slice(0, 90));
  const r1 = await risk('r1');
  const added = r1.actions.filter(a => a.ra);
  R.ok(r1.actions.length === 5 && added.length === 3 && JSON.stringify(r1.actions.slice(0, 2)) === JSON.stringify(JSON.parse(before)), 'three rows added, the two that were there untouched');
  const todo = added.filter(a => !a.hideFromPlan), have = added.filter(a => a.hideFromPlan);
  R.ok(todo.length === 2 && todo.every(a => a.status === 'Not started' && !a.owner && !a.due) && todo[0].desc === 'Training: Ladder association training for every surveyor', 'a still-to-arrange note is a plan action with no owner or date yet, worded kind: note');
  R.ok(have.length === 1 && have[0].status === 'Complete' && have[0].completedDate === '2026-11-05' && have[0].completedBy === 'S. Archer' && have[0].desc === 'Equipment: Ladder tied and footed, stand-off fitted', 'an in-place note is a standing arrangement already in place, dated from the assessment');
  R.ok(added.every(a => a.ra.ref === 'FL-12' && a.ra.key && a.ra.no) && todo[1].ra.no === 3 && todo[1].ra.hazard === 'Fragile roof lights', 'every row remembers the assessment, the hazard number and the hazard');
  R.ok(todo[0].log.some(l => /^From risk assessment FL-12, hazard 1 \(Fall from the ladder\): still to arrange/.test(l.text)) && have[0].log.some(l => /already in place, dated 5 Nov 2026/.test(l.text)), 'each row\'s history says where it came from');
  R.ok((r1.log || []).some(l => /^From risk assessment FL-12 \(sent 6 Nov 2026\): 2 to do, 1 already in place/.test(l.text)) && r1.raised === 2, 'and the risk\'s own history records the import');
  const reg = await page.evaluate(() => JSON.parse(JSON.stringify(S.raRegister)));
  R.ok(reg.length === 1 && reg[0].ref === 'FL-12' && reg[0].riskId === 'r1' && reg[0].title === 'Risk assessment - Roof inspection from a ladder' && reg[0].location === 'Client sites' && reg[0].date === '2026-11-05' && reg[0].source === 'oprams', 'the assessment is on the RA register, linked to the risk');
}
// ── it reads back everywhere ──
{
  const v = await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'r1'); const L = _rsRows(r);
    const o = document.getElementById('riskModalOverlay');
    return { doing: L.doing.map(x => x.a.desc.slice(0, 20)), placed: L.placed.map(x => x.a.desc.slice(0, 20)), rows: [...o.querySelectorAll('#rpBody .t5-table tbody tr.t5-row')].length, placedShown: [...o.querySelectorAll('#rpBody .rs-placed li')].map(x => x.innerText.replace(/\s+/g, ' ')),
      src: [...o.querySelectorAll('#rpBody .t5-st')].map(x => x.innerText).filter(t => /From RA FL-12/.test(t)).length, tab3: /Ladder tied and footed/.test(_riskActionsHTML(r, '', 'ctl')), tab4: /Roof light register checked/.test(_riskActionsHTML(r, '', 'plan')), plan: _execActions().filter(a => a.ref.a === 'r1').map(a => a.desc.slice(0, 12)).join() }; });
  R.ok(v.rows === 4 && v.doing.length === 4 && v.placed.length === 1, 'the overview: four rows to do (the two that were there, the two to arrange), one already in place');
  R.ok(v.placedShown.some(t => /Ladder tied and footed/.test(t) && /In place since 5 Nov 2026/.test(t) && /From RA FL-12, hazard 1/.test(t)) && v.src === 2, 'rows say where they came from: From RA FL-12, hazard n');
  R.ok(v.tab3 && v.tab4 && /Training: La/.test(v.plan) && /Information:/.test(v.plan), 'the standing arrangement is on tab 3, the actions on tab 4 and the execution plan');
}
// ── sent again, unchanged: nothing doubles; a note gone in place closes its row here ──
{
  const again = await apply('r1', file());
  R.ok(again.todo === 0 && again.placed === 0 && again.closed === 0 && again.same === 3 && (await risk('r1')).actions.length === 5, 'the same file again: 3 unchanged, nothing added');
  const f2 = file(); f2.hazards[0].notes[0].status = 'have'; f2.made = '2026-11-20';
  const flip = await apply('r1', f2);
  const r1 = await risk('r1'), a = r1.actions.find(x => x.ra && /Ladder association/.test(x.desc));
  R.ok(flip.closed === 1 && flip.same === 2 && a.status === 'Complete' && a.completedDate === '2026-11-05' && !a.hideFromPlan, 'training now in place on the assessment: its row here is complete, still an action');
  R.ok(a.embed && a.embed.doc && a.embed.doc.name === 'Risk assessment FL-12' && !a.stickDue && a.log.some(l => /in place on the assessment, dated 5 Nov 2026/.test(l.text)), 'and it says where it lives: the risk assessment, filed on Documents');
  R.ok(await page.evaluate(() => S.documents.some(d => d.name === 'Risk assessment FL-12')), 'the assessment is on the Documents register');
  R.ok(!(await page.evaluate(() => !!document.getElementById('evidOverlay'))) && !(await page.evaluate(() => !!document.getElementById('rescoreOverlay'))), 'no question is asked for it, and nothing else is under control yet');
  const f3 = file(); f3.hazards[1].notes.push({ kind: 'Supervision', text: 'Second surveyor on any fragile roof', status: 'todo' }); f3.hazards[0].notes[0].status = 'have';
  const more = await apply('r1', f3);
  R.ok(more.todo === 1 && more.same === 3 && (await risk('r1')).actions.length === 6, 'a new note on the assessment comes in as one new row');
  R.ok(await page.evaluate(() => S.raRegister.length === 1), 'still one register entry');
}
// ── wrong files, and another risk's assessment ──
{
  const bad = await page.evaluate(async () => { const blob = new File(['{"hello":1}'], 'x.json'); const r = await _rsReadRA('r1', blob); return { r, t: (document.getElementById('toast') || {}).textContent || '' }; });
  R.ok(bad.r === null && /not a risk assessment sent from OpRAMS/.test(bad.t), 'a file that is not from OpRAMS is refused with the reason');
  const noref = await page.evaluate(async f => { f.ref = ''; const blob = new File([JSON.stringify(f)], 'x.json'); const r = await _rsReadRA('r1', blob); return { r, t: (document.getElementById('toast') || {}).textContent || '' }; }, file());
  R.ok(noref.r === null && /has no reference/.test(noref.t), 'an assessment with no reference is refused');
  // the harness answers every confirm with yes
  const other = await page.evaluate(async f => { _riskCloseModal(); _riskOpenModal('r2'); const blob = new File([JSON.stringify(f)], 'x.json'); const r = await _rsReadRA('r2', blob); return { r, reg: JSON.parse(JSON.stringify(S.raRegister)), n2: S.riskProfile.find(x => x.id === 'r2').actions.length }; }, file());
  R.ok(other.r && other.r.todo === 2 && other.n2 === 3 && other.reg.length === 1 && other.reg[0].riskId === 'r2', 'the same assessment on another risk is asked about; said yes, it moves the register link there');
  await page.evaluate(() => _riskCloseModal());
}
// ── reload, read only ──
{
  const saved = await page.evaluate(() => { saveData(); return JSON.stringify({ r: S.riskProfile.map(r => r.actions.map(a => ({ id: a.id, ra: a.ra || null, st: a.status, h: !!a.hideFromPlan }))), reg: S.raRegister }); });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"');
  await wait(page, 500);
  R.ok(await page.evaluate(() => JSON.stringify({ r: S.riskProfile.map(r => r.actions.map(a => ({ id: a.id, ra: a.ra || null, st: a.status, h: !!a.hideFromPlan }))), reg: S.raRegister })) === saved, 'it all survives a reload');
  const ro = await page.evaluate(async f => { const was = [_consultantView, _consultantEdit]; _consultantView = { name: 'Testing Client Ltd' }; _consultantEdit = false;
    const n0 = S.riskProfile.find(x => x.id === 'r2').actions.length; rsImportRA('r2'); const picker = !!document.getElementById('rsRaFile');
    _consultantView = was[0]; _consultantEdit = was[1]; return { picker, same: S.riskProfile.find(x => x.id === 'r2').actions.length === n0 }; }, file());
  R.ok(!ro.picker && ro.same, 'read only: the picker does not open and nothing is written');
}

await R.done(browser, errors);
