// ══════════════════════════════════════════════════════════════
//  One sign-off area, three sections that work the same, and a CPD tab that
//  suggests topics for the kind of work the client does. Simon, 2026-09-30:
//  "this will now be the sign off area for all sign offs so it will need to
//  be split into toolbox talks and cpds sections but work the same ... make
//  the tab smart and list potential cpd topics ... fineline are architects so
//  they will need design based things, easytravel are vehicle repair
//  engineers so they will need their specific cpds".
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Sign-off sections and suggested CPD');
const { browser, page, errors } = await openApp();

const base = {
  company: { legalName: 'Easy Travel Service', sector: 'Motor trade' },
  profiler: { sectors: { motor: true, transportsvc: true } },
  riskProfile: [{ id: 'r1', ref: 'R1', activity: 'Working under vehicles on lifts', hazard: 'Crushing' }],
  policySignoff: { policies: [
      { id: 'p1', title: 'Health and Safety Policy', type: 'Policy', version: '4', delivered: '2026-09-01', riskIds: [] },
      { id: 'p2', title: 'Vehicle lifts', type: 'Toolbox talk', delivered: '2026-09-20', riskIds: ['r1'], content: '1. Axle stands.', source: { kind: 'talk', id: 'tbt-x' } },
      { id: 'p3', title: 'Lifting Operations Procedure', type: 'Procedure', delivered: '2026-09-02', riskIds: ['r1'] } ],
    staff: [{ id: 's1', name: 'Mick Kane' }, { id: 's2', name: 'Priya Nair' }],
    signed: {}, log: [], logMigrated: true },
  cpd: { items: [], log: [], issued: {}, intro: '' } };
await seed(page, base, 'signoff');
await page.evaluate(() => { Auth.isSignedIn = () => true; Auth.activeTenantId = () => 'et'; window._psoApi = async () => ({ ok: true, data: { invites: [] } });
  window.openSignoffSend = id => { window._sent = id; };
  _psoRecord('s1', 'p1', 'acknowledged', { method: 'link' }); _psoRebuildSigned(); renderPolicySignoff(); });
await wait(page, 300);

// ── three sections, in order, each line in the section its type belongs to ──
{
  const t = await page.evaluate(() => {
    const secs = [...document.querySelectorAll('#signoffContainer .pss')].map(s => ({ id: s.id, name: s.querySelector('.pss-name').textContent,
      count: s.querySelector('.pss-count').textContent, rows: [...s.querySelectorAll('.psl-row')].map(r => r.id), empty: !!s.querySelector('.pss-empty'),
      lib: (s.querySelector('.pss-lib') || {}).textContent || '', add: [...s.querySelectorAll('button')].some(b => /＋ Add$/.test(b.textContent.trim())),
      docs: /Pull from Documents/.test(s.innerText) }));
    const heads = document.querySelectorAll('#signoffContainer .psl-head').length;
    const p2 = document.getElementById('psl-p2'), p3 = document.getElementById('psl-p3');
    return { secs, heads, p2chips: [...p2.querySelectorAll('.psl-from,.psl-rk')].map(b => b.textContent), p3chips: [...p3.querySelectorAll('.psl-rk')].map(b => b.textContent),
      cards: [...document.querySelectorAll('#signoffContainer .card-band h3')].length };
  });
  R.ok(t.secs.map(s => s.id).join(',') === 'pss-pol,pss-tbt,pss-cpd', 'three sections, in order: ' + t.secs.map(s => s.name).join(' | '));
  R.ok(t.secs[0].rows.join(',') === 'psl-p1,psl-p3' && t.secs[1].rows.join(',') === 'psl-p2' && t.secs[2].empty, 'each line sits in the section its type belongs to - a procedure with the policies, a talk with the talks');
  R.ok(/2 items · 1 of 4 signed/.test(t.secs[0].count) && /1 item · 0 of 2 signed/.test(t.secs[1].count) && /none yet/.test(t.secs[2].count), 'each section counts its own items and signatures');
  R.ok(t.secs.every(s => s.add) && t.secs[0].docs && !t.secs[1].docs, 'every section has its own Add; Pull from Documents sits with the policies only');
  R.ok(t.secs[1].lib === 'Talk library →' && t.secs[2].lib === 'CPD library →' && !t.secs[0].lib, 'the talk and CPD sections link back to their libraries');
  R.ok(t.heads === 1 && t.cards === 3, 'the column heads once at the top, and still three cards');
  R.ok(t.p2chips.join('|') === 'Talk library →|R1 · Working under vehicles…' && t.p3chips.join('|') === 'R1 · Working under vehicles…', 'a talk and a procedure that control the same risk carry the same chip: ' + t.p2chips.join(' / '));
}

// ── Add opens in its own section, and moves with the type ──
{
  const t = await page.evaluate(async () => {
    const out = {};
    psoAddOpen('tbt'); await new Promise(r => setTimeout(r, 30));
    out.inTbt = !!document.querySelector('#pss-tbt .psl-add'); out.type = document.getElementById('psoAddType').value; out.focus = document.activeElement && document.activeElement.id;
    psoAddDraft('type', 'Training / CPD');
    out.moved = !!document.querySelector('#pss-cpd .psl-add') && !document.querySelector('#pss-tbt .psl-add');
    out.topics = [...document.querySelectorAll('#psoAddList option')].map(o => o.value);
    const ti = document.getElementById('psoAddTitle'); ti.value = 'Electric and hybrid vehicle safety'; ti.dispatchEvent(new Event('input')); ti.dispatchEvent(new Event('change'));
    psoAddSave();
    const pol = _psoState().policies.find(x => x.title === 'Electric and hybrid vehicle safety') || {};
    out.pol = { type: pol.type, src: pol.source && pol.source.kind + ':' + pol.source.id, content: pol.content || '' };
    out.inCpd = !!document.querySelector('#pss-cpd #psl-' + pol.id);
    psoAddOpen(); out.defaultPol = !!document.querySelector('#pss-pol .psl-add') && document.getElementById('psoAddType').value === 'Policy'; psoAddCancel();
    return out;
  });
  R.ok(t.inTbt && t.type === 'Toolbox talk' && t.focus === 'psoAddTitle', 'Add on the talk section opens there, as a toolbox talk, ready to type');
  R.ok(t.moved, 'change the type and the line moves to that section');
  R.ok(t.topics.includes('Vehicle lifts and working under vehicles') && t.topics.includes('Daily vehicle walkaround checks') && !t.topics.includes('CDM 2015 for designers'), 'the CPD Add line offers the topics for this client, not everyone else\'s');
  R.ok(t.pol.type === 'Training / CPD' && t.pol.src === 'cpdtopic:mvr-ev' && /What it covers:/.test(t.pol.content) && /Electricity at Work Regulations 1989/.test(t.pol.content) && t.inCpd, 'a suggested topic picked by name arrives with its outline and the law behind it');
  R.ok(t.defaultPol, 'Add with no section is still a policy');
}

// ── the tracker groups its columns under the same coloured sections ──
{
  const t = await page.evaluate(() => {
    const band = [...document.querySelectorAll('#signoffContainer .pss-mband th[colspan]')].map(th => th.textContent + ':' + th.getAttribute('colspan'));
    const cols = [...document.querySelectorAll('#signoffContainer thead tr:nth-child(2) th')].map(th => th.getAttribute('title')).filter(Boolean);
    return { band, cols };
  });
  R.ok(t.band.join(',') === 'Policies:2,Toolbox talks:1,CPD:1', 'the tracker bands its columns: ' + t.band.join(', '));
  R.ok(t.cols.join('|') === 'Health and Safety Policy|Lifting Operations Procedure|Vehicle lifts|Electric and hybrid vehicle safety', 'and orders them section by section');
}

// ── the CPD tab: topics for the kind of work ──
{
  const t = await page.evaluate(() => {
    switchTab('cpd'); renderCPD();
    const cont = document.getElementById('cpdContainer');
    const card = cont.querySelector('.card');
    const groups = [...card.querySelectorAll('.cpt-grp')].map(g => g.textContent);
    return { title: card.querySelector('.card-band h3').textContent.replace(/●/g, '').trim(), kind: card.querySelector('.cpt-kind').innerText,
      groups, titles: [...card.querySelectorAll('.cpt-title')].map(x => x.textContent), view: document.getElementById('cptView').value,
      evStatus: (document.querySelector('#cpt-mvr-ev .cpt-status') || {}).innerText || '', libStill: /CPD library/i.test(cont.innerText) && /This month, issued for sign-off/i.test(cont.innerText),
      hero: document.querySelector('#tab-cpd .rep-hero p').textContent };
  });
  R.ok(t.title === 'Suggested CPD for Easy Travel Service', 'the tab leads with suggested CPD for the client: ' + t.title);
  R.ok(/Vehicle repair or maintenance · Transport, passenger or delivery services/.test(t.kind) && /discovery/.test(t.kind), 'the kind of work comes from the sectors ticked in discovery');
  R.ok(t.groups.join('|') === 'Vehicle repair or maintenance|Transport, passenger or delivery services|Every business', 'grouped by the work, with every-business topics last: ' + t.groups.join(' | '));
  R.ok(t.titles.includes('Vehicle lifts and working under vehicles') && t.titles.includes('Isocyanates and paint spraying') && t.titles.includes('Daily vehicle walkaround checks') && !t.titles.some(x => /designers|drone/i.test(x)), 'vehicle repair and transport topics - nothing for architects');
  R.ok(/Issued/.test(t.evStatus) && /0 of 2 signed/.test(t.evStatus), 'a topic already on the register says so, with the same count as the register: ' + t.evStatus.replace(/\s+/g, ' '));
  R.ok(t.libStill && /suggested for the kind of work/.test(t.hero), 'the library and the month card are still there underneath');
}

// ── Issue and Library from a topic ──
{
  const t = await page.evaluate(() => {
    window._sent = '';
    issueCpdTopic('mvr-lifts');
    const pol = _psoState().policies.find(x => x.source && x.source.id === 'mvr-lifts') || {};
    const out = { type: pol.type, content: /LOLER|Lifting Operations and Lifting Equipment Regulations 1998/.test(pol.content || ''), sent: window._sent === pol.id, tab: document.querySelector('#tab-signoff.active, #tab-signoff[style*="block"]') !== null || S._tab === 'signoff' };
    out.inCpd = !!document.querySelector('#pss-cpd #psl-' + pol.id);
    const n = _psoState().policies.length; issueCpdTopic('mvr-lifts'); out.once = _psoState().policies.length === n;
    switchTab('cpd'); renderCPD();
    addCpdTopicToLibrary('mvr-tyres');
    const it = _cpdState().items.find(i => i.topicId === 'mvr-tyres') || {};
    out.lib = { title: it.title, type: it.type, mins: it.minutes, month: it.month, notes: !!it.notes };
    out.libStatus = document.querySelector('#cpt-mvr-tyres .cpt-status').innerText;
    out.libBtnGone = ![...document.querySelectorAll('#cpt-mvr-tyres button')].some(b => /Library/.test(b.textContent));
    cpdTopicToggle('mvr-tyres'); const more = document.querySelector('#cpt-mvr-tyres .cpt-more');
    out.more = !!more && /Inflation cages/.test(more.innerText) && /Provision and Use of Work Equipment Regulations 1998/.test(more.innerText);
    return out;
  });
  R.ok(t.type === 'Training / CPD' && t.content && t.sent && t.inCpd, 'Issue puts the topic on the register in the CPD section, with its outline, and opens the send screen');
  R.ok(t.once, 'issuing it again opens the same line - no duplicate');
  R.ok(t.lib.title === 'Tyre and wheel safety' && t.lib.type === 'Toolbox talk' && t.lib.mins === '30' && t.lib.month === '' && t.lib.notes, '＋ Library keeps it in the back catalogue with its format, minutes and why');
  R.ok(/In the library/.test(t.libStatus) && t.libBtnGone, 'and the topic then says it is in the library');
  R.ok(t.more, 'More shows what it covers and the law and guidance behind it');
}

// ── an architect gets design topics; no kind of work means every topic ──
{
  const t = await page.evaluate(() => {
    S.company = { legalName: 'Fineline Architects', sector: 'Design / architecture / surveying' }; S.profiler.sectors = {};
    renderCPD();
    const card = document.querySelector('#cpdContainer .card');
    const out = { kind: card.querySelector('.cpt-kind').innerText, groups: [...card.querySelectorAll('.cpt-grp')].map(g => g.textContent),
      titles: [...card.querySelectorAll('.cpt-title')].map(x => x.textContent) };
    S.company = { legalName: 'New Client' }; renderCPD();
    const c2 = document.querySelector('#cpdContainer .card');
    out.unset = { kind: c2.querySelector('.cpt-kind').innerText, view: document.getElementById('cptView').value, n: c2.querySelectorAll('.cpt-row').length, total: CPD_TOPICS.length };
    cpdTopicView('care');
    out.care = [...document.querySelectorAll('#cpdContainer .cpt-grp')].map(g => g.textContent);
    out.designOpt = [...document.querySelectorAll('#tab-company select option')].some(o => o.value === 'Design / architecture / surveying') || /Design \/ architecture \/ surveying/.test(document.documentElement.innerHTML);
    return out;
  });
  R.ok(/Design, surveying or consultancy/.test(t.kind) && /Company setup/.test(t.kind), 'with no discovery done, the Company setup sector decides: ' + t.kind.replace(/\s+/g, ' '));
  R.ok(t.groups[0] === 'Design, surveying or consultancy' && t.titles.includes('CDM 2015 for designers') && t.titles.includes('Flying drones for surveys') && t.titles.includes('Safe surveying in empty and occupied homes') && !t.titles.some(x => /vehicle|isocyanate/i.test(x)), 'an architect gets CDM for designers, drones, void surveys - nothing for garages');
  R.ok(/Not set yet/.test(t.unset.kind) && t.unset.view === 'all' && t.unset.n === t.unset.total, 'with no kind of work set it says so and shows every topic (' + t.unset.n + ')');
  R.ok(t.care[0] === 'Care, health or education' && t.care[t.care.length - 1] === 'Every business', 'any one sector can be looked at on its own');
  R.ok(t.designOpt, 'Company setup can say the client is a design practice');
}

// ── every topic is complete, and says where it comes from ──
{
  const t = await page.evaluate(() => {
    const keys = SECTOR_DEFS.map(d => d.k).concat(['all']);
    const bad = CPD_TOPICS.filter(x => !x.id || !x.title || !x.why || !x.basis || !(x.covers || []).length || !x.mins || CPD_TYPES.indexOf(x.format) < 0 || !x.sectors.length || x.sectors.some(k => keys.indexOf(k) < 0)).map(x => x.id);
    const ids = CPD_TOPICS.map(x => x.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    const bySector = SECTOR_DEFS.filter(d => !CPD_TOPICS.some(x => x.sectors.indexOf(d.k) >= 0)).map(d => d.k);
    const american = CPD_TOPICS.filter(x => /\b(organiz|authoriz|recogniz|minimiz|color\b|center\b|program\b)/i.test(JSON.stringify(x))).map(x => x.id);
    return { bad, dup, bySector, american, n: CPD_TOPICS.length };
  });
  R.ok(!t.bad.length && !t.dup.length, 'all ' + t.n + ' topics have a title, why, outline, basis, minutes and a known format' + (t.bad.length ? ' - bad: ' + t.bad.join(',') : '') + (t.dup.length ? ' dup: ' + t.dup.join(',') : ''));
  R.ok(!t.bySector.length, 'every kind of work has topics of its own' + (t.bySector.length ? ' - missing: ' + t.bySector.join(',') : ''));
  R.ok(!t.american.length, 'British spelling throughout' + (t.american.length ? ' - ' + t.american.join(',') : ''));
}

await R.done(browser, errors);
