// ══════════════════════════════════════════════════════════════
//  The Top 5 response round trip. Simon, 2026-10-01: "add editable fields
//  so the client can enter their actions and comments and send it back to
//  me - I might get three or four different responses but I want to choose
//  the best, add my knowledge and then import the actions into the app
//  using the correct fields and structure".
//  Fillable form out (pdf-lib) -> filled in as two directors would (pdf-lib
//  in the page) -> imported into the holding list -> reviewed side by side
//  -> the best chosen, edited, one added -> real risk actions on the plan,
//  the first taking the month's Top 5 mark.
//  2026-10-07: the form is now the Risk Action Sheet's proposals form - it
//  carries the risks ticked in the Sheet column on the cockpit's risk ladder
//  (_sheetRisks), not the Top 5's five.
//  Later on 2026-10-07: the action sheet itself now carries the two-way
//  table (Simon's controls, then the leadership team's comments, who and by
//  when), so it is the one report the SLT gets and the button to this form
//  is retired. The form, its import and review, and what has come back
//  (S.top5Resp) all stay in the code, so nothing stored is lost - this suite
//  drives them directly.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Risk action sheet proposals - form out, forms back, choose, add to the plan');
const { browser, page, errors } = await openApp();

const month = new Date().toISOString().slice(0, 7);
const risk = (id, name, l, s, extra) => Object.assign({ id, activity: name, likelihood: String(l), severity: String(s), targetL: '2', targetS: '2', actions: [] }, extra || {});
const STATE = () => ({
  company: { legalName: 'Fineline Architects Ltd', sector: 'Design / architecture / surveying',
    slt: [ { name: 'Jo Fine', role: 'Managing Director', email: 'jo@fineline.example' }, { name: 'Sam Line', role: 'Technical Director', email: 'sam@fineline.example' } ] },
  riskProfile: [
    // r1-r5 ticked for this month's Risk Action Sheet; r6 is not
    risk('r1', 'Asbestos disturbance on survey', 4, 4, { sheet: month, actions: [ { id: 'a1', desc: 'Get the R&D survey', owner: 'Jo Fine', due: '2026-09-01', status: 'Not started', top5: month } ] }),
    risk('r2', 'Fall through a fragile roof', 5, 4, { sheet: month }),
    risk('r3', 'Driving for work', 3, 4, { sheet: month }),
    risk('r4', 'Lone working in void property', 4, 3, { sheet: month }),
    risk('r5', 'Manual handling of kit', 3, 3, { sheet: month }),
    risk('r6', 'Office fire', 1, 3),
  ], top5Resp: { list: [], own: {}, notes: {} } });
await seed(page, STATE(), 'cockpit');
await wait(page, 600);

// ── the form carries the risks ticked for the Risk Action Sheet ──
{
  const t = await page.evaluate(async () => {
    // pdf-lib cannot read text back, so what is printed is watched as it builds
    const said = [], P = PDFLib.PDFPage.prototype, orig = P.drawText;
    P.drawText = function (s, o) { said.push(String(s)); return orig.call(this, s, o); };
    let bytes; try { bytes = await buildTop5FormPDF(); } finally { P.drawText = orig; }
    const doc = await PDFLib.PDFDocument.load(bytes);
    const names = doc.getForm().getFields().map(f => f.getName());
    const meta = JSON.parse(doc.getForm().getTextField('t5__meta').getText());
    return { pages: doc.getPageCount(), names, meta, sheet: _sheetRisks().map(z => z.id), said, kick: said.filter(s => /ON THE ACTION SHEET/.test(s)) };
  });
  R.ok(t.meta.ids.join(',') === t.sheet.join(',') && t.sheet.slice().sort().join(',') === 'r1,r2,r3,r4,r5', 'the form carries the risks ticked for the Risk Action Sheet, in the sheet\'s own order (' + t.meta.ids.join(',') + ')');
  R.ok(t.kick.length === 5 && t.kick.filter(k => /THIS MONTH.S TOP 5/.test(k)).length === 1 && /THIS MONTH.S TOP 5/.test(t.kick[t.meta.ids.indexOf('r1')] || ''), 'each risk\'s page says it is on the action sheet, and r1\'s that it is this month\'s Top 5');
  R.ok(t.said.includes('RISK ACTION SHEET - YOUR PROPOSALS'), 'the form is titled as the Risk Action Sheet\'s proposals');
  R.ok(t.pages === 6 && t.meta.client === 'Fineline Architects Ltd', 'a front page and a page a risk; the form knows which client it is for');
  R.ok(t.names.includes('t5__name') && t.names.includes('t5_r1_a1_what') && t.names.includes('t5_r1_a3_due') && t.names.includes('t5_r1_comment') && t.names.includes('t5_r1_agree'), 'each risk has three actions (what / who / by when), a comment box and an agree tick');
  R.ok(!t.names.includes('t5_r6_a1_what'), 'a risk not ticked for the sheet is not on the form');
}

// ── filled in by two directors, imported, nothing on the plan yet ──
const fill = (who, role, answers) => page.evaluate(async (who, role, answers) => {
  const bytes = await buildTop5FormPDF();
  const doc = await PDFLib.PDFDocument.load(bytes); const form = doc.getForm();
  form.getTextField('t5__name').setText(who); form.getTextField('t5__role').setText(role);
  Object.keys(answers).forEach(k => { const v = answers[k]; if (v === true) form.getCheckBox(k).check(); else form.getTextField(k).setText(v); });
  const out = await doc.save();
  const before = JSON.stringify(S.riskProfile.map(r => (r.actions || []).length));
  await _top5ImportFiles([new File([out], who.toLowerCase().replace(/\s+/g, '-') + '.pdf', { type: 'application/pdf' })]);
  return { toast: document.getElementById('toast').textContent, n: _top5Resp().list.length, untouched: before === JSON.stringify(S.riskProfile.map(r => (r.actions || []).length)) };
}, who, role, answers);
{
  const a = await fill('Jo Fine', 'Managing Director', { 't5_r1_a1_what': 'Commission the R&D survey this month', 't5_r1_a1_who': 'Jo Fine', 't5_r1_a1_due': '31/10/2026',
    't5_r1_a2_what': 'Stop intrusive work until it is back', 't5_r1_a2_who': 'Sam Line', 't5_r1_a2_due': 'end of October', 't5_r1_comment': 'We should have done this already.', 't5_r1_agree': true,
    't5_r2_a1_what': 'Buy two crawl boards', 't5_r2_a1_who': 'Sam Line', 't5_r2_a1_due': '15 Nov 2026' });
  const b = await fill('Sam Line', 'Technical Director', { 't5_r1_a1_what': 'Get a UKAS surveyor in', 't5_r1_a1_who': 'Sam Line', 't5_r1_a1_due': '2026-10-20', 't5_r1_comment': 'Agree, and brief the team.',
    't5_r2_a1_what': 'Roof-light checklist before every visit', 't5_r2_a1_who': 'Priya Nair', 't5_r2_a1_due': '01/11/2026', 't5_r2_agree': true });
  R.ok(/1 form added/.test(a.toast) && a.n === 1 && a.untouched, 'a returned form lands in the holding list - nothing goes on the plan');
  R.ok(/1 form added/.test(b.toast) && b.n === 2 && b.untouched, 'a second director\'s form joins it');
  // Jo sends a corrected copy - the whole response is replaced, so it carries everything again
  const c = await fill('Jo Fine', 'Managing Director', { 't5_r1_a1_what': 'Commission the R&D survey this month (revised)', 't5_r1_a1_who': 'Jo Fine', 't5_r1_a1_due': '31/10/2026',
    't5_r1_a2_what': 'Stop intrusive work until it is back', 't5_r1_a2_who': 'Sam Line', 't5_r1_a2_due': 'end of October', 't5_r1_comment': 'We should have done this already.', 't5_r1_agree': true,
    't5_r2_a1_what': 'Buy two crawl boards', 't5_r2_a1_who': 'Sam Line', 't5_r2_a1_due': '15 Nov 2026' });
  R.ok(/replaced an earlier one/.test(c.toast) && c.n === 2, 'the same person sending again replaces their earlier response, not doubles it');
}

// ── forms that cannot be taken ──
{
  const t = await page.evaluate(async () => {
    const out = {};
    const bytes = await buildTop5FormPDF();
    // no name
    let doc = await PDFLib.PDFDocument.load(bytes); doc.getForm().getTextField('t5_r1_a1_what').setText('x');
    await _top5ImportFiles([new File([await doc.save()], 'noname.pdf')]); out.noName = document.getElementById('toast').textContent;
    // another client's form
    doc = await PDFLib.PDFDocument.load(bytes); doc.getForm().getTextField('t5__name').setText('Someone');
    const m = JSON.parse(doc.getForm().getTextField('t5__meta').getText()); m.client = 'Other Co Ltd';
    doc.getForm().getTextField('t5__meta').enableReadOnly(false); doc.getForm().getTextField('t5__meta').setText(JSON.stringify(m));
    await _top5ImportFiles([new File([await doc.save()], 'other.pdf')]); out.other = document.getElementById('toast').textContent;
    // flattened - no fields left
    doc = await PDFLib.PDFDocument.load(bytes); doc.getForm().flatten();
    await _top5ImportFiles([new File([await doc.save()], 'flat.pdf')]); out.flat = document.getElementById('toast').textContent;
    out.n = _top5Resp().list.length;
    return out;
  });
  R.ok(/noname\.pdf: no name was filled in/.test(t.noName), 'a form with no name is refused and says why');
  R.ok(/other\.pdf: this form is for Other Co Ltd, not Fineline Architects Ltd/.test(t.other), 'another client\'s form is refused by name');
  R.ok(/flat\.pdf: no answers could be read - the boxes may have been flattened/.test(t.flat) && t.n === 2, 'a flattened form is refused with the reason, and nothing was added');
}

// ── the review: side by side, dates read, the odd one flagged ──
{
  const t = await page.evaluate(() => {
    openTop5Review();
    const ov = document.getElementById('t5Ov');
    const sec = document.getElementById('t5r-r1');
    const rows = [...sec.querySelectorAll('.t5r-row')].map(r => { const i = r.querySelectorAll('input'); return { what: i[1].value, who: i[2].value, due: i[3].value, from: r.querySelector('.t5r-from').textContent }; });
    return { open: !!ov && document.body.classList.contains('slt-open'), people: [...ov.querySelectorAll('.slt-who .slt-chip b')].map(b => b.textContent),
      secs: [...ov.querySelectorAll('.slt-sec h3')].map(h => h.textContent).slice(1), rows, said: sec.innerText, addBtn: sec.querySelector('.btn-primary').disabled,
      sheetNames: _sheetRisks().map(z => z.name) };
  });
  R.ok(t.open && t.people.join(',') === 'Jo Fine,Sam Line', 'the review opens with both responses named');
  // worst first, as the sheet orders them: the fragile roof (20) before the asbestos (16)
  R.ok(t.secs.length === 5 && t.secs.every((h, i) => h.indexOf(t.sheetNames[i]) >= 0), 'a section a risk, the sheet\'s risks in the sheet\'s order (' + t.sheetNames.join(' | ') + ')');
  R.ok(t.rows.length === 3 && t.rows[0].what === 'Commission the R&D survey this month (revised)' && t.rows[0].due === '2026-10-31' && /from Jo Fine/.test(t.rows[0].from), 'Jo\'s proposals, with 31/10/2026 read as a date');
  R.ok(t.rows[1].what === 'Stop intrusive work until it is back' && t.rows[1].due === '' && /date not read: end of October/.test(t.rows[1].from), 'a date written in words is kept as written and flagged for a date');
  R.ok(t.rows[2].what === 'Get a UKAS surveyor in' && t.rows[2].due === '2026-10-20' && /from Sam Line/.test(t.rows[2].from), 'Sam\'s proposal beside them, 2026-10-20 read');
  R.ok(/Jo Fine agrees with the asks: We should have done this already\./.test(t.said) && /Sam Line did not tick agree: Agree, and brief the team\./.test(t.said), 'what each said, and who ticked agree - Sam commented on this risk but ticked agree only on the roof');
  R.ok(t.addBtn, 'nothing ticked yet, so Add to the plan is not live');
}

// ── choose the best, edit, add your own, add to the plan ──
{
  const t = await page.evaluate(() => {
    const sec = document.getElementById('t5r-r1');
    const rows = () => [...document.getElementById('t5r-r1').querySelectorAll('.t5r-row')];
    const r0 = rows()[0].querySelectorAll('input'); r0[0].checked = true; r0[0].dispatchEvent(new Event('change'));
    const r2 = rows()[2].querySelectorAll('input'); r2[0].checked = true; r2[0].dispatchEvent(new Event('change'));
    // edit Sam's wording and give it a date
    const r2b = rows()[2].querySelectorAll('input'); r2b[1].value = 'Get a UKAS-accredited surveyor in for the R&D survey'; r2b[1].dispatchEvent(new Event('input'));
    // add my own
    t5AddOwn('r1'); const own = rows()[3].querySelectorAll('input'); own[1].value = 'Add asbestos to the pre-survey checklist'; own[1].dispatchEvent(new Event('input'));
    own[2].value = 'Priya Nair'; own[2].dispatchEvent(new Event('input')); own[3].value = '2026-11-30'; own[3].dispatchEvent(new Event('change'));
    const ta = document.getElementById('t5n-r1'); ta.value = 'Jo and Sam agree - survey first, then the checklist.'; ta.dispatchEvent(new Event('input'));
    const out = { btn: document.getElementById('t5r-r1').querySelector('.btn-primary').textContent };
    document.getElementById('t5r-r1').querySelector('.btn-primary').click();
    const r = S.riskProfile.find(x => x.id === 'r1');
    const made = r.actions.filter(a => a.id !== 'a1');
    out.made = made.map(a => a.desc + ' | ' + a.owner + ' | ' + a.due + ' | ' + a.status + ' | ' + (a.top5 || '') + ' | ' + a.priority);
    out.oldMark = r.actions.find(a => a.id === 'a1').top5;
    out.log0 = (made[0].log || []).map(l => l.type + ': ' + l.text);
    out.log1 = (made[1].log || []).map(l => l.type + ': ' + l.text);
    out.doneRows = [...document.getElementById('t5r-r1').querySelectorAll('.t5r-row.t5r-done')].length;
    out.toast = document.getElementById('toast').textContent;
    out.plan = _top5List().map(a => a.desc);
    closeTop5Review(); out.closed = !document.getElementById('t5Ov');
    return out;
  });
  R.ok(/Add 3 to the plan/.test(t.btn), 'the button counts what is ticked');
  R.ok(t.made.length === 3 && t.made[0] === 'Commission the R&D survey this month (revised) | Jo Fine | 2026-10-31 | Not started | ' + month + ' | Critical', 'the chosen proposals become real actions - what, who, by when, status, priority (a 4x4 risk is Critical) - the first taking the month\'s Top 5 mark');
  R.ok(t.made[1].startsWith('Get a UKAS-accredited surveyor in for the R&D survey | Sam Line | 2026-10-20 | Not started |  |'), 'the edited wording is what lands');
  R.ok(t.made[2].startsWith('Add asbestos to the pre-survey checklist | Priya Nair | 2026-11-30 | Not started |  |'), 'and the consultant\'s own line');
  R.ok(t.oldMark === '' && t.plan.includes('Commission the R&D survey this month (revised)') && !t.plan.includes('Get the R&D survey'), 'the earlier Top 5 mark on the risk moves to the new first action - one mark per risk');
  R.ok(t.log0.some(l => /^raised: From the leadership team.s proposals for the risk action sheet, .* - proposed by Jo Fine \(Managing Director\)$/.test(l)) && t.log0.some(l => l === 'comment: Consultant: Jo and Sam agree - survey first, then the checklist.') && t.log0.some(l => l === 'comment: Jo Fine: We should have done this already.') && t.log0.some(l => l === 'comment: Sam Line: Agree, and brief the team.'), 'each action\'s history says who proposed it; the note and the directors\' comments go on the first');
  R.ok(t.log1.some(l => /proposed by Sam Line/.test(l)), 'the second credits Sam');
  R.ok(t.doneRows === 3 && /3 actions added to .* - the first is this month.s Top 5 action/.test(t.toast) && t.closed, 'added rows are marked on the plan and cannot be added twice; Close puts the screen away');
}

// ── no way in from the screens any more; the code and what came back stay ──
{
  const t = await page.evaluate(() => {
    renderCockpit();
    const ladder = [...document.querySelectorAll('.ckx-panel')].find(p => /Risk ladder/.test((p.querySelector('h4') || {}).textContent || ''));
    const old = [...ladder.querySelectorAll('button')].filter(b => /^(Responses|Forms)/.test(b.textContent.trim())).map(b => b.textContent.trim());
    openActionSheets('risk');
    const prop = [...document.querySelectorAll('#asOv button')].some(b => b.textContent.trim() === 'Proposals from the leadership team' || /openTop5Review\(/.test(b.getAttribute('onclick') || ''));
    closeActionSheets();
    switchTab('reports');
    const rep = document.getElementById('tab-reports').textContent;
    const fns = ['openTop5Review', 'closeTop5Review', 'buildTop5FormPDF', 'downloadTop5Form', '_top5ImportFiles', 't5Apply'].filter(n => { try { return new Function('return typeof ' + n)() !== 'function'; } catch (e) { return true; } });
    return { old, prop, card: /Risk Action Sheet/.test(rep), oldCard: /Top 5 Responses/.test(rep), keys: _IMPORT_KEYS.includes('top5Resp'), fns, kept: _top5Resp().list.length };
  });
  R.ok(!t.old.length, 'the ladder has no Responses or Forms button' + (t.old.length ? ': ' + t.old.join(', ') : ''));
  R.ok(!t.prop, 'the Risk action sheet screen no longer has a Proposals from the leadership team button - the sheet carries the two-way table');
  R.ok(!t.fns.length && t.kept === 2, 'the form, its import and review are still in the code, and the two responses are still held' + (t.fns.length ? ' - missing: ' + t.fns.join(', ') : ''));
  R.ok(t.card && !t.oldCard && t.keys, 'a Risk Action Sheet card on the Reports tab and no Top 5 Responses card; responses travel with the client');
}

await R.done(browser, errors);
