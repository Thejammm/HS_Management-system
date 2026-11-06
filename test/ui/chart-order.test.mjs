// ══════════════════════════════════════════════════════════════
//  One order everywhere, and the risk ladder as a monthly chart (Simon, 6 Nov 2026).
//  In the user's order: risks added in no particular order -> every list reads
//  the ladder's order, reference then short title -> every list of actions has
//  the same columns -> the first chart -> a month later, every symbol -> a risk
//  re-scored to target drops out -> reload -> it comes back -> read only -> the
//  saved records untouched -> first use with no data.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('One order everywhere, and the ladder as a monthly chart');
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const LONG = 'Fire safety and asset management of office premises in particular gas boiler plant maintenance';
const act = (id, desc, owner, n) => ({ id, desc, owner, due: day(n), status: 'Not started', priority: 'High' });
// added deliberately out of order: the highest current risk is not first in the list
const RISKS = () => [
  { id: 'lo', activity: 'Slips on the office stairs', hazard: 'Stairs', likelihood: '2', severity: '2', targetL: '1', targetS: '2', actions: [act('l1', 'Fit a second handrail', 'Ann Reed', 20)] },
  { id: 'hi', activity: 'Falls from roofs during surveys', hazard: 'Roof edges', likelihood: '5', severity: '5', targetL: '2', targetS: '3', actions: [act('h1', 'Fit edge protection', 'Ben Cole', 10), act('h2', 'Brief the surveyors', 'Ann Reed', 15)] },
  { id: 'md', activity: LONG, hazard: 'Boiler', likelihood: '3', severity: '4', targetL: '2', targetS: '2', actions: [act('m1', 'Book the boiler service', 'Dan West', 12)] },
  { id: 'nt', activity: 'Road collision driving for work', hazard: 'Driving', likelihood: '4', severity: '4', actions: [act('n1', 'Check licences', 'Ann Reed', 30)] },
  { id: 'at', activity: 'Trailing cables in the studio', hazard: 'Cables', likelihood: '2', severity: '3', targetL: '2', targetS: '3', actions: [] },
  { id: 'un', activity: 'Lone working on site', hazard: 'Lone work', actions: [] },
];
const seedIt = async (extra, tab) => { await seed(page, Object.assign({ riskProfile: RISKS(), actionPlan: [], company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] } }, extra || {}), tab || 'ladder'); await wait(page, 300); };
await seedIt();
const ORDER = ['hi', 'nt', 'md', 'lo'];      // 25, 16, 12, 4 - at-target and unrated are not ranked on the ladder
const refs = await page.evaluate(() => Object.fromEntries(S.riskProfile.map(r => [r.id, _riskRefOf(r)])));
const WANT = ORDER.map(x => refs[x]).join();

// ── one order ──
{
  const t = await page.evaluate(() => {
    const read = sel => [...document.querySelectorAll(sel)].map(e => e.textContent.trim());
    switchTab('ladder'); const ladder = read('#tab-ladder .ckl-band .ckl-line .risk-ref');
    const sug = read('#tab-ladder .no-print .risk-ref').filter(x => x);
    switchTab('risk'); document.getElementById('wfRegister').open = true; const reg = read('#rpTbody tr.rpt-row td:first-child .risk-ref');
    const mode = _riskGroupMode;
    switchTab('execplan'); const plan = [...document.querySelectorAll('#epYearCard tbody tr')].map(tr => (tr.querySelector('.ep-ref') || {}).textContent).filter(Boolean);
    openLiveTop5(); const t5 = [...document.querySelectorAll('.t5-nb')].map(b => b.textContent.split('·').pop().trim()); closeLiveTop5();
    switchTab('ladder');
    return { ladder, sug, reg, mode, plan, t5 };
  });
  R.ok(t.ladder.join() === WANT, 'the ladder runs highest current risk first, whatever order the risks were added in: ' + t.ladder.join());
  R.ok(t.mode === 'flat' && t.reg.filter(x => WANT.includes(x)).join() === WANT, 'the risk profile opens in the same order: ' + t.reg.join());
  R.ok([...new Set(t.plan)].join() === WANT, 'the Client execution plan runs in the same order: ' + [...new Set(t.plan)].join());
  R.ok(t.t5.filter(x => WANT.includes(x)).join() === WANT.split(',').filter(x => t.t5.includes(x)).join(), 'the live Top 5 runs in the same order: ' + t.t5.join());
  R.ok(t.sug.join() === WANT, 'the suggested five are simply the ladder\'s top five (only four are on it here): ' + t.sug.join());
}
// ── one label ──
{
  const t = await page.evaluate(() => {
    const label = root => { const ref = root.querySelector('.risk-ref, .ep-ref'); const after = el => { const n = el.compareDocumentPosition.bind(el); return n; }; return ref ? ref.textContent.trim() : ''; };
    const md = S.riskProfile.find(r => r.id === 'md');
    switchTab('ladder'); const l = [...document.querySelectorAll('#tab-ladder .ckl-band .ckl-line')].find(x => x.querySelector('.risk-ref').textContent === _riskRefOf(md));
    const lad = l.querySelector('.ckl-title').textContent, ladTip = l.querySelector('.ckl-name').title;
    const refBeforeTitle = !!(l.querySelector('.risk-ref').compareDocumentPosition(l.querySelector('.ckl-title')) & Node.DOCUMENT_POSITION_FOLLOWING);
    switchTab('risk'); document.getElementById('wfRegister').open = true; const row = [...document.querySelectorAll('#rpTbody tr.rpt-row')].find(x => x.querySelector('.risk-ref') && x.querySelector('.risk-ref').textContent === _riskRefOf(md));
    const reg = row.cells[1].childNodes[0].textContent, regRef = !!row.cells[0].querySelector('.risk-ref');
    switchTab('execplan'); const pr = [...document.querySelectorAll('#epYearCard tbody tr')].find(x => x.querySelector('.ep-ref') && x.querySelector('.ep-ref').textContent === _riskRefOf(md));
    const plan = pr.querySelector('.ep-wrong-t').textContent, planFirst = !!pr.cells[0].querySelector('.ep-ref');
    openLiveTop5(); t5Go(_t5W().items.findIndex(i => i.ref.a === 'md')); const h = document.querySelector('.t5-h'); const top = h.textContent, topRef = !!h.querySelector('.risk-ref'); closeLiveTop5();
    switchTab('cockpit'); const cock = [...document.querySelectorAll('#tab-cockpit button')].filter(b => b.querySelector('.risk-ref') && b.querySelector('.risk-ref').textContent === _riskRefOf(md)).map(b => b.textContent);
    switchTab('ladder');
    return { lad, ladTip, refBeforeTitle, reg, regRef, plan, planFirst, top, topRef, cock, short: _riskShort(md), ref: _riskRefOf(md) };
  });
  R.ok(t.short.length <= 61 && t.short.endsWith('…') && !/\s…$/.test(t.short), 'a long title gets one short form, cut at a word: "' + t.short + '"');
  R.ok(t.lad === t.short && t.reg === t.short && t.plan === t.short, 'the ladder, the risk profile and the plan all show that same short title');
  R.ok(t.top === t.ref + t.short && t.topRef, 'the live Top 5 heading shows the reference, then the same short title');
  R.ok(t.refBeforeTitle && t.regRef && t.planFirst, 'the reference always comes first, then the title');
  R.ok(t.ladTip.startsWith('Fire safety and asset management of office premises in particular gas boiler plant maintenance'), 'the whole title is a hover away');
  R.ok(t.cock.length && t.cock.every(c => c.startsWith(t.ref) && c.includes(t.short)), 'the cockpit\'s lists show the same reference and short title');
}
// ── one column order ──
{
  const t = await page.evaluate(() => {
    const heads = (root) => [...root.querySelectorAll('thead th')].map(x => x.textContent.trim().replace(/\s+/g, ' '));
    switchTab('execplan'); const plan = heads(document.querySelector('#epYearCard table'));
    const pr = [...document.querySelectorAll('#epYearCard tbody tr')].find(x => /Fit edge protection/.test(x.textContent));
    const planCells = [...pr.cells].slice(0, 5).map(c => c.textContent.trim().replace(/\s+/g, ' '));
    openLiveTop5(); const t5 = heads(document.querySelector('.t5-table')); const lab = document.querySelector('.t5-lab').textContent; const row = document.querySelector('.t5-row'); const t5Cells = [...row.cells].map(c => c.textContent.trim().replace(/\s+/g, ' ')); closeLiveTop5();
    _riskOpenModal('hi'); _riskDetailTab('loop'); const over = heads(document.querySelector('#rpBody .t5-table')); _riskDetailTab('actions'); const at4 = document.querySelector('#rpBody .act-table:not(.act-ctl)') || document.querySelector('#rpBody .act-table'); const tab4 = heads(at4), fits4 = at4.getBoundingClientRect().right <= document.getElementById('rpBody').getBoundingClientRect().right + 1; _riskCloseModal();
    switchTab('ladder');
    return { plan, planCells, t5, lab, t5Cells, over, tab4, fits4 };
  });
  const FIVE = "What’s wrong|How we fix it|Who|By when|Is it enough";
  R.ok(t.plan.slice(0, 5).join('|') === FIVE, 'the Client execution plan: ' + t.plan.join(' | '));
  R.ok(/Falls from roofs/.test(t.planCells[0]) && /Fit edge protection/.test(t.planCells[1]) && t.planCells[2] === 'Ben Cole' && /Not yet/.test(t.planCells[4]), 'its cells follow its heads: ' + t.planCells.join(' | '));
  R.ok(t.t5.slice(0, 4).join('|') === FIVE.split('|').slice(1).join('|') && t.lab === 'What’s wrong', 'the live Top 5: What’s wrong above the table, then ' + t.t5.join(' | '));
  R.ok(/Ben Cole/.test(t.t5Cells[1]) && /Not yet/.test(t.t5Cells[3]), 'and its cells follow');
  R.ok(t.over.slice(0, 4).join('|') === FIVE.split('|').slice(1).join('|'), 'a risk\'s overview: ' + t.over.join(' | '));
  R.ok(t.tab4.slice(0, 4).join('|') === FIVE.split('|').slice(1).join('|'), 'a risk\'s tab 4: ' + t.tab4.join(' | '));
  R.ok(t.fits4, 'and its table stays inside the panel at laptop size');
  const e = await page.evaluate(() => ['hi', 'nt', 'at', 'un'].map(id => { const x = _riskEnough(S.riskProfile.find(r => r.id === id)); return x.k + ':' + x.t + ':' + x.sub; }).concat(_riskEnough(null).t));
  R.ok(e.join('|') === 'no:Not yet:25 to 6|none:No target:now 16|yes:Yes:6 at target 6|none:Not rated:|-', 'is it enough reads the risk, nothing is typed: ' + e.join(' | '));
}
// ── the first chart ──
{
  const t = await page.evaluate(() => { switchTab('ladder'); const lines = [...document.querySelectorAll('#tab-ladder .ckl-band .ckl-line')];
    const m = _top5Month(), c = S.ladderChart;
    return { cols: [...document.querySelectorAll('#tab-ladder .ckl-cols span')].map(x => x.textContent), pos: lines.map(l => l.querySelector('.ckc-pos').textContent).join(), last: lines.map(l => l.querySelector('.ckc-last').textContent).join(), mths: lines.map(l => l.querySelector('.ckc-mths').textContent).join(), syms: lines.map(l => l.querySelector('.ckc-move').textContent).join(), note: (document.querySelector('#tab-ladder .ckc-first-note') || {}).textContent || '', tips: lines.every(l => ['.ckc-pos', '.ckc-last', '.ckc-mths', '.ckc-mv'].every(s => l.querySelector(s).title.length > 10)),
      stored: c && c.months[m] ? c.months[m].on.map(x => x.id + ':' + x.pos + ':' + x.rating).join() : '', out: c && c.months[m] ? c.months[m].out.map(x => x.id).join() : '', outs: (document.querySelector('#tab-ladder .ckc-outs') || {}).innerText || '' }; });
  R.ok(t.cols.slice(0, 4).join() === 'Now,Last,Mths,Move', 'the chart\'s columns: ' + t.cols.join(' | '));
  R.ok(t.pos === '1,2,3,4' && t.last === '–,–,–,–' && t.mths === '1,1,1,1', 'first month: positions 1 to 4, no last month, one month on the ladder');
  R.ok(t.syms === '–,–,–,–' && /chart starts in/.test(t.note), 'nothing is called NEW in the first month, and it says the chart starts now: ' + t.note);
  R.ok(t.tips, 'every position, last, months and move has a tooltip');
  R.ok(t.stored === 'hi:1:25,nt:2:16,md:3:12,lo:4:4' && t.out === 'at', 'the month\'s positions are stored: ' + t.stored);
  R.ok(/DROPPED OUT/i.test(t.outs) && /Trailing cables/.test(t.outs) && /Dropped out before/.test(t.outs), 'a risk already at its target starts in the dropped out list: ' + t.outs.replace(/\s+/g, ' ').slice(0, 110));
}
// ── a month later: every symbol ──
{
  // last month's chart, as Compass would have stored it, with the risks in a different order
  const prev = await page.evaluate(() => _top5PrevMonth());
  const before = await page.evaluate(() => { const c = S.ladderChart, m = _top5Month(), p = _top5PrevMonth();
    c.months[p] = { at: p + '-28', on: [{ id: 'nt', pos: 1, rating: 16 }, { id: 'md', pos: 2, rating: 16 }, { id: 'hi', pos: 3, rating: 25 }], out: [{ id: 'lo', rating: 2 }, { id: 'at', rating: 6 }] };
    delete c.dropped.at; delete c.dropped.lo;
    S.riskProfile.push({ id: 'nw', activity: 'Asbestos in the plant room', hazard: 'Asbestos', likelihood: '3', severity: '2', targetL: '1', targetS: '2', actions: [], ref: 'X-099', refNo: 99 });
    S.riskProfile.push({ id: 'pp', activity: 'Scaffold on the east wing', hazard: 'Scaffold', likelihood: '4', severity: '3', targetL: '1', targetS: '2', actions: [] });
    c.months[p].on.push({ id: 'pp', pos: 4, rating: 12 });
    saveData(); renderLadder(); switchTab('ladder');
    const by = {}; [...document.querySelectorAll('#tab-ladder .ckl-band .ckl-line')].forEach(l => { const name = l.querySelector('.ckl-title').textContent; const mv = l.querySelector('.ckc-mv'); by[name] = { pos: l.querySelector('.ckc-pos').textContent, last: l.querySelector('.ckc-last').textContent, mths: l.querySelector('.ckc-mths').textContent, sym: l.querySelector('.ckc-move').textContent, cls: l.querySelector('.ckc-move').className, tip: mv.title, lastTip: l.querySelector('.ckc-last').title }; });
    return { by, order: Object.keys(by), key: [...document.querySelectorAll('#tab-ladder .ckc-key span[title]')].map(k => k.textContent.trim() + '=' + (k.title.length > 10)) }; });
  const b = before.by, fall = 'Falls from roofs during surveys', road = 'Road collision driving for work', boil = Object.keys(b).find(k => k.startsWith('Fire safety')), stairs = 'Slips on the office stairs', asb = 'Asbestos in the plant room', scaf = 'Scaffold on the east wing';
  R.ok(b[fall].sym === '▲' && b[fall].last === '3' && b[fall].pos === '1' && /Climber: up 2 places, from 3 to 1/.test(b[fall].tip) && b[fall].mths === '2', '▲ climber: up from 3 to 1, two months on: ' + b[fall].tip);
  R.ok(b[road].sym === '▼' && /Faller: down 1 place, from 1 to 2\. Falling is good news\. Its score has not changed: other risks moved above it/.test(b[road].tip), '▼ faller, pushed down by others: the tooltip says so honestly, and it gets no star: ' + b[road].tip);
  R.ok(b[scaf].sym === '=' && /Non-mover: still at 4/.test(b[scaf].tip), '= non-mover: ' + b[scaf].tip);
  R.ok(b[asb].sym === 'NEW' && b[asb].last === '–' && /first time/.test(b[asb].tip) && /Not on the ladder/.test(b[asb].lastTip), 'NEW new entry: ' + b[asb].tip);
  R.ok(b[stairs].sym === 'RE' && /was under control in/.test(b[stairs].tip), 'RE re-entry, was under control and came back: ' + b[stairs].tip);
  R.ok(b[boil].sym === '★' && /Biggest faller of the month/.test(b[boil].tip) && /came down from 16 to 12/.test(b[boil].tip), '★ the biggest faller whose score really came down: ' + b[boil].tip);
  R.ok(before.key.length === 6 && before.key.every(k => /=true$/.test(k)), 'the key lists all six symbols, each with a tooltip: ' + before.key.map(k => k.split('=')[0]).join(', '));
  // no red anywhere on the ladder, and no words from any programme
  const col = await page.evaluate(() => { const bad = []; const hot = c => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c); if (!m) return false; const r = +m[1], g = +m[2], b = +m[3], a = m[4] === undefined ? 1 : +m[4]; return a > 0.05 && r > 150 && r - b > 90 && g < r - 50; };
    document.querySelectorAll('#ladderContainer, #ladderContainer *').forEach(el => { const s = getComputedStyle(el); for (const k of ['color', 'backgroundColor', 'borderLeftColor', 'accentColor']) { if (k.startsWith('border') && s.borderLeftWidth === '0px') continue; if (hot(s[k])) bad.push(el.className + ' ' + k + ' ' + s[k]); } });
    return { bad: [...new Set(bad)].slice(0, 6), text: document.getElementById('ladderContainer').innerText }; });
  R.ok(!col.bad.length, 'no red or near-red anywhere on the ladder' + (col.bad.length ? ': ' + col.bad.join(' | ') : ''));
  R.ok(!/top of the pops|\bTOTP\b/i.test(col.text), 'generic chart words only');
  // a risk re-scored to its target drops out, this month
  const t = await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'hi'); r.likelihood = '2'; r.severity = '3'; saveData(); switchTab('ladder'); const lines = [...document.querySelectorAll('#tab-ladder .ckc-outs .ckl-line')]; const f = lines.find(l => /Falls from roofs/.test(l.textContent));
    return { out: !!f, words: f ? f.querySelector('.ckc-outm').textContent : '', on: [...document.querySelectorAll('#tab-ladder .ckl-band .ckl-title')].some(x => /Falls from roofs/.test(x.textContent)), pos: f ? f.querySelector('.ckc-pos').textContent : '', tick: f ? !!f.querySelector('.ckl-t5 input') : false, label: _top5MonthLabel(_top5Month()), first: document.querySelector('#tab-ladder .ckl-band .ckc-pos').textContent, dropped: S.ladderChart.dropped.hi }; });
  R.ok(t.out && !t.on && t.words === 'Dropped out ' + t.label && t.dropped === await page.evaluate(() => _top5Month()), 'a risk re-scored to its target leaves the ladder for the dropped out list, with this month: ' + t.words);
  R.ok(t.pos === '–' && t.tick && t.first === '1', 'it keeps its ticks there, and the next risk takes number 1');
  // reload: the snapshot and the chart survive
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"'); await wait(page, 300);
  const r = await page.evaluate(p => { switchTab('ladder'); return { months: Object.keys(S.ladderChart.months).length, prev: !!S.ladderChart.months[p], words: [...document.querySelectorAll('#tab-ladder .ckc-outs .ckc-outm')].map(x => x.textContent).join('|'), mv: !!document.querySelector('#tab-ladder .ckc-star, #tab-ladder .ckc-up') }; }, prev);
  R.ok(r.months === 2 && r.prev && r.mv && /Dropped out/.test(r.words), 'after a reload the snapshots and the chart are all still there');
  // and if it comes back, in a later month, it is a re-entry
  const back = await page.evaluate(() => { const c = S.ladderChart, m = _top5Month(), p = _top5PrevMonth(); c.months[p].out.push({ id: 'hi', rating: 6 }); c.months[p].on = c.months[p].on.filter(x => x.id !== 'hi'); const r = S.riskProfile.find(x => x.id === 'hi'); r.likelihood = '5'; r.severity = '5'; saveData(); switchTab('ladder'); const l = [...document.querySelectorAll('#tab-ladder .ckl-band .ckl-line')].find(x => /Falls from roofs/.test(x.textContent)); return { sym: l.querySelector('.ckc-move').textContent, tip: l.querySelector('.ckc-mv').title, gone: !c.dropped.hi }; });
  R.ok(back.sym === 'RE' && back.gone && /was under control in/.test(back.tip), 'when it comes back it shows RE: ' + back.tip);
  // read only: nothing is written, the marks do not use the star
  const ro = await page.evaluate(() => { const keep = window._roLocked, was = JSON.stringify(S.ladderChart); window._roLocked = () => true; S.riskProfile.find(x => x.id === 'lo').severity = '3'; renderLadder(); const same = JSON.stringify(S.ladderChart) === was; const boxes = document.querySelectorAll('#tab-ladder .ckl-t5 input').length; const syms = !!document.querySelector('#tab-ladder .ckc-move'); window._roLocked = keep; S.riskProfile.find(x => x.id === 'lo').severity = '2'; renderLadder(); return { same, boxes, syms }; });
  R.ok(ro.same && !ro.boxes && ro.syms, 'a read-only login sees the chart and writes nothing');
  // the snapshot travels with the client, and the export carries it
  const ex = await page.evaluate(() => ({ key: _IMPORT_KEYS.includes('ladderChart') }));
  R.ok(ex.key, 'the snapshots travel with the client\'s export and import');
}
// ── the guide says all this ──
{
  const t = await page.evaluate(() => { switchTab('howto'); const g = document.getElementById('howtoContainer').innerText; switchTab('ladder'); return { g, tip: (document.querySelector('#ladderContainer .ckx-panel') || {}).title || '' }; });
  R.ok(['▲ climber', '▼ faller', '= non-mover', 'NEW new entry', 'RE re-entry', '★ biggest faller'].every(x => t.g.includes(x)) && /Falling is good news/.test(t.g) && /moves show from the second month/.test(t.g), 'the guide explains the chart and every symbol');
  R.ok(/What’s wrong, How we fix it, Who, By when, Is it enough/.test(t.g) && /the one order/i.test(t.g) && /ladder’s order/.test(t.g), 'and the one order and the column order');
  R.ok(/music chart/.test(t.tip) && /falling is good news/i.test(t.tip), 'the ladder\'s own tooltip says it too');
}
// ── the printed sheet: a new one runs like the screen, one already sent keeps the columns it was sent with ──
{
  const t = await page.evaluate(async () => {
    if (!window.__hook) { window.__hook = true; const d = PDFLib.PDFPage.prototype.drawText; PDFLib.PDFPage.prototype.drawText = function (x, o) { (window.__said = window.__said || []).push(String(x)); return d.call(this, x, o); }; }
    window._sltSaveBlob = () => {};
    const said = async id => { window.__said = []; const bytes = await buildActionSheetPDF(id); const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }); const f = doc.getForm(); return { said: window.__said.map(x => x.toUpperCase()), names: f.getFields().map(x => x.getName()) }; };
    const heads = x => ['HOW WE FIX IT', 'WHO', 'IS IT', 'ENOUGH', 'COMMENTS', 'RECOMMENDED ACTION', 'OWNER', "WHAT'S WRONG", 'HAZARD AND RISK'].filter(h => x.said.includes(h)).join();
    delete S.actionSheets; openActionSheets('top5'); asNewSheet(); closeActionSheets();
    const s = _asList('top5').slice(-1)[0], draft = await said(s.id);
    await downloadActionSheet(s.id);
    const after = { colsV: s.colsV, frozen: s.items.every(i => !!i.enough), first: s.items[0].enough.t };
    const r0 = _execRiskOf({ ref: s.items[0].ref }), keepL = r0.likelihood, keepS = r0.severity, keepTL = r0.targetL, keepTS = r0.targetS;
    r0.targetL = r0.likelihood; r0.targetS = r0.severity; const liveNow = _riskEnough(r0).t, again = await said(s.id), kept = again.said.includes(after.first.toUpperCase());
    r0.targetL = keepTL; r0.targetS = keepTS; r0.likelihood = keepL; r0.severity = keepS;
    const old = JSON.parse(JSON.stringify(s)); old.id = 'as_old'; old.no = 99; old.issuedAt = '2026-10-07'; old.formV = 3; delete old.colsV; S.actionSheets.list.push(old);
    const was = await said('as_old'); await downloadActionSheet('as_old'); const oldStill = !('colsV' in old);
    const fields = n => n.filter(x => /^as_1_r1_(cmt|who|due)$/.test(x)).sort().join();
    S.actionSheets.list = S.actionSheets.list.filter(x => x.id !== 'as_old');
    return { draft: heads(draft), was: heads(was), after, liveNow, kept, oldStill, f1: fields(draft.names), f2: fields(was.names) };
  });
  R.ok(t.draft === "HOW WE FIX IT,WHO,IS IT,ENOUGH,COMMENTS,WHAT'S WRONG", 'a new sheet prints the screen\'s columns: ' + t.draft);
  R.ok(t.was === 'COMMENTS,RECOMMENDED ACTION,OWNER,HAZARD AND RISK' && t.oldStill, 'a sheet already sent reprints with the columns it was sent with: ' + t.was);
  R.ok(t.after.colsV === 2 && t.after.frozen, 'sending a new sheet marks it, and keeps what Is it enough said that day');
  R.ok(t.liveNow === 'Yes' && t.after.first !== 'Yes' && t.kept, 'a later re-score does not change a sheet already sent: it still prints ' + t.after.first);
  R.ok(t.f1 === 'as_1_r1_cmt,as_1_r1_due,as_1_r1_who' && t.f1 === t.f2, 'the form boxes keep their names either way, so a returned sheet still imports');
}
// ── the saved records are not touched: only the new section is added ──
{
  const t = await page.evaluate(async () => { const risks = JSON.parse(JSON.stringify(S.riskProfile)), keys = Object.keys(S).sort().join(); const go = ['cockpit', 'ladder', 'risk', 'execplan', 'requirements', 'journey', 'works', 'howto'];
    for (const g of go) { switchTab(g); await new Promise(r => setTimeout(r, 40)); } openLiveTop5(); closeLiveTop5(); saveData();
    return { same: JSON.stringify(S.riskProfile) === JSON.stringify(risks), keysSame: Object.keys(S).filter(k => k !== 'actionSheets').sort().join() === keys.split(',').filter(k => k !== 'actionSheets').join(), hasOwn: !!S.ladderChart }; });
  R.ok(t.same && t.keysSame && t.hasOwn, 'opening every screen and saving leaves every risk and action exactly as it was');
}
// ── first use: no risks, nothing stored, nothing breaks ──
{
  await seed(page, { riskProfile: [], actionPlan: [], company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] } }, 'ladder');
  await wait(page, 300);
  const t = await page.evaluate(() => { delete S.ladderChart; saveData(); switchTab('ladder'); return { says: document.getElementById('ladderContainer').innerText, stored: !!S.ladderChart, view: Object.keys(_chartView().rows).length }; });
  R.ok(/No risks recorded yet/.test(t.says) && !t.stored && t.view === 0, 'with no risks the ladder says so, and nothing is stored');
}

await R.done(browser, errors);
