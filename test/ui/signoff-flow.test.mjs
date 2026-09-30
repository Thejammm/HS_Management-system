// ══════════════════════════════════════════════════════════════
//  The sign-off tab, in the order the job goes. Simon, 2026-09-30: "the CPD
//  etc sign things are too complex - here is the flow: i open the sign off
//  tab and should see a list of all my policies that have to be signed off,
//  a list of employees, a matrix tracker, i then need to be able to easily
//  issue the policy, TBT or CPD with its location or material storage place
//  to the link i send the employee > they receive it and sign it off, it then
//  follows the current structure tracking".
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Sign-off flow - list, employees, tracker, Issue');
const { browser, page, errors } = await openApp();

await seed(page, { company: { legalName: 'Easy Travel Service' },
  documents: [{ id: 'd1', name: 'Health and Safety Policy v4.pdf', link: 'https://easytravel.sharepoint.com/hs-policy-v4.pdf' },
              { id: 'd2', name: 'Driving for Work Policy', link: 'https://easytravel.sharepoint.com/driving.pdf' }],
  policySignoff: { policies: [
      { id: 'p1', title: 'Health and Safety Policy', type: 'Policy', version: '4', delivered: '2026-09-01', riskIds: [] },
      { id: 'p2', title: 'Slips, trips and falls on the level', type: 'Toolbox talk', delivered: '2026-09-20', riskIds: [], content: '1. Spot it, stop it, clean it.', source: { kind: 'talk', id: 'tbt-slips' } } ],
    staff: [{ id: 's1', name: 'Mick Kane', role: 'Workshop Supervisor' }, { id: 's2', name: 'Priya Nair', role: 'Fitter' }, { id: 's3', name: 'Chloe Barrett', role: 'Office' }],
    signed: {}, log: [], logMigrated: true } }, 'signoff');
await page.evaluate(() => { Auth.isSignedIn = () => true; Auth.activeTenantId = () => 'et'; window._psoApi = async () => ({ ok: true, data: { invites: [] } });
  _psoRecord('s1', 'p1', 'acknowledged', { method: 'link' }); _psoRebuildSigned(); renderPolicySignoff(); });
await wait(page, 300);

// ── the tab reads as the three things, in order ──
{
  const t = await page.evaluate(() => {
    const cont = document.getElementById('signoffContainer');
    const heads = [...cont.querySelectorAll('.card-band h3')].map(h => h.textContent.replace(/●/g, '').trim());
    const consult = document.querySelector('#riskDocControl > details.psl-consult');
    const rows = [...cont.querySelectorAll('.psl-row')].map(r => ({
      title: r.querySelector('.psl-title').textContent, meta: r.querySelector('.psl-meta').textContent,
      where: r.querySelector('.psl-loc').value, covers: (r.querySelector('.psl-covers') || {}).textContent || '',
      signed: r.querySelector('.psl-signed').textContent, issue: [...r.querySelectorAll('button')].some(b => /^Issue$/.test(b.textContent.trim()) && !b.disabled),
      more: !!r.querySelector('.psl-more') }));
    return { heads, consultClosed: !!(consult && !consult.open), rows, hero: document.querySelector('#tab-signoff .rep-hero p').textContent,
      tracker: cont.innerText.replace(/\s+/g, ' ') };
  });
  R.ok(t.heads.join(' | ') === 'What needs signing | Employees | Who has signed', 'three cards, in the order the job goes: ' + t.heads.join(' | '));
  R.ok(t.consultClosed, 'the consultation record is folded away underneath - it feeds the reports, it is not part of issuing');
  R.ok(!/acknowledgement sheets/.test(t.hero) && /press Issue/i.test(t.hero), 'the heading no longer mentions the sheets that went');
  const p1 = t.rows[0] || {}, p2 = t.rows[1] || {};
  R.ok(p1.title === 'Health and Safety Policy' && /Policy · v4 · issued 1 Sept 2026/.test(p1.meta), 'each line says what it is: ' + p1.title + ' - ' + p1.meta);
  R.ok(p1.where === 'https://easytravel.sharepoint.com/hs-policy-v4.pdf', 'and where it lives, found on the Documents register without typing it');
  R.ok(/Talk points attached/.test(p2.covers), 'a toolbox talk says its points go with the link');
  R.ok(p1.signed === '1 of 3' && p2.signed === '0 of 3', 'who has signed, on the line (' + p1.signed + ', ' + p2.signed + ')');
  R.ok(p1.issue && p2.issue, 'and one clear Issue button on every line');
  R.ok(!p1.more && !p2.more, 'the rest - version, dates, risks, trail, remove - is behind More, not in the way');
  R.ok(/1 of 6 signed/.test(t.tracker) && /Check for replies/.test(t.tracker), 'the tracker leads with the count and Check for replies');
}

// ── Issue: where it lives, what it covers, who to ask ──
{
  const t = await page.evaluate(() => {
    const row = document.getElementById('psl-p2');
    [...row.querySelectorAll('button')].find(b => /^Issue$/.test(b.textContent.trim())).click();
    const ov = document.getElementById('psoSendOv');
    const out = { open: !!ov, title: ov && ov.querySelector('div[style*="font-weight:800"]').textContent,
      covers: ov && /What it covers/i.test(ov.innerText) && /Spot it, stop it/.test(ov.innerText),
      ticked: ov ? [...ov.querySelectorAll('input[data-staff]')].filter(x => x.checked).length : 0 };
    if (ov) ov.remove();
    // the location typed on the line is the one the send screen uses
    const loc = document.querySelector('#psl-p1 .psl-loc'); loc.value = 'S:\\H&S\\Policies\\HS Policy v4.pdf'; loc.dispatchEvent(new Event('input'));
    [...document.getElementById('psl-p1').querySelectorAll('button')].find(b => /^Issue$/.test(b.textContent.trim())).click();
    const ov1 = document.getElementById('psoSendOv');
    out.sendLink = ov1 && document.getElementById('psoLink').value;
    out.ticked1 = ov1 ? [...ov1.querySelectorAll('input[data-staff]')].filter(x => x.checked).map(x => x.getAttribute('data-staff')).join(',') : '';
    if (ov1) ov1.remove();
    out.saved = _psoState().policies.find(x => x.id === 'p1').link;
    return out;
  });
  R.ok(t.open && t.title === 'Issue for sign-off', 'Issue opens the send screen, called Issue for sign-off');
  R.ok(t.covers, 'and shows what the talk covers - what goes with each link');
  R.ok(t.ticked === 3, 'with everyone who has not signed ticked (' + t.ticked + ')');
  R.ok(t.saved === 'S:\\H&S\\Policies\\HS Policy v4.pdf' && t.sendLink === t.saved, 'a location typed on the line is remembered and is the one the link carries');
  R.ok(t.ticked1 === 's2,s3', 'and anyone who has already signed is not asked again (' + t.ticked1 + ')');
}

// ── Add: the type first, then a title Compass already knows ──
{
  const t = await page.evaluate(async () => {
    const out = {};
    psoAddOpen();
    await new Promise(r => setTimeout(r, 30));   // the cursor goes into the title a moment after the line opens
    const bar = document.querySelector('.psl-add');
    out.bar = !!bar; out.focus = document.activeElement && document.activeElement.id;
    // a toolbox talk, picked from the library
    psoAddDraft('type', 'Toolbox talk');
    out.talkOptions = document.querySelectorAll('#psoAddList option').length;
    const talkTitle = _tbtAllTalks()[0].title;
    const ti = document.getElementById('psoAddTitle'); ti.value = talkTitle; ti.dispatchEvent(new Event('input')); ti.dispatchEvent(new Event('change'));
    psoAddSave();
    const talk = _psoState().policies.find(x => x.title === talkTitle) || {};
    out.talk = { type: talk.type, hasContent: !!talk.content, src: talk.source && talk.source.kind, delivered: !!talk.delivered };
    out.talkRow = !!document.getElementById('psl-' + talk.id) && /Talk points attached/.test(document.getElementById('psl-' + talk.id).innerText);
    // a policy, picked from the Documents register - its location comes with it
    psoAddOpen();
    const ti2 = document.getElementById('psoAddTitle'); ti2.value = 'Driving for Work Policy'; ti2.dispatchEvent(new Event('input')); ti2.dispatchEvent(new Event('change'));
    out.prefilled = document.getElementById('psoAddLink').value;
    psoAddSave();
    const pol = _psoState().policies.find(x => x.title === 'Driving for Work Policy') || {};
    out.polLink = pol.link;
    // no title, no item
    psoAddOpen(); const before = _psoState().policies.length; psoAddSave(); out.blank = _psoState().policies.length === before; psoAddCancel();
    out.closed = !document.querySelector('.psl-add');
    return out;
  });
  R.ok(t.bar && t.focus === 'psoAddTitle', 'Add opens one line at the foot of the list, ready to type');
  R.ok(t.talkOptions > 10, 'choosing Toolbox talk offers the talk library (' + t.talkOptions + ' talks)');
  R.ok(t.talk.type === 'Toolbox talk' && t.talk.hasContent && t.talk.src === 'talk' && t.talk.delivered && t.talkRow, 'a talk picked from it arrives with its points, ready to issue');
  R.ok(t.prefilled === 'https://easytravel.sharepoint.com/driving.pdf' && t.polLink === t.prefilled, 'a policy picked from the Documents register brings where it lives with it');
  R.ok(t.blank && t.closed, 'no title, nothing added; Cancel closes it');
}

// ── More: everything else, on the line it belongs to ──
{
  const t = await page.evaluate(() => {
    psoToggleMore('p1');
    const row = document.getElementById('psl-p1');
    const out = { open: !!row.querySelector('.psl-more'), fields: [...row.querySelectorAll('.psl-edit label')].map(l => l.firstChild.textContent.trim()).join('|'),
      trail: /Trail \(1\)/.test(row.innerText), remove: /Remove/.test(row.innerText) };
    const title = row.querySelector('.psl-edit input'); title.value = 'Health and Safety Policy Statement'; title.dispatchEvent(new Event('input')); title.dispatchEvent(new Event('change'));
    out.renamed = document.querySelector('#psl-p1 .psl-title').textContent;
    psoToggleMore('p1'); out.closed = !document.querySelector('#psl-p1 .psl-more');
    return out;
  });
  R.ok(t.open && t.fields === 'Title|Type|Version|Issued' && t.trail && t.remove, 'More opens the title, type, version and date, the trail and Remove on that line');
  R.ok(t.renamed === 'Health and Safety Policy Statement', 'an edit there shows on the line straight away');
  R.ok(t.closed, 'and Less folds it away again');
}

// ── signed out: nothing to send links with, and it says so ──
{
  const t = await page.evaluate(() => {
    Auth.isSignedIn = () => false; renderPolicySignoff();
    const b = [...document.querySelectorAll('#psl-p1 button')].find(x => /^Issue$/.test(x.textContent.trim()));
    const out = { disabled: !!(b && b.disabled), why: b && b.title, matrix: !!document.querySelector('#signoffContainer table input[type=checkbox]') };
    Auth.isSignedIn = () => true; renderPolicySignoff();
    return out;
  });
  R.ok(t.disabled && /Sign in to make links/.test(t.why) && t.matrix, 'signed out, Issue is greyed with the reason, and the tracker still takes ticks given in person');
}

await R.done(browser, errors);
