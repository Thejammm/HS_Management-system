// ══════════════════════════════════════════════════════════════
//  The loop, Stage A (Simon, 5 November 2026), in the order it is used: an
//  issue captured in one line -> on the register to be assessed -> a meeting
//  action made an issue from Triage -> a scored risk opens on its overview,
//  one list of what we're doing, nothing lost or doubled against the back
//  office -> owner, date, a new row -> Done and "Where does this live now?"
//  -> the last item closes and "Is this issue now under control?" -> Yes
//  signs it off; Not yet logs why -> it all survives a reload -> read only.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('The loop, Stage A - issue in, managed, controlled');
const { browser, page, errors } = await openApp();

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const today = day(0);
// a risk shaped like a real one: standing arrangements (tab 3) with actions under them (tab 4), one loose, one already done
const risks = () => [
  { id: 'r1', activity: 'Falls from roofs during surveys', hazard: 'Unprotected roof edges', harm: 'Fatal injury', likelihood: '5', severity: '5', targetL: '2', targetS: '3', personsAtRisk: ['Surveyors'], actions: [
    { id: 'c1', desc: 'Safe access arrangements for every roof inspection', owner: 'Old Owner', due: day(-1), status: 'Not started', hideFromPlan: true },
    { id: 'c2', desc: 'A rescue plan for roof work', owner: 'Old Owner', due: day(-1), status: 'Not started', hideFromPlan: true },
    { id: 'c3', desc: 'Roof access register kept up to date', owner: '', due: '', status: 'Complete', completedDate: day(-20), hideFromPlan: true },
    { id: 'c4', desc: 'Permit to work for roof access', owner: '', due: '', status: 'Not started', hideFromPlan: true },
    { id: 'a1', desc: 'Fit edge protection to the loading bay', owner: 'Ben Cole', due: day(10), status: 'Not started', priority: 'High', forCtl: 'c1' },
    { id: 'a2', desc: 'Buy a second harness kit', owner: 'Ben Cole', due: day(20), status: 'In progress', priority: 'High', forCtl: 'c1' },
    { id: 'a3', desc: 'Write the roof rescue plan', owner: '', due: '', status: 'Not started', priority: 'High', forCtl: 'c2' },
    { id: 'a4', desc: 'Brief the survey team', owner: 'Cara Hill', due: day(30), status: 'Not started', priority: 'High' },
    { id: 'a5', desc: 'Order the harness inspection tags', owner: 'Ben Cole', due: day(-30), status: 'Complete', completedDate: day(-25), priority: 'Medium', embed: { at: day(-25), by: 'Simon', doc: { name: 'Harness inspection procedure' } } },
    { id: 'a6', desc: 'A deleted one', owner: '', due: '', status: 'Not started', deleted: true }] },
  { id: 'r2', activity: 'Fire at the office', hazard: 'Ignition sources', likelihood: '3', severity: '5', targetL: '2', targetS: '5', actions: [
    { id: 'b1', desc: 'Update the fire risk assessment', owner: 'Ann Reed', due: day(9), status: 'Not started', priority: 'High' }] },
  { id: 'r3', activity: 'Not yet scored, the old way', actions: [] },
];
const risk = id => page.evaluate(id => JSON.parse(JSON.stringify(S.riskProfile.find(r => r.id === id))), id);
const act = (rid, aid) => page.evaluate((rid, aid) => JSON.parse(JSON.stringify(S.riskProfile.find(r => r.id === rid).actions.find(a => a.id === aid))), rid, aid);
const toast = () => page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
const change = (sel, v) => page.evaluate((sel, v) => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const tick = (aid, on) => page.evaluate((aid, on) => { const e = document.getElementById('rst-' + aid); if (!e) throw new Error('no tick ' + aid); e.checked = on; e.dispatchEvent(new Event('change', { bubbles: true })); }, aid, on);
const answer = async (k, boxes, how) => {
  await page.evaluate((k, boxes, how) => {
    document.getElementById('t5StickHow').value = how || '';
    const r = document.querySelector('#evidOverlay input[name="t5Stick"][value="' + k + '"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true }));
    Object.keys(boxes || {}).forEach(id => { document.getElementById(id).value = boxes[id]; });
    t5StickSave();
  }, k, boxes, how);
  await wait(page, 60);
};
// the overview's own words: the body and its bar (the modal's header is the back office's, shared by every tab)
const modalWords = () => page.evaluate(() => { const o = document.getElementById('riskModalOverlay'); if (!o) return ''; const c = document.createElement('div'); c.innerHTML = (o.querySelector('.rs-bar') || {}).outerHTML || ''; c.innerHTML += (o.querySelector('#rpBody') || {}).outerHTML || '';
  c.querySelectorAll('textarea,.t5-desc,.t5-haz li,.rs-placed b,.rp-name,.own-chip,option').forEach(e => { e.textContent = ''; if (e.value !== undefined) e.value = ''; });
  const attr = [...c.querySelectorAll('[placeholder],[title],[aria-label]')].map(e => (e.getAttribute('placeholder') || '') + ' ' + (e.getAttribute('title') || '') + ' ' + (e.getAttribute('aria-label') || ''));
  return (c.textContent + ' ' + attr.join(' ')).replace(/under control/gi, ''); });      // "under control" is the spec's own phrase
const noRed = sel => page.evaluate(sel => { const rgb = c => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : null; }; const redish = c => { const x = rgb(c); return !!x && x[0] > 150 && x[1] < 110 && x[2] < 110; };
  return [...document.querySelectorAll(sel + ' *')].filter(e => { const s = getComputedStyle(e); return redish(s.color) || redish(s.backgroundColor) || redish(s.borderTopColor); }).map(e => e.className || e.tagName).slice(0, 5); }, sel);

await seed(page, { riskProfile: risks(), company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] }, documents: [{ id: 'd1', name: 'Health & Safety Policy', category: 'Policy', version: '', owner: '', reviewDate: '', link: '' }],
  meetings: [{ id: 'mtg_tri1', quick: true, status: 'triage', date: day(-2), attendees: [], note: 'Walkabout', triageActions: [{ decision: 'Loose paving by the fire exit', owner: 'Dan West', due: day(14) }, { decision: 'Kettle lead frayed', owner: '', due: '' }] }] }, 'cockpit');
await page.evaluate(() => { delete S.actionSheets; });
// the back office's own record of r1, before anything is touched
const before = await page.evaluate(() => ({ actions: JSON.stringify(S.riskProfile.find(r => r.id === 'r1').actions), ctl: _riskActionsHTML(S.riskProfile.find(r => r.id === 'r1'), '', 'ctl'), plan: _riskActionsHTML(S.riskProfile.find(r => r.id === 'r1'), '', 'plan') }));

// ── A1: quick add from the front door, the first line only ──
{
  const t = await page.evaluate(() => { const b = document.getElementById('qaBtn'); const shown = !!b && getComputedStyle(b).display !== 'none' && !!b.closest('.nav-grp-front'); b.click(); return { shown, label: b.innerText, panel: !!document.getElementById('qaOv'), fields: ['qaWhat', 'qaWho', 'qaLevel'].map(id => !!document.getElementById(id)) }; });
  R.ok(t.shown && /Add an issue/.test(t.label), 'a button in the Front door group, under the live Top 5 (Stage C moved both there): "' + t.label + '"');
  R.ok(t.panel && t.fields.every(Boolean), 'it opens a small panel with the three fields');
  await page.evaluate(() => quickAddSave());
  R.ok(/Say what the issue is/.test(await toast()) && await page.evaluate(() => !!document.getElementById('qaOv')), 'the one line is required');
  await page.type('#qaWhat', 'Trailing cables across the studio floor');
  await page.keyboard.press('Enter');
  await wait(page, 100);
  const q = await page.evaluate(() => { const r = S.riskProfile.find(x => x.quick); return r ? { ref: r.ref, activity: r.activity, quick: r.quick, score: _riskScore(r).rating, keys: Object.keys(r).sort().join(), modal: !!document.getElementById('riskModalOverlay'), panel: !!document.getElementById('qaOv'), tab: document.querySelector('.tab-btn.active').getAttribute('data-tab') } : null; });
  R.ok(q && q.activity === 'Trailing cables across the studio floor' && /^[A-Z]-\d{3}$/.test(q.ref), 'Enter adds it: on the register with a reference (' + (q && q.ref) + ')');
  R.ok(q && q.quick.raisedAt === today && q.quick.raisedBy === '' && q.quick.roughLevel === '' && !q.score, 'quick: raised today, nothing else assumed, no score');
  R.ok(q && !q.modal && !q.panel && q.tab === 'cockpit', 'nothing opens: the panel closes and you stay where you were');
  R.ok(/Added to the register: to be assessed/.test(await toast()), 'the toast says so');
  const shape = await page.evaluate(() => { const a = Object.keys(_riskNewEntry()).sort(), b = Object.keys(S.riskProfile.find(x => x.quick)).filter(k => !['quick', 'createdAt', 'createdBy', 'createdById', 'ref', 'refNo'].includes(k)).sort(); return a.join() === b.join(); });
  R.ok(shape, 'the same shape as Add risk, plus the quick note and its reference');
  // with who and how bad
  await page.evaluate(() => { quickAddIssue(); document.getElementById('qaWhat').value = 'No first aider on the late shift'; document.getElementById('qaWho').value = 'Ann Reed'; document.getElementById('qaLevel').value = 'High'; quickAddSave(); });
  const q2 = await page.evaluate(() => { const r = S.riskProfile.filter(x => x.quick).pop(); return { who: r.quick.raisedBy, level: r.quick.roughLevel }; });
  R.ok(q2.who === 'Ann Reed' && q2.level === 'High', 'who raised it and how bad it looks are kept');
}
// ── the register: marked, at the top, opens on Identify ──
{
  await page.evaluate(() => { switchTab('risk'); const sec = document.getElementById('wfRegister'); if (sec) sec.open = true; _macroExpandAll(true); renderRiskProfile(); });
  await wait(page, 300);
  const t = await page.evaluate(() => { const rows = _riskVisibleRows().map(r => r.id); const tb = document.getElementById('rpTbody').innerText; const strip = (document.querySelector('.rs-strip') || {}).innerText || '';
    return { first2: rows.slice(0, 2).every(id => S.riskProfile.find(r => r.id === id).quick), marks: (tb.match(/To be assessed/gi) || []).length, strip, addBtn: getComputedStyle(document.getElementById('addIssueBtn')).display !== 'none' }; });
  R.ok(t.first2, 'the two issues sort to the top of the register');
  R.ok(t.marks === 2, 'each row carries "To be assessed" (' + t.marks + ')');
  R.ok(/To be assessed \(2\)/.test(t.strip) && /Trailing cables/.test(t.strip) && /raised by Ann Reed/.test(t.strip), 'and a strip at the top names them: ' + t.strip.slice(0, 80));
  R.ok(t.addBtn, 'the Risk profile has its own Add an issue button');
  await page.evaluate(() => { const r = S.riskProfile.find(x => x.quick); _riskOpenModal(r.id); });
  await wait(page, 200);
  const o = await page.evaluate(() => ({ tab: _riskSelTab, open: !!document.getElementById('riskModalOverlay'), strip: !!document.querySelector('.rp-tabs') }));
  R.ok(o.open && o.tab === 'identify' && o.strip, 'opening an issue goes to the Identify tab, with the full tabs');
  await page.evaluate(() => _riskCloseModal());
  // the old-way unscored risk opens as it always did
  await page.evaluate(() => _riskOpenModal('r3'));
  R.ok(await page.evaluate(() => _riskSelTab) === 'summary', 'an unscored risk added the old way still opens on its Summary');
  await page.evaluate(() => _riskCloseModal());
}
// ── A1: from Triage ──
{
  await page.evaluate(() => { switchTab('triage'); renderTriage(); });
  await wait(page, 200);
  const t = await page.evaluate(() => ({ btns: [...document.querySelectorAll('#triageList button')].filter(b => /Make this an issue/.test(b.textContent)).length }));
  R.ok(t.btns === 2, 'each meeting action in Triage has "Make this an issue"');
  await page.evaluate(() => { [...document.querySelectorAll('#triageList button')].find(b => /Make this an issue/.test(b.textContent)).click(); });
  await wait(page, 150);
  const m = await page.evaluate(() => { const a = S.meetings[0].triageActions[0], r = S.riskProfile.find(x => x.id === a.issueId); return { linked: !!r, activity: r && r.activity, who: r && r.quick.raisedBy, src: r && r.quick.source, cell: document.getElementById('triageList').innerText, left: [...document.querySelectorAll('#triageList button')].filter(b => /Make this an issue/.test(b.textContent)).length }; });
  R.ok(m.linked && m.activity === 'Loose paving by the fire exit' && m.who === 'Dan West', 'the words and the owner carry over');
  R.ok(/Triage, client meeting/.test(m.src) && /Issue [A-Z]-\d{3}/.test(m.cell) && m.left === 1, 'the row now points at the issue; the other still offers');
  await page.evaluate(() => { [...document.querySelectorAll('#triageList button')].find(b => /^Issue /.test(b.textContent)).click(); });
  await wait(page, 300);
  R.ok(await page.evaluate(() => document.querySelector('.tab-btn.active').getAttribute('data-tab') === 'risk' && !!document.getElementById('riskModalOverlay') && _riskSelTab === 'identify'), 'clicking it opens the issue on the register');
  await page.evaluate(() => _riskCloseModal());
}

// ── A2: a scored risk opens on the overview, one list ──
{
  await page.evaluate(() => _riskOpenModal('r1'));
  await wait(page, 200);
  const t = await page.evaluate(() => { const o = document.getElementById('riskModalOverlay');
    return { tab: _riskSelTab, strip: !!o.querySelector('.rp-tabs'), full: !!o.querySelector('.rs-bar .t5-link'), heads: [...o.querySelectorAll('.rs-h')].map(x => x.innerText.trim()), tiles: [...o.querySelectorAll('.t5-tile')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' / '),
      nos: [...o.querySelectorAll('.t5-table tbody tr.t5-row .t5-no')].map(x => x.innerText.trim()).join(), doing: [...o.querySelectorAll('.t5-table tbody tr.t5-row')].map(tr => tr.id.replace('rsr-', '')), placed: [...o.querySelectorAll('.rs-placed li b')].map(x => x.innerText), cols: [...o.querySelectorAll('.t5-table th')].map(x => x.innerText.trim().toLowerCase()).join('|'), raised: /Raised/.test(o.innerText) }; });
  R.ok(t.tab === 'loop' && !t.strip && t.full, 'a scored risk opens on the overview: no tab strip, a Full detail link');
  R.ok(/CURRENT RISK RATING 25 CRITICAL/i.test(t.tiles) && /TARGET RISK RATING 6/i.test(t.tiles), 'the issue in a few lines: current and target (' + t.tiles + ')');
  R.ok(t.heads[0] === "WHAT WE'RE DOING ABOUT IT" && t.heads[1] === 'ALREADY IN PLACE' && t.cols === 'what|owner|target date|done', 'one list headed What we\'re doing about it, then Already in place (' + t.heads.join(', ') + ')');
  const all = ['a1', 'a2', 'a3', 'a4', 'c1', 'c2', 'c4', 'a5', 'c3'];
  R.ok(t.nos === '1,2,3,4,5,6,7', 'the rows are numbered from 1 (' + t.nos + ')');
  R.ok(t.doing.join() === 'a1,a2,a3,a4,c1,c2,c4' && t.placed.length === 2, 'every row appears exactly once: open actions, then the standing arrangements not in place (' + t.doing.join() + '); in place: ' + t.placed.join(' | '));
  R.ok([...t.doing, 'a5', 'c3'].sort().join() === all.sort().join() && !t.doing.includes('a6'), 'nothing lost, nothing doubled, the deleted one stays gone');
  const words = await modalWords();
  R.ok(!/control/i.test(words), 'the overview\'s own words never say "control"');
  R.ok(!(await noRed('#riskModalOverlay .rs-loop')).length, 'no red on the overview');
  const after = await page.evaluate(() => ({ actions: JSON.stringify(S.riskProfile.find(r => r.id === 'r1').actions), ctl: _riskActionsHTML(S.riskProfile.find(r => r.id === 'r1'), '', 'ctl'), plan: _riskActionsHTML(S.riskProfile.find(r => r.id === 'r1'), '', 'plan') }));
  R.ok(after.actions === before.actions && after.ctl === before.ctl && after.plan === before.plan, 'opening the overview changes no data: tabs 3 and 4 read exactly as before');
  // Full detail: the tabs as they were, Overview first to come back
  await page.evaluate(() => document.querySelector('.rs-bar .t5-link').click());
  const f = await page.evaluate(() => ({ tab: _riskSelTab, tabs: [...document.querySelectorAll('.rp-tabs button')].map(b => b.innerText.replace(/\s+/g, ' ').trim()), digest: !!document.querySelector('.rp-digest') }));
  R.ok(f.tab === 'summary' && f.digest && f.tabs[0] === 'Overview' && /1 · Identify/.test(f.tabs[2]) && /4 · Action delegation/.test(f.tabs[5]), 'Full detail shows the Summary and the four numbered tabs as before, with Overview to come back: ' + f.tabs.join(' | '));
  await page.evaluate(() => _riskDetailTab('loop'));
}
// ── A2: edits write to the real action ──
{
  await page.evaluate(() => { const i = document.querySelector('#own-r1-a3 input'); i.focus(); });
  await page.keyboard.type('Ben Cole'); await page.keyboard.press('Enter');
  await wait(page, 80);
  await change('[onchange*="\'a3\',\'due\'"]', day(40));
  const a3 = await act('r1', 'a3');
  R.ok(a3.owner === 'Ben Cole' && a3.due === day(40), 'owner (from the owner list) and target date land on the action');
  const t = await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'r1'); const tab4 = _riskActionsHTML(r, '', 'plan'); const plan = _execActions().find(x => x.ref.b === 'a3'); return { tab4: /Ben Cole/.test(tab4), plan: plan.owner + '|' + plan.due }; });
  R.ok(t.tab4 && /Ben Cole\|/.test(t.plan), 'and read on tab 4 and the execution plan');
  await page.evaluate(() => { const t = document.getElementById('rsd-a4'); t.value = 'Brief the survey team on the new rescue plan'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  R.ok((await act('r1', 'a4')).desc === 'Brief the survey team on the new rescue plan', 'the words of an action can be edited in place');
  await page.evaluate(() => rsAdd('r1'));
  await wait(page, 150);
  const n = await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'r1'), a = r.actions[r.actions.length - 1]; return { id: a.id, blank: !a.desc && !a.hideFromPlan && a.status === 'Not started', row: !!document.getElementById('rsr-' + a.id), focused: document.activeElement && document.activeElement.id === 'rsd-' + a.id, log: (a.log || []).map(l => l.text).join() }; });
  R.ok(n.blank && n.row && n.focused, '＋ Add what we\'re doing makes a real plan action through addRiskAction and puts the cursor in it');
  R.ok(/Raised on the overview/.test(n.log), 'with a line on its history');
  await page.evaluate(id => { const t = document.getElementById('rsd-' + id); t.value = 'Check the roof ladder tie-off points'; t.dispatchEvent(new Event('input', { bubbles: true })); }, n.id);
  R.ok((await act('r1', n.id)).desc === 'Check the roof ladder tie-off points', 'and what is typed is the action');
}
// ── A2: Done asks the one question, each answer files where the close-out files it ──
{
  await tick('a1', true);
  const t = await page.evaluate(() => ({ panel: !!document.querySelector('#evidOverlay.t5-stick-ov'), oldForm: !!document.querySelector('.emb-wrap'), q: (document.querySelector('.t5-stick-h') || {}).innerText || '', status: S.riskProfile[0].actions.find(a => a.id === 'a1').status, ctl: S.riskProfile[0].actions.find(a => a.id === 'c1').status }));
  R.ok(t.panel && !t.oldForm && t.q === 'Where does this live now?' && t.status === 'Complete', 'ticking Done closes the action and asks where it lives now, on the plain panel');
  R.ok(t.ctl === 'Not started', 'one of two actions done: the standing arrangement they put in place is not yet in place');
  await answer('policy', { _embDocSection: 'Section 7, Work at height' }, 'Scaffold up');
  const a1 = await act('r1', 'a1');
  R.ok(a1.embed && a1.embed.doc && /Section 7/.test(a1.embed.doc.name) && !a1.stickDue && a1.log.some(l => /^Risk [A-Z]-\d{3}, .*: How it was done: Scaffold up/.test(l.text)), 'the answer files against the policy; the history is tagged with the risk and today, not a meeting');
  R.ok(await page.evaluate(() => !S.actionSheets || !S.actionSheets.working), 'answering from the overview never starts a Top 5 working copy');
  const v = await page.evaluate(() => ({ placed: [...document.querySelectorAll('.rs-placed li')].map(x => x.innerText.replace(/\s+/g, ' ')), doing: [...document.querySelectorAll('.t5-table tbody tr.t5-row')].map(tr => tr.id.replace('rsr-', '')) }));
  R.ok(v.placed.some(x => /Fit edge protection/.test(x) && /Health & Safety Policy, Section 7/.test(x)) && !v.doing.includes('a1'), 'the done action moves to Already in place, worded with where it lives');
  // the only action under a standing arrangement: done puts it in place, Later keeps the question, taking Done back puts both back
  await tick('a3', true);
  await page.evaluate(() => t5StickLater());
  const a3 = await act('r1', 'a3'), c2a = await act('r1', 'c2');
  R.ok(a3.status === 'Complete' && !!a3.stickDue && !a3.embed, 'Later: done stands, flagged for later');
  R.ok(c2a.status === 'Complete' && c2a.t5Flip === 'Not started', 'the last action under a standing arrangement done: it goes in place');
  R.ok(await page.evaluate(() => /Where does this live now/.test(document.getElementById('rsr-a3').innerText)), 'the row keeps the question');
  await tick('a3', false);
  R.ok((await act('r1', 'c2')).status === 'Not started' && (await act('r1', 'a3')).status === 'In progress' && !(await act('r1', 'a3')).stickDue && !(await page.evaluate(() => !!document.getElementById('evidOverlay'))), 'taking Done back reopens both, no question asked');
  await tick('a3', true);
  R.ok(await page.evaluate(() => !!document.querySelector('#evidOverlay.t5-stick-ov')), 'ticked again, it asks again');
  await page.evaluate(() => t5StickLater());
  await tick('a2', true);
  await answer('proc', { _embDocName: 'Harness safe system of work' }, '');
  const c1 = await act('r1', 'c1');
  R.ok(c1.status === 'Complete' && c1.t5Flip === 'Not started', 'the second of two actions done: their standing arrangement goes in place');
  R.ok((await page.evaluate(() => [...document.querySelectorAll('.rs-placed li')].map(x => x.innerText))).some(x => /Safe access arrangements/.test(x) && /In place since/.test(x)), 'and it reads in Already in place');
  // a standing arrangement ticked done goes through tab 3's own path
  await tick('c4', true);
  const c4 = await page.evaluate(() => ({ panel: !!document.querySelector('#evidOverlay.t5-stick-ov'), c: JSON.parse(JSON.stringify(S.riskProfile[0].actions.find(a => a.id === 'c4'))), controls: S.riskProfile[0].controls }));
  R.ok(c4.c.status === 'Complete' && !!c4.c.completedDate && c4.c.hideFromPlan === true && /permit to work/i.test(c4.controls), 'a standing arrangement ticked done: Complete through the same path tab 3 uses, still a standing arrangement, written into the risk\'s controls line');
  R.ok(c4.panel, 'and it is asked where it lives too');
  await answer('check', { _embRtItem: 'Permit audit', _embRtFreq: 'Quarterly', _embRtOwner: 'Ben Cole' }, '');
  R.ok(await page.evaluate(() => { const s = (S.monitoring.regSections || []).find(x => /ongoing controls/i.test(x.name || '')); return !!s && s.items.some(i => i.item === 'Permit audit' && i.frequency === 'Quarterly'); }), 'A regular check reaches the assurance register');
  R.ok(!(await page.evaluate(() => !!document.getElementById('rescoreOverlay'))), 'with items still open, nothing asks about control yet');
}
// ── A3: the last item closes -> "Is this issue now under control?" ──
{
  // the loose action and the new one are still open; a3 is done but has not said where it lives
  await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'r1'); const a = r.actions[r.actions.length - 1]; window.__newId = a.id; });
  const newId = await page.evaluate(() => window.__newId);
  await tick('a4', true); await answer('train', { _embBrTitle: 'Roof rescue briefing', _embBrType: 'Briefing' }, '');
  await wait(page, 450);
  R.ok(!(await page.evaluate(() => !!document.getElementById('rescoreOverlay'))), 'one still open: nothing asks about control yet');
  await tick(newId, true); await answer('none', {}, '');
  await wait(page, 500);
  const p = await page.evaluate(() => { const o = document.getElementById('rescoreOverlay'); if (!o) return null; return { title: (o.querySelector('.t5-stick-h') || {}).innerText, text: o.innerText.replace(/\s+/g, ' '), L: document.getElementById('rescoreL').value, S: document.getElementById('rescoreS').value, placed: o.querySelectorAll('.rs-placed li').length, answer: !![...o.querySelectorAll('button')].find(b => /Answer now/.test(b.textContent)), yes: !![...o.querySelectorAll('button')].find(b => /Yes, it's under control/.test(b.textContent)), not: !![...o.querySelectorAll('button')].find(b => /^Not yet$/.test(b.textContent.trim())) }; });
  R.ok(p && p.title === 'Is this issue now under control?', 'the last item closed: the prompt asks the one question');
  R.ok(p && p.L === '2' && p.S === '3' && /Suggested now \(the target\) 6/.test(p.text), 'it suggests the target score, 6 (2x3)');
  R.ok(p && p.placed >= 7 && /Now in place/i.test(p.text), 'it lists what is now in place (' + (p && p.placed) + ')');
  R.ok(p && /1 done item has not said where it lives now/.test(p.text) && p.answer && p.yes && p.not, 'it says one done item has not said where it lives, and offers Answer now first');
  R.ok(!/control(?!\?)/i.test((p && p.text || '').replace(/under control/gi, '')), 'its own words: "under control", nothing else called control');
  R.ok(!(await noRed('#rescoreOverlay')).length, 'no red on the prompt');
  await page.evaluate(() => [...document.querySelectorAll('#rescoreOverlay button')].find(b => /Answer now/.test(b.textContent)).click());
  const an = await page.evaluate(() => ({ stick: !!document.querySelector('#evidOverlay.t5-stick-ov'), gone: !document.getElementById('rescoreOverlay'), what: (document.querySelector('.t5-stick-a') || {}).innerText }));
  R.ok(an.stick && an.gone && /Write the roof rescue plan/.test(an.what), 'Answer now opens the question for that item');
  await answer('person', { _embOwName: 'Ben Cole', _embOwRole: 'Roof work lead' }, '');
  await wait(page, 500);
  const p2 = await page.evaluate(() => { const o = document.getElementById('rescoreOverlay'); return o ? o.innerText : ''; });
  R.ok(/Is this issue now under control/.test(p2) && !/not said where it lives/.test(p2), 'answered, the prompt comes back with nothing left to say');
  await page.evaluate(() => [...document.querySelectorAll('#rescoreOverlay button')].find(b => /Yes, it's under control/.test(b.textContent)).click());
  await wait(page, 200);
  const r1 = await risk('r1');
  R.ok(r1.reviewed === true && r1.likelihood === '2' && r1.severity === '3', 'Yes: the score is saved as the target and the risk is signed off (reviewed)');
  R.ok((r1.scoreHistory || []).some(h => h.l === 5 && h.s === 5) && (r1.log || []).some(l => /^Marked under control at /.test(l.text)), 'the old score is in the history and the sign-off is on the risk\'s own history');
  const back = await page.evaluate(() => { const r = S.riskProfile.find(x => x.id === 'r1'); _riskDetailTab('actions'); const html = document.getElementById('rpBody').innerHTML; _riskDetailTab('loop'); return { tick: /onchange="setReviewed\('r1',this.checked\)"[^>]*>|checked onchange="setReviewed/.test(html) && /checked/.test(html.slice(html.indexOf('setReviewed') - 120, html.indexOf('setReviewed'))), chip: /Under control/i.test(document.getElementById('riskModalOverlay').innerText), hist: /Marked under control/i.test(document.getElementById('riskModalOverlay').innerText), gone: !document.getElementById('rescoreOverlay') }; });
  R.ok(back.tick, 'the back-office tick on tab 4 shows ticked');
  R.ok(back.chip && back.hist && back.gone, 'the overview says Under control and shows the line (' + JSON.stringify(back) + ')');
  // the live Top 5 reads it as done
  const t5 = await page.evaluate(() => { _riskCloseModal(); openLiveTop5(); const w = S.actionSheets.working; const on = w.items.some(i => i.ref.a === 'r1'); const res = { on, n: w.items.length }; closeLiveTop5(); delete S.actionSheets.working; return res; });
  R.ok(!t5.on, 'the live Top 5 no longer offers it: everything on it is done');
}
// ── A3: Not yet ──
{
  await page.evaluate(() => _riskOpenModal('r2'));
  await wait(page, 200);
  await tick('b1', true);
  await answer('none', {}, '');
  await wait(page, 500);
  R.ok(await page.evaluate(() => !!document.getElementById('rescoreOverlay')), 'a one-action risk: the prompt appears when it is done');
  await page.evaluate(() => { document.getElementById('rescoreWhy').value = 'Waiting for the fire marshal training in December'; rsNotYet('r2'); });
  const r2 = await risk('r2');
  R.ok(!r2.reviewed && r2.likelihood === '3' && (r2.log || []).some(l => /Not yet under control: Waiting for the fire marshal/.test(l.text)), 'Not yet: nothing is marked reviewed, the score stands, the reason is logged');
  R.ok(!(await page.evaluate(() => !!document.getElementById('rescoreOverlay'))), 'and the prompt closes');
  await page.evaluate(() => _riskCloseModal());
}
// ── it all survives a reload ──
{
  // what Stage A wrote (the app fills every risk's missing fields on load, as it always has)
  const snap = () => page.evaluate(() => JSON.stringify({ r: S.riskProfile.map(r => ({ id: r.id, activity: r.activity, quick: r.quick || null, reviewed: !!r.reviewed, l: r.likelihood || '', s: r.severity || '', hist: r.scoreHistory || [], log: r.log || [], acts: (r.actions || []).map(a => ({ id: a.id, status: a.status, embed: a.embed || null, stickDue: a.stickDue || '', t5Flip: a.t5Flip || '', log: (a.log || []).length })) })), m: S.meetings.map(m => (m.triageActions || []).map(a => a.issueId || '')) }));
  await page.evaluate(() => saveData());
  const saved = await snap();
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"');
  await wait(page, 500);
  const now = await snap();
  let di = 0; while (di < saved.length && saved[di] === now[di]) di++;
  R.ok(now === saved, 'after a reload the issues, the sign-off and the histories read back exactly as saved' + (now === saved ? '' : (' - differs at ' + di + ': SAVED "' + saved.slice(Math.max(0, di - 60), di + 80) + '" NOW "' + now.slice(Math.max(0, di - 60), di + 80) + '"')));
  const t = await page.evaluate(() => { switchTab('risk'); renderRiskProfile(); const q = S.riskProfile.filter(r => r.quick).length; _riskOpenModal('r1'); return { q, tab: _riskSelTab, chip: /Under control/i.test(document.getElementById('riskModalOverlay').innerText) }; });
  R.ok(t.q === 3 && t.tab === 'loop' && t.chip, 'three issues still to assess; r1 opens on its overview, under control (' + JSON.stringify(t) + ')');
  await page.evaluate(() => _riskCloseModal());
}
// ── read only, and the views ──
{
  const t = await page.evaluate(() => {
    // a scored risk with rows still to show
    S.riskProfile.push({ id: 'r4', activity: 'Lone working in void property', likelihood: '3', severity: '4', targetL: '2', targetS: '3', actions: [{ id: 'd1', desc: 'Set up a check-in call', owner: 'Ben Cole', due: '2027-01-31', status: 'Not started' }, { id: 'd2', desc: 'Lone working procedure', owner: '', due: '', status: 'Not started', hideFromPlan: true }] });
    const was = [_consultantView, _consultantEdit];
    _consultantView = { name: 'Testing Client Ltd' }; _consultantEdit = false;
    renderRiskProfile(); _riskOpenModal('r4'); renderRiskProfile();
    const o = document.getElementById('riskModalOverlay');
    const boxes = [...o.querySelectorAll('.rs-loop textarea,.rs-loop input[type=date],.rs-loop input[type=checkbox]')];
    const res = { boxes: boxes.length, allOff: boxes.every(b => b.disabled), on: boxes.filter(b => !b.disabled).map(b => b.id || b.className).slice(0, 4), noAdd: !o.querySelector('.rs-add'), noAsk: !/Where does this live now/i.test(o.innerText), tab: _riskSelTab };
    const before = JSON.stringify(S.riskProfile);
    rsDone('r4', 'd1', true); rsAdd('r4'); quickAddSave(); const q = _quickAddCreate({ what: 'x' });
    res.unwritten = JSON.stringify(S.riskProfile) === before && q === null;
    res.strip = !document.querySelector('.rs-strip');
    _riskCloseModal();
    _consultantView = was[0]; _consultantEdit = was[1]; renderRiskProfile();
    return res;
  });
  R.ok(t.boxes > 0 && t.allOff && t.noAdd && t.noAsk, 'read only: every box off, no add, no question (' + JSON.stringify(t) + ')');
  R.ok(t.unwritten, 'and every write goes through the read-only guard');
  const v = await page.evaluate(() => { const was = _viewMode, b = document.getElementById('qaBtn'), out = {}; _viewMode = 'management'; applyViewMode(); out.client = b.style.display; renderRiskProfile(); out.clientStrip = !document.querySelector('.rs-strip'); _viewMode = 'employee'; applyViewMode(); out.emp = b.style.display; _viewMode = was; applyViewMode(); out.cons = b.style.display; renderRiskProfile(); return out; });
  R.ok(v.client !== 'none' && v.emp === 'none' && v.cons !== 'none', 'Add an issue shows for the consultant and the client, never the employee view');
  R.ok(v.clientStrip, 'the To be assessed strip is the consultant\'s');
}

await R.done(browser, errors);
