// ══════════════════════════════════════════════════════════════
//  One sign-off journey. Simon, 2026-09-28: "i must be able to raise new
//  cpd, tool box talks risk assessments etc and then have them go through
//  this same sign process but just have one system not two or three
//  fighting each other".
//
//  These pin that a talk, a month's CPD and a risk assessment each become an
//  item on the sign-off register and go no other way; that the toolbox tab
//  no longer signs anyone off; that what was signed for on paper before is
//  brought across as it was; and that a talk, once confirmed, stays
//  confirmed while a policy still runs out after a year.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('One sign-off journey - talks, CPD, risk assessments');
const { browser, page, errors } = await openApp();

const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
const STAFF = [{ id: 's1', name: 'Daniel Ashworth', role: 'Workshop Supervisor' }, { id: 's2', name: 'Chloe Barrett', role: 'Office Manager' }];
const REG = () => ({ policies: [], staff: JSON.parse(JSON.stringify(STAFF)), signed: {}, log: [], logMigrated: true });

// ── a toolbox talk ──
await seed(page, { company: { legalName: 'Fairbank Fabrications Ltd' }, policySignoff: REG() }, 'toolbox');
await wait(page, 300);
{
  const t = await page.evaluate((today) => {
    const txt = document.getElementById('toolboxContainer').innerText;
    const before = { record: /Record delivery/.test(txt), signAll: /Mark all signed/.test(txt), deliveries: /Delivery and sign-off/.test(txt), issue: /Issue for sign-off/.test(txt) };
    issueTalkForSignoff('tbt-slips');
    const p = _psoState(); const pol = p.policies[0] || {};
    const shown = getComputedStyle(document.getElementById('tab-signoff')).display !== 'none';
    return { before, n: p.policies.length, type: pol.type, title: pol.title, content: pol.content || '', src: pol.source, delivered: pol.delivered, shown,
      dec: _psoDeclarationFor(pol), onRegister: /Slips, trips/.test(document.getElementById('signoffContainer').innerText) };
  }, today);
  R.ok(!t.before.record && !t.before.signAll && !t.before.deliveries, 'the toolbox tab no longer records deliveries or signs anyone off');
  R.ok(t.before.issue, 'it issues a talk for sign-off instead');
  R.ok(t.n === 1 && t.type === 'Toolbox talk' && /Slips, trips/.test(t.title), 'issuing puts the talk on the sign-off register as a Toolbox talk');
  R.ok(/^1\. /m.test(t.content) && /wet or contaminated/.test(t.content), 'carrying the talk itself, so the phone link can show what was covered');
  R.ok(t.src && t.src.kind === 'talk' && t.src.id === 'tbt-slips' && t.delivered === today, 'dated today, remembering which talk it came from');
  R.ok(t.shown && t.onRegister, 'and you are taken to the register, where it now sits - the one place anything is signed');
  R.ok(/I attended/.test(t.dec) && !/I have read it/.test(t.dec), 'the declaration says attended, not read - it describes what happened');
}
{
  const t = await page.evaluate(() => { issueTalkForSignoff('tbt-slips'); return _psoState().policies.length; });
  R.ok(t === 1, 'issuing the same talk twice today is one item, not two');
}
// ── ticked in person, and it never expires ──
{
  const t = await page.evaluate((today) => {
    const pol = _psoState().policies[0];
    toggleSignoff('s1', pol.id, true);
    const e = _psoTrailFor('s1', pol.id)[0] || {};
    const twoYears = new Date(Date.now() - 2 * 366 * 864e5).toISOString().slice(0, 10);
    return { kind: e.kind, method: e.method, dec: e.declaration || '',
      talk: _psoSignInfo(twoYears, pol), policy: _psoSignInfo(twoYears, { type: 'Policy' }), ra: _psoSignInfo(twoYears, { type: 'Risk assessment' }),
      last: _tbtLastIssued('tbt-slips'), count: _psoSignedCount(pol.id),
      tbt: (renderToolbox(), document.getElementById('toolboxContainer').innerText) };
  }, today);
  R.ok(t.kind === 'acknowledged' && t.method === 'in-person' && /I attended/.test(t.dec), 'ticking in person writes the same kind of entry a link does, with the same declaration');
  R.ok(t.talk.state === 'ok' && t.talk.once, 'a talk confirmed two years ago is still confirmed - it does not expire');
  R.ok(t.policy.state === 'expired' && t.ra.state === 'expired', 'a policy or risk assessment signed two years ago has expired - reviewed, reissued, re-signed');
  R.ok(t.last === today && t.count === 1, 'the library reads back from the register: last issued today, 1 signed');
  R.ok(/1 of 2 signed/.test(t.tbt), 'and says so on the row (1 of 2 signed)');
}
// ── what was signed for on paper before is brought across as it was ──
{
  const t = await page.evaluate(() => {
    S.policySignoff = { policies: [], staff: [{ id: 's1', name: 'Daniel Ashworth', role: 'Workshop Supervisor' }], signed: {}, log: [], logMigrated: true };
    S.toolbox = { custom: [], hidden: [], deliveries: [{ id: 'd1', talkId: 'tbt-slips', title: 'Slips, trips and falls on the level', date: '2026-08-14', presenter: 'S Archer', notes: '',
      attendees: [{ id: 'a1', name: 'Daniel Ashworth', role: 'Workshop Supervisor', signed: true, signedAt: '2026-08-14' },
                  { id: 'a2', name: 'Priya Nair', role: 'Fitter', signed: true, signedAt: '2026-08-15' },
                  { id: 'a3', name: 'Tom Reid', role: 'Apprentice', signed: false }] }] };
    const n = _tbtMigrateDeliveries();
    const p = _psoState(); const pol = p.policies[0] || {};
    const again = _tbtMigrateDeliveries();
    const priya = p.staff.find(s => s.name === 'Priya Nair'); const tom = p.staff.find(s => s.name === 'Tom Reid');
    const e = priya ? (_psoTrailFor(priya.id, pol.id)[0] || {}) : {};
    return { n, again, items: p.policies.length, type: pol.type, date: pol.delivered, presenter: pol.presenter, staff: p.staff.length,
      priya: !!priya, tom: !!tom, legacy: !!e.legacy, method: e.method, at: String(e.at || '').slice(0, 10), by: e.by,
      signed: p.signed[(priya || {}).id + '|' + pol.id], kept: (S.toolbox.deliveries || []).length, migrated: !!S.toolbox.migratedAt };
  });
  R.ok(t.n === 2 && t.items === 1 && t.type === 'Toolbox talk' && t.date === '2026-08-14' && t.presenter === 'S Archer', 'an old delivery becomes one register item, on its own date, with who gave it');
  R.ok(t.priya && t.staff === 2, 'a signer not yet on the register is added by name');
  R.ok(!t.tom, 'someone who did not sign is not invented');
  R.ok(t.legacy && t.method === 'sheet' && t.at === '2026-08-15' && t.by === 'S Archer', 'each signature is a legacy entry: signed sheet, the day they signed, witnessed by the presenter');
  R.ok(t.signed === '2026-08-15', 'and the grid reads it back');
  R.ok(t.again === 0 && t.kept === 1 && t.migrated, 'running twice adds nothing, and the old record is kept, unread');
}

// ── a month's CPD ──
await seed(page, { policySignoff: REG(), cpd: { items: [
  { id: 'c1', title: 'Manual handling refresher', type: 'Webinar', url: 'https://example.org/mh', minutes: '12', month, notes: '', added: '2026-09-01' },
  { id: 'c2', title: 'Fire warden basics', type: 'PDF guide', url: 'https://example.org/fire.pdf', minutes: '8', month, notes: '', added: '2026-09-01' },
  { id: 'c3', title: 'Back catalogue item', type: 'Video', url: '', minutes: '', month: '', notes: '', added: '2026-01-01' } ],
  log: [{ month: '2026-06', sentAt: '2026-06-03', to: 'a@x.com; b@x.com', count: 2, by: 'S Archer' }], issued: {}, intro: '' } }, 'cpd');
await wait(page, 300);
{
  const t = await page.evaluate(() => {
    const txt = document.getElementById('cpdContainer').innerText;
    const before = { sendTo: /Send to/.test(txt), prompt: /Open this month's prompt/.test(txt), report: /Monthly CPD report/.test(txt),
      issue: /Issue for sign-off/.test(txt), hist: /before acknowledgement by link/i.test(txt) && /2 recipients/.test(txt) };
    issueCpdMonth();
    const p = _psoState(); const pol = p.policies[0] || {};
    issueCpdMonth();
    renderCPD();
    const after = document.getElementById('cpdContainer').innerText;
    return { before, n: p.policies.length, type: pol.type, title: pol.title, content: pol.content || '', src: pol.source,
      dec: _psoDeclarationFor(pol), issued: Object.keys(_cpdState().issued).length, after: /Issued/.test(after) && /0 of 2 confirmed/.test(after) && /Ask by link/.test(after) };
  });
  R.ok(!t.before.sendTo && !t.before.prompt && !t.before.report, 'the CPD tab no longer emails a prompt or prints a report');
  R.ok(t.before.issue && t.before.hist, 'it issues the month for sign-off, and keeps the old prompt history visible as history');
  R.ok(t.n === 1 && t.type === 'Training / CPD' && /learning/.test(t.title), 'the month goes on the register as ONE item');
  R.ok(/1\. Manual handling/.test(t.content) && /2\. Fire warden/.test(t.content) && /example\.org\/mh/.test(t.content) && !/Back catalogue/.test(t.content),
    "listing this month's items and their links - not the back catalogue");
  R.ok(t.src && t.src.kind === 'cpd' && t.issued === 1, 'and the month remembers it was issued');
  R.ok(/worked through/.test(t.dec), 'the declaration says worked through');
  R.ok(t.n === 1 && t.after, 'issuing again reuses it, and the tab reads back 0 of 2 confirmed with Ask by link');
}

// ── a risk assessment, from the risk ──
await seed(page, { policySignoff: REG(),
  riskProfile: [{ id: 'r1', activity: 'Working at height on the mezzanine', hazard: 'Falls from height', assocRisk: '', harm: '', likelihood: 3, severity: 4 }],
  raRegister: [{ id: 'rar1', title: 'Risk assessment - Working at height on the mezzanine', ref: 'RA-004', area: '', date: '2026-07-01', reviewDate: '2027-07-01',
    location: 'https://fairbank.sharepoint.com/ra/wah.pdf', notes: '', riskId: 'r1' }] }, 'signoff');
await wait(page, 300);
{
  const t = await page.evaluate(() => {
    const r = S.riskProfile[0];
    const html = _raStartBtnHTML(r);
    issueRiskForSignoff('r1');
    const p = _psoState(); const pol = p.policies[0] || {};
    issueRiskForSignoff('r1');
    const html2 = _raStartBtnHTML(r);
    const n1 = p.policies.length;   // still one item after the reopen, before any rewrite
    // issued back in June; the RA is rewritten in July; today it goes out again
    pol.delivered = '2026-06-01';
    S.raRegister[0].date = '2026-07-01';
    issueRiskForSignoff('r1');
    const rounds = _psoState().policies.length;
    issueRiskForSignoff('r1');   // a second press reopens July's round, it does not start another
    return { btn: /Issue RA for sign-off/.test(html), n: n1, type: pol.type, title: pol.title, link: _psoPolicyLink(pol),
      risks: pol.riskIds, src: pol.source, chip: /RA signed 0 of 2/.test(html2), rounds, rounds2: _psoState().policies.length };
  });
  R.ok(t.btn, 'the risk carries Issue RA for sign-off next to the RA register button');
  R.ok(t.n === 1 && t.type === 'Risk assessment' && /mezzanine/.test(t.title), 'issuing puts the RA on the register, and issuing again reopens it');
  R.ok(t.link === 'https://fairbank.sharepoint.com/ra/wah.pdf', 'with the link the RA register already holds for it');
  R.ok(t.risks && t.risks[0] === 'r1' && t.src.kind === 'risk', 'tagged to the risk - the golden thread builds itself');
  R.ok(t.chip, 'and the risk now reads RA signed 0 of 2');
  R.ok(t.rounds === 2 && t.rounds2 === 2, 'an RA rewritten after it was issued goes out again as a new round - once');
}

// ── a certificate, once they have confirmed ──
//  Simon, 2026-09-28, with one of his own attached: "can you bring the issue
//  of these into the flow when cpd or training is signed off".
{
  const t = await page.evaluate(() => {
    S.branding = Object.assign({}, S.branding, { producer: 'Archer Health & Safety', certSignatory: 'Simon Archer CMIOSH CMaPS MCABE', certSignatoryRole: 'Managing Director, Archer Health & Safety' });
    S.company = { legalName: 'Fineline Architectural Design' };
    S.policySignoff = { policies: [
        { id: 'p1', title: 'Health and Safety Essentials', type: 'Training / CPD', delivered: '2026-09-16', certLine: 'a one-hour continuing professional development session', certStrap: 'Legislation, risk assessment, policy, process and procedure', riskIds: [] },
        { id: 'p2', title: 'Fire Safety Policy', type: 'Policy', version: '3.1', delivered: '2026-08-12', riskIds: [] } ],
      staff: [{ id: 's1', name: 'Sophie Boyes', role: 'Architect' }, { id: 's2', name: 'Chloe Barrett', role: 'Office Manager' }], signed: {}, log: [], logMigrated: true, certificates: [] };
    const e1 = _psoRecord('s1', 'p1', 'acknowledged', { method: 'link', at: '2026-09-17T08:10:00.000Z' });
    _psoRecord('s1', 'p2', 'acknowledged', { method: 'in-person' });
    _psoRebuildSigned();
    // catch how each PDF is saved (save is copied from API onto each instance) and what each certificate is drawn from
    const P = window.jspdf.jsPDF.API; const names = [], drawn = []; const oS = P.save, oD = window._certDraw;
    P.save = function (nm) { names.push(nm); return this; };
    window._certDraw = function (doc, o) { drawn.push(o); return oD(doc, o); };
    issueCertificate(e1.id);
    const first = _psoState().certificates.slice();
    issueCertificate(e1.id);                                   // again: the same number, no second record
    _psoRecord('s2', 'p1', 'acknowledged', { method: 'in-person' }); _psoRebuildSigned();
    issueCertificates('p1');                                   // everyone confirmed: Sophie keeps -01, Chloe gets -02
    P.save = oS; window._certDraw = oD;
    const certs = _psoState().certificates;
    openSignoffTrail('p1'); const ov1 = document.getElementById('psoTrailOv'); const t1 = ov1 ? ov1.innerText : ''; if (ov1) ov1.remove();
    openSignoffTrail('p2'); const ov2 = document.getElementById('psoTrailOv'); const t2 = ov2 ? ov2.innerText : ''; if (ov2) ov2.remove();
    renderPolicySignoff(); const reg = document.getElementById('signoffContainer').innerHTML;
    return { names, d: drawn[0] || {}, pages: drawn.length, first: first.map(c => c.ref), certs: certs.map(c => c.ref + ':' + c.name), t1, t2,
      certInputs: (reg.match(/'certLine'/g) || []).length };
  });
  R.ok(t.first.length === 1 && t.first[0] === 'AHS-CPD-20260916-01', 'a confirmed CPD entry earns a numbered certificate: ' + t.first[0]);
  R.ok(/^certificate-sophie-boyes-AHS-CPD-20260916-01\.pdf$/.test(t.names[0] || ''), 'named for the person and the number (' + t.names[0] + ')');
  R.ok(t.d.name === 'Sophie Boyes' && t.d.title === 'Health and Safety Essentials' && t.d.line === 'a one-hour continuing professional development session' && /^Legislation, risk assessment/.test(t.d.strap),
    'it carries the name, the session, and the two certificate lines');
  R.ok(t.d.date === '2026-09-16' && t.d.producer === 'Archer Health & Safety' && t.d.client === 'Fineline Architectural Design',
    'delivered on the session date by the practice, working alongside the client');
  R.ok(t.d.signatory === 'Simon Archer CMIOSH CMaPS MCABE' && t.d.role === 'Managing Director, Archer Health & Safety', 'signed by the practice signatory, from branding');
  R.ok(t.d.ref === 'AHS-CPD-20260916-01' && t.pages === 4, 'and numbered - four pages drawn in all: one, the reprint, and the batch of two');
  R.ok(t.names.length === 3 && t.names[1] === t.names[0], 'printing it again gives the same certificate, the same number');
  R.ok(t.certs.length === 2 && t.certs[0] === 'AHS-CPD-20260916-01:Sophie Boyes' && t.certs[1] === 'AHS-CPD-20260916-02:Chloe Barrett', 'everyone confirmed: the second person gets the next number, the first keeps hers');
  R.ok(/^certificates-health-and-safety-essentials-/.test(t.names[2] || ''), 'one PDF for the batch');
  R.ok(/Certificate AHS-CPD-20260916-01 issued/.test(t.t1) && /Certificates for everyone confirmed \(2, 2 issued\)/.test(t.t1), 'the trail shows the number against each person, and offers the batch');
  R.ok(!/Certificate/.test(t.t2), 'a policy earns no certificate');
  R.ok(t.certInputs === 1, 'the certificate lines are editable on the CPD item, and only there');
}

await R.done(browser, errors);
