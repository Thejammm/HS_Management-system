// ══════════════════════════════════════════════════════════════
//  The Risk Action Sheet. Simon, 2026-10-07: the old Top 5 Responses form
//  becomes a sheet built like the Top 5 action sheet, but bespoke - he ticks
//  as many risks as he likes in the Sheet column on the cockpit's risk
//  ladder - and it ends with what came up at the client meeting, taken on
//  the cockpit by the quick minute taker, so the cockpit is the only screen
//  he needs open in the meeting. The Top 5 ticks and the Top 5 sheets stay
//  separate.
//  Later the same day: the sheet is the one report the leadership team gets.
//  Each page ends in the two-way table (my controls, then their comments, who
//  and by when) and a comments box, laid out exactly as on the Top 5 sheet;
//  the cover has no name or role; the Top 5 Risks report and the button to
//  the proposals form are gone (the form's code and data stay).
//  Then, after seeing it live: the table's rows are the risk's open actions,
//  framed as tab 4 frames them (under the control each puts in place), with
//  who and by when printed from the plan (as__meta v3); the pages say RISK n
//  OF N; the meeting part follows straight on when it fits.
//  Ladder ticks -> toolbar -> read-only -> Reports card -> a risk sheet
//  (gaps, no cap, one draft) -> its PDF -> quick minutes -> From the meeting
//  -> the sheet back with meeting rows -> the proposals form, no way in from
//  the sheet -> the two kinds kept apart, built the same -> a reload.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Risk action sheet - ticked on the ladder, minuted at the meeting, out and back');
const { browser, page, errors } = await openApp();

const pad = n => String(n).padStart(2, '0');
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
// Seven rated risks, a band each where it matters: r1 Critical, r2 High,
// r3 Medium, so the sheet's worst-first order is r1, r2, r3 whatever the
// controls judgement says. r3 has nothing open; r4 is never ticked for the sheet.
const RISKS = () => ([
  { id: 'r1', activity: 'Work at height on the loading bay roof', likelihood: '5', severity: '5', actions: [
    { id: 'a1', desc: 'Fit edge protection to the loading bay roof', owner: 'Dave', due: day(30), status: 'Not started' },
    { id: 'a2', desc: 'Stop roof access until a rescue plan is written', owner: 'Dave', due: day(-5), status: 'Not started' } ] },
  { id: 'r2', activity: 'Manual handling in the stores', likelihood: '3', severity: '4', actions: [
    { id: 'a3', desc: 'Buy a pallet truck for the stores', owner: 'Sam', due: day(10), status: 'In progress' } ] },
  { id: 'r3', activity: 'Vehicle movements in the yard', likelihood: '2', severity: '3', actions: [
    { id: 'a4', desc: 'Speed limit signs at the gate', owner: 'Dave', due: day(-40), status: 'Complete' } ] },
  { id: 'r4', activity: 'Asbestos in the plant room', likelihood: '4', severity: '5', actions: [
    { id: 'a5', desc: 'Commission an asbestos survey of the plant room', owner: '', due: day(20), status: 'Not started' } ] },
  { id: 'r5', activity: 'Slips and trips in the workshop', likelihood: '2', severity: '2', actions: [
    { id: 'a6', desc: 'Mark out the workshop walkways', owner: 'Sam', due: day(40), status: 'Not started' } ] },
  { id: 'r6', activity: 'Noise from the press shop', likelihood: '3', severity: '3', actions: [] },
  { id: 'r7', activity: 'Fire in the paint store', likelihood: '4', severity: '4', actions: [
    { id: 'a7', desc: 'Fit a fire door to the paint store', owner: 'Dave', due: day(15), status: 'Not started' } ] },
]);
const COMPANY = { tradingName: 'Fairbank Fabrications Ltd', slt: [
  { name: 'Jo Fine', role: 'Managing Director', email: 'jo@fairbank.example' },
  { name: 'Sam Line', role: 'Operations Director', email: 'sam@fairbank.example' } ] };
await seed(page, { riskProfile: RISKS(), company: COMPANY, meetings: [], decisions: [], actionPlan: [], top5Resp: { list: [], own: {}, notes: {} } }, 'cockpit');
await page.evaluate(() => { delete S.actionSheets; renderCockpit(); });
await wait(page, 300);
const { month, label } = await page.evaluate(() => ({ month: _top5Month(), label: _top5MonthLabel(_top5Month()) }));

// Small readers the steps share, put on the page once (and again after the reload).
const inject = () => page.evaluate(() => {
  window.__text = el => (el ? el.textContent.trim() : '');
  window.__risk = id => S.riskProfile.find(r => r.id === id);
  window.__ladder = () => [...document.querySelectorAll('.ckx-panel')].find(p => /Risk ladder/.test(((p.querySelector('h4') || {}).textContent) || '')) || null;
  window.__line = name => [...((window.__ladder() || document).querySelectorAll('.ckl-line'))].find(l => (((l.querySelector('.ckl-name') || {}).textContent) || '').indexOf(name) >= 0) || null;
  window.__fn = n => { try { return new Function('return typeof ' + n)() === 'function'; } catch (e) { return false; } };
  window.__asKind = () => { try { return new Function('return typeof _asKind === "undefined" ? "(none)" : _asKind')(); } catch (e) { return '(none)'; } };
  // the two kind tabs at the top of the sheets screen, as they are drawn
  window.__switch = () => {
    const ov = document.getElementById('asOv'); if (!ov) return { has: false };
    const b = name => [...ov.querySelectorAll('button')].find(x => x.textContent.trim() === name) || null;
    const sig = el => { if (!el) return ''; const s = getComputedStyle(el); return [s.backgroundColor, s.color, s.borderTopColor, s.borderBottomColor, s.borderLeftColor].join('|'); };
    const t = b('Top 5 action sheets'), r = b('Risk action sheets');
    return { has: !!t && !!r, top5: sig(t), risk: sig(r) };
  };
  window.__accent = () => { const d = document.createElement('span'); d.style.color = 'var(--accent)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
  // add a plan action to a sheet the way the consultant does: pick it, press Add
  window.__addFromPlan = (sid, key) => {
    const sel = document.getElementById('asAdd-' + sid); if (!sel) return 'no select';
    if (![...sel.options].some(o => o.value === key)) return 'not offered';
    sel.value = key; asAddItem(sid); return 'ok';
  };
  // the sheet as built: every string printed on it (pdf-lib cannot read text
  // back, so drawText is watched while it builds), its fields and its meta
  window.__build = async sid => {
    const said = [], P = PDFLib.PDFPage.prototype, orig = P.drawText;
    P.drawText = function (t, o) { said.push(String(t)); return orig.call(this, t, o); };
    let bytes; try { bytes = await buildActionSheetPDF(sid); } finally { P.drawText = orig; }
    const doc = await PDFLib.PDFDocument.load(bytes), form = doc.getForm();
    const rect = n => { try { const r = form.getTextField(n).acroField.getWidgets()[0].getRectangle(); return { x: r.x, w: r.width, h: r.height }; } catch (e) { return null; } };
    let meta = {}; try { meta = JSON.parse(form.getTextField('as__meta').getText()); } catch (e) {}
    let multi = null; try { multi = form.getTextField('as__m1_what').isMultiline(); } catch (e) {}
    const ml = n => { try { return form.getTextField(n).isMultiline(); } catch (e) { return null; } };
    const val = n => { try { return form.getTextField(n).getText() || ''; } catch (e) { return null; } };
    return { said, names: form.getFields().map(f => f.getName()), meta, pages: doc.getPageCount(), multi, multiCmt: ml('as_1_r1_cmt'), multiWhat: ml('as_1_what'),
      vals: { w11: val('as_1_r1_who'), d11: val('as_1_r1_due'), w12: val('as_1_r2_who'), d12: val('as_1_r2_due'), w22: val('as_2_r2_who'), d22: val('as_2_r2_due') },
      rects: { what: rect('as__m1_what'), who: rect('as__m1_who'), due: rect('as__m1_due') } };
  };
  // the minute taker's inputs for one action, by the field each one writes
  window.__qmFields = id => {
    const ov = document.getElementById('qmOv'), out = {}; if (!ov) return out;
    ov.querySelectorAll('input, textarea, select').forEach(el => {
      const h = ['oninput', 'onchange', 'onblur'].map(a => el.getAttribute(a) || '').join(' ');
      const m = /qmAct\(\s*[^,]*,\s*['"](\w+)['"]/.exec(h); if (!m) return;
      let mine = h.indexOf(id) >= 0;
      for (let p = el.parentElement; !mine && p && p !== ov; p = p.parentElement) mine = (p.id || '').indexOf(id) >= 0 || Object.values(p.dataset || {}).indexOf(id) >= 0;
      if (mine) out[m[1]] = el;
    });
    return out;
  };
  window.__put = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
});
await inject();
// The shape of a sheet's form, whatever its length: each line's fields with
// the line and row numbers taken out (the meeting rows are the risk sheet's own).
const shape = names => [...new Set(names.filter(n => !/^as__m\d/.test(n)).map(n => n.replace(/^as_\d+_/, 'as_N_').replace(/^as_N_r\d+_/, 'as_N_rK_')))].sort().join(',');
const SHAPE = ['as__meta', 'as__general', 'as_N_what', 'as_N_rK_cmt', 'as_N_rK_who', 'as_N_rK_due'].sort().join(',');
// The headings every sheet of either kind carries, cover and pages alike.
const HEADS = ['PURPOSE', 'WHAT WE NEED FROM YOU', 'HOW TO READ THE SCORES', 'YOUR ACTIONS - TELL US WHAT YOU THINK', 'COMMENTS ON THIS RISK', 'ANYTHING ELSE TO TELL US'];
const dmy = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
const heads = said => HEADS.filter(h => said.some(x => String(x).trim().toUpperCase() === h)).concat(said.some(x => /AT A GLANCE$/.test(String(x).trim().toUpperCase())) ? ['AT A GLANCE'] : []).join('|');
let riskShape = '', riskHeads = '';

// ── 0. what the other builders agreed to provide ──
{
  const miss = await page.evaluate(() => ['_sheetRisks', 'toggleRiskSheet', 'asAddRiskAction', 'openQuickMinutes', 'closeQuickMinutes', '_qmCurrent', '_qmEnsureOpen',
    '_qmNewAction', 'qmSet', 'qmAddAttendee', 'qmDelAttendee', 'qmAddTeam', 'qmAddAction', 'qmAct', 'qmDelAction', 'qmDone'].filter(n => !__fn(n)));
  if (!R.ok(!miss.length, 'every function the Risk Action Sheet needs is there' + (miss.length ? ' - missing: ' + miss.join(', ') : ''))) await R.done(browser, errors);
}

// ── 1. the Sheet column: a box on every rated line, as many as you like ──
{
  const t = await page.evaluate(() => {
    const L = __ladder(), lines = [...L.querySelectorAll('.ckl-line')];
    return { n: lines.length, boxes: lines.filter(l => l.querySelector('.ckl-sh input[type=checkbox]')).length,
      after: lines.every(l => { const a = l.querySelector('.ckl-t5'), b = l.querySelector('.ckl-sh'); return !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); }),
      head: __text(L.querySelector('.ckl-head-sh')), t5head: __text(L.querySelector('.ckl-head:not(.ckl-head-sh)')),
      title: ((lines[0] && lines[0].querySelector('.ckl-sh input')) || {}).title || '' };
  });
  R.ok(t.n === 7 && t.boxes === 7, 'every rated risk on the ladder has a Sheet box (' + t.boxes + ' of ' + t.n + ' lines)');
  R.ok(t.after, 'the Sheet box sits in a column of its own, after the Top 5 tick');
  R.ok(t.head === 'Sheet · 0' && /^Top 5 · 0 of 5 for /.test(t.t5head), 'the Sheet column has its own head beside the Top 5 one: ' + t.head + ' | ' + t.t5head);
  R.ok(t.title === 'Put this risk on the Risk Action Sheet for ' + label + ' - as many as you like', 'the box says what it does: ' + t.title);
}
{
  const SIX = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
  const t = await page.evaluate((ids, month) => {
    const names = () => [...__ladder().querySelectorAll('.ckl-line')].map(l => __text(l.querySelector('.ckl-name')));
    const before = names(), t5Before = __text(__ladder().querySelector('.ckl-head:not(.ckl-head-sh)'));
    ids.forEach(id => { const box = __line(__risk(id).activity).querySelector('.ckl-sh input'); box.checked = true; box.dispatchEvent(new Event('change')); });
    const L = __ladder();
    return { marks: S.riskProfile.map(r => r.id + ':' + (r.sheet || '')).join(','),
      on: ids.every(id => __line(__risk(id).activity).querySelector('.ckl-sh input').checked),
      top5: S.riskProfile.filter(r => (r.actions || []).some(a => a.top5)).map(r => r.id),
      head: __text(L.querySelector('.ckl-head-sh')), t5Before, t5After: __text(L.querySelector('.ckl-head:not(.ckl-head-sh)')),
      same: JSON.stringify(before) === JSON.stringify(names()),
      list: _sheetRisks().map(z => z.id),
      want: _holdSummary().rows.filter(z => z.r.sheet === month).sort(_holdWorstFirst).map(z => z.id) };
  }, SIX, month);
  const want = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'].map(id => id + ':' + (id === 'r7' ? '' : month)).join(',');
  R.ok(t.marks === want && t.on, 'six risks ticked and all six stick - no limit (' + t.marks + ')');
  R.ok(t.head === 'Sheet · 6' && t.t5After === t.t5Before, 'the Sheet head counts six and the Top 5 head is untouched: ' + t.head + ' | ' + t.t5After);
  R.ok(!t.top5.length, 'a Sheet tick marks the risk, never an action for the Top 5');
  R.ok(t.same, 'nothing on the ladder moves when a Sheet box is ticked');
  R.ok(t.list.length === 6 && t.list.join(',') === t.want.join(','), 'the sheet\'s risks are the ticked ones, worst first (' + t.list.join(',') + ')');
}
{
  const t = await page.evaluate(() => {
    const t5box = () => __line('Fire in the paint store').querySelector('.ckl-t5 input');
    let b = t5box(); b.checked = true; b.dispatchEvent(new Event('change'));
    const out = { r7sheet: __risk('r7').sheet || '', a7: __risk('r7').actions[0].top5 || '', head: __text(__ladder().querySelector('.ckl-head-sh')),
      shOn: __line('Fire in the paint store').querySelector('.ckl-sh input').checked };
    b = t5box(); b.checked = false; b.dispatchEvent(new Event('change'));
    out.a7after = __risk('r7').actions[0].top5 || '';
    const sb = __line('Asbestos in the plant room').querySelector('.ckl-sh input'); sb.checked = false; sb.dispatchEvent(new Event('change'));
    out.r4 = __risk('r4').sheet || ''; out.r4box = __line('Asbestos in the plant room').querySelector('.ckl-sh input').checked;
    out.head2 = __text(__ladder().querySelector('.ckl-head-sh')); out.n = _sheetRisks().length;
    return out;
  });
  R.ok(t.a7 === month && t.r7sheet === '' && !t.shOn && t.head === 'Sheet · 6', 'a Top 5 tick marks the action for the Top 5 and leaves the risk off the Risk Action Sheet');
  R.ok(t.a7after === '', 'unticking the Top 5 takes its mark off again');
  R.ok(t.r4 === '' && !t.r4box && t.head2 === 'Sheet · 5' && t.n === 5, 'unticking a Sheet box takes the risk off the sheet: ' + t.head2);
}

// ── 2. the ladder's row of tools - the cockpit is the only screen in the meeting ──
{
  const t = await page.evaluate(() => {
    const L = __ladder(), tools = L.querySelector('.ckl-tools'), btns = tools ? [...tools.querySelectorAll('button')] : [];
    const calls = [], keep = { s: window.openActionSheets, m: window.openQuickMinutes };
    window.openActionSheets = k => { calls.push('sheets:' + k); };
    window.openQuickMinutes = () => { calls.push('minutes'); };
    try { btns.forEach(b => b.click()); } finally { window.openActionSheets = keep.s; window.openQuickMinutes = keep.m; }
    const head = L.querySelector('.ckl-headrow');
    return { texts: btns.map(b => b.textContent.trim()), calls, report: /Top 5 (risks )?report|Top 5 Risks/i.test(L.textContent + ' ' + btns.map(b => b.title).join(' ')), fn: __fn('openTopFivePrint'),
      under: !!tools && !!head && head.nextElementSibling === tools, headBtns: head ? head.querySelectorAll('button').length : -1,
      responses: /Responses/.test(L.outerHTML), key: /Tick the Sheet column for the Risk Action Sheet - as many as you like\./.test(L.textContent) };
  });
  R.ok(JSON.stringify(t.texts) === JSON.stringify(['Top 5 action sheet', 'Risk action sheet', '✎ Minutes']), 'under the head, one row of tools in order - the Top 5 report button gone: ' + t.texts.join(' | '));
  R.ok(t.calls.join(',') === 'sheets:top5,sheets:risk,minutes', 'each opens its own thing - the Top 5 sheets, the risk sheets, the minutes (' + t.calls.join(',') + ')');
  R.ok(!t.report && !t.fn, 'nothing on the ladder points at a Top 5 report, and the report is gone from the app');
  R.ok(t.under && t.headBtns === 0, 'the row sits directly under the head row, and the head row has no buttons left in it');
  R.ok(!t.responses, 'the word Responses is nowhere on the ladder');
  R.ok(t.key, 'the key says the Sheet column takes as many as you like');
}

// ── 3. a client login sees both columns, and can change neither ──
{
  const t = await page.evaluate(month => {
    const a7 = __risk('r7').actions[0]; a7.top5 = month;
    const keep = window._roLocked; window._roLocked = () => true; renderCockpit();
    const L = __ladder();
    const out = { boxes: L.querySelectorAll('.ckl-sh input, .ckl-t5 input').length, tools: !!L.querySelector('.ckl-tools button'),
      shStar: __text(__line('Work at height on the loading bay roof').querySelector('.ckl-sh')),
      shNone: __text(__line('Fire in the paint store').querySelector('.ckl-sh')),
      t5Star: __text(__line('Fire in the paint store').querySelector('.ckl-t5')) };
    window._roLocked = keep; a7.top5 = ''; renderCockpit();
    out.back = __ladder().querySelectorAll('.ckl-sh input').length;
    return out;
  }, month);
  R.ok(t.boxes === 0 && !t.tools, 'read-only: no boxes in either column, and no row of tools');
  R.ok(t.shStar === '★' && t.shNone === '' && t.t5Star === '★', 'read-only: a star in the Sheet column for a risk on the sheet, and in the Top 5 column for a Top 5 risk');
  R.ok(t.back === 7, 'back in edit, the boxes are back');
}

// ── 4. the Reports tab: the Risk Action Sheet card in place of Top 5 Responses ──
{
  const t = await page.evaluate(() => {
    switchTab('reports');
    const tab = document.getElementById('tab-reports');
    const cards = [...tab.querySelectorAll('.rep-card')].map(c => ({ title: __text(c.querySelector('h3')), meta: __text(c.querySelector('.rep-meta')), desc: __text(c.querySelector('p')), c }));
    const titles = cards.map(c => c.title), i = titles.indexOf('Risk Action Sheet'), j = titles.indexOf('Top 5 Action Sheet');
    const out = { titles, text: tab.textContent, next: i > 0 && titles[i - 1] === 'Top 5 Action Sheet', meta: i >= 0 ? cards[i].meta : '',
      descs: [i, j].map(k => (k >= 0 ? cards[k].desc : '')) };
    if (i >= 0) {
      cards[i].c.querySelector('.rep-btn').click();
      const ov = document.getElementById('asOv');
      out.opened = ov ? __text(ov.querySelector('.slt-bar .slt-k')) : '';
      out.store = S.actionSheets === undefined;
      closeActionSheets();
    }
    switchTab('cockpit');
    return out;
  });
  R.ok(t.titles.includes('Risk Action Sheet') && t.titles.includes('Top 5 Action Sheet') && !t.titles.includes('Top 5 Risks'), 'the Reports tab has the Risk Action Sheet and Top 5 Action Sheet cards - and no Top 5 Risks card');
  R.ok(!t.titles.includes('Top 5 Responses') && !/Top 5 Responses/.test(t.text), 'the Top 5 Responses card is gone');
  R.ok(t.next, 'the card sits straight after the Top 5 Action Sheet card');
  R.ok(t.descs.every(d => /control/i.test(d) && /comment/i.test(d) && /\bwho\b/i.test(d) && /by when/i.test(d)), 'both action sheet cards say what the pages now carry - the controls, the comments, who and by when: ' + t.descs.join(' / '));
  R.ok(t.meta === '5 risks ticked for ' + label, 'the card counts the risks ticked for the month: ' + t.meta);
  R.ok(t.opened === 'Risk action sheet' && t.store, 'its button opens the risk action sheets, and opening them adds nothing to the client record (' + t.opened + ')');
}

// ── 5. a risk action sheet ──
{
  const t = await page.evaluate(() => {
    S.riskProfile.forEach(r => { r.sheet = ''; });
    openActionSheets('risk'); asNewSheet('risk');
    const out = { toast: document.getElementById('toast').textContent, risk: _asList('risk').length, all: _asList().length };
    closeActionSheets();
    return out;
  });
  R.ok(/Tick risks for the sheet on the cockpit.s risk ladder first/.test(t.toast) && t.risk === 0 && t.all === 0, 'with nothing ticked and nothing carried, no sheet - it asks for ticks first: ' + t.toast);
}
{
  const t = await page.evaluate(() => {
    ['r1', 'r2', 'r3'].forEach(id => toggleRiskSheet(id));
    openActionSheets('risk');
    const ov = document.getElementById('asOv');
    return { list: _sheetRisks().map(z => z.id), k: __text(ov.querySelector('.slt-bar .slt-k')), h: __text(ov.querySelector('.slt-bar .slt-h')),
      bar: [...ov.querySelectorAll('.slt-bar button')].map(b => ({ t: b.textContent.trim(), dis: b.disabled, title: b.title || '' })),
      sw: __switch(), accent: __accent(), kind: __asKind(), text: ov.textContent };
  });
  const find = re => t.bar.find(b => re.test(b.t)) || null;
  const nb = find(/New risk action sheet$/), im = find(/Import a returned sheet$/), pr = find(/Proposals from the leadership team/), cl = find(/^Close$/);
  const at = b => t.bar.indexOf(b);
  R.ok(t.list.join(',') === 'r1,r2,r3', 'ticked for the sheet: r1, r2, r3 - worst first (' + t.list.join(',') + ')');
  R.ok(t.k === 'Risk action sheet' && t.h === 'Fairbank Fabrications Ltd', 'the screen reads Risk action sheet, for the client');
  R.ok(t.sw.has && t.sw.top5 !== t.sw.risk && t.kind === 'risk', 'two tabs at the top - Top 5 action sheets | Risk action sheets - with Risk action sheets the one showing (' + t.kind + ')');
  R.ok(t.sw.has && t.sw.risk.indexOf(t.accent) >= 0, 'the tab showing is in the accent (' + t.sw.risk + ' / accent ' + t.accent + ')');
  R.ok(!!(nb && im && cl) && at(nb) < at(im) && at(im) < at(cl), 'the bar: New risk action sheet, Import a returned sheet, Close - in that order');
  R.ok(!pr && !/Proposals from the leadership team/.test(t.text), 'no Proposals from the leadership team button - the sheet itself carries the two-way table');
  R.ok(!!nb && !nb.dis && /^The risks ticked on the cockpit.s risk ladder, one action each, plus anything carried back$/.test(nb.title), 'New risk action sheet is live and says what goes on it: ' + (nb && nb.title));
  R.ok(/As many risks as you tick on the cockpit.s risk ladder, one action each with the control you recommend/.test(t.text) && /quick minute taker/.test(t.text), 'the intro says how the sheet is made, and that it ends with the meeting');
  R.ok(!/Top 5 report/i.test(t.text), 'and nothing on the screen points at a Top 5 report');
}
let sid;
{
  const t = await page.evaluate(() => {
    asNewSheet('risk');
    const l = _asList('risk'), s = l[0] || null, ov = document.getElementById('asOv');
    return { n: l.length, all: _asList().length, top5: _asList('top5').length, s: s ? JSON.parse(JSON.stringify(s)) : null,
      h3: [...ov.querySelectorAll('h3')].map(h => h.textContent.trim()) };
  });
  sid = t.s && t.s.id;
  R.ok(t.n === 1 && t.all === 1 && t.top5 === 0 && t.s.kind === 'risk' && t.s.no === 1, 'New risk action sheet makes risk sheet 1, its own kind, and no Top 5 sheet');
  R.ok(t.s && t.s.items.map(i => i.key).join(',') === 'risk:r1:a2:,risk:r2:a3:', 'one action a ticked risk, worst risk first, and for each its most pressing - the overdue one first (' + (t.s && t.s.items.map(i => i.key).join(',')) + ')');
  R.ok(t.h3.some(h => /^Risk action sheet 1\b/.test(h)), 'the sheet is headed Risk action sheet 1');
}
if (!sid) await R.done(browser, errors);

// a ticked risk with nothing open is listed with a box to say what needs doing
{
  const g = await page.evaluate(() => {
    const ov = document.getElementById('asOv');
    const btns = [...ov.querySelectorAll('button')].filter(b => /asAddRiskAction\(/.test(b.getAttribute('onclick') || ''));
    const b = btns.find(x => /['"]r3['"]/.test(x.getAttribute('onclick') || ''));
    if (!b) return { n: btns.length };
    b.setAttribute('data-t', 'gapadd');
    let box = null, named = false;
    for (let p = b.parentElement; p && p !== ov && !box; p = p.parentElement) {
      const ins = [...p.querySelectorAll('input, textarea')].filter(i => i.type !== 'checkbox' && i.type !== 'date');
      box = ins.find(i => /What needs to be done/i.test((i.placeholder || '') + ' ' + (i.title || '') + ' ' + (i.getAttribute('aria-label') || ''))) || (/What needs to be done/i.test(p.textContent) ? ins[0] || null : null);
    }
    for (let p = b.parentElement, k = 0; p && p !== ov && k < 5 && !named; p = p.parentElement, k++) named = /Vehicle movements in the yard/.test(p.textContent) && !p.querySelector('.as-item');
    if (box) box.setAttribute('data-t', 'gap');
    return { n: btns.length, box: !!box, named };
  });
  R.ok(g.n === 1 && g.box && g.named, 'the ticked risk with nothing open (Vehicle movements in the yard) is named, with a What needs to be done box and an Add button');
  if (g.box) {
    await page.type('[data-t=gap]', 'Put in a one-way system for the yard');
    await page.evaluate(() => document.querySelector('[data-t=gapadd]').click());
    await wait(page, 200);
    const t = await page.evaluate(sid => {
      const s = _asSheet(sid), r3 = __risk('r3'), made = (r3.actions || []).find(a => a.desc === 'Put in a one-way system for the yard') || null;
      return { made: made ? JSON.parse(JSON.stringify(made)) : null, prio: _suggestPriority(r3), items: s.items.map(i => i.key),
        left: [...document.querySelectorAll('#asOv button')].filter(b => /asAddRiskAction\(/.test(b.getAttribute('onclick') || '')).length };
    }, sid);
    R.ok(!!t.made && /^act_/.test(t.made.id) && t.made.status === 'Not started' && t.made.owner === '' && t.made.due === '' && t.made.priority === t.prio && !!t.made.createdAt,
      'Add makes a real action on the risk - as typed, Not started, priority from the risk (' + (t.made && t.made.priority) + ')');
    R.ok(t.made && t.items.length === 3 && t.items[2] === 'risk:r3:' + t.made.id + ':' && t.left === 0, 'and puts it on the sheet as the third line; the gap is gone');
  }
}
// more from the plan - no five cap on a risk sheet
{
  const t = await page.evaluate(sid => {
    const opts = [...((document.getElementById('asAdd-' + sid) || {}).options || [])].map(o => o.value);
    const first = __addFromPlan(sid, 'risk:r1:a1:');
    const r2 = __risk('r2');
    r2.actions.push({ id: 'b1', desc: 'Rack the heavy stock at waist height', owner: '', due: '', status: 'Not started' },
      { id: 'b2', desc: 'Manual handling training for the stores staff', owner: 'Sam', due: '', status: 'Not started' });
    _asRender();
    const more = [__addFromPlan(sid, 'risk:r2:b1:'), __addFromPlan(sid, 'risk:r2:b2:')];
    // the draft screen on each line: the line whose page carries its risk's table, when that is an earlier line
    const same = _asSheet(sid).items.map((it, i) => { const el = document.getElementById('asI-' + sid + '-' + i), m = /Same risk as line (\d+): its actions table prints once, on that line.s page\. This page lists this action only\./i.exec(el ? el.innerText : '');
      return m ? +m[1] : 0; });
    return { opts, first, more, items: _asSheet(sid).items.map(i => i.key), same };
  }, sid);
  R.ok(t.opts.includes('risk:r1:a1:') && !t.opts.some(v => /^risk:(r4|r5|r6|r7):/.test(v)), 'Add from the plan offers the ticked risks\' other actions, and nothing from a risk not ticked');
  R.ok(t.first === 'ok' && t.items[3] === 'risk:r1:a1:', 'r1\'s second action goes on as the fourth line');
  R.ok(t.more.join(',') === 'ok,ok' && t.items.length === 6, 'and on past five - a risk sheet has no cap (' + t.items.length + ' lines)');
  R.ok(t.same.join(',') === '0,0,0,1,2,2', 'the draft screen warns on each later line on a risk already on the sheet, naming the line whose page carries the table (' + t.same.join(',') + ')');
}
{
  const t = await page.evaluate(sid => {
    asNewSheet('risk');
    const nb = [...document.querySelectorAll('#asOv .slt-bar button')].find(b => /New risk action sheet$/.test(b.textContent.trim()));
    asRec(sid, 'risk:r1:a2:', 'A written rescue plan, and the roof hatch locked until it is in place.');
    asRec(sid, 'risk:r2:a3:', 'A hand pallet truck rated 2,000 kg, on the pre-use check sheet.');
    return { n: _asList('risk').length, dis: !!nb && nb.disabled, title: nb ? nb.title : '', live: _asCandidates(null).map(c => c.key), keys: _asSheet(sid).items.map(i => i.key) };
  }, sid);
  R.ok(t.n === 1 && t.dis && t.title === 'Finish the draft sheet first', 'one risk draft at a time: a second is refused and the button says why');
  R.ok(!t.live.some(k => t.keys.includes(k)), 'an action on the risk sheet is never offered for a Top 5 sheet as well');
}
// the Top 5 tab: its own list, untouched
{
  const t = await page.evaluate(() => {
    const ov = document.getElementById('asOv'), before = __switch();
    const tb = [...ov.querySelectorAll('button')].find(b => b.textContent.trim() === 'Top 5 action sheets'); if (tb) tb.click();
    const ov2 = document.getElementById('asOv'), after = __switch();
    const out = { kind: __asKind(), first: [...ov2.querySelectorAll('.slt-bar button')].some(b => /First five$/.test(b.textContent.trim())),
      none: /No sheet yet/.test(ov2.textContent), riskShown: [...ov2.querySelectorAll('h3')].some(h => /^Risk action sheet/.test(h.textContent.trim())),
      k: __text(ov2.querySelector('.slt-bar .slt-k')), swapped: after.top5 === before.risk && after.risk === before.top5, top5: _asList('top5').length };
    const rb = [...ov2.querySelectorAll('button')].find(b => b.textContent.trim() === 'Risk action sheets'); if (rb) rb.click();
    const ov3 = document.getElementById('asOv');
    out.back = __asKind() === 'risk' && [...ov3.querySelectorAll('h3')].some(h => /^Risk action sheet 1\b/.test(h.textContent.trim()));
    return out;
  });
  R.ok(t.kind === 'top5' && t.k === 'Top 5 action sheet' && t.first && t.none && !t.riskShown && t.top5 === 0, 'the Top 5 tab shows the Top 5 sheets alone - still none, First five ready');
  R.ok(t.swapped, 'the tab picked takes the accent');
  R.ok(t.back, 'and the Risk action sheets tab brings the risk sheet back');
}

// ── 6. the sheet the client works from ──
{
  const t = await page.evaluate(async sid => { const b = await __build(sid), s = _asSheet(sid); b.items = s.items.length;
    // each line's risk's open actions, as tab 4 lists them (none of these risks has a control on tab 3) - on
    // the first line on each risk; a later line on a risk already on the sheet lists its own action alone
    b.first = s.items.map((it, i) => s.items.findIndex(j => j.ref && it.ref && j.ref.a === it.ref.a));
    b.want = s.items.map((it, i) => { if (b.first[i] < i) return [it.ref.b];
      const r = _execRiskOf({ ref: it.ref }); return ((r && r.actions) || []).filter(a => a && !a.deleted && !a.hideFromPlan && String(a.desc || '').trim() && a.status !== 'Complete' && a.status !== 'Accepted').map(a => a.id); });
    return b; }, sid);
  // pdf-lib widens a widget's rectangle by its 0.8 border, so allow a point
  const s = t.said, near = (a, b) => Math.abs(a - b) <= 1;
  const CW = 595.28 - 80, MR = 595.28 - 40;
  R.ok([1, 2, 3, 4].every(n => ['what', 'who', 'due'].every(f => t.names.includes('as__m' + n + '_' + f))) && !t.names.includes('as__m5_what'), 'the sheet ends with four rows for the meeting\'s actions - what, who, by when');
  // none of these risks has a control on tab 3, so each line's rows are its risk's open actions
  const lines = Array.from({ length: t.items }, (_, i) => i + 1), want = n => t.want[n - 1] || [];
  R.ok(want(1).join(',') === 'a1,a2' && want(2).join(',') === 'a3,b1,b2' && want(3).length === 1, 'setup: r1 has two open actions, r2 three, r3 the one written on the sheet');
  R.ok(t.first.join(',') === '0,1,2,0,1,1' && want(4).join(',') === 'a1' && want(5).join(',') === 'b1' && want(6).join(',') === 'b2',
    'setup: lines 4, 5 and 6 are later lines on r1 and r2 - each lists its own action alone (' + t.first.join(',') + ')');
  R.ok(lines.every(n => want(n).every((a, k) => ['cmt', 'who', 'due'].every(f => t.names.includes('as_' + n + '_r' + (k + 1) + '_' + f))) && !t.names.includes('as_' + n + '_r' + (want(n).length + 1) + '_cmt') && t.names.includes('as_' + n + '_what'))
    && t.names.includes('as__general') && !t.names.some(n => /^as_\d+_c\d+_/.test(n)),
    'every line has the two-way table - a row for each of its risk\'s open actions (a later line on the same risk, its own action alone), with comments, who and by when - and a comments box, as on the Top 5 sheet');
  {
    // a later line's page says where the rest of its risk's table is - by RISK n, this being a risk sheet
    const iOf = n => { const i = s.findIndex(x => new RegExp('^RISK ' + n + ' OF ' + t.items + '\\b').test(String(x).trim())); return i < 0 ? Infinity : i; };
    const notes = s.map((x, i) => ({ x: String(x).trim(), i })).filter(o => /^THE OTHER ACTIONS ON THIS RISK/.test(o.x));
    const at = (n, f) => notes.filter(o => o.x === 'THE OTHER ACTIONS ON THIS RISK ARE ON THE PAGE FOR RISK ' + f && o.i > iOf(n) && o.i < iOf(n + 1)).length === 1;
    R.ok(notes.length === 3 && at(4, 1) && at(5, 2) && at(6, 2), 'a later line\'s page says where the rest of its risk\'s table is - on the page for Risk 1 or Risk 2 (' + notes.map(o => o.x).join(' | ') + ')');
  }
  R.ok(!t.names.some(n => /^as__(name|role)$/.test(n) || /^as_\d+_(o_\w+|date|by)$/.test(n)), 'no name or role on the cover, and no what-happened ticks or done / date / by whom boxes');
  R.ok(t.multiCmt === true && t.multiWhat === true, 'the comments and the comments box take several lines');
  R.ok(t.vals.w11 === 'Dave' && t.vals.d11 === dmy(day(30)) && t.vals.w12 === 'Dave' && t.vals.d12 === dmy(day(-5)) && t.vals.w22 === '' && t.vals.d22 === '',
    'who and by when come printed from the plan, the date as dd/mm/yyyy, blank where the plan has none (' + JSON.stringify(t.vals) + ')');
  R.ok(!!t.rects.what && near(t.rects.what.w, CW - 214) && near(t.rects.what.h, 26) && t.multi === true
    && !!t.rects.who && near(t.rects.who.x, MR - 204) && near(t.rects.who.w, 96) && near(t.rects.who.h, 20)
    && !!t.rects.due && near(t.rects.due.x, MR - 100) && near(t.rects.due.w, 100) && near(t.rects.due.h, 20), 'the rows are laid out as agreed: what (several lines), who, by when');
  R.ok(t.meta.v === 3 && !('ctls' in t.meta) && t.meta.kind === 'risk' && t.meta.no === 1 && t.meta.sheet === sid && (t.meta.keys || []).length === t.items && t.meta.client === 'Fairbank Fabrications Ltd'
    && Array.isArray(t.meta.rows) && t.meta.rows.length === t.items && t.meta.rows.every((rs, i) => JSON.stringify((rs || []).map(r => r.a)) === JSON.stringify(t.want[i]) && (rs || []).every(r => r.c === null)),
    'the sheet knows its kind, its number, its client, its lines and each line\'s action rows (v3)');
  R.ok(t.pages >= 1 + t.items && t.pages <= 3 + t.items, 'a cover, a page a line, then the meeting part (' + t.pages + ' pages, ' + t.items + ' lines)');
  R.ok(lines.every(n => s.some(x => new RegExp('^RISK ' + n + ' OF ' + t.items + '\\b').test(String(x).trim()))) && !s.some(x => /^ACTION \d+ OF \d+\b/.test(String(x).trim())), 'each page is headed RISK n OF ' + t.items + ', not ACTION n OF N');
  R.ok(s.includes('RISK ACTION SHEET') && !s.includes('TOP 5 ACTIONS'), 'the cover is titled Risk Action Sheet, not Top 5 Actions');
  {
    const U = x => String(x).trim().toUpperCase(), iOf = test => s.findIndex(x => test(U(x)));
    const iP = iOf(x => x === 'PURPOSE'), iG = iOf(x => /^THE (\d+|ONE) AT A GLANCE$/.test(x)), iW = iOf(x => x === 'WHAT WE NEED FROM YOU'), iH = iOf(x => x === 'HOW TO READ THE SCORES'), iT = iOf(x => x === 'YOUR ACTIONS - TELL US WHAT YOU THINK');
    R.ok(iP >= 0 && iP < iG && iG < iW && iW < iH && iH < iT, 'the cover reads like a procedure: Purpose, at a glance, What we need from you, How to read the scores - then the pages');
    R.ok(!s.some(x => /in place today/i.test(x)) && !s.some(x => /what happened/i.test(x)), '"In place today" and "What happened" are gone');
    R.ok(s.filter(x => U(x) === 'YOUR ACTIONS - TELL US WHAT YOU THINK').length >= t.items && s.filter(x => U(x) === 'COMMENTS ON THIS RISK').length >= t.items, 'every line\'s page has the actions table and Comments on this risk');
  }
  riskShape = shape(t.names); riskHeads = heads(s);
  R.ok(riskShape === SHAPE, 'the form\'s shape, line by line: ' + riskShape);
  R.ok(s.some(x => /^RISK ACTION SHEET 1\s/.test(x)) && s.includes('Risk action sheet 1') && !s.some(x => /TOP 5 ACTION SHEET|Top 5 action sheet/.test(x)), 'every page\'s masthead and footer say Risk action sheet 1');
  const iFrom = s.indexOf('FROM THE MEETING'), iElse = s.indexOf('ANYTHING ELSE TO TELL US');
  R.ok(iFrom >= 0 && iFrom < iElse && s.includes('Nothing minuted this month yet.'), 'From the meeting comes before Anything else, and says so when nothing is minuted yet');
}
{
  const t = await page.evaluate(async sid => {
    const out = []; const keep = window._sltSaveBlob; window._sltSaveBlob = (b, f) => out.push(f);
    try { await downloadActionSheet(sid); } finally { window._sltSaveBlob = keep; }
    return { out, status: _asSheetStatus(_asSheet(sid)).label };
  }, sid);
  R.ok(t.out.length === 1 && /^risk-action-sheet-1-fairbank-fabrications-ltd-\d{4}-\d\d-\d\d\.pdf$/.test(t.out[0]) && /With the client since/.test(t.status), 'downloaded as ' + t.out[0] + ', and the sheet is with the client');
}
await page.evaluate(() => closeActionSheets());

// ── 7. the quick minute taker ──
const NOTE = 'Yard gate is broken and forklift training is overdue.';
const ACTS = [{ what: 'Fence off the yard', who: 'Jo Fine', due: '2026-11-15' }, { what: 'Book forklift training', who: 'Sam Line', due: '2026-12-01' }];
let qm1 = '', qm2 = '';
{
  const t = await page.evaluate(() => {
    openQuickMinutes();
    const m = _qmCurrent();
    return { open: !!document.getElementById('qmOv'), m: m ? JSON.parse(JSON.stringify(m)) : null, utc: new Date().toISOString().slice(0, 10), local: _asToday() };
  });
  qm1 = (t.m && t.m.id) || '';
  R.ok(t.open && !!t.m && t.m.quick === true && t.m.status === 'open' && t.m.forum === 'Client meeting' && /^mtg_/.test(t.m.id), 'Minutes opens the quick minute taker on a new client meeting');
  R.ok(!!t.m && (t.m.date === t.utc || t.m.date === t.local) && (t.m.attendees || []).map(a => a.name + '|' + a.email).join(';') === 'Jo Fine|jo@fairbank.example;Sam Line|sam@fairbank.example',
    'dated today, with the leadership team already in the room');
}
if (!qm1) await R.done(browser, errors);
{
  const found = await page.evaluate(() => {
    const ov = document.getElementById('qmOv'), tas = [...ov.querySelectorAll('textarea')];
    const ta = tas.find(x => /qmSet\(\s*['"]note['"]/.test(x.getAttribute('oninput') || '')) || tas[0] || null;
    if (ta) ta.setAttribute('data-t', 'qmnote');
    return !!ta;
  });
  if (found) await page.type('[data-t=qmnote]', NOTE);
  const t = await page.evaluate(() => { const a = document.activeElement; const kept = !!a && a.isConnected && a.getAttribute('data-t') === 'qmnote'; if (a) a.blur(); return { kept, note: _qmCurrent().note }; });
  R.ok(found && t.kept && t.note === NOTE, 'notes are kept as they are typed, and the cursor stays in the box');
}
{
  const t = await page.evaluate(() => { qmDelAttendee(1); const a = _qmCurrent().attendees.length; qmAddTeam(); return { a, b: _qmCurrent().attendees.map(x => x.name).join(',') }; });
  R.ok(t.a === 1 && t.b === 'Jo Fine,Sam Line', 'someone not there comes off, and the leadership team comes back in one click');
}
{
  const t = await page.evaluate(ACTS => {
    const m = _qmCurrent();
    qmAddAction(); qmAddAction();
    const ids = _sltActions(m).map(d => d.id), found = [];
    ids.forEach((id, i) => {
      const A = ACTS[i]; if (!A) return;
      let f = __qmFields(id); found.push(Object.keys(f).sort().join(','));
      if (f.decision) __put(f.decision, A.what);
      f = __qmFields(id); if (f.owner) __put(f.owner, A.who);
      f = __qmFields(id); if (f.due) __put(f.due, A.due);
    });
    return { found, ds: _sltActions(m).map(d => JSON.parse(JSON.stringify(d))), mid: m.id, date: m.date, fmt: fmtDate(m.date) };
  }, ACTS);
  R.ok(t.found.length === 2 && t.found.every(f => f === 'decision,due,owner'), 'each action has what, who and by when to type into (' + t.found.join(' / ') + ')');
  R.ok(t.ds.length === 2 && t.ds.every(d => d.meetingId === t.mid && d.forum === 'Client meeting' && d.agendaItem === 0 && d.status === 'Agreed' && d.date === t.date && !d.raised && d.why === 'Agreed at the client meeting on ' + t.fmt && /^dec_/.test(d.id)),
    'each is a decision on the register, of this meeting, agreed at the client meeting');
  R.ok(t.ds.map(d => d.decision + '|' + d.owner + '|' + d.due).sort().join(';') === ACTS.map(a => a.what + '|' + a.who + '|' + a.due).sort().join(';'), 'what, who and by when are kept as typed');
}
{
  const t = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#qmOv button')].find(x => /^Close\s*[-–]\s*keep for later$/i.test(x.textContent.trim()));
    if (b) b.click();
    const gone = !document.getElementById('qmOv');
    openQuickMinutes();
    const m = _qmCurrent();
    return { btn: !!b, gone, id: m.id, note: m.note, n: _sltActions(m).length, shown: [...document.querySelectorAll('#qmOv input')].map(i => i.value) };
  });
  R.ok(t.btn && t.gone, 'Close - keep for later puts the minute taker away');
  R.ok(t.id === qm1 && t.note === NOTE && t.n === 2 && ACTS.every(a => t.shown.includes(a.what)), 'opened again it carries on with the same meeting, its notes and its actions');
}
{
  const t = await page.evaluate(async () => {
    const m = _qmCurrent(); qmAddAction();
    const three = _sltActions(m).length, ap0 = _apList().length;
    const b = [...document.querySelectorAll('#qmOv button')].find(x => /qmDone\(/.test(x.getAttribute('onclick') || ''));
    if (b) b.click();
    await new Promise(r => setTimeout(r, 300));
    const acts = _decisions().filter(d => d.meetingId === m.id);
    return { btn: !!b, three, acts: acts.map(d => d.raised), plan: _apList().slice(ap0).map(a => a.desc + '|' + a.owner + '|' + a.due), grew: _apList().length - ap0,
      status: m.status, at: !!m.finishedAt, gone: !document.getElementById('qmOv') };
  });
  R.ok(t.btn && t.three === 3 && t.acts.length === 2, 'Done drops the empty third line');
  R.ok(t.grew === 2 && t.acts.every(r => r === 1) && t.plan.slice().sort().join(';') === ACTS.map(a => a.what + '|' + a.who + '|' + a.due).sort().join(';'), 'and puts each action on the execution plan once, with who and by when');
  R.ok(t.status === 'finished' && t.at && t.gone, 'the meeting is finished and the minute taker closes');
}
{
  const t = await page.evaluate(() => {
    openQuickMinutes(); const m = _qmCurrent();
    const out = { id: m.id, status: m.status, quick: m.quick, att: (m.attendees || []).length, acts: _sltActions(m).length, note: m.note || '' };
    closeQuickMinutes();
    out.kept = !!_qmCurrent() && _qmCurrent().id === m.id;
    return out;
  });
  qm2 = t.id;
  R.ok(t.id !== qm1 && t.status === 'open' && t.quick === true && t.acts === 0 && t.note === '' && t.att === 2 && t.kept, 'after Done, Minutes starts a new meeting with the team in the room');
}
{
  const t = await page.evaluate(() => { openSltMeeting(); const c = _sltCur(); const out = { id: c ? c.id : '', quick: !!(c && c.quick) }; closeSltMeeting(); return out; });
  R.ok(!!t.id && !t.quick && t.id !== qm1 && t.id !== qm2, 'the leadership meeting never takes a client meeting\'s quick minutes as its own');
}

// ── 8. From the meeting, on the sheet ──
{
  const t = await page.evaluate(async (sid, qm1, ACTS) => {
    const b = await __build(sid), m = S.meetings.find(x => x.id === qm1);
    return { said: b.said, fmt: fmtDate(m.date), dues: ACTS.map(a => fmtDate(a.due)) };
  }, sid, qm1, ACTS);
  const s = t.said, iFrom = s.indexOf('FROM THE MEETING'), iElse = s.indexOf('ANYTHING ELSE TO TELL US');
  R.ok(iFrom >= 0 && iFrom < iElse, 'the sheet carries From the meeting, before Anything else');
  R.ok(s.some(x => x.indexOf(t.fmt) >= 0 && /present: .*Jo Fine.*Sam Line/.test(x)), 'each meeting is headed with its date and who was there');
  R.ok(s.includes(NOTE), 'the notes are printed');
  R.ok(ACTS.every((a, i) => s.some(x => x.indexOf(a.what) >= 0 && x.indexOf(a.who) >= 0 && x.indexOf(t.dues[i]) >= 0 && /Not started/.test(x))), 'each action is a line - what, who, by when, and where it stands on the plan, live (Not started)');
  // the second meeting was opened and closed with nothing written: it never happened, so it is not printed
  R.ok(!s.includes('No notes.') && !s.includes('Nothing minuted this month yet.') && s.filter(x => /present:/.test(x)).length === 1, 'a meeting opened and left empty is not printed - only the one minuted');
  R.ok(s.some(x => /^ACTIONS FROM THIS MEETING/i.test(x)) && ['WHAT', 'WHO', 'BY WHEN (DD/MM/YYYY)'].every(c => s.some(x => x.toUpperCase() === c)), 'then the rows for the meeting\'s actions, under What, Who and By when');
}

// ── 9. the sheet comes back, with an action from the meeting written on it ──
const MACT = { what: 'Get the yard gate fixed', who: 'Dave Morley', due: '15/11/2026' };
{
  const t = await page.evaluate(async (sid, MACT) => {
    const bytes = await buildActionSheetPDF(sid);
    const doc = await PDFLib.PDFDocument.load(bytes), form = doc.getForm(), missing = [];
    const set = (n, v) => { try { form.getTextField(n).setText(v); } catch (e) { missing.push(n); } };
    // line 1 is r1's overdue rescue-plan stop (a2) - its own row is the second, under the edge protection
    set('as_1_r2_cmt', 'Rescue plan written and the hatch locked.');
    set('as_1_r2_who', 'Dave Morley');
    set('as_1_r2_due', '20/10/2030');
    set('as__m1_what', MACT.what);
    set('as__m1_who', MACT.who);
    set('as__m1_due', MACT.due);
    const before = _decisions().length;
    await _asImportFiles([new File([await doc.save()], 'returned.pdf', { type: 'application/pdf' })]);
    const s = _asSheet(sid), d = _decisions().find(x => x.decision === MACT.what) || null, m = d ? S.meetings.find(x => x.id === d.meetingId) : null;
    return { missing, toast: document.getElementById('toast').textContent, item: JSON.parse(JSON.stringify(s.items[0])), returnedBy: s.returnedBy, d: d ? JSON.parse(JSON.stringify(d)) : null,
      mq: !!(m && m.quick), mOpen: m ? m.status : '', grew: _decisions().length - before, cur: (_qmCurrent() || {}).id || '', quickN: S.meetings.filter(x => x && x.quick).length };
  }, sid, MACT);
  {
    const rows = (t.item.resp || {}).rows || [], c = rows[0] || {};
    R.ok(!t.missing.length && rows.length === 1 && c.a === 'a2' && c.c === null && c.text === 'Stop roof access until a rescue plan is written' && c.gap === false
      && c.cmt === 'Rescue plan written and the hatch locked.' && c.who === 'Dave Morley' && c.whoChanged === true && c.due === '2030-10-20' && c.dueChanged === true && !t.item.resp.outcome && t.returnedBy === '',
      'the line\'s answer comes in as on the Top 5 sheet - against its action, with who and by when as changed; the row left as printed is not counted; no name needed' + (t.missing.length ? ' - not on the sheet: ' + t.missing.join(', ') : ''));
  }
  R.ok(/\b1 meeting action\b/.test(t.toast) && !/Not imported/.test(t.toast), 'the import says one meeting action came in: ' + t.toast);
  R.ok(!!t.d && t.d.owner === 'Dave Morley' && t.d.due === '2026-11-15' && t.d.forum === 'Client meeting' && t.d.agendaItem === 0 && t.d.status === 'Agreed' && !t.d.raised,
    'the row written on the sheet becomes an action of the quick minutes - what, who, and 15/11/2026 read as a date');
  R.ok(!!t.d && t.mq && t.mOpen === 'open' && t.d.meetingId === qm2 && t.cur === qm2 && t.grew === 1 && t.quickN === 2, 'it lands in the open client meeting, not a new one');
}
{
  const t = await page.evaluate(async sid => {
    const bytes = await buildActionSheetPDF(sid);
    const doc = await PDFLib.PDFDocument.load(bytes), form = doc.getForm();
    form.getTextField('as__m2_what').setText('Check the yard lighting');
    await _asImportFiles([new File([await doc.save()], 'meeting-only.pdf', { type: 'application/pdf' })]);
    const d = _decisions().find(x => x.decision === 'Check the yard lighting');
    return { toast: document.getElementById('toast').textContent, d: !!d, mid: d ? d.meetingId : '', rows: JSON.parse(JSON.stringify((_asSheet(sid).items[0].resp || {}).rows || [])) };
  }, sid);
  R.ok(!/Not imported|nothing filled in/.test(t.toast) && t.d && t.mid === qm2 && t.rows.length === 1 && t.rows[0].cmt === 'Rescue plan written and the hatch locked.',
    'a sheet back with only a meeting row filled in is taken, and the answers already in are kept: ' + t.toast);
}
{
  const t = await page.evaluate(() => { openQuickMinutes(); const vals = [...document.querySelectorAll('#qmOv input')].map(i => i.value); const id = _qmCurrent().id; closeQuickMinutes(); return { vals, id }; });
  R.ok(t.id === qm2 && t.vals.includes(MACT.what) && t.vals.includes('Dave Morley') && t.vals.includes('2026-11-15') && t.vals.includes('Check the yard lighting'), 'opened again, the minute taker shows them, ready for Done');
}
{
  // the meeting with no notes now has actions in it, so it prints - saying No notes.
  const s = await page.evaluate(async sid => (await __build(sid)).said, sid);
  R.ok(s.includes('No notes.') && s.some(x => /Get the yard gate fixed \(Dave Morley, .+\).*Agreed/.test(x)) && s.filter(x => /present:/.test(x)).length === 2,
    'a meeting with actions and no notes is printed, saying No notes., with its actions as agreed');
}

// ── 10. the leadership team's proposals: the code and what came back stay, the way in from the sheet is gone ──
{
  const t = await page.evaluate(async () => {
    const out = {};
    openTop5Review(); out.k = __text(document.querySelector('#t5Ov .slt-bar .slt-k')); closeTop5Review();
    openActionSheets('risk');
    out.btn = [...document.querySelectorAll('#asOv button')].some(x => x.textContent.trim() === 'Proposals from the leadership team' || /openTop5Review\(/.test(x.getAttribute('onclick') || ''));
    closeActionSheets();
    const keep = S.riskProfile.map(r => r.sheet), saved = [], keepS = window._sltSaveBlob;
    window._sltSaveBlob = (bl, f) => saved.push(f);
    try {
      S.riskProfile.forEach(r => { r.sheet = ''; });
      await downloadTop5Form(); out.toast = document.getElementById('toast').textContent; out.savedNone = saved.length;
      S.riskProfile.forEach((r, i) => { r.sheet = keep[i]; });
      await downloadTop5Form(); out.fname = saved[0] || '';
    } finally { window._sltSaveBlob = keepS; S.riskProfile.forEach((r, i) => { r.sheet = keep[i]; }); }
    const doc = await PDFLib.PDFDocument.load(await buildTop5FormPDF());
    out.ids = JSON.parse(doc.getForm().getTextField('t5__meta').getText()).ids; out.sheet = _sheetRisks().map(z => z.id);
    return out;
  });
  R.ok(t.k === 'Risk action sheet · proposals from the leadership team · ' + label, 'the proposals screen is still in the code, as part of the risk action sheet: ' + t.k);
  R.ok(!t.btn, 'but the risk sheets screen no longer opens it - the sheet is the one report the leadership team gets');
  R.ok(/Tick risks for the sheet on the cockpit.s risk ladder first/.test(t.toast) && t.savedNone === 0, 'with nothing ticked there is no form to send, and it says why');
  R.ok(t.fname === 'risk-action-sheet-proposals-fairbank-fabrications-ltd-' + month + '.pdf', 'the form downloads as ' + t.fname);
  R.ok(t.ids.join(',') === t.sheet.join(',') && t.sheet.join(',') === 'r1,r2,r3', 'the form carries exactly the risks ticked for the sheet, in the sheet\'s order (' + t.ids.join(',') + ')');
}

// ── 11. the two kinds kept apart: numbering, carried lines, the live-sheet rule ──
{
  const t = await page.evaluate(async sid => {
    const s1 = _asSheet(sid), k2 = s1.items[1].key, rec2 = s1.items[1].rec;
    asDecide(sid, k2, 'carry', 1);
    const out = { carried: (_asItem(sid, k2) || {}).decision, k2, rec2 };
    const live1 = s1.items.filter(i => !i.decision).map(i => i.key);     // still in play on risk sheet 1
    asNewSheet();
    const t5 = _asList('top5')[0] || null;
    out.t5 = t5 ? { no: t5.no, kind: t5.kind || '', keys: t5.items.map(i => i.key), from: t5.items.map(i => i.carriedFrom || 0) } : null;
    out.clash = t5 ? t5.items.map(i => i.key).filter(k => live1.includes(k)) : [];
    if (t5) {
      const b = await __build(t5.id);
      out.pdf = { m: b.names.filter(n => /^as__m\d/.test(n)).length, from: b.said.includes('FROM THE MEETING'), cover: b.said.includes('TOP 5 ACTIONS'), mast: b.said.some(x => /^TOP 5 ACTION SHEET 1\s/.test(x)), kind: b.meta.kind || '',
        names: b.names, said: b.said, v: b.meta.v, rows: b.meta.rows, ctls: b.meta.ctls, items: t5.items.length };
      const saved = [], keep = window._sltSaveBlob; window._sltSaveBlob = (bl, f) => saved.push(f);
      try { await downloadActionSheet(t5.id); } finally { window._sltSaveBlob = keep; }
      out.name = saved[0] || '';
    }
    // the next risk sheet is made while the Top 5 sheet is still out: the carry waited for it
    asNewSheet('risk');
    const r2 = _asList('risk').find(x => x.no === 2) || null;
    out.r2 = r2 ? { kind: r2.kind, first: r2.items[0] ? { key: r2.items[0].key, from: r2.items[0].carriedFrom, rec: r2.items[0].rec } : null, keys: r2.items.map(i => i.key) } : null;
    out.r2clash = r2 ? r2.items.map(i => i.key).filter(k => live1.includes(k) || (out.t5 ? out.t5.keys.includes(k) : false)) : [];
    out.riskN = _asList('risk').length;
    if (t5) asDeleteSheet(t5.id);
    out.t5left = _asList('top5').length;
    return out;
  }, sid);
  R.ok(t.carried === 'carry', 'a line on the risk sheet is carried');
  R.ok(!!t.t5 && t.t5.no === 1 && (t.t5.kind === 'top5' || t.t5.kind === ''), 'numbering is per kind: the first Top 5 sheet is Sheet 1 though risk sheet 1 exists');
  R.ok(!!t.t5 && t.t5.from.every(x => !x) && !t.clash.length && !t.t5.keys.includes(t.k2), 'a line carried on a risk sheet waits for the next risk sheet - it is not put on a Top 5 sheet, and no action is live on both');
  R.ok(!!t.pdf && t.pdf.m === 0 && !t.pdf.from && t.pdf.cover && t.pdf.mast && (t.pdf.kind === 'top5' || t.pdf.kind === ''), 'a Top 5 sheet prints as it always has - no From the meeting, no meeting rows, even with meetings minuted');
  {
    const all = HEADS.concat(['AT A GLANCE']).join('|'), t5Shape = t.pdf ? shape(t.pdf.names) : '', t5Heads = t.pdf ? heads(t.pdf.said) : '';
    R.ok(!!t.pdf && t5Shape === SHAPE && t5Shape === riskShape && t.pdf.v === 3 && t.pdf.ctls === undefined && Array.isArray(t.pdf.rows) && t.pdf.rows.length === t.pdf.items,
      'both kinds have the same form, line by line - the actions table (v3) and the comments box (' + t5Shape + ')');
    R.ok(t5Heads === all && riskHeads === all, 'and the same cover and pages, heading for heading (' + t5Heads + ' / ' + riskHeads + ')');
    R.ok(!!t.pdf && t.pdf.said.some(x => /^ACTION 1 OF \d+\b/.test(String(x).trim())) && !t.pdf.said.some(x => /^RISK \d+ OF \d+\b/.test(String(x).trim())), 'the Top 5 sheet\'s pages keep ACTION n OF N');
  }
  R.ok(/^top-5-action-sheet-1-/.test(t.name || '') && t.t5left === 0, 'it still downloads as top-5-action-sheet-1-..., and it can be deleted (' + t.name + ')');
  R.ok(!!t.r2 && t.r2.kind === 'risk' && !!t.r2.first && t.r2.first.key === t.k2 && t.r2.first.from === 1 && t.r2.first.rec === t.rec2 && t.riskN === 2,
    'the next risk sheet leads with the line carried back from risk sheet 1, its recommendation with it - though a Top 5 sheet was made in between');
  R.ok(!!t.r2 && !t.r2clash.length, 'and nothing still live on risk sheet 1 or the Top 5 sheet goes out on risk sheet 2 as well');
}

// ── 12. it all survives a reload ──
const snap = () => page.evaluate(() => JSON.stringify({
  sheets: S.actionSheets, marks: S.riskProfile.map(r => r.id + ':' + (r.sheet || '')),
  quick: (S.meetings || []).filter(m => m && m.quick).map(m => [m.id, m.status, m.note, (m.attendees || []).length].join('|')),
  acts: (S.decisions || []).filter(d => d.forum === 'Client meeting').map(d => [d.id, d.meetingId, d.decision, d.owner, d.due, d.raised].join('|')) }));
await page.evaluate(() => saveData());
const saved = await snap();
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"');
await wait(page, 500);
await inject();
R.ok(await snap() === saved, 'after a reload the ticks, the sheets, the quick minutes and their actions read back exactly as saved');
{
  const meta = await page.evaluate(() => { switchTab('reports'); const c = [...document.querySelectorAll('#tab-reports .rep-card')].find(x => __text(x.querySelector('h3')) === 'Risk Action Sheet'); return c ? __text(c.querySelector('.rep-meta')) : ''; });
  R.ok(meta === '3 risks ticked for ' + label + ' · 2 sheets', 'the Reports card counts the ticks and the risk sheets: ' + meta);
}
{
  // two risk sheets and no Top 5 sheet: the Top 5 Action Sheet card must not show a risk sheet as its own
  const meta = await page.evaluate(() => { const c = [...document.querySelectorAll('#tab-reports .rep-card')].find(x => __text(x.querySelector('h3')) === 'Top 5 Action Sheet'); const m = c ? __text(c.querySelector('.rep-meta')) : ''; switchTab('cockpit'); return m; });
  R.ok(meta === 'Five actions out, comments back against each control, a decision each', 'the Top 5 Action Sheet card counts Top 5 sheets only: ' + meta);
}

// ── 13. after review: the screens stay true to each other, and nothing is recorded that did not happen ──
{
  // the proposals screen opens over the risk sheets screen; closing it redraws what is underneath
  const t = await page.evaluate(() => {
    toggleRiskSheet('r6');                     // Noise from the press shop - nothing open on it
    openActionSheets('risk');
    const gapBtn = () => [...document.querySelectorAll('#asOv button')].some(b => /asAddRiskAction\(.*'r6'\)/.test(b.getAttribute('onclick') || ''));
    const before = gapBtn();
    openTop5Review(); t5AddOwn('r6');
    const own = _top5Resp().own.r6, key = 'own|' + (own.length - 1);
    t5Edit('r6', key, 'what', 'Fit acoustic panels in the press shop'); t5Apply('r6');
    closeTop5Review();
    const made = (__risk('r6').actions || []).find(a => a.desc === 'Fit acoustic panels in the press shop') || null;
    const s2 = _asList('risk').find(x => x.no === 2);
    const opts = [...((document.getElementById('asAdd-' + s2.id) || {}).options || [])].map(o => o.value);
    return { before, made: !!made, after: gapBtn(), offered: !!made && opts.includes('risk:r6:' + made.id + ':'), still: !!document.getElementById('asOv') };
  });
  R.ok(t.before && t.made && t.still && !t.after && t.offered, 'closing the proposals screen redraws the risk sheets screen under it - the gap is gone and the new action is offered, so it cannot be made twice');
}
{
  // a carry taken back on the sheet it was carried to; the earlier sheet is history
  const t = await page.evaluate(() => {
    const s1 = _asList('risk').find(x => x.no === 1), s2 = _asList('risk').find(x => x.no === 2), k = s2.items[0].key;
    asDecide(s2.id, k, 'carry', 0);
    const decided = (_asItem(s2.id, k) || {}).decision;
    asUndo(s2.id, k);
    const after2 = (_asItem(s2.id, k) || {}).decision;
    asUndo(s1.id, k);
    return { decided, after2, after1: (_asItem(s1.id, k) || {}).decision, toast1: __text(document.getElementById('toast')) };
  });
  R.ok(t.decided === 'carry' && t.after2 === '', 'a carry on the sheet the action was carried to can be taken back - the earlier sheet does not block it');
  R.ok(t.after1 === 'carry' && /already on a later sheet/.test(t.toast1), 'but the earlier sheet\'s carry cannot be taken back while the later sheet holds the action');
}
{
  // a line carried on a Top 5 sheet waits for the next Top 5 sheet
  const t = await page.evaluate(month => {
    closeActionSheets();
    asNewSheet();
    const t5 = _asList('top5').slice(-1)[0], it = t5 && t5.items[0];
    if (!it) return { none: true };
    const r = _execRiskOf({ ref: it.ref });
    if (r && r.sheet !== month) toggleRiskSheet(r.id);
    asDecide(t5.id, it.key, 'carry', 0);
    const c = _asCandidates(null).find(x => x.key === it.key) || {};
    const out = { decided: (_asItem(t5.id, it.key) || {}).decision, risk: _asCandidates(null, 'risk').some(x => x.key === it.key), top5: !!c.carry };
    asDeleteSheet(t5.id);
    return out;
  }, month);
  R.ok(!t.none && t.decided === 'carry' && !t.risk && t.top5, 'a line carried on a Top 5 sheet is held for the next Top 5 sheet - never offered for a risk sheet, even with its risk ticked');
}
{
  // Done on minutes with nothing in them keeps nothing; an empty meeting from an earlier day is today's
  const t = await page.evaluate(() => {
    const out = {}, quick = () => S.meetings.filter(m => m && m.quick).length;
    openQuickMinutes(); qmDone();                                           // the open one has the rows from the sheet
    out.before = quick();
    openQuickMinutes(); const m = _qmCurrent(); out.label = __text(document.getElementById('qmDoneBtn')); qmDone();
    out.after = quick(); out.dropped = !S.meetings.some(x => x.id === m.id); out.toast = __text(document.getElementById('toast'));
    const d = new Date(); d.setDate(d.getDate() - 40);
    const oldDay = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    S.meetings.unshift({ id: 'mtg_stale', quick: true, forum: 'Client meeting', date: oldDay, attendees: [], note: '', status: 'open', teamFilled: true });
    openQuickMinutes(); out.redated = (_qmCurrent() || {}).id === 'mtg_stale' && _qmCurrent().date === _asToday(); out.warnEmpty = !!document.querySelector('#qmOv .qm-stale');
    closeQuickMinutes();
    const st = S.meetings.find(x => x.id === 'mtg_stale'); st.date = oldDay; st.note = 'Walked the yard.';
    openQuickMinutes(); out.kept = _qmCurrent().date === oldDay; out.warn = __text(document.querySelector('#qmOv .qm-stale'));
    qmDone();
    out.open = !!_qmCurrent();
    return out;
  });
  R.ok(t.label === 'Done' && t.dropped && t.after === t.before && /Nothing was written/.test(t.toast), 'Done on minutes with nothing written keeps nothing - no empty meeting is left behind: ' + t.toast);
  R.ok(t.redated && !t.warnEmpty, 'an empty meeting left open from an earlier day becomes today\'s');
  R.ok(t.kept && /not today/.test(t.warn) && !t.open, 'one with notes in it keeps its date, and the minute taker says it is not today\'s: ' + t.warn);
}
{
  // rows back on a sheet with no meeting open: a meeting of their own, nobody put down as present; the same sheet again adds nothing twice
  const t = await page.evaluate(async () => {
    const s1 = _asList('risk').find(x => x.no === 1);
    const make = async () => {
      const doc = await PDFLib.PDFDocument.load(await buildActionSheetPDF(s1.id)), form = doc.getForm();
      form.getTextField('as__m3_what').setText('Buy a harness'); form.getTextField('as__m3_who').setText('Dave'); form.getTextField('as__m3_due').setText('end of Nov');
      return new File([await doc.save()], 'again.pdf', { type: 'application/pdf' });
    };
    const out = { open: !!_qmCurrent() };
    const harness = () => _decisions().filter(d => /^Buy a harness/.test(d.decision || ''));
    await _asImportFiles([await make()]);
    const d = harness()[0] || null, m = d ? S.meetings.find(x => x.id === d.meetingId) : null;
    out.n1 = harness().length; out.att = m ? (m.attendees || []).length : -1; out.note = m ? m.note : ''; out.toast1 = __text(document.getElementById('toast'));
    await _asImportFiles([await make()]);
    out.n2 = harness().length; out.toast2 = __text(document.getElementById('toast'));
    return out;
  });
  R.ok(!t.open && t.n1 === 1 && t.att === 0 && t.note === 'Written on the returned risk action sheet 1.', 'rows back with no meeting open get a meeting of their own - nobody put down as present, and a note of where they came from (the sheet has no name on it now): ' + t.note);
  R.ok(/1 meeting action into the quick minutes \(Done there puts it on the plan\)/.test(t.toast1), 'the import says Done in the minutes puts it on the plan: ' + t.toast1);
  R.ok(t.n2 === 1 && /1 already in the minutes/.test(t.toast2), 'the same sheet imported again adds nothing twice, even a row whose date could not be read: ' + t.toast2);
}
{
  // From the meeting is the sheet's own month, however late it is downloaded
  const t = await page.evaluate(async NOTE => {
    const s2 = _asList('risk').find(x => x.no === 2), keep = s2.createdAt;
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); d.setDate(15);
    const lastDay = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-15';
    S.meetings.push({ id: 'mtg_lastmonth', quick: true, forum: 'Client meeting', date: lastDay, attendees: [{ name: 'Jo Fine', role: '', email: '' }], note: 'The walk round last month.', status: 'finished' });
    s2.createdAt = d.toISOString();
    const then = (await __build(s2.id)).said;
    s2.createdAt = keep;
    const now = (await __build(s2.id)).said;
    return { then: then.includes('The walk round last month.') && !then.includes(NOTE), now: now.includes(NOTE) && !now.includes('The walk round last month.') };
  }, NOTE);
  R.ok(t.then && t.now, 'a sheet started last month prints last month\'s meetings, and this month\'s sheet prints this month\'s');
}

await R.done(browser, errors);
