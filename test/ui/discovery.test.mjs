// ══════════════════════════════════════════════════════════════
//  Discovery: the questionnaire the client fills in, what the import makes
//  of it, and picking the profile back up when the business changes.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, wait, reporter } from './harness.mjs';

const R = reporter('Discovery questionnaire and import');
const { browser, page, errors } = await openApp();

const SECTORS = ['motor', 'transportsvc', 'office'];

// ── build a questionnaire for a garage, and fill some of it in ──
const made = await page.evaluate(async (sectors) => {
  S.company = { legalName: 'Testing Client Ltd', employees: '9' };
  S.riskProfile = []; S.actionPlan = [];
  S.profiler = { exposure: {}, maturity: {}, discNotes: {}, sectors: {}, judgement: {} };
  sectors.forEach(k => { _profState().sectors[k] = true; });
  const asked = _discStats();
  const bytes = await buildDiscoveryQuestionnairePDF();
  const doc = await PDFLib.PDFDocument.load(bytes);
  const form = doc.getForm();
  const names = form.getFields().map(f => f.getName());
  // answer three, leave one deliberately blank
  form.getCheckBox('q_o_driving_yes').check();
  form.getCheckBox('q_o_hotwork_yes').check();
  form.getCheckBox('q_o_cash_no').check();
  form.getTextField('q__general').setText('Garage and minibuses from one site.');
  const out = await doc.save();
  return { bytes: Array.from(out), askedTotal: asked.total, bank: asked.bank,
    carriesSectors: names.indexOf('q__sectors') >= 0,
    // the gate left this one out: it belongs to design, construction, property
    pre2000Asked: names.indexOf('q_b_survey_pre2000_yes') >= 0 };
}, SECTORS);
R.ok(made.askedTotal < made.bank && !made.pre2000Asked, 'the questionnaire asks only what fits the business (' + made.askedTotal + ' of ' + made.bank + ')');
R.ok(made.carriesSectors, 'the questionnaire records which business it was built for');

// ── import it into a clean client ──
const imp = await page.evaluate(async (bytesArr) => {
  S.company = { legalName: 'Testing Client Ltd' };
  S.riskProfile = []; S.actionPlan = [];
  S.profiler = { exposure: {}, maturity: {}, discNotes: {}, sectors: {}, judgement: {} };
  const file = new File([new Uint8Array(bytesArr)], 'q.pdf', { type: 'application/pdf' });
  await _discImportFile(file);
  const p = _profState();
  const st = _discStats();
  return { toast: (document.getElementById('toast') || {}).textContent || '',
    sectors: Object.keys(p.sectors || {}).filter(k => p.sectors[k] === true).sort(),
    answered: st.answered, total: st.total, bank: st.bank,
    pre2000Visible: _discVisible('b_survey_pre2000'),
    driving: p.exposure.o_driving, cash: p.exposure.o_cash,
    blankStillOpen: p.exposure.o_manual };
}, made.bytes);
R.ok(imp.sectors.join(',') === SECTORS.slice().sort().join(','), 'the import puts the business types back (' + imp.sectors.join(', ') + ')');
R.ok(imp.total === made.askedTotal && imp.total < imp.bank, 'so the app counts the same question set the client saw, not the whole bank (' + imp.total + ' of ' + imp.bank + ')');
R.ok(!imp.pre2000Visible, 'a question the client was never asked stays out of the wizard');
R.ok(imp.driving === true && imp.cash === false && imp.blankStillOpen === undefined, 'ticks land, and a question left blank stays unanswered rather than being guessed');
R.ok(/left blank to ask on the visit/.test(imp.toast) && /not asked of this business/.test(imp.toast), 'the import says what it found: ' + imp.toast.slice(0, 120));

// ── the business changes: the consultant ticks the new sector and answers ──
const chg = await page.evaluate(async () => {
  const p = _profState();
  const before = { visible: _discVisible('b_survey_pre2000'), total: _discStats().total };
  _discToggleSector('design');                       // page 1 of the wizard
  const after = { visible: _discVisible('b_survey_pre2000'), total: _discStats().total };
  _discSet('b_survey_pre2000', true);                // answer it
  const suggested = [..._discSuggestedKeys().keys()];
  window.confirm = () => true;
  const n0 = S.riskProfile.length;
  buildProfileFromDiscovery();
  await new Promise(r => setTimeout(r, 500));
  const added = S.riskProfile.slice(n0);
  return { before, after, firedAsbestos: suggested.indexOf('asbestos') >= 0,
    addedAsbestos: added.some(r => r.libKey === 'asbestos'),
    addedNames: added.map(r => r.activity).slice(0, 3),
    answer: p.exposure.b_survey_pre2000 };
});
R.ok(!chg.before.visible && chg.after.visible && chg.after.total > chg.before.total,
  'ticking the new business type brings its questions into the wizard (' + chg.before.total + ' then ' + chg.after.total + ')');
R.ok(chg.answer === true && chg.firedAsbestos, 'answering it fires the theme it should');
R.ok(chg.addedAsbestos, 'Build profile then adds that risk: ' + chg.addedNames.join(' | '));

// ── and an answer can be changed or taken back at any time ──
const undo = await page.evaluate(() => {
  _discSet('b_survey_pre2000', true);   // clicking the same answer again clears it
  const cleared = _profState().exposure.b_survey_pre2000;
  _discSet('b_survey_pre2000', false);
  const now = _profState().exposure.b_survey_pre2000;
  const orphans = (typeof _discOrphanedThemes === 'function') ? _discOrphanedThemes().length : -1;
  return { cleared, now, orphans };
});
R.ok(undo.cleared === undefined && undo.now === false, 'an answer can be changed, or clicked again to clear it');
R.ok(undo.orphans >= 1, 'a theme whose answer was withdrawn is flagged for review, never silently deleted (' + undo.orphans + ')');

await R.done(browser, errors);
