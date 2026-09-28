// ══════════════════════════════════════════════════════════════
//  The risk register and the risk modal - the screen the consultant works
//  in front of the client. Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, openRegister, wait, reporter, RISKS } from './harness.mjs';

const R = reporter('Risk register and modal');
const { browser, page, errors } = await openApp();

// ── the register: three bands, macro groups, one row per risk ──
await seed(page, { riskProfile: RISKS() }, 'risk');
await openRegister(page);
{
  const t = await page.evaluate(() => {
    const body = document.getElementById('rpTbody');
    return { bands: [...body.querySelectorAll('tr.rpt-band')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
      groups: [...body.querySelectorAll('tr.rpt-macro .rpt-mac-name')].map(x => x.textContent.trim()),
      rows: [...body.querySelectorAll('tr.rpt-row')].length,
      titles: [...body.querySelectorAll('tr.rpt-row')].map(x => x.cells[2].textContent.trim()),   // cells[1] is the Ref column
      refs: [...body.querySelectorAll('tr.rpt-row')].map(x => x.cells[1].textContent.trim()),
      headers: [...document.querySelectorAll('#rpTbody')].length ? [...document.querySelectorAll('table thead th')].map(x => x.textContent.trim()).filter(Boolean) : [] };
  });
  R.ok(t.bands.length === 3 && /^Risk profile/.test(t.bands[0]) && /^Legal duties/.test(t.bands[1]) && /^Company maturity/.test(t.bands[2]),
    'the register is banded Risk profile, Legal duties, Company maturity');
  R.ok(t.rows === 6, 'every risk has a row, rated or not (' + t.rows + ')');
  R.ok(t.titles.some(x => /Fire breaking out/.test(x)) && t.titles.some(x => /Not yet scored/.test(x)), 'rows read by risk title');
  R.ok(t.groups.length >= 4, 'risks group under their macro category (' + t.groups.join(', ') + ')');
}

// ── the H&S and Operational chips ──
{
  const m = await page.evaluate(() => {
    const count = () => document.querySelectorAll('#rpTbody tr.rpt-row').length;
    setRiskModeFilter('hs'); _macroExpandAll(true); const hs = count();
    setRiskModeFilter('ops'); _macroExpandAll(true); const ops = count();
    setRiskModeFilter('all'); _macroExpandAll(true); return { hs, ops, all: count() };
  });
  R.ok(m.all === 6 && m.ops === 1 && m.hs === 5, 'the chips split health and safety from operational (' + m.hs + ' / ' + m.ops + ')');
}

// ── search ──
{
  const s = await page.evaluate(() => {
    _riskSearch = 'fall from height'; renderRiskProfile();
    const n = document.querySelectorAll('#rpTbody tr.rpt-row').length;
    _riskSearch = ''; renderRiskProfile(); return n;
  });
  R.ok(s === 1, 'search finds the one risk it names (' + s + ')');
}

// ── the modal: it opens on the risk you clicked, with its five tabs ──
await page.evaluate(() => _riskOpenModal('v1'));
await wait(page, 500);
{
  const t = await page.evaluate(() => {
    const ov = document.getElementById('riskModalOverlay');
    return { open: !!ov, title: (document.getElementById('ract-v1') || {}).value || '',
      tabs: [...document.querySelectorAll('#riskModalOverlay [role="tab"]')].map(x => x.textContent.replace(/\s+/g, ' ').trim()) };
  });
  R.ok(t.open && /Fire breaking out at the premises/.test(t.title), 'clicking a risk opens it in the modal');
  R.ok(t.tabs.length === 5 && /Identify/.test(t.tabs[1]) && /Controls & rating/.test(t.tabs[3]) && /Action delegation/.test(t.tabs[4]),
    'the modal carries Summary, Identify, People & impact, Controls & rating, Action delegation');
}

// ── tab 3: the control table, the reality box, the score gate ──
await page.evaluate(() => _riskDetailTab('rating'));
await wait(page, 450);
{
  const t = await page.evaluate(() => {
    const body = document.getElementById('rpBody');
    const ctl = body.querySelector('table.act-ctl');
    const sel = body.querySelector('.rt-current select');
    const toast = () => (document.getElementById('toast') || {}).textContent || '';
    const out = { ctlTable: !!ctl && /High level control/i.test(ctl.querySelector('th').textContent),
      ctlRow: !!ctl && /Fire risk assessment reviewed annually/.test([...ctl.querySelectorAll('textarea')].map(x => x.value).join(' ')),
      reviewDue: !!body.querySelector('input[type="date"][onchange*="reviewDue"]'),
      reality: !!body.querySelector('textarea[oninput*="controls"]'),
      order: body.innerText.indexOf('INHERENT') < body.innerText.indexOf('Control table') };
    // the gate: an open control and an open action means the score cannot read controlled
    S.riskProfile.find(r => r.id === 'v1').targetL = '2';
    S.riskProfile.find(r => r.id === 'v1').targetS = '3';
    sel.value = '1'; sel.dispatchEvent(new Event('change'));
    out.gated = S.riskProfile.find(r => r.id === 'v1').likelihood === '5' && /still open on this risk/.test(toast());
    return out;
  });
  R.ok(t.ctlTable && t.ctlRow, 'tab 3 shows the control table with its high level controls');
  R.ok(t.reality && t.reviewDue && t.order, 'reality today, the review due date and the order Inherent then Control table');
  R.ok(t.gated, 'the score cannot be moved to read controlled while work is open');
}

// ── tab 4: the plan actions, and what reaches the execution plan ──
await page.evaluate(() => _riskDetailTab('actions'));
await wait(page, 450);
{
  const t = await page.evaluate(() => {
    const body = document.getElementById('rpBody');
    const vals = [...body.querySelectorAll('table.act-table:not(.act-ctl) textarea')].map(x => x.value);
    const ep = _execActions();
    return { planRow: vals.some(v => /Write the fire evacuation procedure/.test(v)),
      noControl: !vals.some(v => /Fire risk assessment reviewed annually/.test(v)),
      onPlan: ep.filter(a => /Write the fire evacuation procedure/.test(a.desc)).length === 1,
      controlOffPlan: !ep.some(a => /Fire risk assessment reviewed annually/.test(a.desc)),
      source: (ep.find(a => /Write the fire evacuation/.test(a.desc)) || {}).sourceLabel };
  });
  R.ok(t.planRow && t.noControl, 'tab 4 lists the plan actions, never the control rows');
  R.ok(t.onPlan && t.controlOffPlan, 'a plan action reaches the execution plan once; a control never does');
  R.ok(/Fire breaking out at the premises/.test(t.source || ''), 'the plan names the risk it came from');
}

// ── the summary reads the risk back ──
await page.evaluate(() => _riskDetailTab('summary'));
await wait(page, 450);
{
  const t = await page.evaluate(() => document.getElementById('rpBody').innerText);
  R.ok(/Hazard \/ Associated risk/i.test(t) && /fragile|workshop/i.test(t), 'the summary shows the hazard and associated risk');
  R.ok(/High level controls/i.test(t) && /Actions for client execution/i.test(t), 'the summary separates the high level controls from the actions');
}

// ── deleting a risk goes to the consultant's bin, and comes back whole ──
await page.evaluate(() => { _riskCloseModal(); });
await wait(page, 300);
{
  const t = await page.evaluate(() => {
    deleteRiskEntry('v3');
    const e = (S.recycleBin || [])[0];
    const gone = !S.riskProfile.some(r => r.id === 'v3');
    restoreBinItem(e ? e.id : 'x');
    const back = S.riskProfile.find(r => r.id === 'v3');
    return { binned: gone && !!e && e.kind === 'risk' && /road collision/.test(e.label),
      restored: !!back && back.likelihood === '3' && !(S.recycleBin || []).length };
  });
  R.ok(t.binned, 'a deleted risk lands in the consultant-only bin, named');
  R.ok(t.restored, 'restoring it puts the risk back whole');
}

// ── a risk you just added is never hidden inside a collapsed category ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const G = (fn) => () => { try { fn(); } catch (e) { res({ ERR: String((e && e.message) || e) }); } };
    _macroExpandAll(false);                      // the tidy default: everything shut
    const shutBefore = document.querySelectorAll('#rpTbody tr.rpt-row').length;
    addRiskEntry();
    setTimeout(G(() => {
      _riskCloseModal();
      setTimeout(G(() => {
        const rows = [...document.querySelectorAll('#rpTbody tr.rpt-row')];
        const open = [...document.querySelectorAll('#rpTbody tr.rpt-macro.rpt-mac-open')].length;
        res({ shutBefore, onScreen: rows.length, isNew: rows.some(r => /New risk/.test(r.cells[2].textContent)),
          onlyItsOwn: open === 1, registerOpen: !!(document.getElementById('wfRegister') || {}).open });
      }), 500);
    }), 600);
  }));
  // its category also holds the fixture's unrated risk, so expect that row too
  R.ok(t.shutBefore === 0 && t.onScreen > 0 && t.isNew, 'from a fully collapsed register, a new risk still appears on screen');
  R.ok(t.onlyItsOwn && t.registerOpen, 'only the category it landed in opens, and the register opens with it');
}

// ── the register survives an empty client ──
await seed(page, { riskProfile: [] }, 'risk');
{
  const t = await page.evaluate(() => {
    const sec = document.getElementById('wfRegister'); if (sec) sec.open = true;
    renderRiskProfile();
    // with nothing on the profile the table may not render at all, so read
    // whatever the register put on screen
    const el = document.getElementById('rpTbody') || document.getElementById('riskRegisterView') || document.getElementById('riskContainer');
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '(nothing rendered)';
  });
  R.ok(/No risks|add from the library|No risks match/i.test(t), 'an empty profile says so rather than showing a broken table');
}

// ── The risk reference: R-001, and it never moves ──────────────────────────
//    Simon, 2026-09-28: an ascending position number would have been a trap,
//    because the register re-sorts by theme and band on every re-score. These
//    pin the thing that makes the reference worth having.
await seed(page, { riskProfile: RISKS() }, 'risk');
await openRegister(page);
{
  const t = await page.evaluate(() => {
    _riskRefsEnsure();
    const refs = S.riskProfile.map(r => r.ref);
    const head = [...document.querySelectorAll('table.rpt thead th')].map(x => x.textContent.trim());
    const cells = [...document.querySelectorAll('#rpTbody tr.rpt-row')].map(tr => tr.cells[1].textContent.trim());
    return { refs, head, cells, seq: S.riskRefSeq, letters: S.macroLetters,
      nos: S.riskProfile.map(r => r.refNo),
      // the fixture's unrated risk has no macro category, so it is the X
      unlettered: S.riskProfile.filter(r => !_riskMacroOf(r)).map(r => r.ref) };
  });
  R.ok(t.refs.every(x => /^[A-Z]{1,2}-\d{3}$/.test(x)), 'a reference is a theme letter and a number (' + t.refs.join(' ') + ')');
  R.ok(t.nos.join(',') === t.nos.map((_, i) => i + 1).join(','), 'the numbers run in the order the risks were added');
  R.ok(t.head[1] === 'Ref' && t.cells.every(c => /^[A-Z]{1,2}-\d{3}$/.test(c)), 'the register shows it in its own column');
  R.ok(t.seq === t.refs.length, 'the sequence is kept on the client as a high-water mark (' + t.seq + ')');
  R.ok(t.unlettered.every(x => /^X-/.test(x)), 'a risk with no category yet carries X until one is set (' + t.unlettered.join(' ') + ')');
  R.ok(new Set(Object.values(t.letters)).size === Object.keys(t.letters).length && !Object.values(t.letters).includes('X'),
    'each theme has its own letter, and none of them is X (' + Object.values(t.letters).sort().join(' ') + ')');
}

// ── the letter follows the theme, and is not the theme's place in the list ──
{
  const t = await page.evaluate(() => {
    const r = S.riskProfile.find(x => x.id === 'v6');        // the unrated, uncategorised one
    const before = r.ref;
    updateRiskField('v6', 'macroKey', 'fire');               // put it under Fire & explosion
    const fireLetter = (S.macroLetters || {}).fire;
    const after = r.ref;
    const fireMate = S.riskProfile.find(x => x.id === 'v1'); // already a Fire risk
    return { before, after, fireLetter, sameLetter: after.charAt(0) === fireMate.ref.charAt(0),
      numberHeld: after.split('-')[1] === before.split('-')[1] };
  });
  R.ok(/^X-/.test(t.before) && t.after.charAt(0) === t.fireLetter, 'giving a risk its category gives it that theme\'s letter (' + t.before + ' to ' + t.after + ')');
  R.ok(t.sameLetter, 'two risks in the same theme share the letter');
  R.ok(t.numberHeld, 'and the number - the part that identifies it - did not change');
}

// ── the whole point: re-scoring re-sorts the register, the references do not move ──
{
  const t = await page.evaluate(() => {
    const before = [...document.querySelectorAll('#rpTbody tr.rpt-row')].map(tr => tr.cells[1].textContent.trim());
    const r = S.riskProfile.find(x => x.id === 'v4');       // Medium, near the bottom
    const was = r.ref;
    r.likelihood = '5'; r.severity = '5';                   // now Critical, jumps up the list
    _macroExpandAll(true);
    const after = [...document.querySelectorAll('#rpTbody tr.rpt-row')].map(tr => tr.cells[1].textContent.trim());
    return { was, now: r.ref, moved: before.join() !== after.join(),
      position: { before: before.indexOf(was), after: after.indexOf(was) } };
  });
  R.ok(t.moved && t.position.before !== t.position.after, 'a re-score moves the risk up the register (' + t.position.before + ' to ' + t.position.after + ')');
  R.ok(t.was === t.now, 'and its reference is exactly where it was - which an ascending number could not do');
}

// ── a deleted reference is never handed to a different risk ──
{
  const t = await page.evaluate(() => {
    const top = S.riskProfile.map(r => r.ref).sort().pop();
    deleteRiskEntry('v3');
    const gone = (S.recycleBin || [])[0];
    const goneRef = gone && gone.payload ? gone.payload.ref : '';
    addRiskEntry();
    const fresh = S.riskProfile[S.riskProfile.length - 1];
    const newRef = fresh.ref;
    // and restoring brings the old number back with the risk
    restoreBinItem(gone ? gone.id : 'x');
    const back = S.riskProfile.find(r => r.id === 'v3');
    _riskCloseModal();
    const no = (x) => String(x || '').split('-')[1] || '';
    return { top, goneRef, newRef, restored: back ? back.ref : '',
      clash: no(newRef) === no(goneRef), newNo: no(newRef), restoredNo: no(back ? back.ref : '') };
  });
  R.ok(!t.clash && t.newNo === '007', 'a new risk takes the next number, never a deleted one (' + t.newRef + ', not ' + t.goneRef + ')');
  R.ok(t.restoredNo === '003' && t.restored === t.goneRef, 'and restoring from the bin brings its own reference back (' + t.restored + ')');
}

await R.done(browser, errors);
