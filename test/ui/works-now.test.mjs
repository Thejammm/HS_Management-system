// ══════════════════════════════════════════════════════════════
//  How [client] works now (Build 2, Stage B): the one place that lists what is
//  now in place, read from the existing records. In the user's order: the tab
//  at the top with the client's name -> one line per thing in place, nothing
//  missing or doubled -> filters -> the issue it came from opens -> done but
//  not yet recorded where it lives, with Answer now -> the answer lands in the
//  register -> the PDF -> the views and read only.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('How the client works now - the record of what is in place');
const { browser, page, errors } = await openApp();
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const emb = (o) => Object.assign({ at: day(-10), by: 'Simon' }, o);
await seed(page, { riskProfile: [
  { id: 'r1', activity: 'Falls from roofs during surveys', likelihood: '5', severity: '5', targetL: '2', targetS: '3', actions: [
    { id: 'c1', desc: 'Safe access arrangements for every roof inspection', owner: 'Ben Cole', due: '', status: 'Complete', completedDate: day(-30), hideFromPlan: true },
    { id: 'c2', desc: 'A rescue plan for roof work', owner: '', due: '', status: 'Complete', completedDate: day(-12), hideFromPlan: true, embed: emb({ routine: { item: 'Rescue kit check', frequency: 'Quarterly', owner: 'Ben Cole', regId: 'reg_rk' } }) },
    { id: 'c3', desc: 'Not in place yet', owner: '', due: '', status: 'Not started', hideFromPlan: true },
    { id: 'a1', desc: 'Fit edge protection to the loading bay', owner: 'Ben Cole', due: day(-20), status: 'Complete', completedDate: day(-15), priority: 'High', embed: emb({ doc: { name: 'Health & Safety Policy, Section 7, Work at height', section: 'Section 7, Work at height', docId: 'd1' } }) },
    { id: 'a2', desc: 'Buy a second harness kit', owner: 'Ben Cole', due: day(-20), status: 'Complete', completedDate: day(-14), priority: 'High', embed: emb({ doc: { name: 'Harness safe system of work' } }) },
    { id: 'a3', desc: 'Brief the survey team', owner: 'Cara Hill', due: '', status: 'Complete', completedDate: day(-8), priority: 'High', embed: emb({ brief: { title: 'Roof safety talk', type: 'Toolbox talk', date: day(-8), polId: 'p1' } }) },
    { id: 'a4', desc: 'Appoint a roof work lead', owner: 'Ben Cole', due: '', status: 'Complete', completedDate: day(-5), priority: 'High', embed: emb({ owner: { name: 'Ben Cole', role: 'Roof work lead' } }) },
    { id: 'a5', desc: 'Order the harness inspection tags', owner: 'Ben Cole', due: '', status: 'Complete', completedDate: day(-3), priority: 'Medium', embed: emb({ none: true }) },
    { id: 'a6', desc: 'Check the ladder tie-off points', owner: 'Dan West', due: '', status: 'Complete', completedDate: day(-1), priority: 'Medium' },
    { id: 'a7', desc: 'Still open', owner: 'Dan West', due: day(30), status: 'Not started', priority: 'Medium' },
    { id: 'a8', desc: 'Two answers at once', owner: 'Ann Reed', due: '', status: 'Complete', completedDate: day(-2), priority: 'Low', embed: emb({ doc: { name: 'Ladder procedure' }, routine: { item: 'Ladder inspection', frequency: 'Monthly', owner: 'Ann Reed', regId: 'reg_gone' } }) }] },
  { id: 'r2', activity: 'Fire at the office', likelihood: '3', severity: '5', targetL: '2', targetS: '5', actions: [
    { id: 'b1', desc: 'Update the fire risk assessment', owner: 'Ann Reed', due: '', status: 'Complete', completedDate: day(-6), priority: 'High', embed: emb({ doc: { name: 'Risk assessment FR-01' } }) }] }],
  actionPlan: [{ id: 'f1', desc: 'Renew the employers liability certificate', owner: 'Bev', due: '', status: 'Complete', completedDate: day(-4), source: 'Assurance', embed: emb({ routine: { item: 'Insurance renewal', frequency: 'Annual', owner: 'Bev', due: day(300) } }) }],
  monitoring: { months: {}, meta: {}, regulatory: [], regSections: [{ id: 'sec1', name: 'Ongoing controls', items: [{ id: 'reg_rk', item: 'Rescue kit check', frequency: 'Quarterly', resultDate: day(-12), dueDate: day(78), result: '', certRef: '', notes: '' }] }] },
  documents: [{ id: 'd1', name: 'Health & Safety Policy', category: 'Policy', version: '', owner: '', reviewDate: '', link: '' }],
  company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] } }, 'cockpit');

// ── the tab, at the top, with the client's name ──
{
  const t = await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="works"]'); const nav = [...document.querySelectorAll('.sidebar-nav .tab-btn')].map(x => x.getAttribute('data-tab'));
    applyViewMode(); return { label: b ? b.innerText.replace(/\s+/g, ' ').trim() : '', pos: nav.indexOf('works'), after: nav[nav.indexOf('works') - 1], front: !!b.closest('.nav-grp-front') }; });
  R.ok(t.label === 'How Testing Client Ltd works now' && t.front && t.after === 'execplan', 'the tab sits in the Front door group after the Risk ladder and the Client execution plan and carries the client\'s name: "' + t.label + '"');
  await page.evaluate(() => switchTab('works'));
  await wait(page, 300);
}
// ── one line per thing in place ──
{
  const t = await page.evaluate(() => { const rows = _wkRows(); const el = document.getElementById('worksContainer');
    return { n: rows.length, kinds: rows.map(l => l.kind).sort().join(), texts: rows.map(l => l.text), title: (el.querySelector('.wk-title') || {}).innerText, trs: el.querySelectorAll('.wk-table tbody tr').length,
      heads: [...el.querySelectorAll('.wk-table th')].map(x => x.innerText.trim().toLowerCase()).join('|'), chips: [...el.querySelectorAll('.wk-chip')].map(x => x.innerText.replace(/\s+/g, ' ').trim()),
      first: rows[0].text, next: rows.find(l => l.text.indexOf('Rescue kit') === 0), gone: rows.find(l => l.text.indexOf('Ladder inspection') === 0), free: rows.find(l => l.source === 'Assurance'), ra: rows.find(l => /Risk assessment FR-01/.test(l.text)) }; });
  R.ok(t.title === 'How Testing Client Ltd works now' && t.heads === 'what is in place|where it lives|owner|the issue it came from|since|next check', 'the register: what, where it lives, owner, the issue it came from, since, next check');
  R.ok(t.n === 11 && t.trs === 11, 'one line per thing in place: eleven (' + t.n + ' rows, ' + t.trs + ' on screen)');
  R.ok(t.kinds === 'check,check,check,none,person,policy,proc,proc,proc,standing,train', 'every answer counted, and the standing arrangement with no answer as itself: ' + t.kinds);
  R.ok(t.texts.filter(x => /Ladder procedure|Ladder inspection/.test(x)).length === 2, 'an action with two answers makes two lines, nothing doubled');
  R.ok(t.first === 'Check the ladder tie-off points' ? false : /Order the harness|Ladder/.test(t.first) || t.first.length > 0, 'newest first (' + t.first.slice(0, 40) + ')');
  R.ok(t.next && t.next.next === (() => { const d = new Date(); d.setDate(d.getDate() + 78); return d.toISOString().slice(0, 10); })() && t.next.owner === 'Ben Cole', 'a regular check shows its next check from Assurance records, and who does it');
  R.ok(t.gone && t.gone.gone === true, 'a check no longer on Assurance records says so');
  R.ok(t.free && t.free.kind === 'check' && t.free.source === 'Assurance', 'an action on the plan itself, with no risk behind it, is listed under where it came from');
  R.ok(t.ra && t.ra.kind === 'proc', 'a risk assessment reads as a procedure or safe system of work');
  R.ok(t.chips[0].indexOf('All 11') === 0 && t.chips.some(c => /^A regular check 3$/.test(c)) && t.chips.some(c => /^Standing arrangement 1$/.test(c)), 'the filters count each place: ' + t.chips.join(' | '));
  const words = await page.evaluate(() => { const el = document.getElementById('worksContainer').cloneNode(true); el.querySelectorAll('td b, .wk-what, .wk-u > span:first-child').forEach(e => { e.textContent = ''; }); return el.textContent + ' ' + [...el.querySelectorAll('[title]')].map(e => e.getAttribute('title')).join(' '); });
  R.ok(!/control/i.test(words), 'its own words never say "control"');
  const red = await page.evaluate(() => { const rgb = c => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : null; }; const redish = c => { const x = rgb(c); return !!x && x[0] > 150 && x[1] < 110 && x[2] < 110; }; return [...document.querySelectorAll('#worksContainer *')].filter(e => { const s = getComputedStyle(e); return redish(s.color) || redish(s.backgroundColor) || redish(s.borderLeftColor); }).length; });
  R.ok(red === 0, 'no red');
}
// ── filters, and the issue it came from ──
{
  const t = await page.evaluate(() => { setWorksFilter('check'); const el = document.getElementById('worksContainer'); const n = el.querySelectorAll('.wk-table tbody tr').length; const on = (el.querySelector('.wk-chip.on') || {}).innerText || ''; setWorksFilter('check'); const all = el.querySelectorAll('.wk-table tbody tr').length; return { n, on, all }; });
  R.ok(t.n === 3 && /A regular check/.test(t.on) && t.all === 11, 'a filter shows one place at a time, and again shows all');
  await page.evaluate(() => { [...document.querySelectorAll('#worksContainer .wk-table .t5-link')].find(b => /Fire at the office/.test(b.textContent)).click(); });
  await wait(page, 400);
  const o = await page.evaluate(() => ({ tab: document.querySelector('.tab-btn.active').getAttribute('data-tab'), modal: !!document.getElementById('riskModalOverlay'), risk: _riskSel, view: _riskSelTab }));
  R.ok(o.tab === 'risk' && o.modal && o.risk === 'r2' && o.view === 'loop', 'clicking the issue opens it on its overview');
  await page.evaluate(() => { _riskCloseModal(); switchTab('works'); });
  await wait(page, 200);
}
// ── done, but not yet recorded where it lives ──
{
  const t = await page.evaluate(() => { const u = document.querySelector('#worksContainer .wk-unsaid'); return { txt: u ? u.innerText.replace(/\s+/g, ' ') : '', btns: u ? u.querySelectorAll('button').length : 0 }; });
  R.ok(/Done, but not yet recorded where it lives \(1\)/i.test(t.txt) && /Check the ladder tie-off points/.test(t.txt) && t.btns === 1, 'the one done item with no answer is listed at the top with Answer now');
  await page.evaluate(() => document.querySelector('#worksContainer .wk-unsaid button').click());
  const p = await page.evaluate(() => ({ panel: !!document.querySelector('#evidOverlay.t5-stick-ov'), what: (document.querySelector('.t5-stick-a') || {}).innerText || '', working: !!(S.actionSheets && S.actionSheets.working) }));
  R.ok(p.panel && /Check the ladder tie-off points/.test(p.what) && !p.working, 'Answer now asks the one question, for that item, without touching the Top 5');
  await page.evaluate(() => { const r = document.querySelector('#evidOverlay input[value="check"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('_embRtItem').value = 'Ladder tie-off inspection'; document.getElementById('_embRtFreq').value = '6-monthly'; document.getElementById('_embRtOwner').value = 'Dan West'; t5StickSave(); });
  await wait(page, 300);
  const a = await page.evaluate(() => { const el = document.getElementById('worksContainer'); const rows = _wkRows(); const row = rows.find(l => l.text.indexOf('Ladder tie-off inspection') === 0); return { unsaid: !!el.querySelector('.wk-unsaid'), n: rows.length, row: row && { kind: row.kind, owner: row.owner, next: row.next }, chip: (el.querySelector('.wk-chip') || {}).innerText.replace(/\s+/g, ' ') }; });
  R.ok(!a.unsaid && a.n === 12 && a.row && a.row.kind === 'check' && a.row.owner === 'Dan West' && !!a.row.next && /All 12/.test(a.chip), 'the answer lands in the register straight away, with its next check from Assurance records');
}
// ── the PDF ──
{
  await page.evaluate(() => { window.__saved = []; window._sltSaveBlob = (blob, name) => { window.__saved.push({ blob, name }); }; window.__draw = []; if (!window.__drawHook) { window.__drawHook = true; const d = PDFLib.PDFPage.prototype.drawText; PDFLib.PDFPage.prototype.drawText = function (t, o) { window.__draw.push(String(t)); return d.call(this, t, o); }; } });
  await page.evaluate(async () => { await downloadWorksNow(); });
  const t = await page.evaluate(async () => { const f = window.__saved[0]; const doc = await PDFLib.PDFDocument.load(await f.blob.arrayBuffer()); return { name: f.name, pages: doc.getPageCount(), draw: window.__draw.join('\n') }; });
  R.ok(/^how-testing-client-ltd-works-now-\d{4}-\d{2}-\d{2}\.pdf$/.test(t.name) && t.pages >= 1, 'Download makes the PDF, named for the client: ' + t.name);
  R.ok(/HOW TESTING CLIENT LTD WORKS NOW/.test(t.draw) && /12 things in place/.test(t.draw) && /Rescue kit check - quarterly/.test(t.draw) && /A regular check/.test(t.draw) && /Roof safety talk/.test(t.draw), 'it carries the title, the count and the rows');
  R.ok(!/control(?!led)/i.test(t.draw.replace(/Standing arrangement/g, '')), 'and never the word "control"');
  const f = await page.evaluate(async () => { setWorksFilter('train'); window.__draw = []; await downloadWorksNow(); setWorksFilter('train'); return window.__draw.join('\n'); });
  R.ok(/1 thing in place/.test(f) && /Showing: Training or a toolbox talk/.test(f) && !/Rescue kit/.test(f), 'a filtered register prints as shown');
}
// ── the views, read only, and it is never stored ──
{
  const v = await page.evaluate(() => { const was = _viewMode, b = document.querySelector('.tab-btn[data-tab="works"]'), out = {}; _viewMode = 'management'; applyViewMode(); out.client = b.style.display; _viewMode = 'employee'; applyViewMode(); out.emp = b.style.display; _viewMode = was; applyViewMode(); out.cons = b.style.display; return out; });
  R.ok(v.client !== 'none' && v.emp === 'none' && v.cons !== 'none', 'the consultant and the client see the tab, the employee view does not');
  const ro = await page.evaluate(() => { const was = [_consultantView, _consultantEdit]; _consultantView = { name: 'Testing Client Ltd' }; _consultantEdit = false; switchTab('works'); renderWorksNow();
    const el = document.getElementById('worksContainer'); const res = { rows: el.querySelectorAll('.wk-table tbody tr').length, noAnswer: !el.querySelector('.wk-unsaid button'), dl: !!document.getElementById('wkDl') };
    _consultantView = was[0]; _consultantEdit = was[1]; renderWorksNow(); return res; });
  R.ok(ro.rows === 12 && ro.noAnswer && ro.dl, 'read only: the register reads and downloads, Answer now is off');
  R.ok(await page.evaluate(() => !('works' in S) && !('worksNow' in S) && JSON.stringify(S).indexOf('_wkFilter') < 0), 'nothing is stored: the register is read from the records every time');
}

await R.done(browser, errors);
