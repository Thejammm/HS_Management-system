// ══════════════════════════════════════════════════════════════
//  A tier on every risk, and the Top 5 order (Simon, 2026-10-27: "I can
//  talk in tiered risks so that companies get what's going on"). A risk
//  takes the tier of its biggest work duty, or from how bad it could be
//  today; could kill = current severity 5; the suggested five run danger
//  seen on site, legal must-haves missing, not adequate, then tier 1 to 4.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, wait, reporter } from './harness.mjs';

const R = reporter('Risk tiers and the Top 5 order');
const { browser, page, errors } = await openApp();

// a made-up grounds business: answers checked, profile built
await page.evaluate(async () => {
  S.company = { legalName: 'Example Grounds Ltd', employees: '12' };
  S.riskProfile = []; S.actionPlan = []; S.requirements = []; S.documents = []; S.raRegister = [];
  const ex = { p_office: true, d_responsible: true, d_dutytomanage: false, a_workequip: true, a_plant: true, w_safetycrit: true, a_pressure: true, p_plant: true, o_driving: true };
  S.profiler = { exposure: ex, maturity: {}, discNotes: {}, sectors: { land: true }, judgement: {},
    gate: { src: Object.fromEntries(Object.keys(ex).map(k => [k, 'consultant'])), confirmed: {} } };
  ['workequip', 'fire', 'roadrisk', 'financial', 'loneworking'].forEach(k => insertLibraryRisk(k, true));
  switchTab('requirements'); buildProfileFromDiscovery(); await new Promise(r => setTimeout(r, 300));
  const sev = { workequip: 4, fire: 5, roadrisk: 5, financial: 3, loneworking: 4 };
  // just the five risks this test rates (Build adds others for the same answers)
  S.riskProfile = S.riskProfile.filter(r => sev[r.libKey] !== undefined);
  S.riskProfile.forEach(r => { r.likelihood = 3; r.severity = sev[r.libKey]; r.sif = ''; });
  _riskRefsEnsure();
});
const by = k => `S.riskProfile.find(r => r.libKey === '${k}')`;

// ── the tier and where it comes from ──
const t = await page.evaluate(() => Object.fromEntries(S.riskProfile.map(r => { const x = _riskTier(r); return [r.libKey, x.tier + ' ' + x.why]; })));
R.ok(/^1 from Work equipment/.test(t.workequip), 'a risk takes the tier of its biggest work duty (' + t.workequip + ')');
R.ok(/^1 from Fire/.test(t.fire), 'the fire risk is tier 1 from the fire duty (' + t.fire + ')');
R.ok(/^2 from Driving/.test(t.roadrisk), 'driving is tier 2 even at severity 5 - the duty decides (' + t.roadrisk + ')');
R.ok(/^2 from how bad it could be today \(severity 4\)/.test(t.loneworking) && /^3 from how bad/.test(t.financial), 'a risk with no work duty takes its tier from severity today (' + t.loneworking + '; ' + t.financial + ')');
const occ = await page.evaluate(() => { const sec = S.requirements.find(s => s.work); const it = sec.items.find(i => i.workKey === 'driving'); it.occasional = true; const a = _riskTier(S.riskProfile.find(r => r.libKey === 'roadrisk')).tier; it.occasional = false; return a; });
R.ok(occ === 3, 'marking its duty occasional moves the risk down a tier (' + occ + ')');
const ov = await page.evaluate(() => { const r = S.riskProfile.find(x => x.libKey === 'financial'); setRiskTier(r.id, '1'); const a = _riskTier(r); setRiskTier(r.id, ''); return a.tier + ' ' + a.why + ' / ' + _riskTier(r).tier; });
R.ok(ov === '1 set by you / 3', 'the consultant can overrule the tier and set it back to auto (' + ov + ')');

// ── could kill = current severity 5, the consultant's own tick kept ──
const sif = await page.evaluate(() => { const f = r => _riskSif(r); const road = S.riskProfile.find(r => r.libKey === 'roadrisk'); const we = S.riskProfile.find(r => r.libKey === 'workequip');
  we.inherentS = 5; const a = { fire: f(S.riskProfile.find(r => r.libKey === 'fire')), we: f(we) }; road.sif = false; a.road = f(road); road.sif = ''; return a; });
R.ok(sif.fire === true && sif.we === false && sif.road === false, 'could kill is current severity 5 only, and an unticked flag stays unticked (' + JSON.stringify(sif) + ')');

// ── the Top 5 order ──
const ord = () => page.evaluate(() => S.riskProfile.slice().sort(_riskPrioCmp).map(r => r.libKey + ':' + _riskPrio(r).grp));
const o1 = await ord();
R.ok(o1.join() === 'fire:4,workequip:4,roadrisk:4,loneworking:4,financial:4', 'with nothing marked: tier 1 first, could kill first inside it (' + o1.join(', ') + ')');
const o2 = await page.evaluate(() => { const ess = S.requirements.find(s => s.legal); const elci = ess.items.find(i => i.legalKey === 'elci'); updateReqField(ess.id, elci.id, 'present', 'No');
  return S.riskProfile.slice().sort(_riskPrioCmp).map(r => r.libKey + ':' + _riskPrio(r).grp + ':' + _riskPrio(r).reason); });
R.ok(/^financial:2:.*not in place$/.test(o2[0]), 'a standard duty marked not in place puts its risk first (' + o2[0] + ')');
const o3 = await page.evaluate(() => { const r = S.riskProfile.find(x => x.libKey === 'loneworking'); setRiskSiteSeen(r.id, 'Lone worker on the ride-on mower with no check-in');
  const top = S.riskProfile.slice().sort(_riskPrioCmp)[0]; const out = top.libKey + ' ' + _riskPrio(top).reason; setRiskSiteSeen(r.id, ''); return out; });
R.ok(/^loneworking Seen on site: Lone worker/.test(o3), 'a danger seen on site goes above everything (' + o3 + ')');

// ── where it shows: the register, a risk, the cockpit ──
await page.evaluate(() => switchTab('risk')); await wait(page, 500);
const reg = await page.evaluate(() => { const th = [...document.querySelectorAll('table.rpt thead th')].map(x => x.textContent.trim());
  const box = document.createElement('tbody'); box.innerHTML = _riskRowHTML(S.riskProfile); return { th, cells: [...box.querySelectorAll('tr')].map(tr => tr.children[2].textContent) }; });
R.ok(reg.th[2] === 'Tier' && reg.cells.every(c => /^TIER [1-4]$/.test(c)), 'the register has a Tier column on every row (' + reg.cells.join(', ') + ')');
const box = await page.evaluate(async () => { const r = S.riskProfile.find(x => x.libKey === 'workequip'); _riskOpenModal(r.id); await new Promise(z => setTimeout(z, 400));
  const b = [...document.querySelectorAll('.dg-acts')].find(x => /^Priority/.test((x.querySelector('.dg-ah') || {}).textContent || ''));
  return { chip: [...document.querySelectorAll('.rc-chip')].some(c => c.textContent === 'TIER 1'), txt: b ? b.textContent.replace(/\s+/g, ' ') : '', sel: !!(b && b.querySelector('select')), inp: !!(b && b.querySelector('input[type=text]')) }; });
R.ok(box.chip && /Tier 1s*Could kill, enforced hard · from Work equipment/.test(box.txt) && box.sel && box.inp, 'an open risk shows its tier in the header and a Priority box with the reason, the override and the seen-on-site line');
await page.evaluate(() => { _riskModalOpen = false; switchTab('cockpit'); }); await wait(page, 900);
const ck = await page.evaluate(() => { const p = document.querySelector('.ckx-panel.ckl'); if (!p) return null;
  const sug = [...p.querySelectorAll('div')].find(d => /^Suggested five/i.test((d.firstElementChild || {}).textContent || '') && d.querySelector('input[type=checkbox]'));
  return { sug: sug ? sug.querySelectorAll('input[type=checkbox]').length : 0, first: sug ? sug.children[1].textContent : '', lines: p.querySelectorAll('.ckl-line').length, tiers: [...p.querySelectorAll('.ckl-meta')].filter(m => /TIER [1-4]/.test(m.textContent)).length }; });
R.ok(ck && ck.sug === 5 && /Uninsured loss/.test(ck.first), 'the cockpit ladder shows the suggested five, first the missing legal duty (' + (ck && ck.first.slice(0, 60)) + ')');
R.ok(ck && ck.lines > 0 && ck.tiers === ck.lines, 'every ladder line shows its tier');

await R.done(browser, errors);
