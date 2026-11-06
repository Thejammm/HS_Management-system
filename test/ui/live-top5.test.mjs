// ══════════════════════════════════════════════════════════════
//  The live Top 5: the front door, Build 1 (Simon, 5 November 2026), in the
//  order it is used. Last sheet out -> opened in the meeting -> owner, date and
//  comment typed on the row and read back on tab 4, the execution plan and the
//  action plan -> Done and "Where does this live now?" for each answer -> Later
//  -> Send -> the PDF, the email and the sheet as the record -> the next meeting
//  opens from it. Then the five sheet fixes, on a sheet that comes back by import.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Live Top 5 - the front door');
const { browser, page, errors } = await openApp();

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dmy = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
const month = new Date().toISOString().slice(0, 7);
const SLT = [
  { name: 'Ann Reed', role: 'Managing Director', email: 'ann@example.test' }, { name: 'Ben Cole', role: 'Operations Director', email: 'ben@example.test' },
  { name: 'Cara Hill', role: 'Finance Director', email: 'cara@example.test' }, { name: 'Dan West', role: 'Commercial Director', email: 'dan@example.test' }];
const risks = () => [
  { id: 'r1', ref: 'A-001', activity: 'Falls from roofs during surveys', hazard: 'Unprotected roof edges', harm: 'Fatal injury', likelihood: '5', severity: '5', targetL: '2', targetS: '3', personsAtRisk: ['Surveyors'], actions: [
    { id: 'c1', desc: 'Edge protection on every roof', owner: 'Old Owner', due: day(-1), status: 'Not started', hideFromPlan: true },
    { id: 'c2', desc: 'A rescue plan for roof work', owner: 'Old Owner', due: day(-1), status: 'Not started', hideFromPlan: true },
    { id: 'c3', desc: 'Roof access register', owner: 'Old Owner', due: day(-1), status: 'Not started', hideFromPlan: true },
    { id: 'a1', desc: 'Fit edge protection to the loading bay', owner: 'Ben Cole', due: day(10), status: 'Not started', priority: 'High', forCtl: 'c1' },
    { id: 'a2', desc: 'Buy a second harness kit', owner: 'Ben Cole', due: day(20), status: 'In progress', priority: 'High', forCtl: 'c1' },
    { id: 'a3', desc: 'Write the roof rescue plan', owner: '', due: '', status: 'Not started', priority: 'High', forCtl: 'c2' },
    { id: 'a4', desc: 'Brief the survey team', owner: 'Cara Hill', due: day(30), status: 'Not started', priority: 'High' }] },
  { id: 'r2', ref: 'A-002', activity: 'Asbestos disturbed during intrusive work', hazard: 'Asbestos in older buildings', likelihood: '4', severity: '5', targetL: '2', targetS: '4', actions: [
    { id: 'a5', desc: 'Obtain the survey before intrusive work', owner: 'Dan West', due: day(5), status: 'Not started', priority: 'High' },
    { id: 'a6', desc: 'Asbestos awareness for all surveyors', owner: 'Dan West', due: day(6), status: 'Not started', priority: 'High' }] },
  { id: 'r3', ref: 'A-003', activity: 'Fire at the office', hazard: 'Ignition sources in the office', likelihood: '3', severity: '5', targetL: '2', targetS: '5', actions: [
    { id: 'a7', desc: 'Update the fire risk assessment', owner: 'Ann Reed', due: day(9), status: 'Not started', priority: 'High' }] },
  { id: 'r4', ref: 'A-004', activity: 'Road collision driving for work', hazard: 'Grey fleet driving', likelihood: '3', severity: '4', targetL: '2', targetS: '3', actions: [
    { id: 'a8', desc: 'Check licences and insurance', owner: 'Ann Reed', due: day(12), status: 'Not started', priority: 'Medium' }] },
  { id: 'r5', ref: 'A-005', activity: 'Lone working in void property', hazard: 'Working alone', likelihood: '3', severity: '3', targetL: '1', targetS: '3', actions: [
    { id: 'a9', desc: 'Set up a lone working check-in', owner: 'Ben Cole', due: day(14), status: 'Not started', priority: 'Medium' }] },
  { id: 'r6', ref: 'A-006', activity: 'Manual handling of survey kit', hazard: 'Heavy cases', likelihood: '2', severity: '2', targetL: '1', targetS: '2', actions: [
    { id: 'a10', desc: 'Buy a kit trolley', owner: 'Ben Cole', due: day(25), status: 'Not started', priority: 'Low' }] },
];
const act = id => page.evaluate(id => { for (const r of S.riskProfile) { const a = (r.actions || []).find(x => x.id === id); if (a) return JSON.parse(JSON.stringify(a)); } return null; }, id);
const logOf = async id => ((await act(id)).log || []).map(l => l.type + ': ' + l.text);
const sheets = () => page.evaluate(() => JSON.parse(JSON.stringify(S.actionSheets.list)));
// a box typed in, as the browser hands it over when the cursor leaves it
const setBox = (sel, v) => page.evaluate((sel, v) => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const tick = (aid, on) => page.evaluate((aid, on) => { const e = document.getElementById('t5t-' + aid); e.checked = on; e.dispatchEvent(new Event('change', { bubbles: true })); }, aid, on);
const goRisk = i => page.evaluate(i => t5Go(i), i);
// every word on the screen, and in the boxes' prompts and tips
const allWords = sel => page.evaluate(sel => { const o = document.querySelector(sel); if (!o) return ''; const bits = [o.innerText]; o.querySelectorAll('[placeholder],[title],[aria-label]').forEach(e => bits.push(e.getAttribute('placeholder') || '', e.getAttribute('title') || '', e.getAttribute('aria-label') || '')); return bits.join(' | '); }, sel);
const injectCatch = () => page.evaluate(() => {
  window.__saved = []; window.__links = []; window.__draw = [];
  const save = _sltSaveBlob; window._sltSaveBlob = (blob, name) => { window.__saved.push({ blob, name }); };
  window._sltOpenLink = href => { window.__links.push(href); };
  if (!window.__drawHook) { window.__drawHook = true; const d = PDFLib.PDFPage.prototype.drawText; PDFLib.PDFPage.prototype.drawText = function (t, o) { (window.__draw = window.__draw || []).push(String(t)); return d.call(this, t, o); }; }
});
const fieldsOf = (n) => page.evaluate(async n => {
  const f = window.__saved[n]; const buf = await f.blob.arrayBuffer(); const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
  const out = {}; doc.getForm().getFields().forEach(x => { try { if (x.getText) out[x.getName()] = x.getText() || ''; } catch (e) {} });
  return { name: f.name, out };
}, n);

await seed(page, { riskProfile: risks(), company: { tradingName: 'Testing Client Ltd', slt: SLT, personnel: [] },
  documents: [{ id: 'd1', name: 'Health & Safety Policy', category: 'Policy', version: '', owner: '', reviewDate: '', link: '' }] }, 'cockpit');
await page.evaluate(() => { delete S.actionSheets; localStorage.removeItem && 0; });
await injectCatch();
// the app assigns a risk's reference, so the checks read it
const REF = await page.evaluate(() => Object.fromEntries(S.riskProfile.map(r => [r.id, _riskRefOf(r)])));

// ── the last sheet goes out from the back office, as sheet 1 did ──
await page.evaluate(async d => {
  toggleRiskTop5('r6');           // a tick the sheet will not carry
  asNewSheet();
  const s = S.actionSheets.list[0];
  s.items = s.items.filter(i => i.ref.a !== 'r6');
  ['r1', 'r2', 'r3', 'r4', 'r5'].forEach(id => { if (!s.items.some(i => i.ref.a === id)) { const r = S.riskProfile.find(x => x.id === id), a = _riskTop5Action(r); s.items.push(_asItemFrom({ a: { ...a, ref: { t: 'risk', a: id, b: a.id }, rag: 'green' }, key: _asKey({ t: 'risk', a: id, b: a.id }), kind: 'top5', band: _riskScore(r).priority })); } });
  await downloadActionSheet(s.id);
  s.issuedAt = d; s.createdAt = d + 'T09:00:00.000Z';
  saveData();
}, day(-29));
const before = await sheets();
R.ok(before.length === 1 && before[0].no === 1 && before[0].issuedAt === day(-29), 'sheet 1 is out, downloaded a month ago');

// ── opening: a clear top-level button, a working copy, no new number ──
{
  const t = await page.evaluate(() => {
    const b = document.getElementById('t5Btn'), shown = !!b && getComputedStyle(b).display !== 'none' && b.closest('.nav-grp-front') !== null, label = b ? b.innerText : '';
    b.click();
    const ov = document.getElementById('t5Ov');
    return { shown, label, open: !!ov, nav: ov ? ov.querySelectorAll('.t5-nb').length : 0, list: S.actionSheets.list.length,
      working: !!S.actionSheets.working, base: S.actionSheets.working.baseId === S.actionSheets.list[0].id, carried: S.actionSheets.working.items.map(i => i.ref.a).sort().join(),
      heads: [...ov.querySelectorAll('.t5-table th')].map(x => x.innerText.trim().toLowerCase()).join('|'),
      tiles: [...ov.querySelectorAll('.t5-tile')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' / '), haz: (ov.querySelector('.t5-haz') || {}).innerText || '', kick: (ov.querySelector('.t5-kick') || {}).innerText || '' };
  });
  R.ok(t.shown && /Top 5/.test(t.label), 'a clear button at the top of the Front door group (Stage C moved it from the header): "' + t.label + '"');
  R.ok(t.open && t.nav === 5 && t.carried === 'r1,r2,r3,r4,r5', 'it opens on the five from the last sheet, a risk a screen');
  R.ok(t.list === 1 && t.working && t.base, 'a working copy that starts from sheet 1: no new sheet number until Send');
  R.ok(t.heads === 'recommended action|comments|owner|target date|done', 'the table: recommended action, then Comments, Owner, Target date, Done (' + t.heads + ')');
  R.ok(/CURRENT RISK RATING 25 CRITICAL/i.test(t.tiles) && /TARGET RISK RATING 6/i.test(t.tiles) && /Unprotected roof edges/.test(t.haz) && /Fatal injury/.test(t.haz), 'heading, current and target rating, hazard: as the PDF page (' + t.tiles + ')');
  R.ok(/Priority 1 of 5/i.test(t.kick) && t.kick.includes(REF.r1), 'the page says which priority it is: ' + t.kick);
}
// no red in anything new, and the word stays off the front door
{
  const t = await page.evaluate(() => {
    const rgb = c => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : null; };
    const redish = c => { const x = rgb(c); return !!x && x[0] > 150 && x[1] < 110 && x[2] < 110; };
    const bad = [...document.querySelectorAll('#t5Ov *')].filter(e => { const s = getComputedStyle(e); return redish(s.color) || redish(s.backgroundColor) || redish(s.borderTopColor); }).map(e => e.className || e.tagName);
    return { bad: bad.slice(0, 5) };
  });
  R.ok(!t.bad.length, 'no red and no orange near red on the screen ' + t.bad.join());
  R.ok(!/control/i.test(await allWords('#t5Ov')), 'the word "control" does not appear on the front door');
}

// ── writes: owner, date and comment land on the real action, the history says so ──
{
  await page.type('#t5c-a1', 'Scaffold firm booked for the loading bay');
  await page.keyboard.press('Tab');
  await page.evaluate(() => { const i = document.querySelector('[id="t5o-a3"] input'); i.focus(); });
  await page.keyboard.type('Ben Cole'); await page.keyboard.press('Enter');
  await wait(page, 60);
  await page.keyboard.type('Jo Bloggs'); await page.keyboard.press('Enter');
  await setBox('#t5d-a3', day(40));
  await setBox('#t5d-a1', day(33));
  await setBox('#t5Meet', day(-1));
  await setBox('#t5c-a2', 'Ordered');
  const a1 = await act('a1'), a3 = await act('a3');
  R.ok(a1.meetingComment === 'Scaffold firm booked for the loading bay' && a1.due === day(33), 'the comment and the date are on the real action');
  R.ok(a3.owner === 'Ben Cole, Jo Bloggs' && a3.due === day(40), 'the owner uses the owner list, more than one name is fine (' + a3.owner + ')');
  const tagNew = 'Action sheet 2, SLT meeting ' + await page.evaluate(d => fmtDate(d), day(-1));
  R.ok((await logOf('a2')).some(l => l === 'comment: ' + tagNew + ': Ordered'), 'a comment is on the history, tagged with the sheet and the meeting date');
  R.ok((await logOf('a3')).some(l => l.startsWith('delegated: Action sheet 2, SLT meeting') && /Owner: Ben Cole, Jo Bloggs/.test(l)) && (await logOf('a3')).some(l => /Target date set to/.test(l)), 'so is the owner and the target date');
  R.ok(await page.evaluate(() => document.getElementById('t5c-a1').value) === 'Scaffold firm booked for the loading bay', 'the latest comment stays visible on the row');
  const grown = await page.evaluate(() => { const was = S.riskProfile[0].actions.find(a => a.id === 'a2').meetingComment; t5Comment(0, 'a2', 'x'.repeat(200)); _t5Render(); const rows = document.getElementById('t5c-a2').rows; t5Comment(0, 'a2', was); _t5Render(); return rows; });
  R.ok(grown >= 6, 'a long comment shows whole: the box is as tall as its words (' + grown + ' rows)');
  const t = await page.evaluate(() => {
    const r = S.riskProfile.find(x => x.id === 'r1');
    const tab4 = _riskActionsHTML(r, '', 'plan');
    switchTab('execplan'); const plan = document.getElementById('tab-execplan').innerHTML;
    if (typeof renderActionPlanTab === 'function') renderActionPlanTab(); const apl = document.getElementById('tab-actionplan').innerHTML;
    const hist = _actionTimelineHTML(_execActions().find(x => x.ref.b === 'a2'));
    return { tab4: /Jo Bloggs/.test(tab4), plan: /Jo Bloggs/.test(plan) || _execActions().find(x => x.ref.b === 'a3').owner === 'Ben Cole, Jo Bloggs', apl: _execActions().find(x => x.ref.b === 'a3').due, hist: /Ordered/.test(hist), head: (document.getElementById('t5h-c2') || {}).innerText || '', line: (document.getElementById('t5h-c1') || {}).innerText || '' };
  });
  R.ok(t.tab4, 'the owner shows on tab 4 of the risk');
  R.ok(t.plan && t.apl === day(40), 'and on the Client execution plan, with the new date');
  R.ok(t.hist, 'the comment reads on the action\'s history');
  R.ok(/^Planned · Ben Cole, Jo Bloggs · by /.test(t.head), 'the line over the group follows what was agreed, not the old owner (' + t.head + ')');
  // ... and the other way round
  await page.evaluate(() => { updateRiskAction('r1', 'a4', 'owner', 'Dan West'); _t5Render(); });
  R.ok(await page.evaluate(() => document.querySelector('[id="t5o-a4"]').innerText.includes('Dan West')), 'a change in the back office reads on the front door');
}

// ── a row with no action yet, and adding one ──
{
  const t = await page.evaluate(() => { const ph = [...document.querySelectorAll('#t5Ov .t5-newr textarea')].map(x => x.placeholder); return { ph }; });
  R.ok(t.ph.includes('No action yet, add one'), 'a gap shows "No action yet, add one" with an add button');
  await page.evaluate(() => { const b = [...document.querySelectorAll('#t5Ov .t5-newr')].find(tr => tr.querySelector('textarea').placeholder === 'No action yet, add one'); b.querySelector('textarea').value = 'Start the access register'; b.querySelector('input[type=text]').value = 'Ann Reed'; b.querySelector('input[type=date]').value = '2027-02-01'; b.querySelector('button').click(); });
  const a = await page.evaluate(() => JSON.parse(JSON.stringify(S.riskProfile.find(r => r.id === 'r1').actions.find(x => x.desc === 'Start the access register'))));
  R.ok(a.forCtl === 'c3' && a.owner === 'Ann Reed' && a.due === '2027-02-01' && a.status === 'Not started' && (a.log || []).some(l => /Raised at the meeting/.test(l.text)), 'the new action is real: what, who, by when, under its group');
  R.ok(await page.evaluate(aid => !!document.getElementById('t5r-' + aid), a.id), 'and takes its place in the table');
  // half typed, then the meeting moves on and comes back: nothing is lost
  const kept = await page.evaluate(() => { const box = () => [...document.querySelectorAll('#t5Ov .t5-newr textarea')].find(x => x.placeholder === 'Add another action'); box().value = 'Half a thought'; t5Go(1); t5Go(0); const v = box().value; box().value = ''; _t5Render(); return v; });
  R.ok(kept === 'Half a thought', 'a new row half typed survives moving to another risk and back');
}

// ── it all survives a reload, working copy included ──
{
  const saved = await page.evaluate(() => { saveData(); return JSON.stringify(S.actionSheets); });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"');
  await wait(page, 500);
  await injectCatch();
  R.ok(await page.evaluate(() => JSON.stringify(S.actionSheets)) === saved, 'after a reload the working copy reads back exactly as saved');
  const t = await page.evaluate(() => { openLiveTop5(); return { c: document.getElementById('t5c-a1').value, d: document.getElementById('t5d-a3').value, m: document.getElementById('t5Meet').value, n: S.actionSheets.list.length }; });
  R.ok(t.c === 'Scaffold firm booked for the loading bay' && t.d === day(40) && t.m === day(-1) && t.n === 1, 'and the meeting carries on where it was');
}

// ── done: one tick, one question, each answer files where the close-out files it ──
const answer = async (k, boxes, how) => {
  await page.evaluate((k, boxes, how) => {
    document.getElementById('t5StickHow').value = how || '';
    const r = document.querySelector('#evidOverlay input[name="t5Stick"][value="' + k + '"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true }));
    Object.keys(boxes || {}).forEach(id => { document.getElementById(id).value = boxes[id]; });
    t5StickSave();
  }, k, boxes, how);
  await wait(page, 60);
};
{
  await tick('a1', true);
  const t = await page.evaluate(() => ({ panel: !!document.querySelector('#evidOverlay.t5-stick-ov'), oldForm: !!document.querySelector('.emb-wrap'), q: (document.querySelector('.t5-stick-h') || {}).innerText || '', opts: [...document.querySelectorAll('#evidOverlay .t5-sc')].map(x => x.innerText.trim()),
    row: !!document.getElementById('t5r-a1'), rowDone: document.getElementById('t5t-a1').checked, status: document.getElementById('t5s-a1').innerText }));
  R.ok(t.panel && !t.oldForm && t.q === 'Where does this live now?', 'ticking Done asks one question, on one small panel');
  R.ok(t.opts.join('|') === 'The H&S policy|A procedure or safe system of work (RA, RAMS)|Training or a toolbox talk|A regular check|A named person who owns it|Nothing ongoing, one-off', 'the plain choices: ' + t.opts.length);
  R.ok(t.row && t.rowDone && /^Complete/.test(t.status), 'the row stays where it is, ticked: ' + t.status);
  R.ok(!/control/i.test(await allWords('#evidOverlay')), 'the word stays off the panel too');
  const a = await act('a1');
  R.ok(a.status === 'Complete' && a.completedDate === new Date().toISOString().slice(0, 10) && a.stickDue, 'Complete on the real action, completion stamped');
  await page.evaluate(() => { t5StickSave(); });
  R.ok(await page.evaluate(() => !!document.getElementById('evidOverlay')), 'with nothing chosen it stays open and asks');
  await answer('policy', { _embDocSection: 'Section 7, Work at height' }, 'Scaffold up on the loading bay');
  const t2 = await page.evaluate(() => { const a = S.riskProfile[0].actions.find(x => x.id === 'a1'); return { embed: a.embed.doc, docs: S.documents.length, line: _embedLines(a)[0].text, stick: a.stickDue, how: a.log.some(l => /How it was done: Scaffold up/.test(l.text)), gone: !document.getElementById('evidOverlay'), rowText: document.getElementById('t5r-a1').innerText }; });
  R.ok(t2.gone && t2.embed.docId === 'd1' && t2.docs === 1, 'The H&S policy: files against the policy already on Documents, no new line');
  R.ok(t2.line === 'Health & Safety Policy, Section 7, Work at height', 'and names the section: ' + t2.line);
  R.ok(t2.how && !t2.stick, 'the line on how it was done is on the history, and nothing is left to ask');
  R.ok(/Lives in: Document - Health & Safety Policy/.test(t2.rowText), 'the row says where it lives now');
  await tick('a2', true);
  await answer('proc', { _embDocName: 'Harness safe system of work', _embDocPath: 'S:\\HS\\harness.pdf' }, '');
  R.ok(await page.evaluate(() => S.documents.some(d => d.name === 'Harness safe system of work')), 'A procedure or safe system of work: reaches the Documents register');
  // the last action under it: the group is in place
  const c = await act('c1');
  R.ok(c.status === 'Complete' && !!c.completedDate && c.t5Flip === 'Not started', 'the last action under a group done: it goes in place, on the back office\'s own record');
  R.ok(/^In place since /.test(await page.evaluate(() => document.getElementById('t5h-c1').innerText)), 'and the line over the group says so');
  await tick('a2', false);
  R.ok((await act('c1')).status === 'Not started' && (await act('a2')).status === 'In progress' && !(await act('a2')).completedDate, 'taking Done back puts both back, as they were');
  R.ok(/^Planned · /.test(await page.evaluate(() => document.getElementById('t5h-c1').innerText)), 'the line over the group follows');
  R.ok(!(await page.evaluate(() => !!document.getElementById('evidOverlay'))), 'and no panel opens for taking it back');
  await tick('a2', true);          // already says where it lives: no second question
  R.ok(!(await page.evaluate(() => !!document.getElementById('evidOverlay'))) && (await act('c1')).status === 'Complete', 'ticked again it is not asked twice');
  await tick('a4', true);
  await answer('train', { _embBrTitle: 'Roof safety talk', _embBrType: 'Toolbox talk' }, '');
  const pol = await page.evaluate(() => JSON.parse(JSON.stringify((S.policySignoff.policies || []).find(p => p.title === 'Roof safety talk') || null)));
  R.ok(pol && pol.type === 'Toolbox talk' && pol.riskIds.includes('r1'), 'Training or a toolbox talk: reaches the Sign-off register, tagged to the risk');
  await goRisk(1);
  await tick('a5', true);
  await page.evaluate(() => { const r = document.querySelector('#evidOverlay input[value="check"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); t5StickSave(); });
  R.ok(await page.evaluate(() => !!document.getElementById('evidOverlay')), 'A regular check asks how often before it files');
  await answer('check', { _embRtItem: 'Asbestos register check', _embRtFreq: 'Quarterly', _embRtOwner: 'Dan West' }, '');
  const item = await page.evaluate(() => { const s = (S.monitoring.regSections || []).find(x => /ongoing controls/i.test(x.name || '')); return s ? JSON.parse(JSON.stringify(s.items.find(i => i.item === 'Asbestos register check') || null)) : null; });
  R.ok(item && item.frequency === 'Quarterly' && /Owner: Dan West/.test(item.notes) && !!item.dueDate, 'A regular check: reaches the assurance register, how often and who, next due worked out');
  await tick('a6', true);
  await answer('person', { _embOwName: 'Eve Marsh', _embOwRole: 'Asbestos lead' }, '');
  R.ok(await page.evaluate(() => S.company.personnel.some(p => p.name === 'Eve Marsh' && p.role === 'Asbestos lead')), 'A named person: reaches Company personnel');
  await goRisk(2);
  await tick('a7', true);
  await answer('none', {}, '');
  R.ok((await act('a7')).embed.none === true, 'Nothing ongoing: recorded as a one-off');
  await wait(page, 450);
  // every action on that risk is closed: the re-score offer, left as it is, comes up over the front door
  const offered = await page.evaluate(() => !!document.getElementById('rescoreOverlay'));
  R.ok(offered, 'a risk\'s plan delivered: the existing re-score offer comes up on top');
  await page.evaluate(() => { document.getElementById('rescoreL').value = '2'; document.getElementById('rescoreS').value = '5'; _saveRescore('r3'); });
  R.ok(/10/.test(await page.evaluate(() => document.querySelector('.t5-tile').innerText)), 'and the front door reads the new score');
  // Later: done stands, the question waits
  await goRisk(3);
  await tick('a8', true);
  await page.evaluate(() => { document.getElementById('t5StickHow').value = 'All licences seen'; t5StickLater(); });
  // its only action done: "Is this issue now under control?" comes up over the meeting (Stage A); Not yet logs why and goes
  await wait(page, 450);
  const nc = await page.evaluate(() => { const o = !!document.getElementById('rescoreOverlay'); if (o) { document.getElementById('rescoreWhy').value = 'Insurance renewal still to check'; rsNotYet('r4'); } return { o, gone: !document.getElementById('rescoreOverlay'), log: (S.riskProfile.find(r => r.id === 'r4').log || []).map(l => l.text).join() }; });
  R.ok(nc.o && nc.gone && /Not yet under control: Insurance renewal/.test(nc.log), 'the last item on a risk done from the meeting: the under-control question comes up; Not yet logs why and goes');
  const a8 = await act('a8');
  R.ok(a8.status === 'Complete' && !!a8.stickDue && !a8.embed && a8.log.some(l => /How it was done: All licences seen/.test(l.text)), 'Later: done stands, and it is flagged');
  const s = await page.evaluate(() => ({ strip: (document.querySelector('.t5-strip-stick') || {}).innerText || '', ask: /Where does this live now/.test(document.getElementById('t5r-a8').innerText) }));
  R.ok(/still to be confirmed \(1\)/.test(s.strip) && s.strip.includes(REF.r4) && s.ask, 'it is flagged on the sheet, and the row keeps the question');
}

// ── Send: the record, the PDF and the email ──
{
  const noteMissing = await page.evaluate(() => (document.querySelector('.t5-strip:not(.t5-strip-stick):not(.t5-strip-add)') || {}).innerText || '');
  R.ok(noteMissing.includes(REF.r6) && /takes that tick off/.test(noteMissing), 'a ladder tick not on this sheet is named before Send clears it');
  await page.evaluate(() => { window.__draw = []; });
  await page.evaluate(() => document.getElementById('t5SendBtn').click());
  await page.waitForFunction('window.__saved && window.__saved.length >= 1', { timeout: 20000 });
  await wait(page, 200);
  const list = await sheets(), s2 = list.find(x => x.no === 2), s1 = list.find(x => x.no === 1), meet = day(-1);
  R.ok(list.length === 2 && !!s2 && s2.meetingDate === meet && s2.issuedAt === meet && s2.firstIssue === day(-29), 'Send freezes it as sheet 2, dated with the meeting date');
  R.ok(await page.evaluate(() => !S.actionSheets.working), 'the working copy is finished with');
  const rows = s2.items.flatMap(i => i.sentRows.filter(x => !x.head));
  const r1 = rows.find(x => x.aid === 'a1'), r8 = rows.find(x => x.aid === 'a8'), r3 = rows.find(x => x.aid === 'a3');
  R.ok(r1 && r1.a.status === 'Complete' && r1.cmt === 'Scaffold firm booked for the loading bay', 'what was done in the meeting stays on the sheet, status current, comment printed');
  R.ok(r3 && r3.who === 'Ben Cole, Jo Bloggs' && r3.due === day(40), 'the rows are as agreed: owner and date');
  R.ok(r8 && /to be confirmed/.test(r8.stick), 'done with where it lives still to be confirmed is flagged on the sheet');
  const f = await fieldsOf(0);
  R.ok(f.name === 'top-5-action-sheet-2-testing-client-ltd-' + meet + '.pdf', 'the PDF downloads, named for the meeting: ' + f.name);
  const n = s2.items.findIndex(i => i.ref.a === 'r1') + 1, k = rows.filter(x => s2.items[n - 1].sentRows.includes && 1) && s2.items[n - 1].sentRows.filter(x => !x.head).findIndex(x => x.aid === 'a3') + 1;
  R.ok(f.out['as_' + n + '_r' + k + '_who'] === 'Ben Cole, Jo Bloggs' && f.out['as_' + n + '_r' + k + '_due'] === dmy(day(40)), 'its boxes hold the agreed owner and date');
  const k1 = s2.items[n - 1].sentRows.filter(x => !x.head).findIndex(x => x.aid === 'a1') + 1;
  R.ok(f.out['as_' + n + '_r' + k1 + '_cmt'] === 'Scaffold firm booked for the loading bay', 'and the comments made in the meeting');
  const draw = await page.evaluate(() => window.__draw.join('\n'));
  const fm = d => page.evaluate(d => fmtDate(d), d);
  R.ok(draw.includes('Issued ' + await fm(day(-29)) + ' · Reviewed at SLT meeting ' + await fm(meet)), 'fix 1: the cover shows the first issue and the meeting');
  R.ok(draw.includes('TOP 5 ACTION SHEET 2    ' + (await fm(meet)).toUpperCase()), 'fix 1: every page header carries the meeting date');
  R.ok(!draw.includes(await fm(day(0))) || (await fm(day(0))) === (await fm(meet)) || !new RegExp('Issued ' + await fm(day(0))).test(draw), 'fix 1: not the day it was downloaded');
  R.ok(/Planned · Ben Cole, Jo Bloggs · by /.test(draw) && !/Old Owner/.test(draw), 'fix 2: the grey lines carry the agreed owner and date, never the old ones');
  R.ok(/In place since /.test(draw), 'fix 2: or In place since the day it was done');
  R.ok(/Complete · High/.test(draw) && /Lives in: Document - Health & Safety Policy/.test(draw), 'fix 5: the status under the action is the status after the meeting');
  const href = await page.evaluate(() => window.__links[0]);
  const to = decodeURIComponent(href.slice(7, href.indexOf('?'))).split(',').sort().join();
  const q = new URLSearchParams(href.slice(href.indexOf('?') + 1).replace(/\+/g, '%2B'));
  R.ok(to === SLT.map(p => p.email).sort().join(), 'the email opens to all four of the leadership team');
  R.ok(q.get('subject') === 'Top 5 action sheet 2 - Testing Client Ltd - SLT meeting ' + await fm(meet), 'subject pre-written: ' + q.get('subject'));
  R.ok(/record of the senior leadership team meeting held on/.test(q.get('body')) && q.get('body').includes(REF.r1 + ' Falls from roofs'), 'body pre-written, in a formal register');
  const shown = await page.evaluate(() => document.getElementById('t5Ov').innerText);
  R.ok(/Attach the PDF in Outlook/.test(shown) && /Ann Reed/.test(shown) && !/control/i.test(shown), 'the screen says what to do next');
  // earlier lines, the ladder
  const one = s1.items.map(i => i.ref.b + ':' + i.decision).join();
  R.ok(s1.items.every(i => i.decision), 'sheet 1\'s lines read as what the meeting did with them, so an action is on one live sheet (' + one + ')');
  const ticks = await page.evaluate(m => ({ ticked: _top5List(m).map(a => a.ref.a).sort().join(), r6: _top5List(m).some(a => a.ref.a === 'r6') }), meet.slice(0, 7));
  R.ok(!ticks.r6, 'Send sets the month\'s ladder ticks to the sheet: the odd tick is off');
  const five = await page.evaluate(m => S.actionSheets.list.find(s => s.no === 2).items.map(i => ({ r: i.ref.a, o: _execOrigin(i.ref) })).filter(x => x.o && !_actClosed(x.o)).map(x => x.r).sort().join(), 0);
  R.ok(ticks.ticked === five, 'and the ladder shows the sheet\'s open risks (' + five + ')');
  R.ok(await page.evaluate(() => { openActionSheets('top5'); const t = document.getElementById('asOv').innerText, none = !document.querySelector('#asOv [onclick^="asDeleteSheet"]'); closeActionSheets(); return /Sheet 2/.test(t) && none; }), 'on the back office screen sheet 2 is a record: it cannot be deleted or rebuilt');
}

// ── the sheet as sent does not change, and it comes down again as sent ──
{
  await page.evaluate(() => { updateRiskAction('r1', 'a3', 'owner', 'Somebody Else'); });
  await page.evaluate(async () => { const s = S.actionSheets.list.find(x => x.no === 2); await t5TrailPdf(s.id); });
  await page.waitForFunction('window.__saved.length >= 2');
  const f = await fieldsOf(1), s2 = (await sheets()).find(x => x.no === 2), n = s2.items.findIndex(i => i.ref.a === 'r1') + 1, k = s2.items[n - 1].sentRows.filter(x => !x.head).findIndex(x => x.aid === 'a3') + 1;
  R.ok(f.out['as_' + n + '_r' + k + '_who'] === 'Ben Cole, Jo Bloggs', 'a sheet downloaded again reads exactly as it was sent');
  await page.evaluate(async () => { const s = S.actionSheets.list.find(x => x.no === 2), was = s.issuedAt; await downloadActionSheet(s.id); window.__keptIssued = s.issuedAt === was; });
  R.ok(await page.evaluate(() => window.__keptIssued), 'and downloading it from the back office keeps its date');
  await page.evaluate(() => { updateRiskAction('r1', 'a3', 'owner', 'Ben Cole, Jo Bloggs'); });
}

// ── the next meeting opens from the sent sheet ──
{
  const t = await page.evaluate(() => { closeLiveTop5(); openLiveTop5(); const w = S.actionSheets.working, base = _asSheet(w.baseId);
    return { baseNo: base.no, list: S.actionSheets.list.length, risks: w.items.map(i => i.ref.a).join(), comment: (document.getElementById('t5c-a3') || {}).value, a1Row: !!document.getElementById('t5r-a1'), meet: document.getElementById('t5Meet').value, strip: (document.querySelector('.t5-strip-stick') || {}).innerText || '', add: (document.querySelector('.t5-strip-add') || {}).innerText || '', trail: (document.querySelector('.t5-trail') || {}).innerText || '' }; });
  R.ok(t.baseNo === 2 && t.list === 2, 'it starts from sheet 2, and still no new number');
  R.ok(!t.a1Row, 'what was already done on the last sheet has dropped off the table');
  R.ok(!t.risks.includes('r2') && !t.risks.includes('r3') && !t.risks.includes('r4'), 'a risk with everything done is not carried: ' + t.risks);
  R.ok(t.risks.includes('r1') && t.risks.includes('r5'), 'everything still open is');
  R.ok(/still to be confirmed \(1\)/.test(t.strip) && t.strip.includes(REF.r4), 'done on a risk that has left the sheet: still asked about');
  R.ok(/Suggested for this month \(\d\)/.test(t.add) && /Highest open risk/.test(t.add) && t.add.includes('Add') && t.risks.split(',').length === 2, 'the next risk is suggested with its reason, not added: ' + t.add.replace(/\s+/g, ' ').slice(0, 90));
  R.ok(t.meet === day(0), 'the new meeting is dated today until you say otherwise');
  R.ok(/Sheet 1, /.test(t.trail) && /Sheet 2, /.test(t.trail), 'the sheets as sent are a trail: ' + t.trail);
  await page.evaluate(() => { const b = document.querySelector('.t5-strip-add .btn'); b.click(); });
  const after = await page.evaluate(() => ({ risks: S.actionSheets.working.items.map(i => i.ref.a).join(), at: _t5At, n: document.querySelectorAll('.t5-nb').length }));
  R.ok(after.n === 3 && after.at === 2 && after.risks.split(',').length === 3, 'pressing Add puts it on the sheet and goes to it');
  await page.evaluate(() => { document.getElementById('t5Ov').querySelector('.t5-off').click(); });
  R.ok((await page.evaluate(() => S.actionSheets.working.items.length)) === 2, 'and a risk can be taken off again, its actions staying on the plan');
  const fp = await page.evaluate(async () => { document.querySelector('.t5-strip-stick .t5-link').click(); const p = !!document.querySelector('#evidOverlay.t5-stick-ov'); document.querySelector('#evidOverlay input[value="none"]').click(); t5StickSave(); return { p, left: _t5StickList().length, stuck: !document.querySelector('.t5-strip-stick') }; });
  R.ok(fp.p && fp.left === 0 && fp.stuck, 'answering it clears the flag');
  await page.evaluate(() => closeLiveTop5());
}

// ── read only: looked at, never written ──
{
  const t = await page.evaluate(() => {
    const saved = JSON.stringify(S.actionSheets);
    const was = [_consultantView, _consultantEdit];
    _consultantView = { name: 'Testing Client Ltd' }; _consultantEdit = false;
    openLiveTop5();
    const ov = document.getElementById('t5Ov'), boxes = [...ov.querySelectorAll('textarea,input[type=date],input[type=checkbox]')];
    const res = { allOff: boxes.length > 0 && boxes.every(b => b.disabled), noSend: !document.getElementById('t5SendBtn'), add: !ov.querySelector('.t5-newr'), ro: /Read only/.test(ov.innerText) };
    t5Due(0, 'a3', '2030-01-01'); t5Comment(0, 'a3', 'x'); t5Done(0, 'a3', true);
    res.unwritten = S.riskProfile[0].actions.find(a => a.id === 'a3').due !== '2030-01-01' && S.riskProfile[0].actions.find(a => a.id === 'a3').status !== 'Complete';
    res.same = JSON.stringify(S.actionSheets) === saved;
    closeLiveTop5();
    _consultantView = was[0]; _consultantEdit = was[1];
    return res;
  });
  R.ok(t.allOff && t.noSend && t.add && t.ro, 'a read-only client: every box off, no Send, no add');
  R.ok(t.unwritten && t.same, 'every write goes through the read-only guard');
  const v = await page.evaluate(() => { const was = _viewMode, b = document.getElementById('t5Btn'), out = {}; _viewMode = 'management'; applyViewMode(); out.client = b.style.display; _viewMode = 'employee'; applyViewMode(); out.emp = b.style.display; _viewMode = was; applyViewMode(); out.cons = b.style.display; return out; });
  R.ok(v.client === 'none' && v.emp === 'none' && v.cons !== 'none', 'the button is the consultant\'s: off in the client and employee views');
}

// ── the first meeting of all: no sheet yet ──
{
  await seed(page, { riskProfile: risks(), company: { tradingName: 'Testing Client Ltd', slt: [] } }, 'cockpit');
  await injectCatch();
  const t = await page.evaluate(async () => { delete S.actionSheets; openLiveTop5(); const w = S.actionSheets.working; const n = w.items.length, ids = new Set(w.items.map(i => i.ref.a)).size, list = S.actionSheets.list.length;
    await t5Send(); const s = S.actionSheets.list[0]; return { n, ids, list, no: s.no, first: s.firstIssue, shown: document.getElementById('t5Ov').innerText, href: window.__links[0] }; });
  R.ok(t.n === 5 && t.ids === 5 && t.list === 0, 'no sheet yet: the Top 5 from the ladder, one risk a screen, no sheet until Send');
  R.ok(t.no === 1 && t.first === '', 'Send makes it sheet 1');
  R.ok(/No leadership team recorded yet/.test(t.shown) && t.href.startsWith('mailto:?'), 'with no leadership team recorded it says where to add them, and the email still opens');
  await page.evaluate(() => closeLiveTop5());
}

// ── the sheet fixes on a returned sheet: Agreed writes to the action, and "Complete" in a date box closes it ──
{
  await seed(page, { riskProfile: risks().slice(0, 5), company: { tradingName: 'Testing Client Ltd', slt: SLT } }, 'cockpit');
  await injectCatch();
  await page.evaluate(() => { delete S.actionSheets; });
  // back through the old route, the way a client still returns one
  const res = await page.evaluate(async d => {
    openActionSheets('top5'); asNewSheet();
    const s = S.actionSheets.list[0], i = s.items.findIndex(x => x.ref.a === 'r1'), n = i + 1;
    await downloadActionSheet(s.id);
    const f0 = window.__saved[window.__saved.length - 1], doc = await PDFLib.PDFDocument.load(await f0.blob.arrayBuffer(), { ignoreEncryption: true }), form = doc.getForm();
    const rowsPr = _asRowsAsPrinted(s.items[i]), kOf = id => rowsPr.findIndex(p => p.a === id) + 1;
    const put = (id, fld, v) => form.getTextField('as_' + n + '_r' + kOf(id) + '_' + fld).setText(v);
    put('a1', 'who', 'New Owner'); put('a1', 'due', d); put('a1', 'cmt', 'Moved to spring');
    put('a2', 'due', 'Complete'); put('a2', 'cmt', 'Bought');
    put('a3', 'due', 'done');
    const bytes = await doc.save();
    await _asImportFiles([new File([bytes], 'returned.pdf', { type: 'application/pdf' })]);
    const a = id => S.riskProfile[0].actions.find(x => x.id === id);
    const out = { a1Owner: a('a1').owner, a1Due: a('a1').due, a2Status: a('a2').status, a2Done: a('a2').completedDate, a2Stick: !!a('a2').stickDue, a3Status: a('a3').status, toast: (document.getElementById('toast') || {}).textContent || '', line: document.querySelector('#asOv .as-item') ? document.getElementById('asOv').innerText : '' };
    return { sid: s.id, key: s.items[i].key, i, out };
  }, '2027-03-31');
  R.ok(res.out.a2Status === 'Complete' && res.out.a2Done === new Date().toISOString().slice(0, 10) && res.out.a2Stick, 'fix 4: "Complete" in a date box closes the action on import, today, flagged for the next meeting');
  R.ok(res.out.a3Status === 'Complete', 'fix 4: and so does "done"');
  R.ok(/Marked complete on the sheet/.test(res.out.line) && !/date as written: Complete/.test(res.out.line), 'it reads as marked complete, not as a date that could not be read');
  R.ok(/marked complete on the sheet, so closed/.test(res.out.toast), 'the import says so, since everything else waits for a decision');
  R.ok(res.out.a1Owner === 'Ben Cole' && res.out.a1Due !== '2027-03-31', 'nothing else moved until the line is decided');
  const rd = await page.evaluate((sid, key, i) => {
    const b = [...document.getElementById('asI-' + sid + '-' + i).querySelectorAll('button')].find(x => /^Agreed$/.test(x.textContent.trim())); b.click();
    const a = id => S.riskProfile[0].actions.find(x => x.id === id);
    return { owner: a('a1').owner, due: a('a1').due, cmt: a('a1').meetingComment, log: a('a1').log.map(l => l.text), dec: S.actionSheets.list[0].items[i].decision };
  }, res.sid, res.key, res.i);
  R.ok(rd.dec === 'agreed' && rd.owner === 'New Owner' && rd.due === '2027-03-31', 'fix 3: Agreed writes the returned owner and date to the action');
  R.ok(rd.cmt === 'Moved to spring', 'and its comment becomes the action\'s latest, ready for the next meeting');
  const pdfAfter = await page.evaluate(async sid => {
    window.__draw = []; const f = S.actionSheets.list[0]; const s2 = { no: 99 }; window.__saved = [];
    const rows = _asSheetActRows(f.items.find(x => x.ref.a === 'r1')); return rows.filter(x => !x.head && x.aid === 'a1').map(x => x.who + '|' + x.due).join();
  }, res.sid);
  R.ok(pdfAfter === 'New Owner|2027-03-31', 'so a reprint shows the agreed owner and date');
  const un = await page.evaluate((sid, key) => { asUndo(sid, key); const a = S.riskProfile[0].actions.find(x => x.id === 'a1'); return { owner: a.owner, due: a.due, dec: S.actionSheets.list[0].items.find(i => i.key === key).decision }; }, res.sid, res.key);
  R.ok(un.dec === '' && un.owner === 'Ben Cole' && un.due !== '2027-03-31', 'Undo on the Agreed line puts the action back');
  const again = await page.evaluate((sid, i) => { const b = [...document.getElementById('asI-' + sid + '-' + i).querySelectorAll('button')].find(x => /^Agreed$/.test(x.textContent.trim())); b.click(); const a = S.riskProfile[0].actions.find(x => x.id === 'a1'); return a.owner + '|' + a.due; }, res.sid, res.i);
  R.ok(again === 'New Owner|2027-03-31', 'and Agreed again writes it again');
  await page.evaluate(() => closeActionSheets());
}

// ── a sheet sent with its comments on it comes back without them counted as replies ──
{
  await seed(page, { riskProfile: risks().slice(0, 5), company: { tradingName: 'Testing Client Ltd', slt: SLT } }, 'cockpit');
  await injectCatch();
  const t = await page.evaluate(async () => {
    delete S.actionSheets; openLiveTop5();
    const w = S.actionSheets.working, i = w.items.findIndex(x => x.ref.a === 'r1'); t5Go(i);
    t5Comment(i, 'a1', 'Printed comment');
    await t5Send();
    const s = S.actionSheets.list[0], n = s.items.findIndex(x => x.ref.a === 'r1') + 1;
    const doc = await PDFLib.PDFDocument.load(await window.__saved[0].blob.arrayBuffer(), { ignoreEncryption: true }), form = doc.getForm();
    const pr = s.items[n - 1].actRows, k = id => pr.findIndex(p => p.a === id) + 1;
    form.getTextField('as_' + n + '_r' + k('a2') + '_cmt').setText('A real reply');
    await _asImportFiles([new File([await doc.save()], 'back.pdf', { type: 'application/pdf' })]);
    const rows = s.items[n - 1].resp.rows;
    const out = { rows: rows.map(x => x.a + ':' + x.cmt) };
    closeLiveTop5();
    return out;
  });
  R.ok(t.rows.length === 1 && t.rows[0] === 'a2:A real reply', 'the comment we printed is not read back as a reply; the one they wrote is (' + t.rows.join() + ')');
}

await R.done(browser, errors);
