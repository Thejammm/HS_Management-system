// ══════════════════════════════════════════════════════════════
//  Controls to actions, and more than one owner (Simon, 2026-10-07):
//  tab 4 groups the actions under the high level control each puts in
//  place, a new action starts from the control's own words, and a row can
//  carry several owners - still one owner string everywhere it is read.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Controls to actions, and more than one owner');
const { browser, page, errors } = await openApp();

const RISK = {
  id: 'k1', activity: 'Surveys on or in pre-2000 buildings', hazard: 'Asbestos', likelihood: '4', severity: '5',
  actions: [
    { id: 'c1', desc: 'Asbestos register checked before every survey', owner: 'James Boyes', due: '2026-12-01', status: 'Not started', hideFromPlan: true },
    { id: 'c2', desc: 'Asbestos awareness training for all surveyors', owner: '', due: '', status: 'Not started', hideFromPlan: true },
    { id: 'p1', desc: 'Pre-construction information procedure to establish ACM', owner: 'James Boyes', due: '2026-11-03', status: 'Not started', priority: 'Critical', forCtl: 'c1' },
    { id: 'p2', desc: 'Prioritise register discipline across all sites', owner: '', due: '', status: 'Not started', priority: 'High' },
    { id: 'p3', desc: 'Ask the landlord for the R&D survey', owner: 'Sam Line', due: '2026-11-10', status: 'Complete', forCtl: 'c1' },
  ],
};
await seed(page, { riskProfile: [RISK], company: { legalName: 'Fineline Architects Ltd', slt: [{ name: 'Jo Fine', role: 'Managing Director' }] } }, 'risk');
await page.evaluate(() => { _riskOpenModal('k1'); _riskDetailTab('actions'); });
await wait(page, 450);

const tab4 = () => page.evaluate(() => {
  const t = document.querySelector('#rpBody table.act-table:not(.act-ctl)');
  const rows = [...t.querySelectorAll('tbody tr')].map(tr => tr.classList.contains('act-grp') ? ('H:' + [...tr.querySelectorAll('.act-grp-h > span')].map(s => s.textContent.trim()).join(' '))
    : tr.classList.contains('act-grp-add') ? ('+:' + tr.textContent.replace(/\s+/g, ' ').trim())
    : ('A:' + ((tr.querySelector('textarea') || {}).value || '')));
  return rows;
});

// ── tab 4 is grouped under the controls ──
{
  const rows = await tab4();
  const at = re => rows.findIndex(x => re.test(x));
  const h1 = at(/^H:Control 1 Asbestos register/), h2 = at(/^H:Control 2 Asbestos awareness/), none = at(/^H:Not linked/);
  R.ok(h1 === 0 && h2 > h1 && none > h2, 'tab 4 lists each control as a heading, in the control table’s order, then what is not linked (' + rows.map(x => x.slice(0, 22)).join(' | ') + ')');
  R.ok(at(/^A:Pre-construction/) > h1 && at(/^A:Pre-construction/) < h2 && at(/^A:Ask the landlord/) < h2, 'the actions linked to control 1 sit under it');
  R.ok(at(/^A:Prioritise register/) > none, 'an action with no control sits under Not linked');
  R.ok(/James Boyes/.test(rows[h1]) && /1 of 2 done/.test(rows[h1]), 'the control heading shows its owner and how many of its actions are done');
  R.ok(/Nothing puts this control in place yet/.test(rows[at(/^\+:.*control 2/i)] || ''), 'a control with no action says so');
  const noCtlRow = await page.evaluate(() => [...document.querySelectorAll('#rpBody table.act-table:not(.act-ctl) textarea')].some(t => /Asbestos awareness training/.test(t.value)));
  R.ok(!noCtlRow, 'the control rows themselves are never plan rows');
}

// ── a new action for a control starts from the control's words, linked ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const btn = [...document.querySelectorAll('#rpBody tr.act-grp-add button')].find(b => /control 2/i.test(b.textContent));
    btn.click();
    setTimeout(() => {
      const r = S.riskProfile.find(x => x.id === 'k1');
      const a = r.actions[r.actions.length - 1];
      const ta = document.getElementById('actd-k1-' + a.id);
      res({ desc: a.desc, forCtl: a.forCtl, plan: !a.hideFromPlan, focused: document.activeElement === ta,
        selected: ta ? (ta.selectionStart === 0 && ta.selectionEnd === ta.value.length && ta.value.length > 0) : false,
        onPlan: _execActions().some(x => x.desc === a.desc), id: a.id });
    }, 300);
  }));
  R.ok(t.desc === 'Asbestos awareness training for all surveyors' && t.forCtl === 'c2' && t.plan, 'the new action is worded from the control and linked to it');
  R.ok(t.focused && t.selected, 'its words come up selected, so typing replaces them');
  R.ok(t.onPlan, 'and it is on the execution plan like any other action');
  const rows = await tab4();
  const h2 = rows.findIndex(x => /^H:Control 2/.test(x));
  R.ok(rows[h2 + 1] === 'A:Asbestos awareness training for all surveyors', 'it shows under its control');
}

// ── moving an action between controls, and the move buttons stay in the group ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const sel = document.querySelector('#actd-k1-p2').parentElement.querySelector('.act-for select');
    const opts = [...sel.options].map(o => o.textContent);
    sel.value = 'c1'; sel.dispatchEvent(new Event('change'));
    setTimeout(() => {
      const r = S.riskProfile.find(x => x.id === 'k1');
      const before = r.actions.filter(a => !a.hideFromPlan && a.forCtl === 'c1').map(a => a.id);
      _riskActionMove('k1', 'p2', -1, 'plan');
      const after = r.actions.filter(a => !a.hideFromPlan && a.forCtl === 'c1').map(a => a.id);
      // control 2's only action is last in the list: up has nowhere to go inside its own control
      const n1 = r.actions.find(a => !a.hideFromPlan && a.forCtl === 'c2');
      const at = r.actions.indexOf(n1); _riskActionMove('k1', n1.id, -1, 'plan');
      res({ opts, linked: r.actions.find(a => a.id === 'p2').forCtl, before, after, stayed: r.actions.indexOf(n1) === at });
    }, 300);
  }));
  R.ok(t.opts[0] === '- not linked -' && /^1 · Asbestos register/.test(t.opts[1]) && /^2 · Asbestos awareness/.test(t.opts[2]), 'each action offers the controls by number and words');
  R.ok(t.linked === 'c1', 'choosing a control links the action to it');
  R.ok(t.before.join() === 'p1,p2,p3' && t.after.join() === 'p2,p1,p3', 'moving an action up reorders it within its control (' + t.after.join() + ')');
  R.ok(t.stayed, 'and never past another control’s actions');
  const rows = await tab4();
  R.ok(!rows.some(x => /^H:Not linked/.test(x)), 'with every action linked, the Not linked heading goes');
}

// ── more than one owner ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const inp = document.querySelector('#own-k1-p1 input');
    inp.focus(); inp.value = 'Sam Line';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    setTimeout(() => {
      const r = S.riskProfile.find(x => x.id === 'k1'), a = r.actions.find(x => x.id === 'p1');
      const chips = [...document.querySelectorAll('#own-k1-p1 .own-chip')].map(c => c.firstChild.textContent);
      const refocused = document.activeElement === document.querySelector('#own-k1-p1 input');
      const i2 = document.querySelector('#own-k1-p1 input'); i2.value = 'sam line'; i2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      setTimeout(() => {
        const dup = a.owner;
        const i3 = document.querySelector('#own-k1-p1 input'); i3.value = 'Jo Fine'; i3.dispatchEvent(new Event('input'));
        setTimeout(() => {
          const three = a.owner;
          const people = [...document.querySelectorAll('#ownPeople option')].map(o => o.value);
          document.querySelectorAll('#own-k1-p1 .own-chip button')[0].click();
          setTimeout(() => res({ first: a.owner === three ? '' : a.owner, chips, refocused, dup, three, people, after: a.owner }), 200);
        }, 200);
      }, 200);
    }, 200);
  }));
  R.ok(t.chips.join() === 'James Boyes,Sam Line', 'a second owner goes on as a chip beside the first');
  R.ok(t.refocused, 'the box stays ready for another name');
  R.ok(t.dup === 'James Boyes, Sam Line', 'the same name twice is not added twice');
  R.ok(t.three === 'James Boyes, Sam Line, Jo Fine', 'picking a name from the list adds it straight away - one owner string, names comma separated');
  R.ok(t.people.includes('Jo Fine') && t.people.includes('Sam Line'), 'the list offers the leadership team and the owners already named');
  R.ok(t.after === 'Sam Line, Jo Fine', '× takes one name off and leaves the rest');
}

// ── what reads the owner: the plan's person filter and the plan itself ──
{
  const t = await page.evaluate(() => {
    const owners = _epOwners();
    const f = { owner: 'Jo Fine', from: '', to: '' };
    const jo = _execActions().filter(a => _epFilterMatch(a, f)).map(a => a.desc);
    const sam = _execActions().filter(a => _epFilterMatch(a, { owner: 'Sam Line', from: '', to: '' })).map(a => a.desc);
    const ep = _execActions().find(a => /Pre-construction/.test(a.desc));
    return { owners, jo, sam, epOwner: ep && ep.owner };
  });
  R.ok(t.owners.includes('Jo Fine') && t.owners.includes('Sam Line') && !t.owners.some(o => /,/.test(o)), 'the plan’s person filter lists each person once, never "A, B" (' + t.owners.join(' / ') + ')');
  R.ok(t.jo.some(d => /Pre-construction/.test(d)) && t.sam.some(d => /Pre-construction/.test(d)), 'a shared action is found under each of its owners');
  R.ok(t.epOwner === 'Sam Line, Jo Fine', 'the execution plan carries both names');
}

// ── tab 3: each control says what puts it in place, and starts an action ──
await page.evaluate(() => _riskDetailTab('rating'));
await wait(page, 450);
{
  const t = await page.evaluate(() => new Promise(res => {
    const lines = [...document.querySelectorAll('#rpBody table.act-ctl .act-link')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    const ownersCtl = !!document.querySelector('#rpBody table.act-ctl #own-k1-c1 .own-chip');
    const btn = document.querySelectorAll('#rpBody table.act-ctl .act-link-add')[1];
    btn.click();
    setTimeout(() => {
      const r = S.riskProfile.find(x => x.id === 'k1');
      const a = r.actions[r.actions.length - 1];
      res({ lines, ownersCtl, tab: _riskSelTab, linked: a.forCtl, focused: document.activeElement && document.activeElement.id === 'actd-k1-' + a.id });
    }, 300);
  }));
  R.ok(/^3 actions on 4 · 1 done/.test(t.lines[0]) && /^1 action on 4 · 0 done/.test(t.lines[1]), 'each control on tab 3 says how many actions put it in place (' + t.lines.join(' | ') + ')');
  R.ok(t.ownersCtl, 'the control rows take several owners too');
  R.ok(t.tab === 'actions' && t.linked === 'c2' && t.focused, '＋ Action on a control opens tab 4 on a new linked action, ready to type');
}

// ── a deleted control lets its actions fall back to Not linked ──
{
  const t = await page.evaluate(() => new Promise(res => {
    deleteRiskAction('k1', 'c2');
    setTimeout(() => {
      const rows = [...document.querySelectorAll('#rpBody table.act-table:not(.act-ctl) tbody tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim());
      res({ none: rows.some(x => /^Not linked to a control/.test(x)), noCtl2: !rows.some(x => /^Control 2/.test(x)) });
    }, 300);
  }));
  R.ok(t.none && t.noCtl2, 'deleting a control drops its heading and its actions show under Not linked - nothing is lost');
}

// ── read only: names as text, no boxes, no buttons ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const was = window._roLocked; window._roLocked = () => true; renderRiskProfile();
    setTimeout(() => {
      const body = document.getElementById('rpBody');
      const r = { inputs: body.querySelectorAll('.own-cell input').length, chips: body.querySelectorAll('.own-ro .own-chip').length,
        adds: body.querySelectorAll('tr.act-grp-add').length };
      window._roLocked = was; renderRiskProfile(); res(r);
    }, 300);
  }));
  R.ok(t.inputs === 0 && t.chips > 0 && t.adds === 0, 'read only shows the owners as names, with nothing to add or remove');
}

await page.evaluate(() => _riskCloseModal());
await R.done(browser, errors);
