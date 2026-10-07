// ══════════════════════════════════════════════════════════════
//  Triage - what is said at a client meeting may be trivial or off the
//  record, so the minute taker has no Done: Triage files the minutes in
//  Tools › Triage (consultant only), off the plan and off the client's
//  record, until Simon deletes them. Simon, 2026-10-07.
//  Run: node test/ui/triage.test.mjs
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Triage - minutes held off the plan until deleted');
const { browser, page, errors } = await openApp();
await seed(page, { company: { tradingName: 'Fairbank Fabrications Ltd', slt: [{ name: 'Jo Fine', role: 'Managing Director', email: 'jo@fairbank.example' }] } }, 'cockpit');
await wait(page, 400);

{
  const t = await page.evaluate(() => {
    openQuickMinutes();
    const names = [...document.querySelectorAll('#qmOv .qm-foot button')].map(b => b.textContent.trim());
    const m = _qmCurrent(); qmSet('note', 'Talked about the racking.\nOff the record: the yard lease.');
    _qmNewAction(m, { decision: 'Racking inspection', owner: 'Simon Archer', due: '2026-11-01' });
    _qmNewAction(m, { decision: 'Forklift - competent employees' });
    _qmNewAction(m, {});                                    // an empty line goes
    const ap0 = _apList().length, d0 = _decisions().length;
    document.getElementById('qmTriageBtn').click();
    return { names, id: m.id, status: m.status, at: !!m.triagedAt, acts: (m.triageActions || []).map(a => a.decision + '|' + a.owner + '|' + a.due),
      decs: _decisions().filter(d => d.meetingId === m.id).length, d0, dn: _decisions().length, plan: _apList().length - ap0,
      gone: !document.getElementById('qmOv'), current: !!_qmCurrent(), notes: _clientNoteMeetings().some(x => x.id === m.id) };
  });
  R.ok(t.names[0] === 'Triage' && !t.names.some(n => /^Done|keep for later/i.test(n)), 'the footer leads with Triage; no Done and no Close - keep for later: ' + t.names.join(' / '));
  R.ok(t.status === 'triage' && t.at && t.gone && !t.current, 'Triage files the minutes and closes the minute taker; the next Minutes starts afresh');
  R.ok(t.acts.join(';') === 'Racking inspection|Simon Archer|2026-11-01;Forklift - competent employees||', 'the actions written are kept on the meeting, in order, empty ones dropped: ' + t.acts.join(';'));
  R.ok(t.decs === 0 && t.plan === 0, 'nothing goes on the decisions register or the plan');
  R.ok(!t.notes, 'and triaged minutes are not client meeting notes, so no client report or sheet prints them');
}
{
  const t = await page.evaluate(() => {
    switchTab('triage');
    const panel = document.getElementById('tab-triage');
    const btn = document.querySelector('.tab-btn[data-tab="triage"]');
    const inTools = !!btn && !!btn.closest('.nav-phase-tools');
    return { active: panel.classList.contains('active'), inTools, consultantOnly: btn.hasAttribute('data-consultant'), text: panel.innerText };
  });
  R.ok(t.active && t.inTools && t.consultantOnly, 'Triage sits in Tools and is consultant only');
  R.ok(/Racking inspection/.test(t.text) && /Off the record: the yard lease/.test(t.text) && /Jo Fine/.test(t.text) && /not named/.test(t.text), 'the Triage tab shows the meeting: who was there, the notes and the actions');
}
{
  const t = await page.evaluate(() => {
    openQuickMinutes(); qmTriage();                         // nothing written
    const empty = S.meetings.filter(m => m && m.quick && m.status === 'triage').length;
    const keep = window.confirm; window.confirm = () => true;
    const id = _triageMeetings()[0].id; triageDelete(id);
    window.confirm = keep;
    return { empty, left: _triageMeetings().length, gone: !S.meetings.some(m => m.id === id), text: document.getElementById('triageList').innerText };
  });
  R.ok(t.empty === 1, 'Triage on empty minutes files nothing');
  R.ok(t.left === 0 && t.gone && /Nothing in Triage/.test(t.text), 'Delete takes the minutes out for good');
}
await R.done(browser, errors);
