// ══════════════════════════════════════════════════════════════
//  Legal duties from the work (Simon, 2026-10-26): the discovery answers put
//  ONE line per regulation on the Legal duties tab, under the standard
//  duties, biggest fish first - what could kill and is enforced hard, then
//  serious harm to health, day-to-day arrangements, later lessons. Work that
//  adds to a standard duty is one extra check under it, not a second line.
//  A line can be marked occasional (drops a tier) or Does not apply (never
//  added again). Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, wait, reporter } from './harness.mjs';

const R = reporter('Legal duties - one line per regulation, biggest fish first');
const { browser, page, errors } = await openApp();

// a made-up grounds business whose answers the consultant has already checked
await page.evaluate(() => {
  S.company = { legalName: 'Example Grounds Ltd', employees: '12' };
  S.riskProfile = []; S.actionPlan = []; S.requirements = []; S.documents = []; S.raRegister = [];
  // d_dutytomanage: no - the building owner holds it, so they get the tenant's asbestos line
  const ex = { p_office: true, d_responsible: true, d_dutytomanage: false, a_workequip: true, a_plant: true, w_safetycrit: true, o_noise: true, o_driving: true, o_lone: true, d_pc: true };
  S.profiler = { exposure: ex, maturity: {}, discNotes: {}, sectors: { land: true }, judgement: {},
    gate: { src: Object.fromEntries(Object.keys(ex).map(k => [k, 'consultant'])), confirmed: {} } };
  switchTab('requirements');                     // the standard duties are put in place
  const fire = S.requirements.find(s => s.legal).items.find(i => i.legalKey === 'fire');
  fire.crit = { 0: true };                       // a tick already there
});
await wait(page, 300);

// ── before Build: the summary on the risk tab ──
const pre = await page.evaluate(() => { switchTab('risk'); renderRiskReview();
  const d = document.querySelector('details[data-keep="rpDiscReqs"]');
  return { badge: d ? d.querySelector('summary .badge').textContent : '', rows: d ? d.querySelectorAll('.coll-body > div[style*="border-bottom"]').length : 0, text: d ? d.textContent : '' }; });
R.ok(pre.rows === 5 && /5 duties from their work/.test(pre.badge), '"What the answers require" is one line per regulation (' + pre.rows + ')');
R.ok(/added at the next Build/.test(pre.text) && /Extra checks under the standard duties/.test(pre.text), 'it says each goes on the Legal duties tab at Build, and which standard duties gain checks');

// ── Build ──
const b = await page.evaluate(async () => { buildProfileFromDiscovery(); await new Promise(r => setTimeout(r, 400)); switchTab('requirements'); await new Promise(r => setTimeout(r, 300));
  const sec = S.requirements.find(s => s.work);
  const order = [...sec.items].sort(_workOrder).map(i => i.workKey);
  const fire = S.requirements.find(s => s.legal).items.find(i => i.legalKey === 'fire');
  const ra = S.requirements.find(s => s.legal).items.find(i => i.legalKey === 'riskassessments');
  const cards = [...document.querySelectorAll('.card')].map(c => (c.querySelector('.card-band h3') || {}).textContent || '');
  return { order, legalAt: cards.findIndex(t => /Legal essentials/.test(t)), workAt: cards.findIndex(t => /Because of the work they do/.test(t)),
    fireExtra: fire.workExtra || [], fireTick: (fire.crit || {})[0] === true, fireFirst: _critList(fire)[0] === LEGAL_ESSENTIALS.find(e => e.key === 'fire').criteria[0],
    raExtra: ra.workExtra || [], puwerChecks: _critList(sec.items.find(i => i.workKey === 'puwer')).length }; });
R.ok(b.workAt === b.legalAt + 1, 'Build puts "Because of the work they do" straight under the standard duties');
R.ok(b.order.join() === 'asbestos,puwer,noise,driving,cdmroles', 'one line per regulation, biggest fish first: ' + b.order.join(', '));
R.ok(b.puwerChecks >= 4, 'a line carries the checks of every answer behind it (' + b.puwerChecks + ' for work equipment and plant)');
R.ok(b.fireExtra.length === 2 && b.raExtra.length === 2 && b.raExtra.some(t => /^Lone working/.test(t)) && b.raExtra.some(t => /^Safety-critical roles/.test(t)),
  'work that adds to a standard duty is one check per topic under it, not a second line');
R.ok(b.fireTick && b.fireFirst, 'a tick already on a standard duty stays on the same check');

// ── what the line shows ──
const card = await page.evaluate(() => { const c = [...document.querySelectorAll('.card-body > div[style*="border-left:4px"]')].find(d => /Work equipment and mobile plant/.test(d.textContent)); return c ? c.textContent : ''; });
const heads = await page.evaluate(() => [...document.querySelectorAll('.card-body > div')].filter(d => /^Tier \d · /.test(d.textContent)).map(d => d.textContent));
// this business has nothing in tier 3, so there is no tier 3 heading
R.ok(heads.map(h => h.slice(0, 6)).join() === 'Tier 1,Tier 2,Tier 4' && /^Tier 1 · Could kill, enforced hard/.test(heads[0]), 'the lines sit under a heading for each tier they fall in: ' + heads.join(' | '));
R.ok(/They answered yes to:/.test(card) && /Occasional/.test(card) && /Does not apply/.test(card) && !/Tier \d · /.test(card),
  'each line shows the answers behind it and Occasional / Does not apply, without repeating its tier');

// ── occasional, does not apply ──
const o = await page.evaluate(async () => { const sec = S.requirements.find(s => s.work); const it = sec.items.find(i => i.workKey === 'puwer');
  toggleWorkOccasional(sec.id, it.id); const tier = _workTierOf(it); const order = [...sec.items].sort(_workOrder).map(i => i.workKey);
  const moved = [...document.querySelectorAll('.card-body > div[style*="border-left:4px"]')].find(d => /Work equipment and mobile plant/.test(d.textContent));
  if (!moved || !/Occasional for this client · normally tier 1/.test(moved.textContent)) return { tier: -1 };
  const n = sec.items.find(i => i.workKey === 'noise'); dismissWorkDuty(sec.id, n.id);
  buildProfileFromDiscovery(); await new Promise(r => setTimeout(r, 300));
  const back = sec.items.some(i => i.workKey === 'noise'); restoreWorkDuty(sec.id, 'work:noise');
  return { tier, order, back, restored: sec.items.some(i => i.workKey === 'noise') }; });
R.ok(o.tier === 2 && o.order.indexOf('puwer') > o.order.indexOf('asbestos'), 'marking a line occasional drops it a tier, and the card says it was moved');
R.ok(!o.back && o.restored, 'Does not apply removes a line for good - Build never re-adds it - and Restore brings it back');

// ── a gap becomes a risk, as for the standard duties ──
const r = await page.evaluate(() => { const sec = S.requirements.find(s => s.work); const it = sec.items.find(i => i.workKey === 'driving');
  updateReqField(sec.id, it.id, 'present', 'No'); renderRequirements(); const rk = (S.riskProfile || []).find(x => x.reqKey === 'line|' + it.id); return rk ? rk.activity : ''; });
R.ok(/Driving for work/.test(r), 'a line marked not in place becomes a risk on the profile (' + r + ')');

await R.done(browser, errors);
