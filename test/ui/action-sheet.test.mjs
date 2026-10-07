// ══════════════════════════════════════════════════════════════
//  Top 5 action sheet: five actions out with the recommended controls; the
//  leadership team's comments, who and by when come back against each of
//  the risk's open actions (imported, or keyed in from a paper copy), and a
//  decision on each line - agreed, compromise, client accepts the risk, or
//  carry.
//  Simon, 2026-10-07: the cover loses the name and role and reads like a
//  procedure, the five in their band colours; each page ends in a two-way
//  table - printed and not editable on the left, then the client's comments,
//  who and by when - and a comments box at the bottom that marries up with
//  the app when the sheet comes back. Sheets already sent (v1: a tick for
//  what happened) still come back, and can still be approved.
//  Later the same day, after seeing it live: "you have put the high level
//  control in the table to answer when it should be the action - frame it
//  the same as it is in the Action delegation & timescale modal view". The
//  table (v3) is the risk's open actions under the control each puts in
//  place, as tab 4 shows them - a gap row for a control nothing puts in place
//  yet - with who and by when printed from the plan, so a change comes back
//  as a change: Apply to the plan, Add to the action's history, or a new
//  action under the control. Sheets sent as the second form (v2: a row a
//  control) still come back exactly as they did.
//  Then: two lines on one risk - the risk's table prints once, on the first
//  line's page; a later line on that risk lists its own action alone, under a
//  note naming that page, so no row (a gap row above all) is answered twice.
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

// Small readers the steps share, put on the page once (and again after the reload).
const inject = () => page.evaluate(() => {
  // the buttons on one line of the sheet screen, by the decision they make or the words on them
  window.__line = (sid, i) => document.getElementById('asI-' + sid + '-' + i);
  window.__btn = (sid, i, test) => [...((__line(sid, i) || document.createElement('div')).querySelectorAll('button'))].find(b => test(b.textContent.trim(), b.getAttribute('onclick') || '')) || null;
  window.__decideBtn = (sid, i, k) => __btn(sid, i, (t, on) => new RegExp('asDecide\\([^)]*[\'"]' + k + '[\'"]').test(on));
  window.__addBtns = (sid, i) => [...((__line(sid, i) || document.createElement('div')).querySelectorAll('button'))].filter(b => /^[＋+]\s*Add to the plan under this control$/.test(b.textContent.trim()));
  // the buttons on the rows that came back (not the decision bar, the line's head or a decided line's Undo), by their words
  window.__rowBtns = (sid, i, re) => [...((__line(sid, i) || document.createElement('div')).querySelectorAll('button'))]
    .filter(b => !b.closest('.as-btns, .as-ih, .as-decided') && (typeof re === 'function' ? re(b.textContent.trim()) : re.test(b.textContent.trim())));
  // the paper-copy inputs on a v3 line: each row's comment / who / when, by the row and field asRowResp writes
  window.__rowIn = (sid, i) => {
    const el = __line(sid, i), out = { rows: {}, what: null }; if (!el) return out;
    el.querySelectorAll('input, textarea, select').forEach(x => {
      const h = ['oninput', 'onchange', 'onblur'].map(a => x.getAttribute(a) || '').join(' ');
      const m = /asRowResp\(\s*[^,]+,\s*[^,]+,\s*(\d+)\s*,\s*['"](\w+)['"]/.exec(h); if (!m) return;
      const k = +m[1], f = m[2];
      if (!k) { if (f === 'what') out.what = x; return; }
      const r = out.rows[k] = out.rows[k] || {};
      r[/^(due|dueText|date|when)$/.test(f) ? 'due' : f] = x;
    });
    return out;
  };
  window.__respIn = (sid, i, f) => [...((__line(sid, i) || document.createElement('div')).querySelectorAll('input, textarea, select'))]
    .find(x => new RegExp('asResp\\([^)]*[\'"]' + f + '[\'"]').test(['oninput', 'onchange'].map(a => x.getAttribute(a) || '').join(' '))) || null;
  // the comments box on a paper copy: through asRowResp(..., 0, 'what'), asResp(..., 'what') or asCtlResp(..., 0, 'what') - any is the contract
  window.__whatIn = (sid, i) => __rowIn(sid, i).what || __respIn(sid, i, 'what') || [...((__line(sid, i) || document.createElement('div')).querySelectorAll('textarea'))]
    .find(x => /asCtlResp\([^)]*['"]what['"]/.test(x.getAttribute('oninput') || '')) || null;
  window.__put = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  // The sheet as built. pdf-lib cannot read text back, so what is drawn is
  // watched while it builds: every string (with its page, colour and place),
  // and every rectangle and line (for the band colours).
  window.__build = async sid => {
    const P = PDFLib.PDFPage.prototype, orig = { t: P.drawText, r: P.drawRectangle, l: P.drawLine };
    const said = [], marks = [], seen = [];
    const pg = p => { let i = seen.indexOf(p); if (i < 0) { seen.push(p); i = seen.length - 1; } return i; };
    const hex = c => (c && typeof c.red === 'number') ? [c.red, c.green, c.blue].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase() : '';
    P.drawText = function (s, o) { o = o || {}; said.push({ s: String(s), p: pg(this), c: hex(o.color), size: o.size || 0, x: o.x || 0, y: o.y || 0 }); return orig.t.call(this, s, o); };
    P.drawRectangle = function (o) { o = o || {}; marks.push({ k: 'r', p: pg(this), x: o.x || 0, y: o.y || 0, w: o.width || 0, h: o.height || 0, t: 0, c: hex(o.color) }); return orig.r.call(this, o); };
    P.drawLine = function (o) { o = o || {}; const a = o.start || {}, b = o.end || {};
      marks.push({ k: 'l', p: pg(this), x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y), t: o.thickness || 1, c: hex(o.color) }); return orig.l.call(this, o); };
    let bytes; try { bytes = await buildActionSheetPDF(sid); } finally { P.drawText = orig.t; P.drawRectangle = orig.r; P.drawLine = orig.l; }
    const doc = await PDFLib.PDFDocument.load(bytes), form = doc.getForm(), pages = doc.getPages();
    const names = form.getFields().map(f => f.getName());
    const pageOf = f => {
      const w = f.acroField.getWidgets()[0], at = w && w.P ? w.P() : null;
      if (at) { const i = pages.findIndex(p => String(p.ref) === String(at)); if (i >= 0) return i; }
      const kids = f.acroField.Kids ? f.acroField.Kids() : null, wr = String(kids && kids.size() ? kids.get(0) : f.ref);
      return pages.findIndex(p => { const an = p.node.Annots(); if (!an) return false; for (let k = 0; k < an.size(); k++) if (String(an.get(k)) === wr) return true; return false; });
    };
    const boxes = {};
    form.getFields().forEach(f => { const n = f.getName(); if (!/^as_/.test(n)) return;
      let text = ''; try { text = f.getText() || ''; } catch (e) {}
      try { const r = f.acroField.getWidgets()[0].getRectangle(); boxes[n] = { x: r.x, y: r.y, w: r.width, h: r.height, p: pageOf(f), multi: (typeof f.isMultiline === 'function') ? f.isMultiline() : null, text }; } catch (e) { boxes[n] = null; } });
    let meta = {}; try { meta = JSON.parse(form.getTextField('as__meta').getText()); } catch (e) {}
    let b = ''; bytes.forEach(x => { b += String.fromCharCode(x); });
    return { said, marks, names, boxes, meta, pages: pages.length, b64: btoa(b) };
  };
});
await inject();

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
  R.ok(!/Top 5 report/i.test(t.text), 'and its screen no longer points at a Top 5 report');
}

// ── the first five are the Top 5: the month's marks, then the Top 5's own ranking ──
await page.evaluate(() => asNewSheet());
await wait(page, 300);
let s1 = await sheet(1);
R.ok(s1 && s1.items.map(i => i.ref.b).join(',') === 'a3,a1,a5,a4,a2', 'the first five: one action a risk down the Top 5, then round again (' + (s1 && s1.items.map(i => i.ref.b).join(',')) + ')');
{
  const t = await page.evaluate(() => ({ five: _top5Five().map(f => f.z.id), lines: S.actionSheets.list[0].items.slice(0, 3).map(i => i.ref.a) }));
  R.ok(t.five.length === 3 && JSON.stringify(t.five) === JSON.stringify(t.lines), 'the sheet leads with the month’s Top 5 risks, in the Top 5’s own order (' + t.lines.join(',') + ')');
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

// ── the rows: the risk's open actions, under the control each puts in place (tab 4) ──
// r1 (lines 2 and 4) gets three controls, plus a deleted one and one with no
// words - neither of those is a control. Its two actions put two of them in
// place: the edge protection the guard rail, the rescue plan the harness
// training; nothing puts the access permit in place yet, so it gets a gap
// row. r2 and r3 have no controls: their rows are their open actions - the
// training taken off this sheet included (it is still open on the plan) and
// the speed signs, complete, left off. Lines 4 and 5 are the second lines on
// r1 and r3: each risk's table prints once, on its first line's page (2 and
// 3), and the later page lists its own action alone - the rescue plan, the
// banksman - under a note saying where the rest are.
const CTLS = [
  { id: 'c1', desc: 'Guard rail on the roof edge', owner: 'Dave', due: '', status: 'Complete', completedDate: day(-20), hideFromPlan: true },
  { id: 'c2', desc: 'Roof access permit', owner: 'Dave', due: day(30), status: 'Not started', hideFromPlan: true },
  { id: 'cx', desc: 'Ladder tied at the top', owner: '', due: '', status: 'Not started', hideFromPlan: true, deleted: true },
  { id: 'cb', desc: '   ', owner: '', due: '', status: 'Not started', hideFromPlan: true },
  { id: 'c3', desc: 'Harness training for roof work', owner: '', due: '', status: 'In progress', hideFromPlan: true }];
await page.evaluate(C => { const r1 = S.riskProfile.find(r => r.id === 'r1'); r1.actions.push(...C);
  r1.actions.find(a => a.id === 'a1').forCtl = 'c1'; r1.actions.find(a => a.id === 'a2').forCtl = 'c3'; _asRender(); }, CTLS);
// per line (r2, r1, r3, r1, r3): the action on each row (null: a gap row), the control it sits under, and the row of the line's own action
const ROWS = { 1: ['a3', 'a4'], 2: ['a1', null, 'a2'], 3: ['a5', 'a6'], 4: ['a2'], 5: ['a6'] };
const UNDER = { 1: [null, null], 2: ['c1', 'c2', 'c3'], 3: [null, null], 4: [null], 5: [null] };
const OWN = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
// a later line on a risk already on the sheet: the line whose page carries the risk's table
const FIRST = { 4: 2, 5: 3 };
const NOTE = n => 'FURTHER RECOMMENDED ACTIONS FOR THIS RISK ARE LISTED UNDER PRIORITY ' + n;
const dmy = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
const GAP = 'No action identified - please propose';      // one line in the action column

// ── the sheet itself ──
const pdfPath = path.join(os.tmpdir(), 'action-sheet-test.pdf');
const BAND = { Critical: 'DC2626', High: 'EA580C', Medium: 'F59E0B', Low: '16A34A' };
{
  const t = await page.evaluate(async sid => {
    const b = await __build(sid), s = _asSheet(sid);
    b.bands = s.items.map(it => { const r = _execRiskOf({ ref: it.ref }); return r ? (_riskScore(r).priority || '') : ''; });
    b.since = _pdfAscii(fmtDate(S.riskProfile.find(r => r.id === 'r1').actions.find(a => a.id === 'c1').completedDate));
    b.permitBy = _pdfAscii(fmtDate(S.riskProfile.find(r => r.id === 'r1').actions.find(a => a.id === 'c2').due));
    return b;
  }, s1.id);
  fs.writeFileSync(pdfPath, Buffer.from(t.b64, 'base64'));
  const S_ = t.said.map(x => x.s), U = x => String(x).trim().toUpperCase();
  const has = n => t.names.includes(n);
  const rowsOf = n => t.names.filter(x => new RegExp('^as_' + n + '_r\\d+_cmt$').test(x)).length;
  const per = n => has('as_' + n + '_what') && ROWS[n].every((a, k) => ['cmt', 'who', 'due'].every(f => has('as_' + n + '_r' + (k + 1) + '_' + f))) && !has('as_' + n + '_r' + (ROWS[n].length + 1) + '_cmt');
  R.ok([1, 2, 3, 4, 5].every(per) && has('as__general'), 'each page has a comment, who and by when on every row of its table, and a comments box for the risk');
  R.ok(!has('as__name') && !has('as__role'), 'the cover no longer asks for a name or a role');
  R.ok(!t.names.some(n => /^as_\d+_(o_\w+|date|by)$/.test(n)), 'the what-happened ticks and the what was done / date done / by whom boxes are gone');
  R.ok(t.names.filter(n => /^as_\d+_/.test(n)).every(n => /^as_\d+_(r\d+_(cmt|who|due)|what)$/.test(n)), 'the action itself is printed, never a field - the only boxes are the client’s, a row an action (no control rows)');
  // tab 4's order: under each control its actions, a gap row for the permit - the deleted and the blank left off
  const mrows = n => ((t.meta.rows || [])[n - 1] || []);
  const order = n => ROWS[n].map((a, k) => t.boxes['as_' + n + '_r' + (k + 1) + '_cmt']).every((b, k, arr) => !!b && (k === 0 || arr[k - 1].p < b.p || (arr[k - 1].p === b.p && arr[k - 1].y > b.y)));
  const same = n => JSON.stringify(mrows(n).map(r => r.a || null)) === JSON.stringify(ROWS[n]) && JSON.stringify(mrows(n).map(r => r.c || null)) === JSON.stringify(UNDER[n]);
  R.ok(rowsOf(2) === 3 && order(2) && same(2),
    'a risk with controls: its open actions under the control each puts in place, in tab 4’s order, and a gap row for a control nothing puts in place yet (' + JSON.stringify((t.meta.rows || []).map(rs => rs.map(r => r.a || ('gap:' + r.c)))) + ')');
  R.ok([1, 3].every(n => rowsOf(n) === 2 && order(n) && same(n)), 'a risk with no controls: its open actions - one taken off the sheet is still a row on its risk’s page, a completed one is not');
  {
    // a later line on a risk already on the sheet: one row, its own action, under a note naming the first line's page
    const notes = t.said.filter(x => /^FURTHER RECOMMENDED ACTIONS FOR THIS RISK/.test(x.s.trim()));
    R.ok([4, 5].every(n => rowsOf(n) === 1 && same(n) && mrows(n).length === 1 && mrows(n)[0].a === ROWS[n][0]),
      'a later line on a risk already on the sheet lists its own action alone - the rescue plan on page 4, the banksman on page 5 - nothing printed twice (' + JSON.stringify([4, 5].map(mrows)) + ')');
    R.ok(notes.length === 2 && [4, 5].every(n => notes.filter(x => x.p === n && x.s.trim() === NOTE(FIRST[n])).length === 1),
      'its page says where the rest of the risk’s table is: ' + notes.map(x => x.p + ': ' + x.s.trim()).join(' | '));
  }
  R.ok(t.meta.v === 3 && !('ctls' in t.meta) && Array.isArray(t.meta.rows) && t.meta.rows.length === 5 && t.meta.sheet === s1.id && t.meta.no === 1 && (t.meta.keys || []).length === 5 && t.meta.kind === 'top5' && t.meta.client === 'Fairbank Fabrications Ltd' && !!t.meta.made,
    'it knows which client, which sheet, which lines and which action and control each row is (v3, no control rows)');
  // who and by when, printed from the plan into the boxes
  const PRE = { as_1_r1: ['Sam', day(10)], as_1_r2: ['', day(60)], as_2_r1: ['Dave', day(30)], as_2_r2: ['', ''], as_2_r3: ['', ''], as_3_r1: ['Dave', day(-5)], as_4_r1: ['', ''], as_5_r1: ['', day(20)] };
  R.ok(Object.keys(PRE).every(k => (t.boxes[k + '_who'] || {}).text === PRE[k][0] && (t.boxes[k + '_due'] || {}).text === dmy(PRE[k][1]) && (t.boxes[k + '_cmt'] || {}).text === '')
    && mrows(1)[0].who === 'Sam' && mrows(1)[0].due === day(10) && mrows(2)[1].who === '' && mrows(2)[1].due === '',
    'who and by when come filled in from the plan - the owner, and the due date as dd/mm/yyyy; a gap row is left blank');
  // a page an action, after a one-page cover; the comments box at the bottom of the risk's pages
  R.ok([1, 2, 3, 4, 5].every(n => (t.boxes['as_' + n + '_r1_cmt'] || {}).p === n) && t.pages >= 6 && t.pages <= 7, 'a cover, then a page an action that stands on its own (' + t.pages + ' pages)');
  const below = n => { const k = ROWS[n].length, last = t.boxes['as_' + n + '_r' + k + '_cmt'], w = t.boxes['as_' + n + '_what']; return !!last && !!w && w.p === last.p && w.y + w.h <= last.y + 1; };
  R.ok([1, 2, 3, 4, 5].every(below), 'the comments on the risk come at the bottom, under the table, on the same page');
  {
    const CW = 595.28 - 80, ML = 40, MR = 595.28 - 40, c = t.boxes.as_2_r1_cmt, w = t.boxes.as_2_r1_who, d = t.boxes.as_2_r1_due, k = t.boxes.as_2_what;
    const near = (v, lo, hi) => v >= lo && v <= hi;
    R.ok(!!c && !!w && !!d && near(c.x, ML + 0.35 * CW, ML + 0.45 * CW) && c.x < w.x && w.x < d.x && d.x + d.w <= MR + 1.5 && near(c.w, 0.25 * CW, 0.35 * CW) && near(w.w, 0.10 * CW, 0.20 * CW) && near(d.w, 0.10 * CW, 0.20 * CW) && c.multi === true,
      'the columns: the action (printed, about 40%) on the left, then comments (about 30%, several lines), who and by when (about 15% each)');
    R.ok(!!k && k.w >= 0.9 * CW && near(k.h, 38, 80) && k.multi === true, 'the comments box runs the full width, several lines');
  }
  // what is printed
  const iOf = test => S_.findIndex(test);
  const iP = iOf(x => U(x) === 'PURPOSE'), iG = iOf(x => /^SUMMARY OF (PRIORITY )?RISKS$/.test(U(x))), iW = iOf(x => U(x) === 'RESPONSE REQUIRED'), iH = iOf(x => U(x) === 'RISK RATING KEY'), iT = iOf(x => U(x) === 'RECOMMENDED ACTIONS');
  R.ok(iP >= 0 && iP < iG && iG < iW && iW < iH && iH < iT, 'the cover reads like a procedure: Purpose, Summary of priority risks, Response required, Risk rating key');
  const all = S_.join(' ');
  R.ok(['first priority for resource', 'never run on acceptance alone', 'must never sit at 1', 'managed with routine precautions'].every(p => new RegExp(p.replace(/ /g, '\\s+'), 'i').test(all))
    && ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].every(b => all.toUpperCase().indexOf(b) >= 0) && ['16-25', '10-15', '5-9', '1-4'].every(r => all.indexOf(r) >= 0),
    'how to read the scores: the four bands with their ranges, in the risk ladder’s own words');
  R.ok(!S_.some(x => /in place today/i.test(x)) && !S_.some(x => /what happened/i.test(x)), '"In place today" and "What happened" are gone from the sheet');
  R.ok(S_.filter(x => U(x) === 'RECOMMENDED ACTIONS').length >= 5 && S_.filter(x => U(x) === 'FURTHER COMMENTS').length >= 5
    && ['RECOMMENDED ACTION', 'COMMENTS', 'OWNER'].every(h => S_.some(x => U(x) === h)) && S_.some(x => /^TARGET DATE/.test(U(x))) && S_.some(x => /dd\/mm\/yyyy/i.test(x))
    && S_.filter(x => x.trim() === 'Proposed owner and target date shown - amend where required').length >= 5,
    'every page has Recommended actions (Action, Comments, Who, By when), with who and when from the plan, and Further comments');
  R.ok(!S_.some(x => U(x) === 'YOUR CONTROLS - TELL US WHAT YOU THINK') && !S_.some(x => /The controls are printed - write against each one/.test(x)), 'the controls table is gone');
  const onPage = p => t.said.filter(x => x.p === p).map(x => x.s).join(' ').replace(/\s+/g, ' ');
  R.ok(['Fit edge protection to the loading bay roof', 'Write a rescue plan for harness work'].every(d => onPage(2).indexOf(d) >= 0)
    && onPage(4).indexOf('Write a rescue plan for harness work') >= 0 && onPage(4).indexOf('Fit edge protection to the loading bay roof') < 0
    && ['Mark pedestrian walkways in the yard', 'Banksman for reversing HGVs'].every(d => onPage(3).indexOf(d) >= 0)
    && onPage(5).indexOf('Banksman for reversing HGVs') >= 0 && onPage(5).indexOf('Mark pedestrian walkways in the yard') < 0
    && ['Buy a pallet truck for the stores', 'Manual handling training for stores staff'].every(d => onPage(1).indexOf(d) >= 0) && onPage(3).indexOf('Speed limit signs at the gate') < 0,
    'each row prints the action itself - on r1’s first page both its actions, on r2’s the training taken off this sheet too, and a later page on r1 or r3 its own action alone; the completed speed signs are not printed');
  R.ok(CTLS.filter(c => !c.deleted && c.desc.trim()).every(c => onPage(2).indexOf(c.desc) >= 0 && onPage(4).indexOf(c.desc) < 0) && !S_.some(x => x.indexOf('Ladder tied at the top') >= 0)
    && t.said.filter(x => x.p === 2 && /^CONTROL \d+\b/.test(x.s.trim())).length === 3 && [1, 3, 4, 5].every(p => !t.said.some(x => x.p === p && /^CONTROL \d+\b/.test(x.s.trim()))),
    'on r1’s first page each control heads the actions that put it in place - CONTROL k and its words, the deleted one not printed; r2 and r3 have no headings, and r1’s later page no controls at all');
  R.ok(S_.some(x => /^In place since /.test(x) && x.indexOf(t.since) >= 0) && S_.some(x => /^Planned\b/.test(x) && /Dave/.test(x) && x.indexOf('by ' + t.permitBy) >= 0), 'under each control, whether it is in place (since when) or planned (who, by when) - as tab 4 heads it');
  R.ok(onPage(2).indexOf(GAP) >= 0 && [1, 3, 4, 5].every(p => onPage(p).indexOf('No action yet') < 0), 'the permit, with nothing to put it in place, gets a gap row - once, on r1’s first page: ' + GAP);
  {
    // the line's own action is tagged in its row
    const tag = n => { const own = t.boxes['as_' + n + '_r' + OWN[n] + '_cmt'], tg = t.said.filter(x => x.p === n && x.s.trim() === 'PRIORITY');
      return tg.length === 1 && !!own && tg[0].y >= own.y - 3 && tg[0].y <= own.y + own.h + 3 && tg[0].x < own.x; };
    R.ok([1, 2, 3, 4, 5].every(tag), 'the line’s own action carries PRIORITY in its row - the edge protection on page 2, the rescue plan on page 4');
  }
  R.ok([1, 2, 3, 4, 5].every(n => t.said.some(x => x.p === n && new RegExp('^PRIORITY ' + n + ' OF 5\\b').test(x.s.trim()))), 'each page is headed PRIORITY n OF 5');
  // the colour that shows each risk's level
  {
    const cov = t.said.filter(x => x.p === 0), yOf = test => (cov.find(x => test(U(x.s))) || {}).y;
    const yG = yOf(x => /^SUMMARY OF (PRIORITY )?RISKS$/.test(x)), yW = yOf(x => x === 'RESPONSE REQUIRED');
    const glance = cov.filter(x => yG != null && yW != null && x.y < yG && x.y > yW);
    const num = n => glance.find(x => new RegExp('^0?' + n + '\\.?$').test(x.s.trim())) || {};
    const want = t.bands.map(b => BAND[b] || '');
    R.ok([1, 2, 3, 4].every(n => num(n).c === want[n - 1]), 'at a glance, each row’s number is in its band’s colour (' + [1, 2, 3, 4].map(n => num(n).c).join(',') + ' / ' + want.slice(0, 4).join(',') + ')');
    const bars = t.marks.filter(m => m.p === 0 && m.y < yG && m.y + m.h > yW && m.h >= 16 && ((m.k === 'r' && m.w >= 2.5 && m.w <= 6) || (m.k === 'l' && m.w < 0.5 && m.t >= 2.5 && m.t <= 6)) && Object.values(BAND).includes(m.c))
      .sort((a, b) => b.y - a.y).map(m => m.c);
    R.ok(bars.length >= 5 && want.every((c, i) => bars[i] === c), 'and a bar in its band’s colour down each row’s left edge (' + bars.join(',') + ')');
    const pg2 = t.said.filter(x => x.p === 2), yT = (pg2.find(x => U(x.s) === 'RECOMMENDED ACTIONS') || {}).y, yC = (pg2.find(x => U(x.s) === 'FURTHER COMMENTS') || {}).y;
    const rule = t.marks.some(m => m.p === 2 && m.c === BAND[t.bands[1]] && m.h >= 30 && ((m.k === 'r' && m.w >= 1.5 && m.w <= 4.5) || (m.k === 'l' && m.w < 0.5 && m.t >= 1.5 && m.t <= 4.5)) && yT != null && yC != null && m.y + m.h <= yT + 2 && m.y >= yC - 2);
    R.ok(rule, 'the actions table carries the risk’s band colour down its left edge');
  }
}
{
  // the draft screen says so on each later line on a risk already on the sheet
  const t = await page.evaluate(sid => [0, 1, 2, 3, 4].map(i => { const m = /Same risk as line (\d+): its actions table prints once, on that line.s page\. This page lists this action only\./i.exec((__line(sid, i) || {}).innerText || ''); return m ? +m[1] : 0; }), s1.id);
  R.ok(t.join(',') === '0,0,0,2,3', 'the draft screen warns on a later line on the same risk, naming the line whose page carries the table - line 4 on line 2, line 5 on line 3 (' + t.join(',') + ')');
}
await page.evaluate(sid => downloadActionSheet(sid), s1.id);
await wait(page, 500);
R.ok(/With the client since/.test(await page.evaluate(() => _asSheetStatus(S.actionSheets.list[0]).label)), 'downloading it marks the sheet as with the client');

// ── what is refused on the way back ──
const fill = (answers, edit) => page.evaluate(async (sid, answers, edit) => {
  const bytes = await buildActionSheetPDF(sid);
  const doc = await PDFLib.PDFDocument.load(bytes); const form = doc.getForm(), missing = [];
  Object.keys(answers).forEach(k => { try { form.getTextField(k).setText(answers[k]); } catch (e) { missing.push(k); } });
  if (missing.length) return 'NOT ON THE SHEET: ' + missing.join(', ');
  if (edit === 'other') { const m = JSON.parse(form.getTextField('as__meta').getText()); m.client = 'Other Co Ltd'; form.getTextField('as__meta').enableReadOnly(false); form.getTextField('as__meta').setText(JSON.stringify(m)); }
  if (edit === 'flat') form.flatten();
  window.__lastCopy = await doc.save();       // the copy as sent back, to import again later
  await _asImportFiles([new File([window.__lastCopy], (edit || 'returned') + '.pdf', { type: 'application/pdf' })]);
  return document.getElementById('toast').textContent;
}, s1.id, answers, edit || '');
{
  const other = await fill({ as_1_r1_cmt: 'Fine by us.' }, 'other');
  const flat = await fill({ as_1_r1_cmt: 'Fine by us.' }, 'flat');
  const blank = await fill({});
  R.ok(/this sheet is for Other Co Ltd, not Fairbank Fabrications Ltd/.test(other), 'another client’s sheet is refused, with the reason');
  R.ok(/boxes may have been flattened/.test(flat) && /enter the answers by hand/.test(flat), 'a flattened sheet is refused, and says the answers can be entered by hand');
  R.ok(/nothing filled in/.test(blank), 'a sheet returned blank - who and by when left as printed - is refused');
  R.ok(await page.evaluate(() => S.actionSheets.list[0].items.every(i => !_asHasResp(i) && !((i.resp || {}).rows || []).length && !((i.resp || {}).ctls || []).length)), 'and none of those changed anything');
}

// ── the leadership team's comments come back, against each action ──
// Who and by when were printed from the plan: a box left as printed is no
// change; one written over is. The dates are years out, so they never meet
// the plan's own.
const ANSWERS = {
  as_1_r1_cmt: 'Bought and in use. On the pre-use check sheet.', as_1_r1_due: '12/10/2030', as_1_what: 'The stores are clear now.',
  as_1_r2_cmt: 'Training booked for November.',
  as_2_r1_cmt: 'The landlord will not allow fixings into the roof.', as_2_r1_who: 'Dave Morley', as_2_r1_due: '9 Oct 2030',
  as_2_r2_cmt: 'Agreed - book it with the access contractor.', as_2_r2_who: 'Dave', as_2_r2_due: 'end of Nov',
  as_2_r3_cmt: 'Rescue plan is with the insurer.',
  as_2_what: 'Budget is tight for the roof this year.',
  as_3_what: 'Waiting for the line-marking contractor.',
  as_4_r1_who: 'Dave Morley', as_4_r1_due: '31/10/2030',      // line 4's one row: the rescue plan, only who and by when
  as__general: 'Budget is tight until January.' };
const before = { a3: (await act('a3')).status, a1: (await act('a1')).status, a1o: (await act('a1')).owner, a1d: (await act('a1')).due, a2o: (await act('a2')).owner, a2d: (await act('a2')).due };
const order0 = await lineIds();
{
  const msg = await fill(ANSWERS);
  s1 = await sheet(1);
  const it = s1.items, c = n => ((it[n].resp || {}).rows || []);
  R.ok(/Sheet 1: 4 answers? in/.test(msg) && !/Not imported/.test(msg), 'the returned sheet imports - four lines answered, the fifth left as printed (' + msg.slice(0, 90) + ')');
  R.ok(c(0).length === 2 && c(0)[0].a === 'a3' && c(0)[0].c === null && c(0)[0].text === 'Buy a pallet truck for the stores' && c(0)[0].cmt === ANSWERS.as_1_r1_cmt && c(0)[0].who === 'Sam' && c(0)[0].whoChanged === false
    && c(0)[0].due === '2030-10-12' && c(0)[0].dueText === '12/10/2030' && c(0)[0].dueChanged === true && c(0)[0].gap === false && !c(0)[0].applied
    && c(0)[1].a === 'a4' && c(0)[1].cmt === 'Training booked for November.' && c(0)[1].whoChanged === false && c(0)[1].dueChanged === false
    && it[0].resp.what === 'The stores are clear now.' && !it[0].resp.outcome && !(it[0].resp.ctls || []).length,
    'each row comes back against its action: the comment, who and by when, and whether they differ from what was printed - a who left as printed is no change');
  R.ok(c(1).length === 3 && c(1).map(x => x.a || 'gap').join(',') === 'a1,gap,a2' && c(1).map(x => x.c || '-').join(',') === 'c1,c2,c3' && c(1)[0].text === 'Fit edge protection to the loading bay roof'
    && c(1)[0].whoChanged === true && c(1)[0].who === 'Dave Morley' && c(1)[1].gap === true && c(1)[1].cmt === ANSWERS.as_2_r2_cmt && c(1)[1].who === 'Dave' && c(1)[2].dueChanged === false && it[1].resp.what === ANSWERS.as_2_what,
    'each row keeps its action and the control it sits under; a gap row comes back as a gap under its control');
  R.ok(c(1).length === 3 && c(1)[0].due === '2030-10-09' && c(1)[0].dueChanged === true && c(1)[1].due === '' && c(1)[1].dueText === 'end of Nov' && c(1)[1].dueChanged === true, 'a date written as words is read, and one that cannot be read is kept as written');
  R.ok(c(2).length === 0 && it[2].resp.what === ANSWERS.as_3_what && c(3).length === 1
    && c(3)[0].a === 'a2' && c(3)[0].c === null && c(3)[0].gap === false && c(3)[0].cmt === '' && c(3)[0].who === 'Dave Morley' && c(3)[0].due === '2030-10-31' && c(3)[0].whoChanged && c(3)[0].dueChanged,
    'a comment on the risk alone counts, and so does a row with only who and by when changed - the rescue plan, the one row on r1’s later page');
  R.ok(await page.evaluate(() => [0, 1, 2, 3].every(i => _asHasResp(S.actionSheets.list[0].items[i])) && !_asHasResp(S.actionSheets.list[0].items[4])), 'four lines read as answered, the one left as printed does not');
  R.ok(s1.returnedBy === '' && s1.general === 'Budget is tight until January.' && !!s1.returnedAt, 'no name is needed to send it back; the general comment is kept');
  const a1 = await act('a1'), a2 = await act('a2');
  R.ok((await act('a3')).status === before.a3 && a1.status === before.a1 && a1.owner === before.a1o && a1.due === before.a1d && a2.owner === before.a2o && a2.due === before.a2d,
    'nothing changes on the plan when it comes in - not even who and by when - until it is applied or decided');
  R.ok(JSON.stringify(await lineIds()) === JSON.stringify(order0), 'the lines stay exactly where they were');
  R.ok(/5 to decide/.test(await page.evaluate(() => _asSheetStatus(S.actionSheets.list[0]).label)), 'the sheet reads 5 to decide');
}
{
  await fill(ANSWERS);
  const n = (await sheet(1)).items.map(i => ((i.resp || {}).rows || []).length).join(',');
  R.ok(n === '2,3,0,1,0', 'the same sheet imported again replaces what came back - never two copies (' + n + ')');
}

// ── the review: what came back, against each action ──
const rx = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lc = s => String(s || '').toLowerCase();
{
  const t = await page.evaluate(sid => {
    const el = __line(sid, 1);
    return { text: el.innerText, apply: __rowBtns(sid, 1, /^Apply to the plan$/).length, hist: __rowBtns(sid, 1, /^Add to the action.s history$/).length, adds: __addBtns(sid, 1).length,
      approve: !!__decideBtn(sid, 1, 'approved'), agreed: (__decideBtn(sid, 1, 'agreed') || {}).textContent || '',
      others: ['compromise', 'accepted', 'carry'].every(k => !!__decideBtn(sid, 1, k)), d30: fmtDate(S.riskProfile.find(r => r.id === 'r1').actions.find(a => a.id === 'a1').due), d9: fmtDate('2030-10-09') };
  }, s1.id);
  R.ok(t.text.indexOf(ANSWERS.as_2_what) >= 0, 'the comments on the risk are shown first');
  // (innerText follows the house style's uppercase labels, so labels are matched in any case)
  R.ok(/Action \d+\s*·\s*Fit edge protection to the loading bay roof/i.test(t.text) && /Action \d+\s*·\s*Write a rescue plan for harness work/i.test(t.text)
    && lc(t.text).indexOf(lc(ANSWERS.as_2_r1_cmt)) >= 0 && lc(t.text).indexOf(lc(ANSWERS.as_2_r3_cmt)) >= 0, 'then each row: Action k · the action, and what they wrote against it');
  R.ok(/Who:\s*Dave\s*→\s*Dave Morley/i.test(t.text) && new RegExp('By when:\\s*' + rx(t.d30) + '\\s*→\\s*' + rx(t.d9), 'i').test(t.text),
    'a change shows what was printed and what came back - Who: Dave → Dave Morley, By when: ' + t.d30 + ' → ' + t.d9);
  R.ok(/New action under Control 2\s*·\s*Roof access permit/i.test(t.text) && /date as written: end of Nov/i.test(t.text), 'a gap row reads New action under Control 2 · Roof access permit; a date that could not be read says so, as written');
  R.ok(t.apply === 1 && t.hist === 1 && t.adds === 1, 'a change to an action offers Apply to the plan, a comment alone Add to the action’s history, a gap row ＋ Add to the plan under this control');
  R.ok(!t.approve && /Agreed/.test(t.agreed) && t.others, 'the decisions: Agreed, a compromise, the client accepts the risk, or carry - there is no Approve on a sheet like this');
}

// ── apply to the plan: who and by when onto the action, the comment onto its history ──
{
  const t = await page.evaluate(sid => {
    const a1 = S.riskProfile.find(r => r.id === 'r1').actions.find(a => a.id === 'a1'), n0 = (a1.log || []).length;
    const b = __rowBtns(sid, 1, /^Apply to the plan$/)[0]; if (b) b.click();
    const it = _asSheet(sid).items[1];
    return { owner: a1.owner, due: a1.due, status: a1.status, log: (a1.log || []).slice(n0).map(l => l.type + ': ' + l.text), applied: (((it.resp || {}).rows || [])[0] || {}).applied,
      text: __line(sid, 1).innerText, left: __rowBtns(sid, 1, /^Apply to the plan$/).length };
  }, s1.id);
  R.ok(t.owner === 'Dave Morley' && t.due === '2030-10-09' && t.status === before.a1, 'Apply to the plan sets the action’s owner and target date to what came back - its status untouched');
  R.ok(t.log.some(l => /^comment: From .*\b1, returned .+: The landlord will not allow fixings into the roof\.( \(.*\))?$/.test(l)), 'and writes the comment on its history - which sheet, when it came back, what was said (' + (t.log.slice(-1)[0] || 'nothing') + ')');
  R.ok(!!t.applied && /✓\s*Done/i.test(t.text) && t.left === 0, 'the row now reads ✓ Done, and cannot be applied twice');
}
{
  // the rescue plan's own row, against an action since taken off the risk: only a new action is offered
  const t = await page.evaluate(sid => {
    const r1 = S.riskProfile.find(r => r.id === 'r1'), at = r1.actions.findIndex(a => a.id === 'a2'), a2 = r1.actions.splice(at, 1)[0];
    _asRender();
    const text = __line(sid, 1).innerText, others = __rowBtns(sid, 1, /^(Apply to the plan|Add to the action.s history)$/).length, add = __rowBtns(sid, 1, /^[＋+]\s*Add as a new action$/);
    const n0 = r1.actions.length; if (add[0]) add[0].click();
    const made = r1.actions.slice(n0).map(a => JSON.parse(JSON.stringify(a)));
    r1.actions.splice(at, 0, a2); _asRender();
    return { text, others, add: add.length, made, applied: (((_asSheet(sid).items[1].resp || {}).rows || [])[2] || {}).applied, after: __rowBtns(sid, 1, /Add as a new action/).length };
  }, s1.id);
  const a = t.made[0] || {};
  R.ok(/no longer/i.test(t.text) && t.add === 1 && t.others === 0, 'an action gone from the plan since the sheet went out: the row says so and offers only ＋ Add as a new action');
  R.ok(t.made.length === 1 && a.desc === ANSWERS.as_2_r3_cmt && !a.deleted && !a.hideFromPlan && a.status === 'Not started' && !!t.applied && t.after === 0, 'which puts what they wrote on the plan as a new action, once');
}
{
  // a comment alone goes on the action's history
  const t = await page.evaluate(sid => {
    const a4 = S.riskProfile.find(r => r.id === 'r2').actions.find(a => a.id === 'a4'), n0 = (a4.log || []).length, was = a4.owner + '|' + a4.due;
    const b = __rowBtns(sid, 0, /^Add to the action.s history$/)[0]; if (b) b.click();
    return { log: (a4.log || []).slice(n0).map(l => l.type + ': ' + l.text), same: a4.owner + '|' + a4.due === was, applied: (((_asSheet(sid).items[0].resp || {}).rows || [])[1] || {}).applied,
      left: __rowBtns(sid, 0, /^Add to the action.s history$/).length, apply: __rowBtns(sid, 0, /^Apply to the plan$/).length };
  }, s1.id);
  R.ok(t.log.some(l => /^comment: From .*\b1, returned .+: Training booked for November\.( \(.*\))?$/.test(l)) && t.same && !!t.applied && t.left === 0,
    'Add to the action’s history writes the comment on the training - its owner and date untouched - and the row is done');
  R.ok(t.apply === 1, 'the pallet truck’s row, with a new date, still offers Apply to the plan');
}

// ── a gap row onto the plan ──
// The permit's gap row prints once, on r1's first page (line 2) - r1's later
// page (line 4) does not carry it - so both ways a gap row goes on the plan
// are taken from that one row: first from what they wrote, its control
// deleted since; then from a corrected copy, with only who and by when on it.
{
  // the permit taken off tab 3 since the sheet went out: the gap row's action still goes on the plan, not linked
  const t = await page.evaluate(sid => {
    const r1 = S.riskProfile.find(r => r.id === 'r1'), c2 = r1.actions.find(a => a.id === 'c2'), n0 = r1.actions.length;
    c2.deleted = true; _asRender();
    // its button may drop "under this control" now there is no control to go under
    const b = __rowBtns(sid, 1, /^[＋+]\s*Add to the plan( under this control)?$/)[0]; if (b) b.click();
    const made = r1.actions.slice(n0).map(a => JSON.parse(JSON.stringify(a)));
    delete c2.deleted; _asRender();
    return { made, adds: __addBtns(sid, 1).length, applied: (((_asSheet(sid).items[1].resp || {}).rows || [])[1] || {}).applied };
  }, s1.id);
  const a = t.made[0] || {};
  R.ok(t.made.length === 1 && !a.forCtl && a.desc === ANSWERS.as_2_r2_cmt && a.owner === 'Dave' && a.due === '' && !!t.applied && t.adds === 0,
    'a control deleted since the sheet went out: the action still goes on the plan from what they wrote, not linked to a control');
}
{
  // a corrected copy comes back: the permit's gap row now has only who and by when written on it
  const msg = await fill(Object.assign({}, ANSWERS, { as_2_r2_cmt: '', as_2_r2_who: 'Sam', as_2_r2_due: '15/12/2030' }));
  const it = (await sheet(1)).items, c = n => ((it[n].resp || {}).rows || []);
  const adds = await page.evaluate(sid => __addBtns(sid, 1).length, s1.id);
  R.ok(/Sheet 1: 4 answers? in/.test(msg) && c(1).length === 3 && c(1)[1].gap === true && c(1)[1].c === 'c2' && c(1)[1].cmt === '' && c(1)[1].who === 'Sam' && c(1)[1].whoChanged === true
    && c(1)[1].due === '2030-12-15' && c(1)[1].dueChanged === true && !c(1)[1].applied && adds === 1,
    'a gap row with only who and by when written counts - a corrected copy brings its row back with its button (' + msg.slice(0, 60) + ')');
  R.ok(!!c(1)[0].applied && !!c(1)[2].applied && !!c(0)[1].applied && !c(0)[0].applied && c(3).length === 1 && !c(3)[0].applied,
    'and the rows already done stay done; the rest still wait');
}
{
  // ＋ Add to the plan under this control, from the corrected row
  const t = await page.evaluate(sid => {
    const r1 = S.riskProfile.find(r => r.id === 'r1'), n0 = r1.actions.length, done = () => ((__line(sid, 1).innerText || '').match(/✓\s*Done/gi) || []).length, d0 = done();
    const b = __addBtns(sid, 1)[0]; if (b) b.click();
    const made = r1.actions.slice(n0).map(a => JSON.parse(JSON.stringify(a))), it = _asSheet(sid).items[1];
    return { made, prio: _suggestPriority(r1), onPlan: made.length ? _execActions().some(x => x.ref && x.ref.b === made[0].id) : false,
      applied: (((it.resp || {}).rows || [])[1] || {}).applied, adds: __addBtns(sid, 1).length, d0, d1: done() };
  }, s1.id);
  const a = t.made[0] || {};
  R.ok(t.made.length === 1 && a.desc === 'Put in place: Roof access permit' && a.forCtl === 'c2' && a.owner === 'Sam' && a.due === '2030-12-15' && a.status === 'Not started' && a.priority === t.prio && !!a.createdAt && !a.hideFromPlan && t.onPlan,
    '＋ Add to the plan under this control makes a real action under the permit, as tab 4 would - no comment, so Put in place: Roof access permit, with who and by when as written');
  R.ok((a.log || []).some(l => /^From .*\b1, returned /.test(l.text)), 'its history says which sheet it came from');
  R.ok(!!t.applied && t.adds === 0 && t.d0 === 2 && t.d1 === 3, 'and the row reads ✓ Done - it cannot go on twice (' + t.d0 + ' → ' + t.d1 + ' rows done)');
}
{
  // a who-and-when change with no comment applies too
  const t = await page.evaluate(sid => {
    const b = __rowBtns(sid, 3, /^Apply to the plan$/)[0]; if (b) b.click();
    const a2 = S.riskProfile.find(r => r.id === 'r1').actions.find(a => a.id === 'a2');
    return { owner: a2.owner, due: a2.due, applied: (((_asSheet(sid).items[3].resp || {}).rows || [])[0] || {}).applied };
  }, s1.id);
  R.ok(t.owner === 'Dave Morley' && t.due === '2030-10-31' && !!t.applied, 'a row with only who and by when written over applies them to the rescue plan');
}
{
  // the same copy (the corrected one, the last sent back) imported again once its rows are on the plan: they stay done - nothing goes on twice
  const t = await page.evaluate(async sid => {
    const r1 = S.riskProfile.find(r => r.id === 'r1'), n0 = r1.actions.length;
    await _asImportFiles([new File([window.__lastCopy], 'returned-again.pdf', { type: 'application/pdf' })]);
    const done = n => (((_asSheet(sid).items[n].resp || {}).rows) || []).map(r => !!r.applied).join(',');
    return { d1: done(1), d3: done(3), grew: r1.actions.length - n0,
      offers: [1, 3].reduce((m, i) => m + __addBtns(sid, i).length + __rowBtns(sid, i, /^(Apply to the plan|Add to the action.s history|[＋+]\s*Add (to the plan|as a new action).*)$/).length, 0) };
  }, s1.id);
  R.ok(t.d1 === 'true,true,true' && t.d3 === 'true' && t.grew === 0 && t.offers === 0, 'the same copy imported again keeps every row done - nothing goes on the plan twice (' + t.d1 + ' / ' + t.d3 + ')');
}

// ── agreed: the action stays open and the client's comments go on its history ──
{
  const t = await page.evaluate(sid => {
    const b = __decideBtn(sid, 0, 'agreed'); if (b) b.click();
    const it = _asSheet(sid).items[0], a = S.riskProfile.find(r => r.id === 'r2').actions.find(x => x.id === 'a3');
    return { dec: it.decision, label: AS_DECISIONS.agreed, status: a.status, log: (a.log || []).map(l => l.type + ': ' + l.text), shown: __line(sid, 0).innerText };
  }, s1.id);
  R.ok(t.dec === 'agreed' && t.label === 'Agreed with the client' && /Agreed with the client/.test(t.shown), 'Agreed decides the line - Agreed with the client');
  R.ok(t.status === before.a3, 'and the action stays open on the plan (' + t.status + ')');
  R.ok(t.log.some(l => /^comment: Action sheet 1: agreed - /i.test(l) && /Bought and in use/.test(l)),'the client’s comments are written on the action’s history');
  R.ok(JSON.stringify(await lineIds()) === JSON.stringify(order0), 'the decided line stays in place');
}
{
  const t = await page.evaluate(sid => {
    asUndo(sid, 'risk:r2:a3:');
    const a = S.riskProfile.find(r => r.id === 'r2').actions.find(x => x.id === 'a3'), last = (a.log || []).slice(-1)[0] || {};
    const out = { dec: _asSheet(sid).items[0].decision, status: a.status, last: last.type + ': ' + last.text };
    const b = __decideBtn(sid, 0, 'agreed'); if (b) b.click();
    out.again = _asSheet(sid).items[0].decision;
    return out;
  }, s1.id);
  R.ok(t.dec === '' && t.status === before.a3 && /^comment: Action sheet 1: the decision \(Agreed with the client\) was taken back$/.test(t.last), 'Agreed can be taken back - a line on the history, the action untouched');
  R.ok(t.again === 'agreed', 'and agreed again');
}

// ── go back with a compromise ──
await page.evaluate(sid => __decideBtn(sid, 1, 'compromise').click(), s1.id);
await wait(page, 200);
R.ok(/Write the compromise first/.test(await toast()) && !(await sheet(1)).items[1].decision, 'a compromise with nothing written is refused');
const COMPROMISE = 'Free-standing counterweighted guard rail, no fixings into the roof. Landlord to be told in writing.';
await page.type('#asN-' + s1.id + '-1', COMPROMISE);
await page.evaluate(sid => __decideBtn(sid, 1, 'compromise').click(), s1.id);
await wait(page, 300);
{
  const a = await act('a1'); s1 = await sheet(1);
  R.ok(s1.items[1].decision === 'compromise' && a.status === 'In progress', 'the compromise is recorded and the action stays open');
  R.ok((a.log || []).some(l => /Budget is tight for the roof|The landlord will not allow fixings/.test(l.text) && /Compromise sent back: Free-standing/.test(l.text)), 'what the client said and the compromise are both on the action’s history');
}

// ── agreed on the rescue plan; the walkways carried forward ──
await page.evaluate(sid => __decideBtn(sid, 3, 'agreed').click(), s1.id);
await wait(page, 200);
R.ok((await sheet(1)).items[3].decision === 'agreed' && (await act('a2')).status === 'Not started', 'a line with only who and by when written can be agreed too, still open');
await page.evaluate(sid => { const b = [...__line(sid, 2).querySelectorAll('.as-btns button')].find(x => /Carry to the next sheet/.test(x.textContent)); b.click(); }, s1.id);
await wait(page, 300);
R.ok((await sheet(1)).items[2].decision === 'carry' && (await act('a5')).status === 'Not started', 'a line carried forward stays open');

// ── client accepts the risk: keyed in by hand, as from a paper copy ──
{
  const t = await page.evaluate(sid => {
    const f = __rowIn(sid, 4), ks = Object.keys(f.rows).map(Number).sort((a, b) => a - b), v = (k, n) => ((f.rows[k] || {})[n] || {}).value;
    return { ks, full: ks.every(k => ['cmt', 'who', 'due'].every(n => !!f.rows[k][n])), who: ks.map(k => v(k, 'who')), due: ks.map(k => v(k, 'due')), cmt: ks.map(k => v(k, 'cmt')),
      what: !!__whatIn(sid, 4), outcome: !!__respIn(sid, 4, 'outcome'), approve: !!__decideBtn(sid, 4, 'approved') };
  }, s1.id);
  const dueOk = (v, iso) => v === iso || v === dmy(iso);
  // the banksman is r3's second line on the sheet: its page printed one row, its own action
  R.ok(t.ks.join(',') === '1' && t.full && t.what && !t.outcome && !t.approve, 'a line with nothing back can be keyed in from paper: comment, who and by when on each row as printed - here the one, its own action - and the comments box - no what-happened choice');
  R.ok(t.who.length === 1 && t.who[0] === '' && dueOk(t.due[0], day(20)) && t.cmt.every(c => c === ''), 'who and by when start as they were printed, so only what the copy changes needs typing (' + t.who.join('|') + ' / ' + t.due.join('|') + ')');
}
{
  const t = await page.evaluate(sid => {
    const f = k => __rowIn(sid, 4).rows[k] || {};
    const put = (k, n, v) => { const el = f(k)[n]; if (!el) return false; __put(el, n === 'due' && el.type !== 'date' ? v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) : v); return true; };
    const done = [put(1, 'cmt', 'Reversing is under ten movements a week.'), put(1, 'who', 'Dave Morley'), put(1, 'due', '2030-10-20')];
    const w = __whatIn(sid, 4); if (w) __put(w, 'We accept this one.');
    const it = _asSheet(sid).items[4];
    return { done, resp: JSON.parse(JSON.stringify(it.resp || {})), back: _asHasResp(it) };
  }, s1.id);
  const r = (t.resp.rows || []).find(x => x.a === 'a6') || {};
  R.ok(t.done.every(Boolean) && (t.resp.rows || []).length === 1 && r.k === 1 && r.cmt === 'Reversing is under ten movements a week.' && r.who === 'Dave Morley' && r.due === '2030-10-20' && t.resp.what === 'We accept this one.' && t.back && !(t.resp.ctls || []).length,
    'what is keyed in is kept against its action’s row, as an import would keep it (' + JSON.stringify(r).slice(0, 120) + ')');
  await page.evaluate(() => _asRender());       // the screen as it is drawn when it is opened again
  await page.evaluate(sid => { document.getElementById('asA-' + sid + '-4').value = ''; [...__line(sid, 4).querySelectorAll('.as-btns button')].find(x => /Client accepts the risk/.test(x.textContent)).click(); }, s1.id);
  await wait(page, 200);
  R.ok(/who at the client accepts the risk/.test(await toast()) && !(await sheet(1)).items[4].decision, 'an accepted risk needs the name of the person accepting it');
  await page.type('#asA-' + s1.id + '-4', 'Dave Morley, Operations Director');
  await page.type('#asN-' + s1.id + '-4', 'Reversing is under ten movements a week; a banksman is disproportionate. Reviewed at the next visit.');
  await page.evaluate(sid => { [...__line(sid, 4).querySelectorAll('.as-btns button')].find(x => /Client accepts the risk/.test(x.textContent)).click(); }, s1.id);
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
let s2;
{
  s2 = await sheet(2);
  // the two carried lines lead, in the Top 5's ranking as it stands now (it moves as risks are dealt with)
  const want = await page.evaluate(() => { const o = _asRiskOrder(); return ['a1', 'a5'].sort((x, y) => o.indexOf(x === 'a1' ? 'r1' : 'r3') - o.indexOf(y === 'a1' ? 'r1' : 'r3')).join(','); });
  R.ok(s2 && s2.items.slice(0, 2).map(i => i.ref.b).join(',') === want, 'the next sheet leads with what was carried back, then carries on down the Top 5 (' + (s2 && s2.items.map(i => i.ref.b).join(',')) + ')');
  const c1 = s2.items.find(i => i.ref.b === 'a1'), c5 = s2.items.find(i => i.ref.b === 'a5');
  R.ok(c1.rec === COMPROMISE && c1.carriedFrom === 1, 'the compromise goes out as that action’s recommended control');
  R.ok(c5.rec === RECS[2] && c5.carriedFrom === 1, 'a carried line keeps its recommendation');
  const live = await page.evaluate(() => { const s2 = S.actionSheets.list.find(s => s.no === 2), keys = s2.items.map(i => i.key);
    return { offered: _asCandidates(null).filter(c => keys.includes(c.key)).length, twice: S.actionSheets.list.filter(s => s.no !== 2).some(s => s.items.some(i => !i.decision && keys.includes(i.key))) }; });
  R.ok(s2.items.length <= 5 && live.offered === 0 && !live.twice, 'an action is never on two sheets at once');
  const older = await page.evaluate(() => { const d = document.querySelector('#asOv details.as-old'); return d ? { open: d.open, sum: d.querySelector('summary').textContent } : null; });
  R.ok(older && !older.open && /Sheet 1 · Reviewed/.test(older.sum), 'the finished sheet folds away under the new one, still there to read');
}

// ── taking a decision back ──
{
  const s = await sheet(1);
  await page.evaluate((sid) => asUndo(sid, 'risk:r1:a1:'), s.id);
  await wait(page, 200);
  R.ok(/already on a later sheet/.test(await toast()) && (await sheet(1)).items[1].decision === 'compromise', 'a compromise already sent out on the next sheet cannot be undone behind it');
}

// ── a sheet sent before 7 October (v1: a tick for what happened) still comes back ──
// Built by hand the way the old sheet was: name and role, four ticks, what
// was done, the date and by whom - and it must read exactly as it always did.
{
  const t = await page.evaluate(async sid => {
    const s = _asSheet(sid), pdf = await PDFLib.PDFDocument.create(), pg = pdf.addPage([595.28, 841.89]), form = pdf.getForm();
    let i = 0; const at = () => { const p = { x: 40 + (i % 4) * 130, y: 790 - Math.floor(i / 4) * 28 }; i++; return p; };
    const tf = (n, v) => { const f = form.createTextField(n), p = at(); f.addToPage(pg, { x: p.x, y: p.y, width: 120, height: 20 }); if (v) f.setText(v); return f; };
    const cb = (n, on) => { const f = form.createCheckBox(n), p = at(); f.addToPage(pg, { x: p.x, y: p.y, width: 12, height: 12 }); if (on) f.check(); return f; };
    tf('as__meta', JSON.stringify({ v: 1, kind: 'top5', client: _sltClient(), sheet: s.id, no: s.no, made: _asToday(), keys: s.items.map(x => x.key) })).enableReadOnly();
    tf('as__name', 'Dave Morley'); tf('as__role', 'Operations Director');
    const ANS = { 1: { o: ['done'], what: 'Done - the counterweighted rail is up.', date: '14/10/2026', by: 'Sam' },
      2: { o: ['diff'], what: 'Done another way - barriers hired for the yard.', date: '', by: 'Dave Morley' },
      3: { o: ['done', 'cannot'], what: 'Not sure - see me.' } };
    for (let n = 1; n <= s.items.length; n++) {
      const a = ANS[n] || { o: [] };
      ['done', 'diff', 'cannot', 'notyet'].forEach(o => cb('as_' + n + '_o_' + o, a.o.includes(o)));
      tf('as_' + n + '_what', a.what); tf('as_' + n + '_date', a.date); tf('as_' + n + '_by', a.by);
    }
    tf('as__general', 'Sent back on the old form.');
    await _asImportFiles([new File([await pdf.save()], 'old-sheet.pdf', { type: 'application/pdf' })]);
    const s2 = _asSheet(sid);
    return { toast: document.getElementById('toast').textContent, items: JSON.parse(JSON.stringify(s2.items)), returnedBy: s2.returnedBy, general: s2.general,
      approve: [0, 1, 2].map(i => { const b = __decideBtn(sid, i, 'approved'); return b ? { t: b.textContent.trim(), dis: b.disabled } : null; }),
      agreed: [0, 1, 2].some(i => !!__decideBtn(sid, i, 'agreed')), adds: [0, 1, 2].reduce((n, i) => n + __addBtns(sid, i).length, 0), select: !!__respIn(sid, 0, 'outcome') };
  }, s2.id);
  const r = n => t.items[n].resp || {};
  R.ok(/Sheet 2: 3 answers in/.test(t.toast) && /1 with more than one box ticked/.test(t.toast), 'an old sheet imports as it always did, and says one line needs a choice (' + t.toast.slice(0, 90) + ')');
  R.ok(r(0).outcome === 'done' && r(0).date === '2026-10-14' && r(0).by === 'Sam' && /counterweighted rail is up/.test(r(0).what) && !(r(0).ctls || []).length && !(r(0).rows || []).length, 'tick, date and name are read off it - no control or action rows');
  R.ok(r(1).outcome === 'diff' && r(2).outcome === '' && /More than one box was ticked: Done as recommended, Cannot be done/.test(r(2).what), 'two ticks are not guessed at: the line says so and waits for a choice');
  R.ok(t.returnedBy === 'Dave Morley (Operations Director)' && t.general === 'Sent back on the old form.', 'who returned it and their general comment are kept');
  R.ok(!!t.approve[0] && t.approve[0].t === 'Approve' && !t.approve[0].dis && !!t.approve[1] && t.approve[1].t === 'Approve what was done instead' && !!t.approve[2] && t.approve[2].dis,
    'its lines still offer Approve - and Approve what was done instead - but not on a line with no outcome chosen');
  R.ok(t.select && !t.agreed && t.adds === 0, 'the old screen as it was: the what-happened choice, no Agreed, no Add to the plan under a control');
}
{
  const s = await sheet(2), key = s.items[0].key, id = s.items[0].ref.b;
  await page.evaluate((sid) => __decideBtn(sid, 0, 'approved').click(), s.id);
  await wait(page, 300);
  const a = await act(id);
  R.ok(a.status === 'Complete' && a.completedDate === '2026-10-14' && a.completedBy === 'Sam' && (await sheet(2)).items[0].decision === 'approved', 'Approve completes the action on the plan, dated and named as the client reported');
  R.ok((a.log || []).some(l => l.type === 'completed' && /Action sheet 2: Done as recommended - Done - the counterweighted rail is up/.test(l.text) && /Approved/.test(l.text)), 'and writes what was done on the action’s own history');
  await page.evaluate((sid, key) => asUndo(sid, key), s.id, key);
  await wait(page, 300);
  const b = await act(id);
  R.ok(b.status === 'In progress' && !b.completedDate && (b.log || []).some(l => l.type === 'reopened') && !(await sheet(2)).items[0].decision, 'undoing an approval reopens the action and says so on its history');
}

// ── it all survives a reload ──
const saved = await page.evaluate(() => { saveData(); return JSON.stringify(S.actionSheets); });
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"');
await wait(page, 500);
await inject();
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
  R.ok(t.five.join(',') === 'r3,r2,r4,r1' && t.risks.slice(0, 3).join(',') === 'r3,r2,r1', 'the sheet follows the month’s Top 5, in its order (' + t.five.join(',') + ')');
  R.ok(/In the Top 5 with nothing to send: .*Asbestos in the plant room/.test(t.gap) && /add one on the risk/.test(t.gap), 'a Top 5 risk with no open action is named, not silently left off');
  await page.evaluate(() => closeActionSheets());
}
// ── after review (7 October 2026): a sheet sent as the second form (v2, a row
//    a control) still comes back as it did - a control taken off the risk
//    after printing, copies imported more than once; an agreed line and the
//    next five; a v3 paper copy keyed in row by row; a very long control ──
await seed(page, { riskProfile: [
  { id: 'q1', activity: 'Roof work', likelihood: '4', severity: '5', personsAtRisk: ['Employees'], actions: [
    { id: 'k1', desc: 'Guard rail', owner: 'Dave', due: '', status: 'Not started', hideFromPlan: true },
    { id: 'k2', desc: 'Roof access permit', owner: 'Dave', due: '', status: 'Not started', hideFromPlan: true },
    { id: 'k3', desc: 'Harness training', owner: '', due: '', status: 'Not started', hideFromPlan: true },
    { id: 'q1a', desc: 'Fit edge protection', owner: 'Dave', due: day(30), status: 'Not started' }] },
  { id: 'q2', activity: 'Yard traffic', likelihood: '3', severity: '4', personsAtRisk: ['Employees'], actions: [
    { id: 'q2a', desc: 'Mark the walkways', owner: '', due: day(20), status: 'Not started' }] }],
  company: { tradingName: 'Fairbank Fabrications Ltd' } }, 'execplan');
let q;
{
  const t = await page.evaluate(async () => {
    delete S.actionSheets; window._sltSaveBlob = () => {};
    openActionSheets('top5'); asNewSheet();
    const s = _asList('top5')[0], i = s.items.findIndex(x => x.key === 'risk:q1:q1a:');
    s.items.forEach(it => { it.rec = 'Our control for ' + it.desc; });
    // sent before 7 October on the second form: what its download kept - the
    // form, and each line's control rows as printed, with their words
    const ctls = s.items.map(it => { const r = _execRiskOf({ ref: it.ref }), c = (r ? _riskCtlRows(r) : []).filter(x => String(x.desc || '').trim());
      it.ctlIds = c.length ? c.map(x => x.id) : [null];
      if (c.length) { it.ctlPrinted = {}; c.forEach(x => { it.ctlPrinted[x.id] = String(x.desc).trim(); }); }
      return it.ctlIds.slice(); });
    s.issuedAt = _asToday(); s.formV = 2;
    // the second form as it came back: as__meta v2 with each line's control row ids, and a comment, who and by when a control row
    window.__v2 = async vals => {
      const pdf = await PDFLib.PDFDocument.create(), pg = pdf.addPage([595.28, 841.89]), form = pdf.getForm();
      let k = 0; const tf = (n, v) => { const f = form.createTextField(n); f.addToPage(pg, { x: 40 + (k % 4) * 130, y: 800 - Math.floor(k / 4) * 24, width: 120, height: 20 }); k++; if (v) f.setText(v); return f; };
      tf('as__meta', JSON.stringify({ v: 2, kind: 'top5', client: _sltClient(), sheet: s.id, no: s.no, made: _asToday(), keys: s.items.map(x => x.key), ctls })).enableReadOnly();
      s.items.forEach((it, j) => { const n = j + 1;
        ctls[j].forEach((c, r) => ['cmt', 'who', 'due'].forEach(f => { const nm = 'as_' + n + '_c' + (r + 1) + '_' + f; tf(nm, vals[nm] || ''); }));
        tf('as_' + n + '_what', vals['as_' + n + '_what'] || ''); });
      tf('as__general', vals.as__general || '');
      await _asImportFiles([new File([await pdf.save()], 'second-form.pdf', { type: 'application/pdf' })]);
      return document.getElementById('toast').textContent;
    };
    return { sid: s.id, i, ctls };
  });
  q = t;
  R.ok(q.i >= 0 && JSON.stringify(q.ctls[q.i]) === '["k1","k2","k3"]', 'setup: a sheet sent on the second form, its roof line printed with three control rows');
}
{
  const t = await page.evaluate(async (sid, i) => {
    const s = _asSheet(sid), n = i + 1, it = s.items[i], q1 = S.riskProfile[0];
    q1.actions.find(a => a.id === 'k2').deleted = true;          // taken off the risk after the sheet went out
    const v = {}; v['as_' + n + '_c1_cmt'] = 'Already fitted on the front'; v['as_' + n + '_c2_cmt'] = 'Permit is overkill for us'; v['as_' + n + '_c3_cmt'] = 'Book it';
    v['as_' + n + '_c3_who'] = 'Sam'; v['as_' + n + '_c3_due'] = '30/11/2030'; v['as_' + n + '_what'] = 'Roof work is rare for us.';
    window.__v = v;
    const m1 = await __v2(v);
    const resp = JSON.parse(JSON.stringify(it.resp || {}));
    const text = (__line(sid, i) || {}).innerText || '', adds = __addBtns(sid, i).length, agreed = !!__decideBtn(sid, i, 'agreed'), approve = !!__decideBtn(sid, i, 'approved');
    const n0 = q1.actions.length;
    let b = __addBtns(sid, i)[0]; if (b) b.click();                             // row 1
    b = __addBtns(sid, i).slice(-1)[0]; if (b) b.click();                       // row 3, the last one left
    const made = q1.actions.slice(n0).map(a => ({ desc: a.desc, owner: a.owner, due: a.due, forCtl: a.forCtl || '' }));
    const v2 = {}; v2['as_' + n + '_c2_cmt'] = 'Permit is overkill for us';
    await __v2(v2);                                                             // a second copy: rows 1 and 3 left blank
    const kept = ((it.resp || {}).ctls || []).map(c => c.k + (c.actId ? ':on' : ':-')).join(',');
    await __v2(v);                                                              // and the first copy again
    const again = ((it.resp || {}).ctls || []).map(c => c.k + (c.actId ? ':on' : ':-')).join(',');
    return { m1, resp, text, adds, agreed, approve, made, kept, again, btns: __addBtns(sid, i).length, n: q1.actions.filter(a => !a.hideFromPlan && /^(Book it|Already fitted)/.test(a.desc)).length };
  }, q.sid, q.i);
  const c = t.resp.ctls || [];
  R.ok(/answers? in/.test(t.m1) && c.length === 3 && c.map(x => x.ctlId).join(',') === 'k1,k2,k3' && c[2].who === 'Sam' && c[2].due === '2030-11-30' && c[2].dueText === '30/11/2030'
    && t.resp.what === 'Roof work is rare for us.' && !(t.resp.rows || []).length,
    'a sheet sent on the second form (v2) still comes back exactly as before - each comment, who and by when under its control (' + t.m1.slice(0, 80) + ')');
  R.ok(c.map(x => x.ctlText).join('|') === 'Guard rail|Roof access permit|Harness training', 'a control taken off the risk after the sheet went out still reads as it was printed (' + c.map(x => x.ctlText).join('|') + ')');
  R.ok(/Control 1\s*·\s*Guard rail/i.test(t.text) && t.adds === 3 && t.agreed && !t.approve, 'and reads on screen as it did: Control k · the control, an Add to the plan under each row written on, Agreed - no Approve');
  R.ok(t.made.length === 2 && t.made[0].desc === 'Already fitted on the front' && t.made[0].owner === '' && t.made[0].forCtl === 'k1' && t.made[1].desc === 'Book it' && t.made[1].owner === 'Sam' && t.made[1].due === '2030-11-30' && t.made[1].forCtl === 'k3',
    'Add to the plan under this control still puts each row on the plan under its control, given to who the client named - nobody, when they named nobody (' + JSON.stringify(t.made) + ')');
  R.ok(t.kept === '1:on,2:-,3:on' && t.again === '1:on,2:-,3:on' && t.n === 2 && t.btns === 1,
    'a copy that leaves a row blank keeps that row on the plan, so another copy cannot put it there twice (' + t.kept + ' / ' + t.again + ')');
}
{
  const t = await page.evaluate(async (sid, d40) => {
    const s = _asSheet(sid);
    s.items.forEach((it, i) => { if (!it.decision) { if (!_asHasResp(it)) it.resp = { outcome: '', what: 'Fine by us.', date: '', by: '', ctls: [] }; asDecide(sid, it.key, 'agreed', i); } });
    const recs = {}; s.items.forEach(it => { recs[it.key] = it.rec; });
    const msg = await __v2(__v);                                                // the same copy once every line is decided
    S.riskProfile.find(r => r.id === 'q2').actions.push({ id: 'q2b', desc: 'Speed limit signs at the gate', owner: 'Dave', due: d40, status: 'Not started' });
    asNewSheet();
    const s2 = _asList('top5').find(x => x.no === 2);
    return { decided: s.items.every(it => it.decision === 'agreed'), agreedKeys: s.items.map(it => it.key), msg, recs,
      next: s2 ? s2.items.map(it => ({ key: it.key, rec: it.rec, from: it.carriedFrom || 0 })) : [] };
  }, q.sid, day(40));
  const tail = t.next.slice(-t.agreedKeys.length);
  R.ok(t.decided && /every line answered on it has been decided already/.test(t.msg), 'a copy whose answered lines are all decided says so: ' + t.msg.slice(0, 120));
  R.ok(t.next.length === 5 && !t.agreedKeys.includes(t.next[0].key) && tail.every(x => t.agreedKeys.includes(x.key)),
    'a line agreed with the client waits at the back of the queue - the next five moves on down the list (' + t.next.map(x => x.key).join(' ') + ')');
  R.ok(t.next.filter(x => t.agreedKeys.includes(x.key)).every(x => x.rec === t.recs[x.key] && !!x.rec && x.from === 0), 'and when it goes out again it takes the control it was agreed with');
}
{
  // the next sheet goes out as the third form; its paper copy is keyed in row by row
  const t = await page.evaluate(async () => {
    const s = _asList('top5').find(x => x.no === 2), i = s.items.findIndex(x => x.key === 'risk:q2:q2b:');
    await downloadActionSheet(s.id);
    const f = k => __rowIn(s.id, i).rows[k] || {}, out = { i, before: s.returnedAt || '', today: _asToday() };
    out.ks = Object.keys(__rowIn(s.id, i).rows).map(Number).sort((a, b) => a - b);
    out.pre = [1, 2].map(k => [(f(k).who || {}).value, (f(k).due || {}).value]);
    if (f(2).cmt) __put(f(2).cmt, 'Signs ordered.');                           // the first entry
    out.after = s.returnedAt || '';
    const el = f(2).cmt; if (el) { el.setAttribute('data-t', 'q3cmt'); __put(el, 'Signs ordered and fitted.'); }     // and typing on
    const kept = document.querySelector('[data-t=q3cmt]'); out.same = !!kept && kept === el && kept.isConnected;
    if (f(2).who) __put(f(2).who, 'Sam Line');
    const it = s.items[i]; out.resp = JSON.parse(JSON.stringify(it.resp || {})); out.back = _asHasResp(it);
    return out;
  });
  const dueOk = (v, iso) => v === iso || v === dmy(iso);
  R.ok(t.i >= 0 && t.ks.join(',') === '1,2' && t.pre[0][0] === '' && dueOk(t.pre[0][1], day(20)) && t.pre[1][0] === 'Dave' && dueOk(t.pre[1][1], day(40)),
    'a paper copy of the third form is keyed in row by row - the walkways and the signs, who and by when starting as printed (' + JSON.stringify(t.pre) + ')');
  R.ok(t.before === '' && t.after === t.today, 'the first entry marks the sheet as back today');
  R.ok(t.same, 'typing saves without redrawing - the box being typed in stays where it is');
  const r = (t.resp.rows || []).find(x => x.a === 'q2b') || {};
  R.ok(r.cmt === 'Signs ordered and fitted.' && r.who === 'Sam Line' && t.back, 'and what is typed is kept against its action’s row (' + JSON.stringify(r).slice(0, 120) + ')');
}
{
  const t = await page.evaluate(async () => {
    delete S.actionSheets;
    const LONG = ('Install a permanent fall-arrest anchor system on every roof with a certified installer, inspected annually under LOLER and BS EN 795, with a written rescue plan, trained users and a permit for every access. ').repeat(9);
    const r = S.riskProfile[0]; r.actions.filter(a => a.hideFromPlan).forEach(a => { a.deleted = true; });
    r.actions.push({ id: 'k9', desc: LONG, owner: '', due: '', status: 'Not started', hideFromPlan: true });
    asNewSheet(); const s = _asList('top5')[0]; s.items.forEach(it => { it.rec = LONG.slice(0, 1500); });
    const b = await __build(s.id);
    return { low: Object.entries(b.boxes).filter(([n, x]) => x && n !== 'as__meta' && x.y < 59).map(([n]) => n), cut: b.said.some(x => / \.\.\.$/.test(x.s)), off: b.said.filter(x => x.y < 40 && x.size > 7).length };
  });
  R.ok(!t.low.length && !t.off && t.cut, 'a control or recommendation too long for a page is cut to fit, ending ...; its boxes stay on the page (' + t.low.join(',') + ')');
}
console.log('  sheet written to ' + pdfPath);
await R.done(browser, errors);
