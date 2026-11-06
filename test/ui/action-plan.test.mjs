// ══════════════════════════════════════════════════════════════
//  The Client execution plan as an action plan (Simon, 6 November 2026). In the
//  user's order: open the plan -> a block a risk, in the ladder's order, its head
//  saying what is wrong -> numbered actions in the five columns -> mark one done
//  -> it says Done and where it lives -> the figures narrow the list -> Detail ->
//  read only -> the client's view -> reload -> nothing saved has changed.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('The plan as an action plan - a block a risk, numbered actions, five columns');
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const act = (id, desc, owner, n, extra) => Object.assign({ id, desc, owner, due: n === null ? '' : day(n), status: 'Not started', priority: 'High' }, extra || {});
const RISKS = () => [
  { id: 'lo', activity: 'Slips on the office stairs', hazard: 'Worn stair treads', likelihood: '2', severity: '2', targetL: '1', targetS: '2', actions: [act('l1', 'Fit a second handrail', 'Ann Reed', 20)] },
  { id: 'hi', activity: 'Falls from roofs during surveys', hazard: 'Unprotected roof edges on survey access', harm: 'Fatal injury', likelihood: '5', severity: '5', targetL: '2', targetS: '3', actions: [act('h1', 'Fit edge protection', 'Ben Cole, Cara Hill', 10), act('h2', 'Brief the surveyors', 'Ann Reed', -5), act('hc', 'Standing arrangement row', 'Ann Reed', 30, { hideFromPlan: true })] },
  { id: 'nt', activity: 'Road collision driving for work', hazard: 'Grey fleet driving', likelihood: '4', severity: '4', actions: [act('n1', 'Check licences', 'Ann Reed', null)] },
  { id: 'un', activity: 'Lone working on site', actions: [act('u1', 'Set up a check-in', 'Dan West', 40)] },
  { id: 'at', activity: 'Trailing cables in the studio', hazard: 'Cables', likelihood: '2', severity: '3', targetL: '2', targetS: '3', actions: [act('a1', 'Fit cable covers', 'Dan West', 15)] },
];
const FREE = () => [{ id: 'f1', desc: 'Renew the insurance certificate', owner: 'Ann Reed', due: day(45), status: 'Not started', source: 'Assurance' }];
await seed(page, { riskProfile: RISKS(), actionPlan: FREE(), company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] } }, 'execplan');
await wait(page, 300);
const snap = () => page.evaluate(() => JSON.stringify(S.riskProfile.map(r => [r.id, r.likelihood, r.severity, r.targetL, r.targetS])));
const scores = await snap();

// ── a block a risk, in the ladder's order ──
{
  const t = await page.evaluate(() => { const blocks = [...document.querySelectorAll('#epYearCard .ep-rb')]; const head = b => ({ ref: (b.querySelector('.ep-rb-h .ep-ref') || {}).textContent || '', t: (b.querySelector('.ep-rb-t') || {}).textContent, sc: (b.querySelector('.ep-rb-sc') || {}).textContent || '', w: (b.querySelector('.ep-rb-w') || {}).innerText || '', n: b.querySelectorAll('tbody tr').length, chip: !!b.querySelector('.rs-chip') });
    return { mode: _epGroupBy, heads: blocks.map(head), order: _riskDisplayOrder().filter(r => (r.actions || []).some(a => !a.hideFromPlan)).map(r => _riskRefOf(r)), month: !!document.getElementById('epMonthCard'), delivered: !!document.getElementById('epDeliveredCard'), sort: !!document.getElementById('epSortSel'), chips: [...document.querySelectorAll('#epYearCard .ep-gb')].map(b => b.textContent.trim()) }; });
  R.ok(t.mode === 'risk', 'the plan opens grouped by risk');
  R.ok(t.heads.slice(0, 4).map(h => h.ref).join() === t.order.slice(0, 4).join() && t.heads[0].t === 'Falls from roofs during surveys', 'one block a risk, highest current risk first, in the ladder\'s order: ' + t.heads.map(h => h.ref).join());
  R.ok(t.heads[0].sc === '25 → 6' && t.heads[1].sc === '16 → no target' && /Not yet rated/.test(t.heads.find(h => /Lone working/.test(h.t)).sc), 'each head has current and target: ' + t.heads.map(h => h.sc).join(' | '));
  R.ok(/What’s wrong/i.test(t.heads[0].w) && /Unprotected roof edges/.test(t.heads[0].w), 'and one line of What\'s wrong: ' + t.heads[0].w);
  R.ok(t.heads.find(h => /Trailing cables/.test(h.t)).chip && !t.heads[0].chip, 'a risk at its target says Under control, one above it does not');
  R.ok(t.heads[0].n === 2, 'its plan actions only: the standing arrangement row is not an action on the plan');
  R.ok(t.heads[t.heads.length - 1].t === 'Not tied to a risk' && t.heads[t.heads.length - 1].n === 1, 'actions with no risk behind them come last, in their own block');
  R.ok(!t.month && !t.delivered && !t.sort, 'no repeated list above it, no separate delivered list, and no Sort box: there is one order');
  R.ok(t.chips.slice(0, 4).join() === 'Risk,Risk theme,Target date,Risk level', 'the other views are still a click away: ' + t.chips.join(', '));
}
// ── numbered actions, the five columns, nothing cut off ──
{
  const t = await page.evaluate(() => { const b = document.querySelector('#epYearCard .ep-rb'), ths = [...b.querySelectorAll('thead th')], rows = [...b.querySelectorAll('tbody tr')]; return { heads: ths.map(x => x.textContent.trim()), cut: ths.filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.textContent.trim()), nums: rows.map(r => r.cells[0].textContent.trim()).join(), first: [...rows[0].cells].map(c => c.innerText.replace(/\s+/g, ' ').trim()), whoWhole: rows[0].cells[2].scrollWidth <= rows[0].cells[2].clientWidth + 1, overflow: b.scrollWidth > b.clientWidth + 1 }; });
  R.ok(t.heads.join('|') === 'No.|How we fix it|Who|By when|Is it enough', 'the columns: ' + t.heads.join(' | '));
  R.ok(!t.cut.length && !t.overflow, 'no header is cut off and nothing runs past the block' + (t.cut.length ? ': ' + t.cut.join() : ''));
  R.ok(t.nums === '1,2', 'the actions are numbered');
  R.ok(t.first[1] === 'Fit edge protection' && t.first[2] === 'Ben Cole, Cara Hill' && /Not yet/.test(t.first[4]) && /25 to 6/.test(t.first[4]), 'each row reads across: ' + t.first.join(' | '));
  R.ok(t.whoWhole, 'every owner\'s name shows in full');
  const lv = await page.evaluate(() => { setEpGroupBy('level'); const h = [...document.querySelector('#epYearCard table').querySelectorAll('thead th')].map(x => x.textContent.trim()); setEpGroupBy('risk'); return h; });
  R.ok(lv.join('|') === 'What’s wrong|How we fix it|Who|By when|Is it enough', 'in the other views What\'s wrong is the first column, the same five: ' + lv.join(' | '));
}
// ── done: says so, and where it now lives ──
{
  const before = await page.evaluate(() => ({ mark: [...document.querySelectorAll('#eprb-hi .ep-done')].length }));
  R.ok(before.mark === 2, 'an open action has a Mark done');
  await page.evaluate(() => { document.querySelector('#eprb-hi .ep-done').click(); });
  await wait(page, 400);
  const a = await page.evaluate(() => { const ov = document.getElementById('evidOverlay'); const o = { asked: !!ov }; if (ov) { const c = ov.querySelector('.btn-ghost, [onclick*="close"]'); } const h1 = S.riskProfile.find(r => r.id === 'hi').actions[0]; o.status = h1.status; return o; });
  R.ok(a.status === 'Complete', 'Mark done closes it, the same way the status box does');
  const b = await page.evaluate(() => { const e = document.getElementById('evidOverlay'); if (e) e.remove(); document.body.classList.remove('slt-open'); renderExecPlan(); const row = document.querySelector('#eprb-hi tbody tr'); const c = row.cells[4]; return { said: c.innerText.replace(/\s+/g, ' '), ask: !!c.querySelector('.ep-ask'), stays: row.cells[1].innerText.includes('Fit edge protection') }; });
  R.ok(/^Done/.test(b.said) && b.ask && b.stays, 'it stays in its block and says Done, and asks where it now lives until that is answered: ' + b.said);
  const c = await page.evaluate(() => { const h1 = S.riskProfile.find(r => r.id === 'hi').actions[0]; h1.embed = { at: _asToday(), by: 'Simon', doc: { name: 'Roof access procedure', docId: '' } }; renderExecPlan(); const cell = document.querySelector('#eprb-hi tbody tr').cells[4]; return { said: cell.innerText.replace(/\s+/g, ' '), ask: !!cell.querySelector('.ep-ask'), set: _embedIsSet(h1), words: _asStickWords(h1) }; });
  R.ok(c.set && /^Done/.test(c.said) && c.said.includes(c.words) && !c.ask, 'once answered it says Done and where it lives: ' + c.said);
}
// ── the figures narrow the list ──
{
  const t = await page.evaluate(() => { const tiles = [...document.querySelectorAll('.ep-tile')]; const lab = n => tiles.find(x => new RegExp(n, 'i').test(x.innerText)); const rows = () => [...document.querySelectorAll('#epYearCard .ep-rb tbody tr')].map(r => r.cells[1].innerText.trim()); lab('overdue').click(); const over = rows(), showing = (document.querySelector('.ep-showing') || {}).innerText || ''; document.querySelector('.ep-showing button').click(); const all = rows(); [...document.querySelectorAll('.ep-tile')].find(x => /delivered/i.test(x.innerText)).click(); const done = rows(); setEpShow('done'); return { over, showing, all: all.length, done, none: !document.querySelector('.ep-showing') }; });
  R.ok(t.over.join() === 'Brief the surveyors' && /overdue/.test(t.showing), 'Overdue narrows the blocks to what it counts: ' + t.over.join());
  R.ok(t.all === 7, 'Show everything brings them all back (' + t.all + ')');
  R.ok(t.done.length === 1 && t.done[0].startsWith('Fit edge protection') && t.none, 'Delivered shows what is done');
}
// ── Detail, for the consultant, hidden by default ──
{
  const t = await page.evaluate(() => { const off = document.querySelector('#eprb-hi thead tr').cells.length; document.getElementById('epDetailBtn').click(); const b = document.querySelector('#eprb-hi'), heads = [...b.querySelectorAll('thead th')].map(x => x.textContent.trim().replace(/\s+/g, ' ')), cells = b.querySelector('tbody tr').cells.length, on = document.getElementById('epDetailBtn').classList.contains('on'), sel = !!b.querySelector('tbody select'), cut = [...b.querySelectorAll('thead th')].filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.textContent.trim()), tick = !!b.querySelector('tbody input[type=checkbox]'); document.getElementById('epDetailBtn').click(); return { off, heads, cells, on, sel, tick, cut, back: document.querySelector('#eprb-hi thead tr').cells.length }; });
  R.ok(t.off === 5 && t.back === 5, 'Status, Priority and Source are hidden by default');
  R.ok(t.on && /Status/.test(t.heads.join()) && /Priority/.test(t.heads.join()) && /Source/.test(t.heads.join()) && t.cells === 9 && t.sel && t.tick, 'Detail shows them, with the status box and the Top 5 tick: ' + t.heads.join(' | '));
  R.ok(!t.cut.length, 'and nothing is cut off with it on' + (t.cut.length ? ': ' + t.cut.join() : ''));
  const v = await page.evaluate(() => { const was = _viewMode; _viewMode = 'management'; renderExecPlan(); const client = { btn: !!document.getElementById('epDetailBtn'), cols: document.querySelector('#eprb-hi thead tr').cells.length, mark: !!document.querySelector('#eprb-hi .ep-done') }; _viewMode = was; const keep = window._roLocked; window._roLocked = () => true; renderExecPlan(); const ro = { mark: !!document.querySelector('.ep-done'), ask: !!document.querySelector('.ep-ask') }; window._roLocked = keep; renderExecPlan(); return { client, ro }; });
  R.ok(!v.client.btn && v.client.cols === 5 && v.client.mark, 'the client\'s view has no Detail button, and can still mark an action done');
  R.ok(!v.ro.mark && !v.ro.ask, 'a read-only login can do neither');
}
// ── opening a row still gives the detail; the words stay; nothing saved has moved ──
{
  const t = await page.evaluate(() => { document.querySelector('#eprb-nt tbody td:nth-child(2)').click(); const rows = [...document.querySelectorAll('#eprb-nt tbody tr')]; return { n: rows.length, wide: rows[1] ? rows[1].cells[0].colSpan : 0 }; });
  R.ok(t.n === 2 && t.wide === 5, 'clicking an action still opens its detail and log, across the block');
  R.ok(await snap() === scores, 'no score or target has been touched');
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"'); await wait(page, 300);
  const r = await page.evaluate(() => { switchTab('execplan'); const h1 = S.riskProfile.find(x => x.id === 'hi').actions[0]; return { st: h1.status, said: document.querySelector('#eprb-hi tbody tr').cells[4].innerText.replace(/\s+/g, ' '), group: _epGroupBy, detail: _epDetail }; });
  R.ok(r.st === 'Complete' && /^Done/.test(r.said) && r.group === 'risk' && !r.detail, 'after a reload it is as you left it, grouped by risk with Detail off');
  const g = await page.evaluate(() => { switchTab('howto'); const t = document.getElementById('howtoContainer').innerText; switchTab('execplan'); return t; });
  R.ok(/under the risk it belongs to/.test(g) && /Mark done/.test(g) && /Detail, for the consultant/.test(g), 'the guide covers it');
}
// ── the sidebar's count stays inside the sidebar, and the held count has a home ──
{
  const t = await page.evaluate(() => { switchTab('execplan'); const b = document.querySelector('.tab-btn[data-tab="execplan"]'), bd = b.querySelector('.tb-badge'), g = b.closest('.nav-grp'); return { fits: !bd || bd.getBoundingClientRect().right <= g.getBoundingClientRect().right, shown: !!bd && getComputedStyle(bd).display !== 'none', held: (document.querySelector('.ep-held') || {}).innerText || '' }; });
  R.ok(t.fits && t.shown, 'the plan\'s count sits inside the Front door group');
  R.ok(/1 of 1 delivered say where they live now/.test(t.held), 'and the view says how many delivered actions say where they live: ' + t.held);
}
// ── the plan on paper: same blocks, A4, name, date and page numbers, risks kept whole ──
{
  const long = 'Establish the presence of the hazard before any visit, and record what was found against the job so that everyone on the team can read it first. ';
  const many = [];
  for (let i = 1; i <= 16; i++) many.push({ id: 'p' + i, activity: 'Printed risk number ' + i, hazard: 'What is wrong with printed risk ' + i, likelihood: String(1 + (i % 5)), severity: '5', targetL: '1', targetS: '2', actions: [1, 2, 3, 4].map(n => act('p' + i + 'a' + n, 'Risk ' + i + ' action ' + n + '. ' + long, 'Ann Reed, Ben Cole, Cara Hill', 20)) });
  many.push({ id: 'big', activity: 'A risk too long for any page', hazard: 'Very many actions', likelihood: '5', severity: '5', targetL: '1', targetS: '1', actions: Array.from({ length: 34 }, (_, n) => act('bg' + n, 'Long risk action ' + (n + 1) + '. ' + long, 'Ann Reed', 10)) });
  await seed(page, { riskProfile: many, actionPlan: FREE(), company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] } }, 'execplan');
  await wait(page, 300);
  const t = await page.evaluate(async () => {
    window.__blob = null; const keepSave = _sltSaveBlob; window._sltSaveBlob = (b, n) => { window.__blob = { b, n }; };
    const seen = [], text = []; const d = PDFLib.PDFPage.prototype.drawText; PDFLib.PDFPage.prototype.drawText = function (x, o) { let i = seen.indexOf(this); if (i < 0) { seen.push(this); i = seen.length - 1; text[i] = []; } text[i].push({ s: String(x), y: o.y, x: o.x, size: o.size }); return d.call(this, x, o); };
    document.getElementById('epPdfBtn').click();
    for (let n = 0; n < 60 && !window.__blob; n++) await new Promise(r => setTimeout(r, 100));
    PDFLib.PDFPage.prototype.drawText = d;
    const buf = await window.__blob.b.arrayBuffer(), doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true }), sz = doc.getPage(0).getSize();
    const date = fmtDate(_asToday()).toUpperCase(), N = doc.getPageCount();
    const whereIs = s => text.map((p, i) => p.some(e => e.s.includes(s)) ? i : -1).filter(i => i >= 0);
    return { name: window.__blob.n, N, w: Math.round(sz.width), h: Math.round(sz.height), named: text.every(p => p.some(e => e.s === 'TESTING CLIENT LTD') && p.some(e => e.s.includes(date))), numbered: text.every((p, i) => p.some(e => new RegExp('Page ' + (i + 1) + ' of ' + N).test(e.s))),
      heads: text.every(p => ['HOW WE FIX IT', 'WHO', 'BY WHEN', 'IS IT ENOUGH'].every(h => p.some(e => e.s === h))),
      split: many_check(text), bigPages: whereIs('A risk too long for any page').length, cont: whereIs('(continued)').length, overrun: text.flatMap(p => p.filter(e => !/^Page \d+ of \d+$|^Client execution plan$|Compliance Consulting|Archer/.test(e.s) && e.s !== 'Client execution plan' && (e.y < 56 || e.x < 30 || e.x > 560))).map(e => e.s.slice(0, 40) + ' @' + Math.round(e.x) + ',' + Math.round(e.y)),
      lone: text.filter(p => { const ys = p.filter(e => /^(Printed risk number \d+|A risk too long)/.test(e.s)).map(e => e.y); const lowest = Math.min(...ys); return ys.length && !p.some(e => /(Risk \d+ action \d+|Long risk action \d+)/.test(e.s) && e.y < lowest); }).length, free: whereIs('Not tied to a risk').length };
    function many_check(text) { const bad = []; for (let i = 1; i <= 16; i++) { const pages = new Set(); text.forEach((p, n) => { if (p.some(e => new RegExp('^(Printed risk number ' + i + '$|Risk ' + i + ' action \\d)').test(e.s))) pages.add(n); }); if (pages.size !== 1) bad.push(i + ':' + [...pages].join('/')); } return bad; }
  });
  R.ok(t.w === 595 && t.h === 842 && t.N > 2 && /^client-execution-plan-testing-client-ltd-\d{4}-\d{2}-\d{2}\.pdf$/.test(t.name), 'Print / PDF gives an A4 PDF: ' + t.N + ' pages, ' + t.name);
  R.ok(t.named && t.numbered, 'the client name, the date and "Page x of y" are on every page');
  R.ok(t.heads, 'and the same columns as the screen: How we fix it, Who, By when, Is it enough');
  R.ok(!t.split.length, 'a risk that fits on a page is never split across two' + (t.split.length ? ': ' + t.split.join(' ') : ''));
  R.ok(t.bigPages >= 2 && t.cont === t.bigPages - 1, 'one too long for any page runs on, its head repeated and marked continued (' + t.bigPages + ' pages)');
  R.ok(t.lone === 0, 'a risk\'s head is never left at the foot of a page without its actions');
  R.ok(!t.overrun.length, 'nothing runs into the margins or the footer' + (t.overrun.length ? ': ' + t.overrun.slice(0, 6).join(' | ') : ''));
  R.ok(t.free === 1, 'actions with no risk are on it too');
}
// ── first use ──
{
  await seed(page, { riskProfile: [], actionPlan: [], company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] } }, 'execplan');
  await wait(page, 200);
  const t = await page.evaluate(() => document.getElementById('epYearCard').innerText);
  R.ok(/No actions yet/.test(t), 'with no actions it says so');
}

await R.done(browser, errors);
