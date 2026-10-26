// ══════════════════════════════════════════════════════════════
//  The consultant's check on the client's discovery answers (Simon,
//  2026-10-26: "an internal check by me when I get it back"). Only the
//  answers that need him are listed - the client's own documents say
//  otherwise, two answers disagree, or a yes switches on a dutyholder duty -
//  and Build profile waits until he has answered them. His own wizard
//  answers are never listed, and a client login never sees the check.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, wait, reporter } from './harness.mjs';

const R = reporter('Discovery - the consultant checks the client\'s answers');
const { browser, page, errors } = await openApp();

// a made-up landscaping business, its answers back from the questionnaire
const seedClient = () => page.evaluate(() => {
  S.company = { legalName: 'Example Grounds Ltd', employees: '12' };
  S.riskProfile = []; S.actionPlan = []; S.documents = [];
  S.raRegister = [
    { id: 'ra1', title: '07 Air Tools & Compressors RAM' },
    { id: 'ra2', title: '12 Chainsaw Ground Works RAM' },
    { id: 'ra3', title: '15 Workshop activities RAM' },
    { id: 'ra4', title: '21 Use of 360 Excavator RAM' },
  ];
  const ex = { a_pressure: true, p_plant: false, d_responsible: true, p_office: false, w_safetycrit: false,
    a_plant: true, d_pc: true, o_driving: true, o_noise: true, a_workequip: true, o_excavation: true };
  S.profiler = { exposure: ex, maturity: {}, discNotes: {}, sectors: { land: true, construction: true }, judgement: {},
    gate: { src: Object.fromEntries(Object.keys(ex).map(k => [k, 'client'])), confirmed: {} } };
});
const read = () => page.evaluate(() => {
  const panel = document.getElementById('dgPanel');
  const rows = panel ? [...panel.querySelectorAll('[id^="dgrow_"]')].map(r => ({ q: r.id.slice(6), open: r.style.opacity === '', text: r.innerText })) : [];
  const build = [...document.querySelectorAll('#discoveryPanel button')].find(b => /Build profile from discovery/.test(b.textContent));
  return { panel: !!panel, badge: panel ? panel.querySelector('summary .badge').textContent : '', rows, open: _dgOpenCount(),
    build: build ? { text: build.textContent, disabled: build.disabled } : null };
});
const answer = (q, v) => page.evaluate((q, v) => [...document.querySelectorAll('#dgrow_' + q + ' button')].find(b => b.textContent === (v ? 'Yes' : 'No')).click(), q, v);

await seedClient();
await page.evaluate(() => switchTab('risk'));
await wait(page, 700);
let t = await read();

// ── what is listed, and why ──
R.ok(t.panel && t.open === 4, 'four answers need the consultant: ' + t.rows.map(r => r.q).join(', '));
R.ok(/Air Tools & Compressors/.test((t.rows.find(r => r.q === 'p_plant') || {}).text || ''), 'a "no" the client\'s own documents contradict is listed with the document named');
R.ok(/Responsible Person for fire/.test((t.rows.find(r => r.q === 'p_office') || {}).text || ''), 'two answers that cannot both be right are listed with the reason');
R.ok(t.rows.some(r => r.q === 'd_pc'), 'a yes that switches on a dutyholder duty is listed to confirm');
R.ok(!t.rows.some(r => r.q === 'o_driving' || r.q === 'o_noise'), 'everything else goes in as the client answered');

// ── Build waits ──
R.ok(t.build && t.build.disabled && /check 4 answers first/.test(t.build.text), 'Build profile is held back and says how many are waiting');
const held = await page.evaluate(() => { const n = S.riskProfile.length; buildProfileFromDiscovery(); return S.riskProfile.length - n; });
R.ok(held === 0, 'Build called directly adds nothing while answers are waiting');

// ── answering, in place ──
const order = t.rows.map(r => r.q).join();
await answer('p_office', true); await wait(page, 150);
t = await read();
R.ok(t.rows.slice(0, 4).map(r => r.q).join() === order, 'answering one leaves every row where it was');
R.ok(t.rows[t.rows.length - 1].q === 'd_dutytomanage', 'confirming they occupy a workplace brings up the asbestos duty to manage, at the foot');
const log = await page.evaluate(() => ({ ex: S.profiler.exposure.p_office, c: S.profiler.gate.confirmed.p_office }));
R.ok(log.ex === true && log.c && log.c.was === false && log.c.v === true && log.c.by && log.c.at, 'the answer is written into discovery and logged: what was on record, what was confirmed, who and when');
for (const [q, v] of [['p_plant', true], ['w_safetycrit', true], ['d_pc', true], ['d_dutytomanage', false]]) { await answer(q, v); await wait(page, 120); }
t = await read();
R.ok(t.open === 0 && t.rows.length === 5 && t.rows.every(r => !r.open) && /^Checked/.test(t.badge), 'once all are answered the list stays, greyed, marked checked');
R.ok(t.build && !t.build.disabled, 'and Build profile is available');

// ── the consultant's own wizard answers are already checked ──
await seedClient();
await page.evaluate(() => { _discSet('d_pc', true); _discSet('d_pc', true); _discSet('d_pc', true); renderDiscoveryPanel(); });
t = await read();
R.ok(!t.rows.some(r => r.q === 'd_pc'), 'an answer the consultant gives in the wizard is never put back to him');

// ── a client login never sees it ──
const cl = await page.evaluate(() => { const u = Auth.user; Auth.user = () => ({ role: 'client_user', name: 'Client' }); renderDiscoveryPanel();
  const out = { panel: !!document.getElementById('dgPanel'), open: _dgOpenCount() }; Auth.user = u; return out; });
R.ok(!cl.panel && cl.open === 0, 'a client login sees no check and is never held up by it');

// ── the questionnaire import marks the answers as the client's ──
const imp = await page.evaluate(async () => {
  S.company = { legalName: 'Example Grounds Ltd' };
  S.riskProfile = []; S.raRegister = []; S.documents = [];
  S.profiler = { exposure: {}, maturity: {}, discNotes: {}, sectors: { construction: true }, judgement: {} };
  const bytes = await buildDiscoveryQuestionnairePDF();
  const doc = await PDFLib.PDFDocument.load(bytes);
  const form = doc.getForm();
  form.getCheckBox('q_d_pc_yes').check();
  form.getCheckBox('q_o_noise_yes').check();
  const out = await doc.save();
  S.profiler = { exposure: {}, maturity: {}, discNotes: {}, sectors: {}, judgement: {} };
  await _discImportFile(new File([out], 'q.pdf', { type: 'application/pdf' }));
  return { src: (S.profiler.gate || {}).src || {}, toast: (document.getElementById('toast') || {}).textContent || '', open: _dgOpenCount() };
});
R.ok(imp.src.d_pc === 'client' && imp.src.o_noise === 'client', 'imported answers are recorded as the client\'s');
R.ok(imp.open === 1 && /1 to check before the profile is built/.test(imp.toast), 'and the import says how many are waiting: ' + imp.toast.slice(-60));

await R.done(browser, errors);
