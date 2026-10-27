// ══════════════════════════════════════════════════════════════
//  Legal duties against the company's own risks, both ways (Simon,
//  2026-10-27: "how do I see the legal duties against the company specific
//  risks"). A duty card lists the client's risks it concerns, or offers to
//  add one; a risk lists its legal duties, tier first, with the status from
//  the Legal duties tab. Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, wait, reporter } from './harness.mjs';

const R = reporter('Legal duties against the company\'s risks');
const { browser, page, errors } = await openApp();

// a made-up grounds business: answers checked, profile built
await page.evaluate(async () => {
  S.company = { legalName: 'Example Grounds Ltd', employees: '12' };
  S.riskProfile = []; S.actionPlan = []; S.requirements = []; S.documents = []; S.raRegister = [];
  const ex = { p_office: true, d_responsible: true, d_dutytomanage: false, a_workequip: true, a_plant: true, w_safetycrit: true, a_pressure: true, p_plant: true, o_driving: true };
  S.profiler = { exposure: ex, maturity: {}, discNotes: {}, sectors: { land: true }, judgement: {},
    gate: { src: Object.fromEntries(Object.keys(ex).map(k => [k, 'consultant'])), confirmed: {} } };
  ['workequip', 'fire', 'roadrisk', 'financial'].forEach(k => insertLibraryRisk(k, true));
  switchTab('requirements'); buildProfileFromDiscovery(); await new Promise(r => setTimeout(r, 300));
  switchTab('requirements');
});
await wait(page, 400);

// ── on a duty card: their risks ──
const cards = await page.evaluate(() => {
  // the driving risk was taken off the profile, so the driving duty has no risk under it
  S.riskProfile = S.riskProfile.filter(r => r.libKey !== 'roadrisk'); renderRequirements();
  const work = k => S.requirements.find(s => s.work).items.find(i => i.workKey === k);
  const std = k => S.requirements.find(s => s.legal).items.find(i => i.legalKey === k);
  const line = it => { const el = document.getElementById('legalcard-' + it.id); const d = el && [...el.querySelectorAll('div')].find(x => /^(Their risks: |No risk on their profile)/.test(x.textContent)); return d ? d.textContent : ''; };
  return { puwer: line(work('puwer')), fire: line(std('fire')), elci: line(std('elci')), driving: line(work('driving')) };
});
R.ok(/^Their risks: .*Provision, maintenance and use of work equipment/.test(cards.puwer), 'a work duty lists the risks it concerns (' + cards.puwer.slice(0, 80) + ')');
R.ok(/^Their risks: .*Fire safety/.test(cards.fire) && /^Their risks: .*Uninsured loss/.test(cards.elci), 'standard duties list their risks too (fire, employers\' liability)');
R.ok(/^No risk on their profile covers this yet/.test(cards.driving) && /to the risk profile/.test(cards.driving), 'a duty with no risk on their profile says so and offers the library risk');
const added = await page.evaluate(() => { const it = S.requirements.find(s => s.work).items.find(i => i.workKey === 'driving');
  [...document.getElementById('legalcard-' + it.id).querySelectorAll('button')].find(b => /to the risk profile/.test(b.textContent)).click();
  return S.riskProfile.some(r => r.libKey === 'roadrisk'); });
R.ok(added, 'one click adds that risk to the profile');

// ── on a risk: its duties, tier first ──
const duties = await page.evaluate(() => { const r = S.riskProfile.find(x => x.libKey === 'workequip'); return _riskDuties(r).map(d => (d.tier ? 'T' + d.tier : 'EE') + ' ' + d.it.workKey + ' ' + d.status.t); });
R.ok(duties.join() === 'T1 puwer Not assessed,T1 pressure Not assessed', 'a risk lists its legal duties, tier first, in the Legal duties tab order: ' + duties.join(', '));
const fire = await page.evaluate(() => _riskDuties(S.riskProfile.find(x => x.libKey === 'fire')).map(d => (d.tier ? 'T' + d.tier : 'EE') + ' ' + (d.it.workKey || d.it.legalKey)));
R.ok(fire[0] === 'T1 fire', 'fire is a tier 1 standard duty on the fire risk (' + fire.join(', ') + ')');
const ins = await page.evaluate(() => _riskDuties(S.riskProfile.find(x => x.libKey === 'financial')).map(d => (d.tier ? 'T' + d.tier : 'EE') + ' ' + d.it.legalKey));
R.ok(ins.join() === 'EE elci', 'other standard duties show as every employer (' + ins.join(', ') + ')');

// ── the status and the tier follow the Legal duties tab ──
const follow = await page.evaluate(() => { const sec = S.requirements.find(s => s.work); const p = sec.items.find(i => i.workKey === 'puwer');
  updateReqField(sec.id, p.id, 'present', 'No'); p.occasional = true;
  const d = _riskDuties(S.riskProfile.find(x => x.libKey === 'workequip')).find(x => x.it.workKey === 'puwer'); return { st: d.status.t, tier: d.tier }; });
R.ok(follow.st === 'Not in place' && follow.tier === 2, 'marking a duty not in place, or occasional, shows on the risk (' + follow.st + ', tier ' + follow.tier + ')');

// ── the Summary box, and the way back to the duty ──
const box = await page.evaluate(async () => { const r = S.riskProfile.find(x => x.libKey === 'workequip'); switchTab('risk'); _riskOpenModal(r.id); await new Promise(z => setTimeout(z, 400));
  const b = [...document.querySelectorAll('.dg-acts')].find(x => /^Legal duties/.test((x.querySelector('.dg-ah') || {}).textContent || ''));
  const rows = b ? [...b.querySelectorAll('.dg-act')].map(x => x.textContent.replace(/\s+/g, ' ').trim()) : [];
  if (b) b.querySelector('.dg-act').click(); await new Promise(z => setTimeout(z, 500));
  return { rows, tab: document.querySelector('.tab-btn.active').getAttribute('data-tab') }; });
R.ok(box.rows.length === 2 && /Tier 1/.test(box.rows[0]) && /Pressure systems/.test(box.rows[0]), 'the risk Summary shows a "Legal duties" box, tier first (' + box.rows.length + ' rows)');
R.ok(box.tab === 'requirements', 'clicking a duty on the risk goes to the Legal duties tab');

await R.done(browser, errors);
