// Build a filled-in discovery questionnaire for the Testing Client, exactly
// as a client would return it: the app builds its own questionnaire PDF, we
// tick the boxes and type the notes, then save it. Nothing is hand-rolled, so
// the field names cannot drift from what the importer expects.
//
//   node test/ui/_make_discovery.mjs "<output folder>"
import fs from 'node:fs';
import path from 'node:path';
import { openApp } from './harness.mjs';

const OUT_DIR = process.argv[2];
if (!OUT_DIR) { console.error('Give me an output folder.'); process.exit(2); }
const OUT = path.join(OUT_DIR, 'Testing_Client_discovery_questionnaire_COMPLETED.pdf');

// A small mixed operation: a garage that also runs passenger transport, with
// an office. The same shape as Easy Travel, so the test rehearses tomorrow.
const SECTORS = ['motor', 'transportsvc', 'office'];
const ANSWERS = {
  // business profile - who they are and who they affect
  b_survey_pre2000: false, b_dutyholder: false, b_design: false, b_domestic: true,
  b_public: true, b_manufacture: false, b_warehouse: false, b_retail: true, b_food: false,
  b_care: false, b_passengers: true, b_atrisk: true, b_events: false,
  b_contractdep: true, b_licence: true,
  o_height: true, o_driving: true, o_confined: false, o_livesites: false, o_manual: true,
  o_lone: true, o_outdoor: true, o_hotwork: true, o_chemicals: true, o_dust: true,
  o_noise: true, o_vibration: true, o_elecwork: false, o_water: false, o_transport: true,
  o_violence: true, o_cash: false, o_livestock: false, o_atv: false, o_grain: false,
  o_agrichem: false, o_hgv: false, o_loading: true, o_coldstore: false, o_vehmaint: true,
  o_wastegen: true, o_infection: false, o_medicines: false, o_medrad: false, o_pool: false,
  o_roadside: true,
  p_office: true, p_home: false, p_clientsites: false, p_derelict: false, p_gas: true,
  p_plant: true, p_multi: false, p_persondata: true, p_landlord: false,
  w_agency: true, w_young: true, w_newexpectant: true, w_migrant: false, w_vulnerable: true,
  w_apprentices: true, w_selfemployed: true, w_safetycrit: true, w_volunteers: false, w_keyperson: true,
  a_workequip: true, a_lifting: true, a_vehicles: true, a_display: true, a_pressure: true,
  a_ladders: true, a_forklift: false, a_plant: false, a_scaffold: false, a_lev: true,
  d_pc: false, d_client: false, d_dutytomanage: true, d_responsible: true, d_landlordgas: false,
  d_waste: true, d_data: true, d_food: false,
  c_growth: true, c_newsector: false, c_newpremises: false, c_keyperson: true,
  c_newequipment: true, c_restructure: false, c_acquisition: false, c_regulatory: false, c_seasonal: true,
};
const NOTES = {
  o_driving: 'Two minibuses and three staff using their own cars for call-outs.',
  o_hotwork: 'MIG welding in the workshop bay only, never on the forecourt.',
  o_violence: 'Occasional aggression from passengers on the assisted travel runs.',
  a_lifting: 'Two four-post vehicle lifts and a mobile column set, LOLER due March.',
  w_young: 'One apprentice technician, 17, started in August.',
  d_dutytomanage: 'Asbestos survey done when we took the unit on, garage roof flagged.',
};
const GENERAL = 'We run a garage and a small assisted passenger transport service from one site. '
  + 'Eight staff plus one apprentice. Busiest in winter. Happy to walk you round the workshop and the yard.';

const { browser, page, errors } = await openApp();

// 1) the client's own questionnaire, built by the app
const built = await page.evaluate(async (sectors) => {
  S.company = { legalName: 'Testing Client Ltd', tradingName: 'Testing Client', employees: '9' };
  S.riskProfile = []; S.actionPlan = [];
  const p = _profState();
  p.exposure = {}; p.discNotes = {}; p.sectors = {};
  sectors.forEach(k => { p.sectors[k] = true; });
  const bytes = await buildDiscoveryQuestionnairePDF();
  return { bytes: Array.from(bytes), stats: _discStats() };
}, SECTORS);
console.log('built the blank questionnaire: ' + built.bytes.length + ' bytes, ' + built.stats.total + ' questions fit this business (bank ' + built.stats.bank + ')');

// 2) fill it in the way a client would
const filled = await page.evaluate(async (bytesArr, answers, notes, general) => {
  const doc = await PDFLib.PDFDocument.load(new Uint8Array(bytesArr));
  const form = doc.getForm();
  const names = form.getFields().map(f => f.getName());
  let yes = 0, no = 0, wrote = 0; const missing = [];
  Object.keys(answers).forEach(id => {
    const want = answers[id];
    const box = 'q_' + id + (want ? '_yes' : '_no');
    if (names.indexOf(box) < 0) { missing.push(id); return; }
    try { form.getCheckBox(box).check(); if (want) yes++; else no++; } catch (e) { missing.push(id); }
  });
  Object.keys(notes).forEach(id => {
    const nm = 'q_' + id + '_note';
    if (names.indexOf(nm) < 0) return;
    try { form.getTextField(nm).setText(notes[id]); wrote++; } catch (e) {}
  });
  if (names.indexOf('q__general') >= 0) { try { form.getTextField('q__general').setText(general); wrote++; } catch (e) {} }
  const out = await doc.save();
  return { bytes: Array.from(out), yes, no, wrote, missing, fields: names.length };
}, built.bytes, ANSWERS, NOTES, GENERAL);
console.log('filled it in: ' + filled.yes + ' yes, ' + filled.no + ' no, ' + filled.wrote + ' notes (' + filled.fields + ' form fields)');
if (filled.missing.length) console.log('not asked of this business, left alone: ' + filled.missing.join(', '));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, Buffer.from(filled.bytes));
console.log('wrote ' + OUT);

// 3) prove it imports into a clean client, and that it wakes the builder
const check = await page.evaluate(async (bytesArr) => {
  S.company = { legalName: 'Testing Client Ltd' };
  S.riskProfile = []; S.actionPlan = [];
  S.profiler = { exposure: {}, maturity: {}, discNotes: {}, sectors: {}, judgement: {} };
  const file = new File([new Uint8Array(bytesArr)], 'questionnaire.pdf', { type: 'application/pdf' });
  await _discImportFile(file);
  const p = _profState();
  const ex = p.exposure || {};
  return { answered: Object.keys(ex).length,
    yes: Object.keys(ex).filter(k => ex[k] === true).length,
    notes: Object.keys(p.discNotes || {}).length,
    general: String((p.discNotes || {})._general || '').slice(0, 44),
    toast: (document.getElementById('toast') || {}).textContent || '',
    suggested: _discSuggestedKeys().size,
    sample: Object.keys(ex).slice(0, 6).map(k => k + '=' + ex[k]).join(', ') };
}, filled.bytes);
console.log('\nIMPORT CHECK');
console.log('  toast:     ' + check.toast);
console.log('  answered:  ' + check.answered + ' (' + check.yes + ' yes)');
console.log('  notes:     ' + check.notes + ' including the general note "' + check.general + '..."');
console.log('  suggests:  ' + check.suggested + ' library themes for the profile');
console.log('  sample:    ' + check.sample);
console.log(errors.length ? ('  PAGE ERRORS: ' + errors.join(' | ')) : '  no page errors');
await browser.close();
