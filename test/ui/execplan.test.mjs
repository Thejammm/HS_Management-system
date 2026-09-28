// ══════════════════════════════════════════════════════════════
//  The client execution plan - the screen the client reads. It has to show
//  what part of the business is moving, tie every action back to its high
//  level risk theme, and hand the consultant one way back to the work.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter, RISKS } from './harness.mjs';

const R = reporter('Client execution plan');
const { browser, page, errors } = await openApp();

// A plan with work across four themes: two open on fire, one open and one
// delivered on height, one delivered on transport (that theme finished), one
// overdue on business continuity, and one action with no risk behind it.
const PLAN = () => {
  const rs = RISKS();
  const by = (id) => rs.find(r => r.id === id);
  by('v1').actions.push({ id: 'v1a2', desc: 'Service the extinguishers', owner: 'Dee', due: '2027-03-01', status: 'Not started', priority: 'Medium' });
  by('v2').actions.push({ id: 'v2a1', desc: 'Buy a proper roof-edge system', owner: 'Ash', due: '2027-02-01', status: 'In progress', priority: 'High' });
  by('v2').actions.push({ id: 'v2a2', desc: 'Brief the survey team on fragile roofs', owner: 'Ash', due: '2026-08-01', status: 'Complete', completedDate: '2026-08-02', completedBy: 'Ash' });
  by('v3').actions.push({ id: 'v3a1', desc: 'Write the driving-for-work policy', owner: 'Bev', due: '2026-07-01', status: 'Complete', completedDate: '2026-07-04', completedBy: 'Bev' });
  by('v4').actions.push({ id: 'v4a1', desc: 'Re-lay the stores racking', owner: 'Dee', due: '2026-10-15', status: 'Not started', priority: 'Medium' });
  by('v5').actions.push({ id: 'v5a1', desc: 'Sign the second key customer', owner: 'Simon', due: '2026-01-31', status: 'Not started', priority: 'Critical' });
  return rs;
};

await seed(page, { riskProfile: PLAN(), actionPlan: [
  { id: 'f1', desc: 'Renew the employers liability certificate', owner: 'Bev', due: '2027-01-31', status: 'Not started', source: 'Assurance' }] }, 'execplan');
await wait(page, 500);

// ── every action carries the high level theme it belongs to ──
{
  const t = await page.evaluate(() => {
    const acts = _execActions();
    const of = (d) => acts.find(a => a.desc.indexOf(d) === 0);
    return { fire: _epMacroOf(of('Write the fire')), height: _epMacroOf(of('Buy a proper')),
      transport: _epMacroOf(of('Write the driving')), free: _epMacroOf(of('Renew the employers')),
      fireName: _epThemeName(of('Write the fire')),
      // the derivation is the register's own, not a second opinion
      sameAsRegister: _epMacroOf(of('Write the fire')) === _riskMacroOf(S.riskProfile.find(r => r.id === 'v1')) };
  });
  R.ok(t.fire && t.height && t.transport && t.fire !== t.height, 'an action inherits the macro theme of the risk behind it');
  R.ok(t.free === '', 'an action with no risk behind it claims no theme rather than guessing one');
  R.ok(t.sameAsRegister && /fire/i.test(t.fireName), 'the theme is the register\'s own derivation (' + t.fireName + ')');
}

// ── the plan opens grouped by theme, with honest progress on each ──
{
  const t = await page.evaluate(() => {
    const gs = _epThemeGroups();
    const root = document.getElementById('execPlanRoot');
    const heads = [...root.querySelectorAll('#epYearCard .ep-theme .ep-theme-head')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    const bars = [...root.querySelectorAll('#epYearCard .ep-theme-bar > i')].map(x => x.style.width);
    const g = (nameRx) => gs.find(z => nameRx.test(z.name));
    const h = gs.find(z => z.done && z.list.length);        // a theme part-done
    return { mode: _epGroupBy, blocks: root.querySelectorAll('#epYearCard .ep-theme').length,
      heads, bars, groups: gs.length,
      // the sum of every theme is every action, none lost and none counted twice
      covers: gs.reduce((s, z) => s + z.total, 0) === _execActions().length,
      partDone: h ? (h.done + '/' + h.total) : '',
      partPct: h ? Math.round(h.done / h.total * 100) + '%' : '',
      barMatches: h ? bars.includes(Math.round(h.done / h.total * 100) + '%') : false,
      overdueShown: heads.some(x => /overdue/i.test(x)),
      doneStrip: /Themes fully delivered/.test(root.textContent) };
  });
  R.ok(t.mode === 'theme' && t.blocks >= 3, 'the plan opens grouped by risk theme, one block each (' + t.blocks + ')');
  R.ok(t.covers, 'every action sits in exactly one theme - the blocks account for the whole plan');
  R.ok(t.heads.some(x => /\d+ of \d+ done/.test(x)), 'each theme says how much of it is done: ' + (t.heads[0] || '').slice(0, 76));
  R.ok(t.barMatches, 'the progress bar is that same fraction, not a separate guess (' + t.partDone + ' = ' + t.partPct + ')');
  R.ok(t.overdueShown, 'a theme with something overdue says so on its header');
  R.ok(t.doneStrip, 'a theme with everything delivered still shows, as a win rather than vanishing');
}

// ── the theme name opens that category in the register ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const btn = document.querySelector('#epYearCard .ep-theme .ep-theme-name');
    const want = btn.textContent.trim();
    btn.click();
    setTimeout(() => {
      const open = [...document.querySelectorAll('#rpTbody tr.rpt-macro.rpt-mac-open .rpt-mac-name')].map(x => x.textContent.trim());
      res({ want, onRisk: document.getElementById('tab-risk').classList.contains('active'),
        registerOpen: !!(document.getElementById('wfRegister') || {}).open,
        open, onlyOne: open.length === 1, matches: open.length === 1 && open[0].toUpperCase() === want.toUpperCase() });
    }, 700);
  }));
  R.ok(t.onRisk && t.registerOpen, 'clicking a theme name lands on the risk register');
  R.ok(t.onlyOne && t.matches, 'and opens that one category: ' + t.open.join(', '));
}

// ── back on the plan: the other reading is one click away ──
await page.evaluate(() => { switchTab('execplan'); });
await wait(page, 450);
{
  const t = await page.evaluate(() => {
    const txt = () => document.getElementById('execPlanRoot').textContent.replace(/\s+/g, ' ');
    const chips = [...document.querySelectorAll('#epYearCard .ep-gb')].map(x => x.textContent.trim());
    const themeTitle = /by risk theme/i.test(document.querySelector('#epYearCard .card-band h3').textContent);
    setEpGroupBy('month');
    const monthTitle = /the full year/i.test(document.querySelector('#epYearCard .card-band h3').textContent);
    const months = /February 2027|January 2027|March 2027/.test(txt());
    const themesGone = !document.querySelectorAll('#epYearCard .ep-theme').length;
    // in the dated reading each line still names its theme, or the tie-back is lost
    const labels = [...document.querySelectorAll('#epYearCard td.cas-req > div')].map(x => x.textContent.trim()).filter(Boolean);
    setEpGroupBy('theme');
    return { chips, themeTitle, monthTitle, months, themesGone, labels,
      backToTheme: !!document.querySelectorAll('#epYearCard .ep-theme').length,
      on: (document.querySelector('#epYearCard .ep-gb.on') || {}).textContent };
  });
  R.ok(t.chips.length === 2 && /Risk theme/.test(t.chips[0]) && /Target date/.test(t.chips[1]), 'the card offers both readings: ' + t.chips.join(' / '));
  R.ok(t.themeTitle && t.monthTitle && t.months && t.themesGone, 'switching to Target date gives the month-by-month plan back');
  R.ok(t.labels.length >= 3, 'and every dated line still names its theme above the action (' + t.labels.length + ' labelled)');
  R.ok(t.backToTheme && /Risk theme/.test(t.on || ''), 'the switch says which reading is on, and goes back');
}

// ── the marker beside each action is the band of its risk, never a status ──
{
  const t = await page.evaluate(() => {
    const cell = (d) => {
      const rows = [...document.querySelectorAll('#epYearCard tr')];
      const tr = rows.find(r => r.cells && r.cells[2] && r.cells[2].textContent.indexOf(d) >= 0);
      const m = tr ? tr.cells[0].querySelector('span') : null;
      return { has: !!(m && m.classList.contains('ep-band')), colour: m ? m.style.background : '', tip: m ? (m.getAttribute('title') || '') : '(no cell)' };
    };
    const band = (d) => _epBandOf(_execActions().find(a => a.desc.indexOf(d) === 0));
    // the fixture's fire risk is 5x5 Critical, manual handling 2x3 Medium
    return { fire: cell('Write the fire'), fireBand: band('Write the fire'),
      hand: cell('Re-lay the stores racking'), handBand: band('Re-lay the stores racking'),
      free: cell('Renew the employers'), freeBand: band('Renew the employers'),
      header: (document.querySelector('#epYearCard thead th') || {}).textContent,
      // the band the marker shows is the register's own score, not a second opinion
      agrees: _epBandOf(_execActions().find(a => a.desc.indexOf('Write the fire') === 0))
        === _riskScore(S.riskProfile.find(r => r.id === 'v1')).priority };
  });
  R.ok(/Band/.test(t.header || ''), 'the first column says what it is (' + t.header + ')');
  R.ok(t.fire.has && t.fire.colour === 'rgb(220, 38, 38)' && t.fireBand === 'Critical',
    'a Critical action is marked in the Critical colour (' + t.fireBand + ')');
  R.ok(t.hand.has && t.hand.colour === 'rgb(245, 158, 11)' && t.handBand === 'Medium',
    'a Medium action is marked in the Medium colour (' + t.handBand + ')');
  R.ok(t.agrees, 'the band is the register\'s own score, not a second opinion');
  R.ok(!t.free.has && /not tied to a rated risk/i.test(t.free.tip),
    'an action with no rated risk behind it is left unmarked, and says why on hover');
}

// ── a Low risk is left blank on purpose, so nothing reads as finished ──
{
  const t = await page.evaluate(() => {
    const r = S.riskProfile.find(x => x.id === 'v4');
    r.likelihood = '1'; r.severity = '1';                 // make it Low
    renderExecPlan();
    const rows = [...document.querySelectorAll('#epYearCard tr')];
    const tr = rows.find(x => x.cells && x.cells[2] && x.cells[2].textContent.indexOf('Re-lay the stores racking') >= 0);
    const m = tr ? tr.cells[0].querySelector('span') : null;
    const out = { band: _riskScore(r).priority, marked: !!(m && m.classList.contains('ep-band')),
      tip: m ? (m.getAttribute('title') || '') : '', anyGreen: [...document.querySelectorAll('#epYearCard .ep-band')].some(x => /22, 163, 74/.test(x.style.background)) };
    r.likelihood = '2'; r.severity = '3'; renderExecPlan();
    return out;
  });
  R.ok(t.band === 'Low' && !t.marked, 'a Low risk gets no mark at all');
  R.ok(/marked blank on purpose/i.test(t.tip), 'and says why: ' + t.tip.slice(0, 74));
  R.ok(!t.anyGreen, 'no green appears on the plan, so a mark can never be misread as done');
}

// ── lateness moved to the date, where it belongs ──
{
  const t = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#epYearCard tr')];
    const find = (d) => rows.find(r => r.cells && r.cells[2] && r.cells[2].textContent.indexOf(d) >= 0);
    const dateOf = (tr) => tr ? tr.querySelector('input[type="date"]') : null;
    const late = dateOf(find('Sign the second key customer'));      // due 2026-01-31, overdue
    const ok = dateOf(find('Service the extinguishers'));           // 2027-03-01, on track
    // read the inline style text: a var() border never surfaces on el.style.borderColor
    return { lateBorder: late ? (late.getAttribute('style') || '') : '', lateWeight: late ? late.style.fontWeight : '',
      lateTip: late ? (late.getAttribute('title') || '') : '',
      okBorder: ok ? (ok.getAttribute('style') || '') : '', okTip: ok ? (ok.getAttribute('title') || '') : '' };
  });
  R.ok(/#DC2626/i.test(t.lateBorder) && t.lateWeight === '700' && /Overdue/.test(t.lateTip),
    'an overdue action shows it on its target date, not on a dot at the far left');
  R.ok(/var\(--border\)/.test(t.okBorder) && /On track/.test(t.okTip), 'an action on track leaves its date plain');
}

// ── the reference: five actions on one risk read as five actions on one risk ──
{
  const t = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#epYearCard tr')].filter(r => r.cells && r.cells.length > 5);
    const refOf = (d) => { const tr = rows.find(r => r.cells[2] && r.cells[2].textContent.indexOf(d) >= 0);
      return tr ? tr.cells[1].textContent.trim() : '(row not found)'; };
    const head = [...document.querySelectorAll('#epYearCard thead th')].map(x => x.textContent.trim());
    return { head,
      fire1: refOf('Write the fire'), fire2: refOf('Service the extinguishers'),
      height: refOf('Buy a proper roof-edge'), free: refOf('Renew the employers'),
      appRef: (S.riskProfile.find(r => r.id === 'v1') || {}).ref,
      opens: (rows.find(r => r.cells[2] && r.cells[2].textContent.indexOf('Write the fire') >= 0)
        .cells[1].querySelector('button') || {}).getAttribute
        ? rows.find(r => r.cells[2] && r.cells[2].textContent.indexOf('Write the fire') >= 0)
            .cells[1].querySelector('button').getAttribute('onclick') : '' };
  });
  R.ok(t.head[0] === 'Band' && t.head[1] === 'Ref' && t.head[2] === 'Action',
    'Ref sits between Band and Action (' + t.head.slice(0, 3).join(' | ') + ')');
  R.ok(t.fire1 === t.fire2 && t.fire1 === t.appRef,
    'two actions on one risk carry the same reference, the register\'s own (' + t.fire1 + ')');
  R.ok(t.height !== t.fire1, 'an action on a different risk carries a different one (' + t.height + ')');
  R.ok(t.free === '-', 'an action with no risk behind it shows a dash, not a borrowed reference');
  R.ok(/_gotoRisk\('v1'\)/.test(t.opens || ''), 'and the reference opens that risk in the register');
}

// ── the trailing arrow column is gone; nothing it held was lost ──
{
  const t = await page.evaluate(() => {
    const head = [...document.querySelectorAll('#epYearCard thead th')].map(x => x.textContent.trim());
    const rows = [...document.querySelectorAll('#epYearCard tr.no-such')];   // placeholder, keeps shape
    // an action with a comment shows the count beside the action text instead
    const a = _execActions().find(x => x.desc.indexOf('Write the fire') === 0);
    const o = _execOrigin(a.ref);
    _logAdd(o, 'comment', 'Draft with the fire officer');
    _logAdd(o, 'comment', 'Second draft back');
    renderExecPlan();
    const tr = [...document.querySelectorAll('#epYearCard tr')]
      .find(r => r.cells && r.cells[2] && r.cells[2].textContent.indexOf('Write the fire') >= 0);
    return { head, lastEmpty: head[head.length - 1] === '', cols: head.length, rows: rows.length,
      mark: tr ? (tr.cells[2].querySelector('.ep-mark') || {}).textContent || '' : '',
      cells: tr ? tr.cells.length : 0 };
  });
  R.ok(!t.lastEmpty && t.cols === 9, 'the empty arrow column is gone and the header ends on Status (' + t.cols + ' columns)');
  R.ok(t.cells === 9, 'every row matches the header');
  R.ok(/2/.test(t.mark), 'the activity count moved beside the action it belongs to (' + t.mark.trim() + ')');
}

// ── removing a completed action moved into the opened row ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const a = _execActions().find(x => x.desc.indexOf('Write the fire') === 0);
    const rk = encodeURIComponent(JSON.stringify(a.ref));
    const o = _execOrigin(a.ref); o.status = 'Complete'; o.completedDate = '2026-09-01';
    _execRowOpen = {}; _execRowOpen[rk] = true; renderExecPlan();
    setTimeout(() => {
      const openRow = document.querySelector('#epDeliveredCard .ep-del') || document.querySelector('#execPlanRoot .ep-del');
      const onList = document.querySelector('#execPlanRoot tr.rpt-row .ep-del');
      res({ inDrillIn: !!openRow, label: openRow ? openRow.textContent.trim() : '',
        onList: !!onList, consultant: _isConsultantish() });
    }, 500);
  }));
  R.ok(t.consultant && t.inDrillIn && /Remove/i.test(t.label), 'the consultant can still remove a completed action, from inside the opened row');
  R.ok(!t.onList, 'and never from the list surface, beside a date field');
}

// ── "Work on this": one button from the plan to where the work is done ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const a = _execActions().find(x => x.desc.indexOf('Write the fire') === 0);
    const rk = encodeURIComponent(JSON.stringify(a.ref));
    _execRowOpen = {}; _execRowOpen[rk] = true; renderExecPlan();
    setTimeout(() => {
      const btn = document.querySelector('#execPlanRoot .ep-work');
      if (!btn) { res({ ERR: 'no Work on this button' }); return; }
      const label = btn.textContent.replace(/\s+/g, ' ').trim();
      const call = btn.getAttribute('onclick');
      const tip = btn.getAttribute('title') || '';
      btn.click();
      setTimeout(() => {
        res({ label, call, tip, onRisk: document.getElementById('tab-risk').classList.contains('active'),
          modal: !!document.getElementById('riskModalOverlay'),
          title: (document.getElementById('ract-v1') || {}).value || '' });
      }, 700);
    }, 450);
  }));
  R.ok(/^Work on this/.test(t.label || ''), 'the expanded action carries a "Work on this" button (' + (t.label || t.ERR) + ')');
  R.ok(/_gotoRisk\('v1'\)/.test(t.call || ''), 'it makes the same jump as the greyed risk line above it');
  R.ok(t.onRisk && t.modal && /Fire breaking out/.test(t.title), 'clicking it opens that risk, ready to work on');
  R.ok(/controls/.test(t.tip) && /score/.test(t.tip), 'and it says what it will open: ' + (t.tip || '').slice(0, 70));
}

// ── a legal-duties action goes to its duty line, not nowhere ──
await page.evaluate(() => { switchTab('execplan'); });
await wait(page, 350);
{
  const t = await page.evaluate(() => {
    const mk = { ref: { t: 'mgmt', a: 'sec1', b: 'item1', c: 'act1' }, desc: 'x', status: 'Not started', rag: 'green', source: 'Legal duties' };
    const btn = _epWorkBtnHTML(mk);
    const none = _epWorkBtnHTML({ ref: { t: 'free', a: 'f1' }, desc: 'x', source: 'Assurance' });
    return { btn, theme: _epMacroOf(mk), none };
  });
  R.ok(/_gotoReqLine\('item1'\)/.test(t.btn), 'a legal-duties action sends you to its duty line on the Legal duties tab');
  R.ok(t.theme === 'legal:sec1', 'and groups under that duty area as its theme (' + t.theme + ')');
  R.ok(t.none === '', 'an action with nowhere to go offers no button rather than a dead one');
}

// ── an empty plan still reads as a plan ──
await seed(page, { riskProfile: [], actionPlan: [] }, 'execplan');
await wait(page, 450);
{
  const t = await page.evaluate(() => document.getElementById('execPlanRoot').textContent.replace(/\s+/g, ' '));
  R.ok(/No actions yet|No open actions/i.test(t), 'an empty plan says so rather than showing empty blocks');
}

await R.done(browser, errors);
