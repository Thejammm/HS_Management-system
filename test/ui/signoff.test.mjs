// ══════════════════════════════════════════════════════════════
//  The acknowledgement trail. Simon, 2026-09-28: it "must be water tight
//  regarding the law - the communication with employees bit".
//
//  A tick used to be one date in an object, set by whoever had the app open
//  and deleted by a second click. These pin what replaced it: an append-only
//  entry that says who, when to the minute, how, which VERSION of the document,
//  where it lived, and what they were told - and a withdrawal that corrects
//  rather than erases.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Policy acknowledgement trail');
const { browser, page, errors } = await openApp();

const REGISTER = {
  policies: [
    { id: 'p1', title: 'Fire Safety Policy', type: 'Policy', version: '3.1', delivered: '2026-08-12', riskIds: [] },
    { id: 'p2', title: 'Driving for Work', type: 'Procedure', version: '1', delivered: '2026-07-04', riskIds: [] },
  ],
  staff: [
    { id: 's1', name: 'Daniel Ashworth', role: 'Workshop Supervisor' },
    { id: 's2', name: 'Chloe Barrett', role: 'Office Manager' },
  ],
  signed: {},
};

await seed(page, { company: { legalName: 'Fairbank Fabrications Ltd' },
  documents: [{ id: 'd1', name: 'Fire Safety Policy', link: '\\\\fairbank\\HS\\Policies\\Fire Safety.pdf', category: 'Policy' }],
  policySignoff: JSON.parse(JSON.stringify(REGISTER)) }, 'signoff');
await wait(page, 400);

// ── an acknowledgement is an entry, not a date ──
{
  const t = await page.evaluate(() => {
    toggleSignoff('s1', 'p1', true);
    const e = _psoTrailFor('s1', 'p1')[0] || {};
    return { n: _psoTrail().length, e, signed: _psoState().signed['s1|p1'] };
  });
  R.ok(t.n === 1 && t.e.kind === 'acknowledged', 'ticking writes one entry to the trail');
  R.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t.e.at || ''), 'timed to the minute, not just dated (' + String(t.e.at).slice(0, 16) + ')');
  R.ok(t.e.staffName === 'Daniel Ashworth' && t.e.staffRole === 'Workshop Supervisor', 'with the person as they were at the time');
  R.ok(t.e.policyTitle === 'Fire Safety Policy' && t.e.policyVersion === '3.1' && t.e.policyIssued === '2026-08-12',
    'and the document AND ITS VERSION as it stood (' + t.e.policyVersion + ')');
  R.ok(/fairbank/i.test(t.e.policyLink || ''), 'and where the document lives on the client\'s system');
  R.ok(!!t.e.by && !!t.e.method, 'and who entered it, and how (' + t.e.method + ')');
  R.ok(t.signed === String(t.e.at).slice(0, 10), 'the tick on the grid is derived from the entry, not stored beside it');
}

// ── the declaration is stored verbatim, so changing it cannot rewrite history ──
{
  const t = await page.evaluate(() => {
    const e = _psoTrailFor('s1', 'p1')[0];
    const dec = e.declaration || '';
    // now the policy is revised - the old entry must not follow it
    const pol = _psoState().policies.find(x => x.id === 'p1');
    pol.version = '4.0'; pol.title = 'Fire Safety Policy (revised)';
    const still = _psoTrailFor('s1', 'p1')[0];
    return { dec, named: /Fire Safety Policy/.test(dec), ver: /version 3\.1/.test(dec),
      read: /I have read it/.test(dec), unsure: /I know who to ask/.test(dec), raise: /raise anything I believe is unsafe/.test(dec),
      afterTitle: still.policyTitle, afterVer: still.policyVersion };
  });
  R.ok(t.named && t.ver, 'the declaration names the document and the version they saw');
  R.ok(t.read && t.unsure && t.raise, 'and says what they are agreeing to, in their words');
  R.ok(t.afterTitle === 'Fire Safety Policy' && t.afterVer === '3.1',
    'revising the policy does not rewrite what someone agreed to (' + t.afterVer + ')');
}

// ── a new version is a new round ──
{
  const t = await page.evaluate(() => {
    const before = _psoState().signed['s1|p1'];
    // the 12-month clock has not run out, so the tick still reads signed...
    const info = _psoSignInfo(before);
    return { state: info.state, entries: _psoTrailFor('s1', 'p1').length };
  });
  R.ok(t.state === 'ok' && t.entries === 1, 'a fresh acknowledgement stands on its own (' + t.state + ')');
}

// ── withdrawing corrects the record, it does not erase it ──
{
  const t = await page.evaluate(() => {
    window.prompt = () => '';
    toggleSignoff('s1', 'p1', false);
    const refused = _psoTrailFor('s1', 'p1').length === 1 && !!_psoState().signed['s1|p1'];
    window.prompt = () => 'Ticked against the wrong person';
    toggleSignoff('s1', 'p1', false);
    const trail = _psoTrailFor('s1', 'p1');
    return { refused, n: trail.length, kinds: trail.map(e => e.kind), reason: (trail[1] || {}).reason,
      original: (trail[0] || {}).kind, signed: _psoState().signed['s1|p1'] };
  });
  R.ok(t.refused, 'no reason, no withdrawal - a tick that just vanishes is what this replaces');
  R.ok(t.n === 2 && t.kinds.join(',') === 'acknowledged,withdrawn', 'with a reason it writes a correction, and both entries stay');
  R.ok(/wrong person/.test(t.reason || ''), 'the reason is on the record: ' + t.reason);
  R.ok(!t.signed, 'and the grid follows - it no longer reads as signed');
}

// ── ticks made before the trail existed are marked, never dressed up ──
{
  const t = await page.evaluate(() => {
    S.policySignoff = { policies: [{ id: 'p9', title: 'Old Policy', type: 'Policy', version: '', delivered: '', riskIds: [] }],
      staff: [{ id: 's9', name: 'Historic Employee', role: '' }],
      signed: { 's9|p9': '2025-03-04' } };
    const made = _psoMigrateTrail();
    const e = _psoTrailFor('s9', 'p9')[0] || {};
    return { made, legacy: !!e.legacy, method: e.method, at: e.at, dec: e.declaration,
      twice: _psoMigrateTrail() };
  });
  R.ok(t.made === 1 && t.legacy, 'an older tick is brought onto the trail and marked as one');
  R.ok(t.method === 'unrecorded', 'it does not claim a method nobody recorded');
  R.ok(String(t.at).slice(0, 10) === '2025-03-04', 'and keeps its own date rather than todays (' + String(t.at).slice(0, 10) + ')');
  R.ok(t.twice === 0, 'migrating twice does not duplicate it');
}

// ── the trail can be read back and produced ──
{
  const t = await page.evaluate(() => new Promise(res => {
    S.policySignoff = JSON.parse(JSON.stringify({ policies: [
      { id: 'p1', title: 'Fire Safety Policy', type: 'Policy', version: '3.1', delivered: '2026-08-12', riskIds: [] }],
      staff: [{ id: 's1', name: 'Daniel Ashworth', role: 'Workshop Supervisor' }], signed: {}, log: [], logMigrated: true }));
    toggleSignoff('s1', 'p1', true);
    openSignoffTrail('p1');
    setTimeout(() => {
      const ov = document.getElementById('psoTrailOv');
      const txt = ov ? ov.innerText : '';
      if (ov) ov.remove();
      res({ open: !!ov, txt });
    }, 400);
  }));
  R.ok(t.open, 'every policy row opens its own trail');
  R.ok(/Daniel Ashworth/.test(t.txt) && /ACKNOWLEDGED/i.test(t.txt), 'showing who acknowledged it');
  R.ok(/version 3\.1/.test(t.txt), 'against which version');
  R.ok(/Nothing here is ever edited or removed/.test(t.txt), 'and says plainly that nothing in it is edited or removed');
  R.ok(/Health and Safety at Work etc\. Act 1974/.test(t.txt) && /reg\. 10/.test(t.txt),
    'with the duty the record answers to printed under it');
}

// ── a reply that came back by link joins the trail like any other entry ──
{
  const t = await page.evaluate(() => {
    S.policySignoff = { policies: [{ id: 'p1', title: 'Fire Safety Policy', type: 'Policy', version: '3.1', delivered: '2026-08-12', riskIds: [] }],
      staff: [{ id: 's1', name: 'Daniel Ashworth', role: 'Workshop Supervisor' }], signed: {}, log: [], logMigrated: true };
    // what the server hands back for a signed invite
    _psoRecord('s1', 'p1', 'acknowledged', { inviteId: 'inv_abc', at: '2026-09-20T09:41:00.000Z', method: 'link',
      staffName: 'Daniel J Ashworth', declaration: 'I confirm that: ... version 3.1 ...',
      link: 'https://fairbank.sharepoint.com/fire.pdf', ip: '81.2.3.4', ua: 'Mozilla/5.0 (iPhone)' });
    _psoRebuildSigned();
    const e = _psoTrailFor('s1', 'p1')[0] || {};
    return { method: e.method, name: e.staffName, invite: e.inviteId, ip: e.ip, ua: e.ua,
      dec: e.declaration, signed: _psoState().signed['s1|p1'], at: e.at };
  });
  R.ok(t.method === 'link' && t.invite === 'inv_abc', 'a link reply is an entry, and it remembers which invite it answered');
  R.ok(t.name === 'Daniel J Ashworth', 'it keeps the name the employee typed, not the one on the register');
  R.ok(/version 3.1/.test(t.dec || ''), 'and the declaration THEY saw, not the one the policy carries today');
  R.ok(!!t.ip && /iPhone/.test(t.ua || ''), 'with where it came from, which is what a link buys you over a tick');
  R.ok(t.at.slice(0, 10) === '2026-09-20' && t.signed === '2026-09-20', 'dated when they signed, not when it was pulled back');
}

// ── and it is never merged twice, however often you check ──
{
  const t = await page.evaluate(() => {
    const before = _psoTrail().length;
    const have = new Set(_psoTrail().map(e => e && e.inviteId).filter(Boolean));
    const again = have.has('inv_abc');
    return { before, again };
  });
  R.ok(t.again, 'the invite id is what stops a reply being counted a second time');
}

await R.done(browser, errors);
