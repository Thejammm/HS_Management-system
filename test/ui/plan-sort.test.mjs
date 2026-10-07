// ══════════════════════════════════════════════════════════════
//  Sorting and filtering the client execution plan. Simon, 2026-10-07:
//  "The client execution plan needs to either be organised into the risk
//  hierarchy from the highest to the lowest or to have a filter option to
//  show high to low risk, low to high risks, risks by specialism, mirrored
//  on how shopping web sites do this when people want to filter out on
//  price, etc."
//  The shopping bar under "Everything on your plan": Sort by (one sort,
//  _epSortList, read by every list), a Risk level chip per band with its
//  count over ALL actions, Specialism (the risk themes), "Showing X of Y"
//  and Clear all. Group by gains Risk level. The tiles keep full counts.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Plan sort and filter - the shopping bar');
const { browser, page, errors } = await openApp();

const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const iso = n => day(n) + 'T09:00:00.000Z';
// due this month and not late, whatever day of the month the suite runs on
const endOfMonth = (() => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); })();

// Four risk themes, read from the page's own library: the first library
// entry of each of the first four distinct macro themes.
const TH = await page.evaluate(() => {
  const seen = [];
  HAZARD_LIBRARY.forEach(t => { if (t.macroKey && !seen.some(x => x.macroKey === t.macroKey)) seen.push(t); });
  return seen.slice(0, 4).map(t => ({ lib: t.key, k: t.macroKey, name: _macroName(t.macroKey) }));
});

// Every action's description starts with a unique code word, so a row on
// screen reads back as one action. Bands: Critical 5x5 and 4x5, High 3x4,
// Medium 2x3, Low 1x2, and one risk not rated.
//   Theme A (TH[0]): Critical - Alpha (overdue), Bravo
//   Theme B (TH[1]): High - Charlie (overdue), Delta (undated, no raised date)
//                    Medium - Echo (due this month), Foxtrot
//   Theme C (TH[2]): Low - Golf (overdue), Hotel (no raised date), November (delivered)
//                    Not rated - India (overdue)
//                    Critical - Lima (delivered) - so the REGISTER ranks theme C
//                    as Critical, while its worst OPEN action is only Low
//   Theme D (TH[3]): Critical - Juliet (due this month), Kilo (delivered)
//   No theme:        Mike (a free action, Not rated)
const RISKS = () => ([
  { id: 'rC1', activity: 'Critical risk on theme A', libKey: TH[0].lib, likelihood: '5', severity: '5', actions: [
    { id: 'a1', desc: 'Alpha - write the critical rescue plan', owner: 'Ash', due: day(-10), status: 'Not started', createdAt: iso(-40) },
    { id: 'a2', desc: 'Bravo - fit the critical guard rail', owner: 'Ash', due: day(60), status: 'In progress', createdAt: iso(-5) }] },
  { id: 'rH1', activity: 'High risk on theme B', libKey: TH[1].lib, likelihood: '3', severity: '4', actions: [
    { id: 'a3', desc: 'Charlie - brief the high risk team', owner: 'Bev', due: day(-20), status: 'Not started', createdAt: iso(-30) },
    { id: 'a4', desc: 'Delta - choose a high risk supplier', owner: 'Bev', due: '', status: 'Not started' }] },
  { id: 'rM1', activity: 'Medium risk on theme B', libKey: TH[1].lib, likelihood: '2', severity: '3', actions: [
    { id: 'a5', desc: 'Echo - tidy the medium risk store', owner: 'Cal', due: endOfMonth, status: 'Not started', createdAt: iso(-2) },
    { id: 'a6', desc: 'Foxtrot - label the medium risk shelves', owner: 'Cal', due: day(90), status: 'Not started', createdAt: iso(-60) }] },
  { id: 'rL1', activity: 'Low risk on theme C', libKey: TH[2].lib, likelihood: '1', severity: '2', actions: [
    { id: 'a7', desc: 'Golf - sweep the low risk yard', owner: 'Dee', due: day(-3), status: 'Not started', createdAt: iso(-1) },
    { id: 'a8', desc: 'Hotel - paint the low risk lines', owner: 'Dee', due: day(40), status: 'Not started' },
    { id: 'a9', desc: 'November - fix the low risk sign', owner: 'Dee', due: day(-4), status: 'Complete', completedDate: day(-1), completedBy: 'Dee', createdAt: iso(-20) }] },
  { id: 'rN1', activity: 'Not yet rated risk on theme C', libKey: TH[2].lib, actions: [
    { id: 'a10', desc: 'India - rate the unrated risk', owner: 'Eve', due: day(-5), status: 'Not started', createdAt: iso(-15) }] },
  { id: 'rC3', activity: 'Critical risk on theme C, all delivered', libKey: TH[2].lib, likelihood: '5', severity: '5', actions: [
    { id: 'a11', desc: 'Lima - replace the critical cable', owner: 'Eve', due: day(-30), status: 'Complete', completedDate: day(-20), completedBy: 'Eve', createdAt: iso(-50) }] },
  { id: 'rC2', activity: 'Critical risk on theme D', libKey: TH[3].lib, likelihood: '4', severity: '5', actions: [
    { id: 'a12', desc: 'Juliet - test the critical alarm', owner: 'Fay', due: endOfMonth, status: 'Not started', createdAt: iso(-8) },
    { id: 'a13', desc: 'Kilo - service the critical hoist', owner: 'Fay', due: day(-6), status: 'Complete', completedDate: day(-2), completedBy: 'Fay', createdAt: iso(-35) }] },
]);
const FREE = () => ([{ id: 'f1', desc: 'Mike - renew the insurance certificate', owner: 'Bev', due: day(45), status: 'Not started', source: 'Assurance', createdAt: iso(-12) }]);

await seed(page, { riskProfile: RISKS(), actionPlan: FREE() }, 'execplan');
await wait(page, 400);

// Small readers the steps share.
await page.evaluate(() => {
  window.__fn = n => { try { return new Function('return typeof ' + n)() === 'function'; } catch (e) { return false; } };
  window.__get = n => { try { return new Function('return typeof ' + n + ' === "undefined" ? undefined : ' + n)(); } catch (e) { return undefined; } };
  window.__RANK = { Critical: 0, High: 1, Medium: 2, Low: 3, 'Not rated': 4 };
  window.__LOW = { Low: 0, Medium: 1, High: 2, Critical: 3, 'Not rated': 4 };
  window.__band = a => (_epBandOf(a) || 'Not rated');
  window.__code = a => (a ? String(a.desc).split(' ')[0] : '?');
  // the actions in the rows of a list, in the order they are drawn
  window.__rows = root => {
    if (!root) return [];
    const acts = _execActions();
    return [...root.querySelectorAll('tbody tr')].filter(tr => tr.cells && tr.cells.length === 9)
      .map(tr => { const t = tr.cells[2].textContent; return acts.find(a => a.desc && t.indexOf(a.desc) >= 0) || null; });
  };
  window.__codes = root => __rows(root).map(__code);
  // The contract's sort, written out again here so the screen is checked
  // against the words, not against itself.
  const dk = a => a.due || '9999-12-31';
  window.__cmp = mode => (a, b) => {
    const ba = __band(a), bb = __band(b), R = __RANK;
    const tie = () => ((a.rag === 'red' ? 0 : 1) - (b.rag === 'red' ? 0 : 1)) || dk(a).localeCompare(dk(b));
    if (mode === 'risk-high') return (R[ba] - R[bb]) || tie();
    if (mode === 'risk-low') return (__LOW[ba] - __LOW[bb]) || tie();
    if (mode === 'due') return dk(a).localeCompare(dk(b)) || (R[ba] - R[bb]);
    if (mode === 'raised') { const ra = a.raisedAt || '', rb = b.raisedAt || ''; if (!ra !== !rb) return ra ? -1 : 1; return rb.localeCompare(ra) || (R[ba] - R[bb]); }
    return 0;
  };
  window.__badOrder = (list, mode) => { const c = __cmp(mode), bad = []; for (let i = 1; i < list.length; i++) if (!list[i - 1] || !list[i] || c(list[i - 1], list[i]) > 0) bad.push(__code(list[i - 1]) + ' before ' + __code(list[i])); return bad; };
  // every list on the plan that is not the Delivered card
  window.__lists = () => {
    const out = [{ where: 'This month', list: __rows(document.getElementById('epMonthCard')) }];
    const yc = document.querySelector('#epYearCard .card-body');
    [...(yc ? yc.querySelectorAll('table') : [])].forEach((t, i) => out.push({ where: 'block ' + (i + 1), list: __rows(t) }));
    return out;
  };
  window.__allBad = mode => __lists().flatMap(l => __badOrder(l.list, mode).map(x => l.where + ': ' + x));
  window.__planCodes = () => __lists().flatMap(l => l.list.map(__code));
  // the open actions in the 'Everything on your plan' card, block by block
  window.__yearCodes = () => { const yc = document.querySelector('#epYearCard .card-body'); return [...(yc ? yc.querySelectorAll('table') : [])].flatMap(t => __codes(t)); };
  // the theme blocks as drawn: key, name, rows and the worst open band
  window.__themes = () => [...document.querySelectorAll('#epYearCard .ep-theme')]
    .filter(b => b.querySelector('table') && b.querySelector('.ep-theme-name'))
    .map(b => { const nm = b.querySelector('.ep-theme-name'); const m = /_gotoRiskTheme\('([^']*)'\)/.exec(nm.getAttribute('onclick') || '');
      const list = __rows(b);
      return { k: m ? m[1] : '?', name: nm.textContent.trim(), codes: list.map(__code), worst: list.reduce((w, a) => Math.min(w, __RANK[__band(a)]), 9) }; });
  window.__regIdx = k => { const reg = _riskMacroGroups(S.riskProfile || []).map(g => g.k); const i = reg.indexOf(k); return i < 0 ? 999 : i; };
  window.__tiles = () => [...document.querySelectorAll('#execPlanRoot .ep-tile')].map(t => (t.firstElementChild || t).textContent.trim()).join(',');
  window.__shop = () => document.querySelector('#execPlanRoot .ep-shop');
  window.__chips = () => [...document.querySelectorAll('#execPlanRoot .ep-shop .ep-lv')].map(b => ({ text: b.textContent.replace(/\s+/g, ' ').trim(), on: b.classList.contains('on'), sw: !!b.querySelector('i'), call: b.getAttribute('onclick') || '' }));
  window.__chip = name => [...document.querySelectorAll('#execPlanRoot .ep-shop .ep-lv')].find(b => b.textContent.replace(/\s+/g, ' ').trim().indexOf(name + ' (') === 0) || null;
  window.__spec = () => document.querySelector('#execPlanRoot .ep-shop .ep-spec');
  window.__sort = v => { const s = document.getElementById('epSortSel'); if (!s) return false; s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); return true; };
  window.__showing = () => { const s = __shop(); const m = s ? /Showing\s+(\d+)\s+of\s+(\d+)\s+actions?/.exec(s.textContent.replace(/\s+/g, ' ')) : null; return m ? { x: +m[1], y: +m[2] } : null; };
  window.__clearBtn = () => { const s = __shop(); return s ? ([...s.querySelectorAll('button')].find(b => /Clear all/.test(b.textContent)) || null) : null; };
  window.__banner = () => /Column filters on/.test(document.getElementById('execPlanRoot').textContent);
  // "Showing X of Y": X and Y are both counted over all actions, or both over the open ones
  window.__showingFits = pass => { const s = __showing(); if (!s) return false; const all = _execActions(), open = all.filter(a => a.status !== 'Complete' && a.status !== 'Accepted');
    return (s.y === all.length && s.x === all.filter(pass).length) || (s.y === open.length && s.x === open.filter(pass).length); };
  window.__rgb = hex => { const h = String(hex).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(', '); };
  // The blocks of the Risk level reading: for each table in the card, its
  // heading (the block's own words outside the table) and the colours drawn
  // on it. A flat layout (heading, table, heading, table) is read as the
  // words between one table and the next.
  window.__levels = () => {
    const scope = document.querySelector('#epYearCard .card-body'); if (!scope) return [];
    const tables = [...scope.querySelectorAll('table')];
    const skip = n => { const el = n.nodeType === 1 ? n : n.parentElement; return !el || !!el.closest('table') || !!el.closest('.ep-shop'); };
    const between = (prev, t) => {
      const els = [], txt = []; const w = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) {
        if (skip(n)) continue;
        if (prev && !(prev.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        if (!(t.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
        if (n.nodeType === 3) txt.push(n.textContent); else els.push(n);
      }
      return { els, text: txt.join(' ').replace(/\s+/g, ' ').trim() };
    };
    return tables.map((t, i) => {
      let blk = t.parentElement;
      while (blk.parentElement && blk.parentElement !== scope && blk.parentElement.querySelectorAll('table').length === 1) blk = blk.parentElement;
      let els = [blk, ...blk.querySelectorAll('*')].filter(e => e === blk || !t.contains(e));
      let head = (() => { let s = ''; const w = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) { if (t.contains(n) || n.parentElement.closest('.ep-shop')) continue; s += n.textContent + ' '; }
        return s.replace(/\s+/g, ' ').trim(); })();
      if (!head) { const b = between(tables[i - 1] || null, t); head = b.text; els = b.els; }
      const colours = els.map(e => { const cs = getComputedStyle(e); return [cs.color, cs.backgroundColor, cs.borderLeftColor, cs.borderTopColor, cs.borderBottomColor].join('|'); }).join('||');
      const list = __rows(t);
      return { head, colours, codes: list.map(__code), bands: [...new Set(list.map(__band))], overdue: list.filter(a => a && a.rag === 'red').length, n: list.length };
    });
  };
});

// ── 0. what the builders agreed to provide, and the fixture is what it says ──
{
  const t = await page.evaluate(() => {
    const miss = ['_epSortList', 'setEpSort', 'toggleEpBand', '_epThemeNameOf', 'setEpGroupBy', 'clearEpXF', '_epXFPass', 'openXFPop'].filter(n => !__fn(n));
    const b = {}; _execActions().forEach(a => { b[__code(a)] = __band(a); });
    return { miss, b, n: _execActions().length };
  });
  if (!R.ok(!t.miss.length, 'every function the shopping bar needs is there' + (t.miss.length ? ' - missing: ' + t.miss.join(', ') : ''))) await R.done(browser, errors);
  const want = { Alpha: 'Critical', Bravo: 'Critical', Juliet: 'Critical', Kilo: 'Critical', Lima: 'Critical', Charlie: 'High', Delta: 'High',
    Echo: 'Medium', Foxtrot: 'Medium', Golf: 'Low', Hotel: 'Low', November: 'Low', India: 'Not rated', Mike: 'Not rated' };
  const off = Object.keys(want).filter(k => t.b[k] !== want[k]);
  R.ok(t.n === 14 && !off.length, 'the fixture: 14 actions across Critical, High, Medium, Low and not rated' + (off.length ? ' - wrong: ' + off.map(k => k + '=' + t.b[k]).join(', ') : ''));
}

// ── 1. the bar: Sort by, the Risk level chips, Specialism ──
{
  const t = await page.evaluate(() => {
    const shops = document.querySelectorAll('#execPlanRoot .ep-shop');
    const shop = __shop(), body = document.querySelector('#epYearCard .card-body');
    const firstTable = body ? body.querySelector('table') : null;
    const sel = document.getElementById('epSortSel');
    const xf = __get('_epXF') || {};
    return { count: shops.length, inYear: !!(shop && body && body.contains(shop)),
      beforeLists: !!(shop && firstTable && (shop.compareDocumentPosition(firstTable) & Node.DOCUMENT_POSITION_FOLLOWING)),
      selIn: !!(sel && shop && shop.contains(sel)),
      opts: sel ? [...sel.options].map(o => o.textContent.trim()) : [], vals: sel ? [...sel.options].map(o => o.value) : [],
      value: sel ? sel.value : '', sortVar: __get('_epSort'),
      text: shop ? shop.textContent.replace(/\s+/g, ' ') : '',
      labs: shop ? [...shop.querySelectorAll('.ep-shop-lab')].map(x => x.textContent.trim()) : [],
      chips: __chips(), spec: __spec() ? __spec().textContent.replace(/\s+/g, ' ').trim() : '(none)',
      showing: __showing(), clear: !!__clearBtn(), xfBand: Array.isArray(xf.band), xfTheme: Array.isArray(xf.theme),
      radius: shop ? getComputedStyle(shop).borderTopLeftRadius : '',
      chipRadius: [...document.querySelectorAll('#execPlanRoot .ep-shop .ep-lv, #execPlanRoot .ep-shop .ep-spec, #epSortSel')].map(x => getComputedStyle(x).borderTopLeftRadius) };
  });
  R.ok(t.count === 1 && t.inYear && t.beforeLists, 'one shopping bar, inside "Everything on your plan", above the lists');
  R.ok(t.selIn && t.opts.join('|') === 'Highest risk first|Lowest risk first|Target date - soonest first|Most recently raised',
    'Sort by offers, in order: ' + t.opts.join(' / '));
  R.ok(t.vals.join('|') === 'risk-high|risk-low|due|raised', 'and each choice is one of the four sorts (' + t.vals.join(', ') + ')');
  R.ok(t.value === 'risk-high' && t.sortVar === 'risk-high', 'the plan opens on Highest risk first (' + t.value + ')');
  R.ok(/Sort by/.test(t.text) && /Risk level/.test(t.text), 'the bar is labelled Sort by and Risk level (' + t.labs.join(', ') + ')');
  const chipText = t.chips.map(c => c.text).join(' | ');
  R.ok(t.chips.length === 5 && /^Critical \(5\)$/.test(t.chips[0].text) && /^High \(2\)$/.test(t.chips[1].text) && /^Medium \(2\)$/.test(t.chips[2].text)
    && /^Low \(3\)$/.test(t.chips[3].text) && /^Not rated \(2\)$/.test(t.chips[4].text),
    'a chip per band, worst first, each counting ALL its actions, delivered included: ' + chipText);
  R.ok(t.chips.every(c => c.sw && !c.on && /toggleEpBand\(/.test(c.call)), 'each chip carries a colour swatch, starts off, and toggles its band');
  R.ok(t.spec === 'Specialism', 'and a Specialism button (' + t.spec + ')');
  R.ok(!t.showing && !t.clear, 'with no filter on, no "Showing X of Y" and no Clear all');
  R.ok(t.xfBand && t.xfTheme, 'the plan filter holds a band list and a theme list');
  R.ok(t.radius === '0px' && t.chipRadius.length >= 7 && t.chipRadius.every(r => r === '0px'), 'square, the house style - no rounded pills (' + [t.radius].concat(t.chipRadius).join(' ') + ')');
}

// ── 2. Highest risk first, the default ──
{
  const t = await page.evaluate(() => {
    const src = _execActions(), before = src.map(__code).join(','), out = _epSortList(src);
    const ths = __themes();
    return { month: __codes(document.getElementById('epMonthCard')), bad: __allBad('risk-high'),
      copy: out !== src && src.map(__code).join(',') === before && out.length === src.length,
      fnOrder: _epSortList(_execActions().filter(a => a.status !== 'Complete' && a.status !== 'Accepted')).map(__code),
      ths, firstWorst: ths.every(b => b.codes.length && __RANK[__band(_execActions().find(a => __code(a) === b.codes[0]))] === b.worst),
      reg: ths.map(b => __regIdx(b.k)) };
  });
  R.ok(t.copy, '_epSortList hands back a sorted copy and leaves the list it was given alone');
  R.ok(t.month.join(',') === 'Alpha,Juliet,Charlie,Echo,Golf,India',
    'This month: Critical first (the late one first), then High, Medium, Low, not rated last - ' + t.month.join(', '));
  R.ok(!t.bad.length, 'every list on the plan is in that order' + (t.bad.length ? ' - out of order: ' + t.bad.join('; ') : ''));
  R.ok(t.fnOrder[0] === 'Alpha' && t.fnOrder[t.fnOrder.length - 1] === 'Mike', 'the one sort reads the same off the function: ' + t.fnOrder.join(', '));
  R.ok(t.firstWorst, 'each theme block opens on its most serious action');
  // the worst open band leads, and a tie keeps the register's order
  const ok = t.ths.every((b, i) => !i || (t.ths[i - 1].worst < b.worst) || (t.ths[i - 1].worst === b.worst && t.reg[i - 1] <= t.reg[i]));
  R.ok(ok, 'theme blocks run worst first: ' + t.ths.map(b => b.name + '(' + b.worst + ')').join(' > '));
  const iB = t.ths.findIndex(b => b.k === TH[1].k), iC = t.ths.findIndex(b => b.k === TH[2].k);
  const regC = await page.evaluate((kb, kc) => __regIdx(kc) < __regIdx(kb), TH[1].k, TH[2].k);
  R.ok(regC && iB >= 0 && iC > iB, TH[2].name + ' sits below ' + TH[1].name + ' - its worst OPEN action is Low, though the register ranks the theme Critical');
}

// ── 3. Lowest risk first ──
{
  const t = await page.evaluate(() => {
    const did = __sort('risk-low');
    const sel = document.getElementById('epSortSel');
    return { did, value: sel ? sel.value : '', sortVar: __get('_epSort'), month: __codes(document.getElementById('epMonthCard')), bad: __allBad('risk-low'),
      ths: __themes().map(b => Object.assign(b, { reg: __regIdx(b.k) })) };
  });
  R.ok(t.did && t.value === 'risk-low' && t.sortVar === 'risk-low', 'choosing Lowest risk first redraws with the choice still showing');
  R.ok(t.month.join(',') === 'Golf,Echo,Charlie,Alpha,Juliet,India',
    'This month: Low, Medium, High, Critical - and not rated still last: ' + t.month.join(', '));
  R.ok(!t.bad.length, 'every list on the plan is in that order' + (t.bad.length ? ' - out of order: ' + t.bad.join('; ') : ''));
  const rated = t.ths.filter(b => b.k && b.worst < 4);
  const LOWOF = [3, 2, 1, 0];   // worst open band (Critical 0 .. Low 3) read least serious first
  const ok = rated.every((b, i) => !i || LOWOF[rated[i - 1].worst] < LOWOF[b.worst] || (rated[i - 1].worst === b.worst && rated[i - 1].reg <= b.reg));
  R.ok(ok && rated.length >= 4 && rated[0].k === TH[2].k, 'theme blocks run least serious first: ' + rated.map(b => b.name + '(' + b.worst + ')').join(' > '));
}

// ── 4. Target date - soonest first ──
{
  const t = await page.evaluate(() => {
    __sort('due');
    const ths = __themes();
    const regs = ths.map(b => __regIdx(b.k));
    return { month: __codes(document.getElementById('epMonthCard')), bad: __allBad('due'), ths, regs,
      themeB: (ths.find(b => /Charlie/.test(b.codes.join())) || {}).codes || [] };
  });
  R.ok(t.month.join(',') === 'Charlie,Alpha,India,Golf,Juliet,Echo',
    'This month: the soonest date first, a tie on the date going to the more serious - ' + t.month.join(', '));
  R.ok(!t.bad.length, 'every list on the plan is soonest first' + (t.bad.length ? ' - out of order: ' + t.bad.join('; ') : ''));
  R.ok(t.themeB[t.themeB.length - 1] === 'Delta', 'an action with no target date goes last (' + t.themeB.join(', ') + ')');
  R.ok(t.regs.every((r, i) => !i || t.regs[i - 1] <= r), 'by date, the theme blocks keep the register\'s order');
}

// ── 5. Most recently raised ──
{
  const t = await page.evaluate(() => {
    __sort('raised');
    const ths = __themes();
    return { month: __codes(document.getElementById('epMonthCard')), bad: __allBad('raised'),
      themeB: (ths.find(b => /Charlie/.test(b.codes.join())) || {}).codes || [],
      themeC: (ths.find(b => /Golf/.test(b.codes.join())) || {}).codes || [] };
  });
  R.ok(t.month.join(',') === 'Golf,Echo,Juliet,India,Charlie,Alpha', 'This month: the newest raised first - ' + t.month.join(', '));
  R.ok(!t.bad.length, 'every list on the plan is newest raised first' + (t.bad.length ? ' - out of order: ' + t.bad.join('; ') : ''));
  R.ok(t.themeB[t.themeB.length - 1] === 'Delta' && t.themeC[t.themeC.length - 1] === 'Hotel',
    'an action with no raised date goes last (' + t.themeB.join(', ') + ' / ' + t.themeC.join(', ') + ')');
}

// ── 6. the Delivered list keeps its own order, newest delivered first ──
{
  const t = await page.evaluate(() => {
    const out = {};
    ['risk-high', 'risk-low', 'due'].forEach(m => { __sort(m); out[m] = __codes(document.getElementById('epDeliveredCard')).join(','); });
    return out;
  });
  R.ok(t['risk-high'] === 'November,Kilo,Lima' && t['risk-low'] === t['risk-high'] && t.due === t['risk-high'],
    'Delivered stays newest delivered first whatever the sort (' + t['risk-high'] + ')');
}

// ── 7. Group by Risk level ──
{
  const t = await page.evaluate(() => {
    __sort('risk-high');
    const gb = [...document.querySelectorAll('#epYearCard .ep-gb')];
    const chips = gb.map(x => x.textContent.trim());
    const lv = gb.find(x => /Risk level/.test(x.textContent));
    if (lv) lv.click();
    const out = { chips, mode: __get('_epGroupBy'), on: (document.querySelector('#epYearCard .ep-gb.on') || {}).textContent || '',
      high: __levels(), badHigh: __allBad('risk-high'), month: __codes(document.getElementById('epMonthCard')) };
    __sort('risk-low'); out.low = __levels(); out.badLow = __allBad('risk-low');
    __sort('due'); out.due = __levels(); out.badDue = __allBad('due');
    __sort('risk-high');
    // a band with nothing open is not shown
    const mr = S.riskProfile.find(r => r.id === 'rM1');
    mr.actions.forEach(a => { a.status = 'Complete'; a.completedDate = a.completedDate || new Date().toISOString().slice(0, 10); });
    renderExecPlan(); out.noMed = __levels();
    mr.actions.forEach(a => { a.status = 'Not started'; a.completedDate = ''; });
    renderExecPlan();
    out.planCodes = __yearCodes().length;
    return out;
  });
  R.ok(t.chips.length === 3 && /Risk theme/.test(t.chips[0]) && /Target date/.test(t.chips[1]) && /Risk level/.test(t.chips[2]),
    'Group by offers a third reading: ' + t.chips.join(' / '));
  R.ok(t.mode === 'level' && /Risk level/.test(t.on), 'Risk level is on once chosen (' + t.mode + ')');
  const bandsOf = L => L.map(l => l.bands.length === 1 ? l.bands[0] : ('mixed:' + l.bands.join('+')));
  R.ok(bandsOf(t.high).join(',') === 'Critical,High,Medium,Low,Not rated', 'one block a band, worst first: ' + bandsOf(t.high).join(', '));
  const RGB = { Critical: '220, 38, 38', High: '234, 88, 12', Medium: '245, 158, 11' };
  const heads = t.high.map(l => {
    const b = l.bands[0], hasName = l.head.toLowerCase().indexOf(String(b).toLowerCase()) >= 0;
    const hasN = new RegExp('(^|\\D)' + l.n + '(\\D|$)').test(l.head);
    const od = l.overdue ? new RegExp('(^|\\D)' + l.overdue + '\\s+overdue', 'i').test(l.head) : !/overdue/i.test(l.head);
    // Low is not checked for colour: on the plan a green mark reads as done (Simon), so Low
    // may be left plain on purpose - the rule the execplan suite holds for the band marks.
    const col = (RGB[b] && b !== 'Low') ? l.colours.indexOf(RGB[b]) >= 0 : true;
    return { b, ok: hasName && hasN && od && col, why: [hasName ? '' : 'no name', hasN ? '' : 'no count ' + l.n, od ? '' : 'overdue ' + l.overdue, col ? '' : 'no band colour'].filter(Boolean).join(' '), head: l.head.slice(0, 60) };
  });
  R.ok(heads.every(h => h.ok), 'each block is headed with its band, its count, "n overdue" when any, Critical/High/Medium in the band colour'
    + (heads.some(h => !h.ok) ? ' - ' + heads.filter(h => !h.ok).map(h => h.b + ': ' + h.why + ' [' + h.head + ']').join('; ') : ''));
  R.ok(t.high.map(l => l.n).join(',') === '3,2,2,2,2', 'the blocks hold the open actions only (' + t.high.map(l => l.n).join(',') + ')');
  R.ok(!t.badHigh.length && t.high[0].codes[0] === 'Alpha', 'inside each block the sort still applies' + (t.badHigh.length ? ' - ' + t.badHigh.join('; ') : ''));
  R.ok(bandsOf(t.low).join(',') === 'Low,Medium,High,Critical,Not rated' && !t.badLow.length,
    'Lowest risk first turns the rated bands round and keeps not rated last: ' + bandsOf(t.low).join(', '));
  R.ok(bandsOf(t.due).join(',') === 'Critical,High,Medium,Low,Not rated' && !t.badDue.length,
    'by target date the bands keep their order and each block runs soonest first');
  R.ok(bandsOf(t.noMed).join(',') === 'Critical,High,Low,Not rated', 'a band with nothing open is not shown: ' + bandsOf(t.noMed).join(', '));
  R.ok(t.planCodes === 11, 'and with it back, all 11 open actions are on the plan again (' + t.planCodes + ')');
}
await page.evaluate(() => { setEpGroupBy('theme'); });
await wait(page, 200);

// ── 8. a Risk level chip filters the lists; the tiles and the chips keep their full counts ──
{
  const t = await page.evaluate(() => {
    const tiles0 = __tiles(), chips0 = __chips().map(c => c.text).join('|');
    const hi = __chip('High'); if (!hi) return { ERR: 'no High chip' };
    hi.click();
    const xf = __get('_epXF') || {};
    const out = { tiles0, chips0, band: (xf.band || []).slice(), tiles1: __tiles(), chips1: __chips(),
      plan: __yearCodes(), month: __codes(document.getElementById('epMonthCard')), banner: __banner(),
      showing: __showing(), fits: __showingFits(a => __band(a) === 'High'), clear: !!__clearBtn(),
      active: _epXFActive() };
    // a second band adds to the first, as a shop's ticks do
    __chip('Critical').click();
    out.both = __yearCodes(); out.fitsBoth = __showingFits(a => ['High', 'Critical'].includes(__band(a)));
    // clicking a chip that is on takes it off
    __chip('High').click();
    out.crit = __yearCodes(); out.band2 = ((__get('_epXF') || {}).band || []).slice();
    out.chips2 = __chips().map(c => c.text).join('|');
    // the unrated chip finds the actions with no rated risk behind them
    __chip('Critical').click(); __chip('Not rated').click();
    out.nr = __yearCodes();
    // Clear all puts everything back, the column filters with it
    const x = __get('_epXF'); if (x) x.src = ['Assurance'];
    renderExecPlan();
    const cb = __clearBtn(); out.clearWas = !!cb; if (cb) cb.click();
    const x2 = __get('_epXF') || {};
    out.after = { band: (x2.band || []).length, theme: (x2.theme || []).length, src: (x2.src || []).length, showing: __showing(), clear: !!__clearBtn(),
      banner: __banner(), chipsOn: __chips().filter(c => c.on).length, plan: __yearCodes().length, tiles: __tiles() };
    return out;
  });
  if (t.ERR) R.ok(false, t.ERR);
  else {
    const hiChip = t.chips1.find(c => /^High/.test(c.text)) || {};
    R.ok(t.band.join() === 'High' && hiChip.on && t.active, 'clicking High turns the High chip on and the plan filter with it');
    R.ok(t.plan.length === 2 && t.plan.every(c => ['Charlie', 'Delta'].includes(c)) && t.month.join() === 'Charlie',
      'every list now shows only High actions: ' + t.plan.join(', '));
    R.ok(t.tiles1 === t.tiles0, 'the tiles keep their full counts (' + t.tiles1 + ')');
    R.ok(t.chips1.map(c => c.text).join('|') === t.chips0, 'the chips keep counting all actions, like a shop\'s price bands: ' + t.chips1.map(c => c.text).join(' | '));
    R.ok(t.showing && t.fits, '"Showing X of Y actions" says how much is shown (' + (t.showing ? t.showing.x + ' of ' + t.showing.y : 'missing') + ')');
    R.ok(t.clear && t.banner, 'with a Clear all in the bar, and the "Column filters on" line above the tiles');
    R.ok(t.both.length === 5 && t.both.every(c => ['Alpha', 'Bravo', 'Juliet', 'Charlie', 'Delta'].includes(c)) && t.fitsBoth,
      'a second chip adds its band: ' + t.both.join(', '));
    R.ok(t.band2.join() === 'Critical' && t.crit.every(c => ['Alpha', 'Bravo', 'Juliet'].includes(c)) && t.chips2 === t.chips0,
      'clicking a chip that is on takes it off again');
    R.ok(t.nr.length === 2 && t.nr.every(c => ['India', 'Mike'].includes(c)), 'Not rated finds the actions with no rated risk behind them: ' + t.nr.join(', '));
    R.ok(t.clearWas && !t.after.band && !t.after.theme && !t.after.src && !t.after.showing && !t.after.clear && !t.after.banner && !t.after.chipsOn && t.after.plan === 11 && t.after.tiles === t.tiles0,
      'Clear all resets every filter, the column ones too, and the plan is whole again (' + t.after.plan + ' open)');
  }
}

// ── 9. Specialism - the risk themes ──
{
  const t = await page.evaluate((names) => new Promise(res => {
    const btn = __spec(); if (!btn) { res({ ERR: 'no Specialism button' }); return; }
    btn.click();
    const pop = document.getElementById('casXFPop');
    if (!pop) { res({ ERR: 'Specialism opened no pick list' }); return; }
    const rows = [...pop.querySelectorAll('label.cas-xf-row')].map(l => { const c = l.querySelector('input[data-xfv]'); return c ? { v: c.getAttribute('data-xfv'), n: ((l.querySelector('.cas-xf-n') || {}).textContent || '').trim() } : null; }).filter(Boolean);
    const want = {}; _execActions().forEach(a => { const v = _epThemeNameOf(a); want[v] = (want[v] || 0) + 1; });
    // pick one theme in the list, the way the consultant does
    const all = pop.querySelector('#casXFAll'); if (all) { all.checked = false; all.dispatchEvent(new Event('change')); }
    const pick = [...pop.querySelectorAll('input[data-xfv]')].find(c => c.getAttribute('data-xfv') === names[0]);
    if (pick) { pick.checked = true; pick.dispatchEvent(new Event('change')); }
    const ap = [...pop.querySelectorAll('button')].find(b => b.textContent.trim() === 'Apply'); if (ap) ap.click();
    setTimeout(() => {
      const xf = __get('_epXF') || {};
      const out = { rows, want, mike: _epThemeNameOf(_execActions().find(a => __code(a) === 'Mike')),
        alpha: _epThemeNameOf(_execActions().find(a => __code(a) === 'Alpha')),
        viaPop: (xf.theme || []).slice(), specPop: (__spec() || {}).textContent, planPop: __yearCodes() };
      clearEpXF();
      const tiles0 = __tiles();
      // and driven straight, as a saved view would be
      __get('_epXF').theme = [names[1]]; renderExecPlan();
      out.spec = (__spec() || {}).textContent; out.specOn = !!(__spec() && __spec().classList.contains('on'));
      out.plan = __yearCodes(); out.month = __codes(document.getElementById('epMonthCard'));
      out.themesOk = __lists().every(l => l.list.every(a => _epMacroOf(a) === names[2]));
      out.tiles = __tiles(); out.tiles0 = tiles0; out.showing = __showing();
      out.fits = __showingFits(a => _epThemeNameOf(a) === names[1]); out.banner = __banner();
      out.chips = __chips().map(c => c.text).join('|');
      clearEpXF();
      out.specAfter = (__spec() || {}).textContent; out.themeAfter = ((__get('_epXF') || {}).theme || []).length;
      res(out);
    }, 80);
  }), [TH[0].name, TH[1].name, TH[1].k]);
  if (t.ERR) R.ok(false, t.ERR);
  else {
    const listed = t.rows.map(r => r.v);
    const expect = Object.keys(t.want);
    R.ok(expect.every(v => listed.includes(v)) && listed.length === expect.length && listed.includes('No risk theme'),
      'Specialism lists every risk theme on the plan, and "No risk theme": ' + listed.join(', '));
    R.ok(t.rows.every(r => String(t.want[r.v]) === r.n) && String(t.want[TH[2].name]) === '5',
      'each with its count over all actions, delivered included (' + t.rows.map(r => r.v + ' ' + r.n).join(', ') + ')');
    R.ok(t.mike === 'No risk theme' && t.alpha === TH[0].name, 'an action with no risk behind it is "No risk theme"; one on a risk carries that risk\'s theme');
    R.ok(t.viaPop.join() === TH[0].name && String(t.specPop).replace(/\s+/g, ' ').trim() === 'Specialism (1)' && t.planPop.every(c => ['Alpha', 'Bravo'].includes(c)) && t.planPop.length === 2,
      'picking one in the list filters the plan to it and the button says "Specialism (1)"');
    R.ok(String(t.spec).replace(/\s+/g, ' ').trim() === 'Specialism (1)', 'set straight on the filter, the button reads "' + String(t.spec).replace(/\s+/g, ' ').trim() + '"');
    R.ok(t.themesOk && t.plan.length === 4 && t.month.join(',') === 'Charlie,Echo', 'every list shows only that theme\'s actions: ' + t.plan.join(', '));
    R.ok(t.tiles === t.tiles0 && t.showing && t.fits && t.banner, 'the tiles keep their counts and the bar says how much is shown');
    R.ok(String(t.specAfter).replace(/\s+/g, ' ').trim() === 'Specialism' && !t.themeAfter, 'Clear all takes the specialism off too');
  }
}

// ── 10. read-only still shows the bar - it is a view, not an edit ──
{
  const t = await page.evaluate(() => {
    const keep = window._roLocked;
    window._roLocked = () => true;
    let out;
    try {
      renderExecPlan();
      const sel = document.getElementById('epSortSel');
      out = { shop: !!__shop(), sel: !!sel, disabled: sel ? sel.disabled : true, chips: __chips().length, spec: !!__spec(),
        dateLocked: !!document.querySelector('#epYearCard input[type="date"][disabled]') };
      __sort('risk-low'); out.sorted = __codes(document.getElementById('epMonthCard')).join(',');
      const lo = __chip('Low'); if (lo) lo.click(); out.lowOnly = __yearCodes();
      clearEpXF(); __sort('risk-high');
    } finally { window._roLocked = keep; renderExecPlan(); }
    return out;
  });
  R.ok(t.dateLocked, 'the read-only view is locked (its dates cannot be edited)');
  R.ok(t.shop && t.sel && !t.disabled && t.chips === 5 && t.spec, 'and the shopping bar is still there, every control live');
  R.ok(t.sorted === 'Golf,Echo,Charlie,Alpha,Juliet,India' && t.lowOnly.length && t.lowOnly.every(c => ['Golf', 'Hotel'].includes(c)),
    'sorting and the chips work for a client looking at a locked plan');
}

// ── 11. one name for the no-theme group, and an empty result says it is the filters ──
{
  const t = await page.evaluate((nameA) => {
    clearEpXF(); setEpGroupBy('theme'); __sort('risk-high');
    const names = [...document.querySelectorAll('#epYearCard .ep-theme-name')].map(x => x.textContent.trim());
    // theme A holds only Critical actions, so theme A + Low matches nothing
    const x = __get('_epXF'); x.theme = [nameA]; x.band = ['Low']; renderExecPlan();
    const body = document.querySelector('#epYearCard .card-body');
    const said = body ? body.textContent.replace(/\s+/g, ' ') : '';
    const out = { names, said, showing: __showing(), rows: __yearCodes().length };
    clearEpXF();
    out.back = __yearCodes().length;
    return out;
  }, TH[0].name);
  R.ok(t.names.includes('No risk theme') && !t.names.some(n => /Not tied to a risk theme/.test(n)),
    'the block of actions with no risk theme is called "No risk theme", the word the Specialism list uses (' + t.names.join(', ') + ')');
  R.ok(t.showing && t.showing.x === 0 && !t.rows && /Nothing on the plan matches the filters/.test(t.said) && !/No actions yet/.test(t.said),
    'filters that match nothing say so in the Risk theme reading - not that the plan is empty');
  R.ok(t.back === 11, 'and Clear all brings the plan back (' + t.back + ' open)');
}

await R.done(browser, errors);
