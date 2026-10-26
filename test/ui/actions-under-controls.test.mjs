// ══════════════════════════════════════════════════════════════
//  Every action under the control it puts in place (Simon, 2026-10-26: "I
//  don't see the actions under the high level risks when I dig into the
//  risk"). Library risks arrive linked; actions that serve every control
//  (procedure, roles, a named owner) sit under the risk's own "Procedure,
//  roles and records in place" control; a client built before this links
//  the clear ones in one click and confirms only the doubtful ones, best
//  guess selected. The Summary reads control by control.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, wait, reporter } from './harness.mjs';

const R = reporter('Actions under their controls');
const { browser, page, errors } = await openApp();

const digest = (rid) => page.evaluate((rid) => { const r = S.riskProfile.find(x => x.id === rid);
  const live = a => !a.deleted && (a.desc || a.owner || a.due);
  const ctls = (r.actions || []).filter(a => live(a) && a.hideFromPlan), acts = (r.actions || []).filter(a => live(a) && !a.hideFromPlan);
  const d = document.createElement('div'); d.innerHTML = _rpCtlActsHTML(r, ctls, acts, acts);
  return { head: d.querySelector('.dg-ah').textContent, rows: [...d.querySelectorAll('.dg-act')].map(x => (x.classList.contains('dg-ctlrow') ? 'C:' : x.classList.contains('dg-sub') ? 'a:' : x.classList.contains('dg-loose') ? '-:' : '') + x.textContent.trim()) }; }, rid);

// ── a risk added from the library ──
const lib = await page.evaluate(() => { S.company = { legalName: 'Example Grounds Ltd' }; S.riskProfile = []; S.actionPlan = []; S.requirements = [];
  const e = insertLibraryRisk('fire', true); const ctls = e.actions.filter(a => a.hideFromPlan), acts = e.actions.filter(a => !a.hideFromPlan);
  const arr = ctls.find(c => c.ctlArr);
  return { id: e.id, acts: acts.length, linked: acts.filter(a => ctls.some(c => c.id === a.forCtl)).length, arr: arr ? arr.desc : '', underArr: acts.filter(a => arr && a.forCtl === arr.id).length,
    testing: (ctls.find(c => c.id === (acts.find(a => /^Testing and maintenance/.test(a.desc)) || {}).forCtl) || {}).desc || '' }; });
R.ok(lib.acts === 4 && lib.linked === 4, 'a library risk arrives with every action under a control (' + lib.linked + ' of ' + lib.acts + ')');
R.ok(lib.arr === 'Procedure, roles and records in place' && lib.underArr === 3, 'the procedure, roles and record-keeper actions sit under its own "Procedure, roles and records in place" control');
R.ok(/^Fire risk assessment findings/.test(lib.testing), 'a specific action sits under the control it serves (testing and maintenance under the fire risk assessment findings)');
const d1 = await digest(lib.id);
R.ok(d1.rows[0].startsWith('C:Fire risk assessment findings') && d1.rows[1].startsWith('a:Testing and maintenance') && !d1.rows.some(r => r.startsWith('-:')),
  'opening the risk shows each control with its actions under it');
R.ok(/High level controls/i.test(d1.head) && /actions for client execution/i.test(d1.head), 'the heading still names the high level controls and the actions for client execution');

// ── a client built before this: nothing linked ──
await page.evaluate(() => {
  const t = HAZARD_LIBRARY.find(x => x.key === 'manualhandling');
  const c = (d) => ({ id: 'c' + Math.random().toString(36).slice(2, 7), desc: d, owner: '', due: '', status: 'Not started', priority: '', hideFromPlan: true });
  const a = (d) => ({ id: 'a' + Math.random().toString(36).slice(2, 7), desc: d, owner: 'Jo', due: '', status: 'Not started', priority: '' });
  S.riskProfile = [
    { id: 'old1', libKey: 'manualhandling', activity: t.activity, likelihood: '3', severity: '4', actions: [...t.measures.map(c), ...t.deliverables.map(a)] },
    { id: 'old2', activity: 'Our own risk about yard plant', likelihood: '3', severity: '4',
      actions: [c('Plant inspected before use every day'), c('Only trained drivers on the telehandler'), a('Telehandler driver training booked for every driver'), a('Sort the yard out')] },
    { id: 'old3', activity: 'A risk with no controls written', likelihood: '2', severity: '3', actions: [a('Do something about it')] },
  ];
  S.profiler = { exposure: { a_workequip: true }, maturity: {}, discNotes: {}, sectors: {}, judgement: {}, gate: { src: { a_workequip: 'consultant' }, confirmed: {} } };
  switchTab('risk'); renderRiskReview();
});
await wait(page, 400);
const pre = await page.evaluate(() => { const p = _ctlLinkPlan(false); const el = document.getElementById('clPanel');
  return { sure: p.sure, arr: p.arrRisks.size, doubt: p.doubt.map(d => d.a.desc), noCtl: p.noCtl.map(r => r.id), panel: !!el, btn: el ? ([...el.querySelectorAll('button')].find(b => /Link the/.test(b.textContent)) || {}).textContent : '' }; });
R.ok(pre.panel && pre.sure === 5 && /Link the 5 that are clear/.test(pre.btn || ''), 'the consultant is offered to link the clear ones (' + pre.sure + ')');
R.ok(pre.arr === 1 && pre.doubt.length === 1 && pre.doubt[0] === 'Sort the yard out', 'only the doubtful one is left to confirm: ' + pre.doubt.join(', '));
R.ok(pre.noCtl.join() === 'old3', 'a risk with actions but no controls is pointed out rather than guessed at');

const post = await page.evaluate(() => { ctlLinkClear(); const r1 = S.riskProfile.find(r => r.id === 'old1'), r2 = S.riskProfile.find(r => r.id === 'old2');
  const ctl = (r, a) => (_ctlOfAction(r, a) || {}).desc || '';
  const sel = document.querySelector('#clPanel select');
  return { lib: r1.actions.filter(a => !a.hideFromPlan).every(a => !!_ctlOfAction(r1, a)), arr: !!r1.actions.find(a => a.ctlArr),
    own: ctl(r2, r2.actions.find(a => /^Telehandler/.test(a.desc))), selected: sel ? sel.options[sel.selectedIndex].textContent : '' }; });
R.ok(post.lib && post.arr, 'one click links the library actions and adds the procedure control');
R.ok(/Only trained drivers/.test(post.own), 'an action in the client\'s own words that clearly matches is linked too');
R.ok(/^Control \d:/.test(post.selected), 'the doubtful one shows a best guess already selected (' + post.selected + ')');

const conf = await page.evaluate(() => { const r2 = S.riskProfile.find(r => r.id === 'old2'); const a = r2.actions.find(x => x.desc === 'Sort the yard out');
  ctlLinkConfirm('old2', a.id); return { linked: !!_ctlOfAction(r2, a), stays: !!document.getElementById('clrow_' + a.id), open: _ctlLinkPlan(false).doubt.length }; });
R.ok(conf.linked && conf.stays && conf.open === 0, 'confirming links it, and the row stays where it was');

// ── a client login never sees the linking list ──
const cl = await page.evaluate(() => { const u = Auth.user; Auth.user = () => ({ role: 'client_user', name: 'Client' }); const html = _ctlLinkHTML(); Auth.user = u; return html; });
R.ok(cl === '', 'a client login never sees the linking list');

await R.done(browser, errors);
