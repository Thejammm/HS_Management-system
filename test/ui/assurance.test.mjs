// ══════════════════════════════════════════════════════════════
//  The training matrix and the statutory register are the CLIENT'S records -
//  hundreds of dates they keep in their own spreadsheet and re-upload as it
//  changes. The app carries the overview: one risk and one action per
//  register, and both let go by themselves when the register comes back into
//  date. Without that last part a monthly re-upload silts the plan up.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Assurance registers - one risk, one signal');
const { browser, page, errors } = await openApp();

const past = '2026-01-15', soon = '2026-10-20', far = '2028-06-30';

// A small matrix and register, the shape the importers write.
const MATRIX = (dates) => ({ filename: 'matrix.xlsx', sheets: [{ name: 'Staff' }], people: [
  { id: 'trn_b_ff001', group: 'staff', status: 'active', lastName: 'Ashworth', firstName: 'Daniel', badge: 'FF001',
    cells: { 'First Aid at Work': { type: 'date', v: dates[0] }, 'FLT Counterbalance': { type: 'date', v: dates[1] },
      'Fire Marshal': { type: 'text', v: 'Trainer' } } },
  { id: 'trn_b_ff002', group: 'staff', status: 'active', lastName: 'Barrett', firstName: 'Chloe', badge: 'FF002',
    cells: { 'First Aid at Work': { type: 'date', v: dates[2] } } },
  { id: 'trn_b_ff090', group: 'staff', status: 'left', lastName: 'Quinn', firstName: 'Damien', badge: 'FF090',
    cells: { 'First Aid at Work': { type: 'date', v: past } } },   // a leaver: never counted
] });
const REGISTER = (dates) => ([{ id: 'rs1', name: 'Plant & Equipment', items: [
  { id: 'reg1', item: 'Overhead crane thorough examination', frequency: '12-monthly', dueDate: dates[0] },
  { id: 'reg2', item: 'Lifting accessories thorough examination', frequency: '6-monthly', dueDate: dates[1] },
] }]);

const load = async (tDates, rDates) => page.evaluate((t, r) => {
  S.trainingData = t; S.monitoring.regSections = r; S.monitoring.regSeeded = true;
  _assuranceSync();
}, MATRIX(tDates), REGISTER(rDates));

await seed(page, { company: { legalName: 'Fairbank Fabrications Ltd' } }, 'risk');
await load([past, past, soon], [past, soon]);
await wait(page, 300);

// ── one register, one risk ──
{
  const t = await page.evaluate(() => ({
    risks: (S.riskProfile || []).map(r => ({ ref: r.ref, key: r.assuranceKey || '', lib: r.libKey, name: r.activity })),
    training: _assuranceState('training'), statutory: _assuranceState('statutory'),
  }));
  const trn = t.risks.find(r => r.key === 'training'), sta = t.risks.find(r => r.key === 'statutory');
  R.ok(!!trn && trn.lib === 'competence', 'the training matrix drives one risk - the competence theme (' + (trn || {}).ref + ')');
  R.ok(!!sta && sta.lib === 'statutory', 'the statutory register drives one of its own (' + (sta || {}).ref + ')');
  R.ok(t.risks.filter(r => r.key).length === 2, 'two registers, two risks - not one per certificate');
  R.ok(t.training.red === 2 && t.training.amber === 1, 'the leaver is not counted against the client (' + t.training.red + ' expired, ' + t.training.amber + ' soon)');
  R.ok(t.statutory.red === 1 && t.statutory.amber === 1, 'the register counts the same way (' + t.statutory.red + ' overdue, ' + t.statutory.amber + ' soon)');
}

// ── one action each, carrying the count, on the risk it belongs to ──
{
  const t = await page.evaluate(() => {
    const acts = _execActions().filter(a => /back into date/.test(a.desc));
    return { n: acts.length, descs: acts.map(a => a.desc), refs: acts.map(a => { const r = _execRiskOf(a); return r ? r.ref : ''; }),
      total: _execActions().length,
      perCertificate: _execActions().filter(a => /^Renew /.test(a.desc)).length };
  });
  R.ok(t.n === 2, 'one action per register, not one per date (' + t.n + ')');
  R.ok(t.descs.some(d => /training matrix back into date - 2 out of date, 1 due within 60 days/.test(d)),
    'it carries the count: ' + (t.descs[0] || ''));
  R.ok(t.refs.every(x => /^[A-Z]+-\d{3}$/.test(x)), 'each hangs off its risk, so it inherits the reference (' + t.refs.join(' ') + ')');
  R.ok(t.perCertificate === 0, 'nothing is raised per certificate unless the consultant asks');
}

// ── the client renews everything and re-uploads: the actions let go ──
await load([far, far, far], [far, far]);
await wait(page, 250);
{
  const t = await page.evaluate(() => {
    const acts = _execActions().filter(a => /back into date/.test(a.desc));
    const o = _execOrigin(acts[0] ? acts[0].ref : {});
    return { open: acts.filter(a => a.status !== 'Complete' && a.status !== 'Accepted').length,
      closed: acts.filter(a => a.status === 'Complete').length,
      why: (o && (o.log || []).slice(-1)[0] || {}).text || '',
      state: _assuranceState('training') };
  });
  R.ok(t.state.total === 0, 'the re-upload brings the register back into date');
  R.ok(t.open === 0 && t.closed === 2, 'and both actions close themselves - the plan does not silt up (' + t.closed + ' closed)');
  R.ok(/back in date/.test(t.why), 'with the reason on the record: ' + t.why);
}

// ── one lapses again next month: the same action comes back with the new count ──
await load([past, far, far], [far, far]);
await wait(page, 250);
{
  const t = await page.evaluate(() => {
    const acts = _execActions().filter(a => /back into date/.test(a.desc));
    return { open: acts.filter(a => a.status !== 'Complete' && a.status !== 'Accepted').map(a => a.desc),
      n: acts.length };
  });
  R.ok(t.n === 2, 'no second copy is created - it is the same action (' + t.n + ' in total)');
  R.ok(t.open.length === 1 && /training matrix back into date - 1 out of date/.test(t.open[0]),
    'it reopens with the count as it is now: ' + (t.open[0] || ''));
}

// ── an individually raised renewal closes itself when that date goes green ──
{
  const t = await page.evaluate(() => {
    raiseTrainingRenewals();                                   // the consultant chooses the detailed route
    const raised = (S.actionPlan || []).filter(a => a.trainingKey).length;
    const summary = _execActions().find(a => /training matrix back into date/.test(a.desc));
    const summaryOpen = !!(summary && summary.status !== 'Complete' && summary.status !== 'Accepted');
    // now the client renews it in the spreadsheet and re-uploads
    const p = (S.trainingData.people || []).find(x => x.badge === 'FF001');
    p.cells['First Aid at Work'].v = '2028-06-30';
    _assuranceSync();
    const still = (S.actionPlan || []).filter(a => a.trainingKey && a.status !== 'Complete' && a.status !== 'Accepted').length;
    const done = (S.actionPlan || []).find(a => a.trainingKey && a.status === 'Complete');
    return { raised, summaryOpen, still, why: done ? ((done.log || []).slice(-1)[0] || {}).text || '' : '' };
  });
  R.ok(t.raised >= 1, 'the consultant can still raise individual renewals (' + t.raised + ')');
  R.ok(!t.summaryOpen, 'and while those are open the summary stands down rather than saying it twice');
  R.ok(t.still === 0, 'a renewal done in the spreadsheet closes its own action on the next upload');
  R.ok(/now runs to/.test(t.why), 'with the new date on the record: ' + t.why);
}

// ── "no longer applies": the only honest way out of an examination ──────────
//    Simon, 2026-09-28: "i dont know what to do with the ones that i choose
//    not to add". You do not decline a statutory examination - you establish
//    that it no longer applies, and you say why.
await seed(page, { company: { legalName: 'Fairbank Fabrications Ltd' } }, 'risk');
await load([far, far, far], [past, past]);
await wait(page, 300);
{
  const t = await page.evaluate(() => {
    const before = _assuranceState('statutory');
    const beforeDue = _statDueCount();
    window.prompt = () => '';                                  // a reason is required
    regMarkNA('rs1', 'reg1');
    const refused = !_regIsNA((_regSections()[0].items || []).find(i => i.id === 'reg1'));
    window.prompt = () => 'Crane disposed of, June 2026';
    regMarkNA('rs1', 'reg1');
    const it = (_regSections()[0].items || []).find(i => i.id === 'reg1');
    return { before, beforeDue, refused,
      na: _regIsNA(it), rag: _regItemRag(it), reason: (it.na || {}).reason, by: (it.na || {}).by, at: (it.na || {}).at,
      after: _assuranceState('statutory'), afterDue: _statDueCount(), counts: _regCounts() };
  });
  R.ok(t.refused, 'no reason, no mark - an item nobody did is not an item that does not apply');
  R.ok(t.na && t.rag === 'na' && /Crane disposed of/.test(t.reason || ''), 'with a reason it is marked, and the reason is kept (' + t.reason + ')');
  R.ok(!!t.at && t.by !== undefined, 'dated and attributed, because that is what gets asked for');
  R.ok(t.before.red === 2 && t.after.red === 1, 'it leaves the overdue count (' + t.before.red + ' to ' + t.after.red + ')');
  R.ok(t.beforeDue === 2 && t.afterDue === 1, 'and the raise no longer offers it (' + t.beforeDue + ' to ' + t.afterDue + ')');
  R.ok(t.counts.na === 1 && t.counts.total === 1, 'the register still counts it as set aside, so it is not hidden (' + t.counts.na + ' set aside of ' + (t.counts.total + t.counts.na) + ')');
}

// ── raise them all: every remaining due item, one click, no picking ──
{
  const t = await page.evaluate(() => {
    raiseStatutoryDue();
    const raised = (S.actionPlan || []).filter(a => a.regKey && a.status !== 'Complete' && a.status !== 'Accepted');
    return { n: raised.length, descs: raised.map(a => a.desc),
      naRaised: raised.some(a => a.regKey === 'reg|reg1'),
      due: _statDueCount() };
  });
  R.ok(t.n === 1 && t.due === 0, 'the button raises every item still counting, in one go (' + t.n + ')');
  R.ok(!t.naRaised, 'and never one that no longer applies');
}

// ── the reason survives the next upload, which replaces the whole register ──
{
  const t = await page.evaluate(() => {
    // the client re-uploads: a brand new set of item ids, same item names
    S.monitoring.regSections = [{ id: 'rs9', name: 'Plant & Equipment', items: [
      { id: 'regX', sheet: 'Plant & Equipment', item: 'Overhead crane thorough examination', frequency: '12-monthly', dueDate: '2026-01-15' },
      { id: 'regY', sheet: 'Plant & Equipment', item: 'Lifting accessories thorough examination', frequency: '6-monthly', dueDate: '2026-01-15' } ] }];
    const beforeApply = _regItemRag((_regSections()[0].items || [])[0]);
    const back = _regNAApply();
    const it = (_regSections()[0].items || [])[0];
    return { beforeApply, back, rag: _regItemRag(it), reason: (it.na || {}).reason,
      state: _assuranceState('statutory') };
  });
  R.ok(t.beforeApply === 'red', 'a fresh upload brings the item back as overdue, with a new id');
  R.ok(t.back === 1 && t.rag === 'na' && /Crane disposed of/.test(t.reason || ''),
    'and the reason is put back on it, matched by name: ' + t.reason);
  R.ok(t.state.red === 1, 'so the count is right straight after the upload, not wrong until someone notices');
}

// ── putting it back ──
{
  const t = await page.evaluate(() => {
    const id = (_regSections()[0].items || [])[0].id;
    regClearNA(_regSections()[0].id, id);
    const it = (_regSections()[0].items || [])[0];
    return { rag: _regItemRag(it), mapped: Object.keys(S.monitoring.regNA || {}).length, red: _assuranceState('statutory').red };
  });
  R.ok(t.rag === 'red' && t.red === 2, 'putting it back in makes it count again');
  R.ok(t.mapped === 0, 'and the mark is gone for good, so the next upload does not resurrect it');
}

// ── the cockpit answers one question per register ──
await seed(page, { company: { legalName: 'Fairbank Fabrications Ltd' } }, 'risk');
await load([past, far, far], [past, soon]);
await wait(page, 300);
{
  const t = await page.evaluate(() => {
    switchTab('cockpit');
    const txt = () => document.getElementById('tab-cockpit').innerText;
    return { has: typeof _assuranceHas === 'function' && _assuranceHas('statutory'), text: txt() };
  });
  R.ok(t.has, 'the statutory register is recognised');
  R.ok(/Statutory checks/i.test(t.text), 'the cockpit carries a Statutory checks tile beside Training');
  R.ok(/Compliant|overdue/i.test(t.text), 'and answers compliant or not, without the detail');
}

// ── a client with no registers gets no invented risks ──
await seed(page, { company: { legalName: 'Nothing Uploaded Ltd' } }, 'risk');
await wait(page, 350);
{
  const t = await page.evaluate(() => { _assuranceSync();
    return { risks: (S.riskProfile || []).length, acts: _execActions().length }; });
  R.ok(t.risks === 0 && t.acts === 0, 'no register, no risk, no action - nothing is invented (' + t.risks + '/' + t.acts + ')');
}

await R.done(browser, errors);
