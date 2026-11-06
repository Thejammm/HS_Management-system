// ══════════════════════════════════════════════════════════════
//  Stage C (Build 2): the suggested Top 5, and the sidebar in four groups.
//  In the user's order: a sheet was sent last month -> the live Top 5 opens
//  with room on it -> Compass names the five with a reason each: carried, a new
//  issue, a check overdue, a check failed, the highest open risk -> one is
//  added, then Add all, then one taken off -> the reasons sit on the pages ->
//  the first meeting of all shows reasons too. Then the sidebar: four groups in
//  order, every button kept, the views unchanged, a group closed and remembered
//  across a reload.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Stage C - the suggested Top 5, and the sidebar in four groups');
const { browser, page, errors } = await openApp();
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const emb = o => Object.assign({ at: day(-40), by: 'Simon' }, o);
const risks = () => [
  { id: 'r1', activity: 'Falls from roofs during surveys', likelihood: '5', severity: '5', targetL: '2', targetS: '3', actions: [{ id: 'a1', desc: 'Fit edge protection to the loading bay', owner: 'Ben Cole', due: day(10), status: 'Not started', priority: 'High' }] },
  { id: 'r2', activity: 'Fire at the office', likelihood: '4', severity: '5', targetL: '2', targetS: '5', actions: [{ id: 'b1', desc: 'Fire drill', owner: 'Ann Reed', due: '', status: 'Complete', completedDate: day(-40), embed: emb({ routine: { item: 'Fire alarm test', frequency: 'Monthly', owner: 'Ann Reed', regId: 'reg_fire' } }) }] },
  { id: 'r3', activity: 'Legionella in the water system', likelihood: '2', severity: '5', targetL: '1', targetS: '5', actions: [{ id: 'c1', desc: 'Water temperature checks', owner: 'Dan West', due: '', status: 'Complete', completedDate: day(-50), embed: emb({ routine: { item: 'Water temperature log', frequency: 'Monthly', owner: 'Dan West', regId: 'reg_water' } }) }] },
  { id: 'r4', activity: 'Road collision driving for work', likelihood: '3', severity: '4', targetL: '2', targetS: '3', actions: [{ id: 'd1', desc: 'Check licences and insurance', owner: 'Ann Reed', due: day(12), status: 'Not started', priority: 'Medium' }] },
  { id: 'r5', activity: 'Lone working in void property', likelihood: '3', severity: '3', targetL: '1', targetS: '3', actions: [{ id: 'e1', desc: 'Set up a check-in call', owner: 'Ben Cole', due: day(14), status: 'Not started', priority: 'Medium' }] },
  { id: 'r6', activity: 'Manual handling of survey kit', likelihood: '2', severity: '2', targetL: '1', targetS: '2', actions: [{ id: 'f1', desc: 'Buy a kit trolley', owner: 'Ben Cole', due: day(25), status: 'Not started', priority: 'Low' }] },
  { id: 'r7', activity: 'Trailing cables across the studio floor', quick: { raisedBy: 'Ann Reed', roughLevel: 'Medium', raisedAt: day(-3) }, actions: [] },
];
await seed(page, { riskProfile: risks(), company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] },
  monitoring: { months: {}, meta: {}, regulatory: [], regSections: [{ id: 'sec1', name: 'Ongoing controls', items: [
    { id: 'reg_fire', item: 'Fire alarm test', frequency: 'Monthly', resultDate: day(-45), dueDate: day(-15), result: 'Pass', certRef: '', notes: '' },
    { id: 'reg_water', item: 'Water temperature log', frequency: 'Monthly', resultDate: day(-5), dueDate: day(25), result: 'Fail', certRef: '', notes: '' }] }] } }, 'cockpit');
await page.evaluate(() => { delete S.actionSheets; });

// ── last month's sheet went out with r1 on it ──
await page.evaluate(d => { const st = _asState(); st.list.push({ id: 'as_last', kind: 'top5', no: 1, formV: 3, createdAt: d + 'T10:00:00.000Z', issuedAt: d, meetingDate: d, firstIssue: '', returnedAt: '', returnedBy: '', file: '', items: [{ key: 'risk:r1:a1', ref: { t: 'risk', a: 'r1', b: 'a1' }, desc: 'Fit edge protection to the loading bay', risk: 'Falls from roofs during surveys', riskRef: _riskRefOf(S.riskProfile[0]), band: 'Critical', owner: 'Ben Cole', due: '', rec: '', carriedFrom: 0, why: 'tick', resp: { outcome: '', what: '', date: '', by: '' }, decision: '', decidedAt: '', dnote: '', acceptedBy: '' }] }); saveData(); }, day(-30));

// ── C1: the live Top 5 opens with room, and Compass names the five ──
{
  const t = await page.evaluate(() => { openLiveTop5(); const w = S.actionSheets.working; const strip = document.querySelector('.t5-strip-add');
    const sug = _t5Suggest(w); return { on: w.items.map(i => i.ref.a).join(), order: sug.map(s => s.r.id + ':' + s.kind + ':' + s.reason.replace(/\d+ \w{3} \d{4}/, 'DATE')), strip: strip ? strip.innerText.replace(/\s+/g, ' ') : '', adds: strip ? strip.querySelectorAll('button').length : 0, why: (document.querySelector('.t5-why-p') || {}).innerText || '' }; });
  R.ok(t.on === 'r1', 'the copy carries r1 from last month\'s sheet');
  R.ok(t.order.join(' | ') === 'r1:carry:Carried from last meeting | r7:new:New: raised DATE | r2:check:Check overdue: Fire alarm test (was due DATE) | r3:check:Failed check DATE: Water temperature log | r4:top:Highest open risk', 'five named in order, each with its reason: ' + t.order.join(' | '));
  R.ok(/Suggested for this month \(4\)/.test(t.strip) && /New: raised/.test(t.strip) && /Check overdue: Fire alarm test/.test(t.strip) && /Failed check/.test(t.strip) && /Highest open risk/.test(t.strip) && t.adds === 5, 'the four not yet on it are offered with Add each and Add all');
  R.ok(/Carried from last meeting/i.test(t.why), 'the page says why r1 is on the sheet: ' + t.why);
  R.ok(!/control/i.test(t.strip), 'no "control" in the suggestion');
  // add one, then all, then take one off
  await page.evaluate(() => { [...document.querySelectorAll('.t5-strip-add button')].find(b => /Add$/.test(b.textContent.trim()) && b.closest('.t5-offer') && /Trailing cables/.test(b.closest('.t5-offer').textContent)).click(); });
  const one = await page.evaluate(() => ({ on: S.actionSheets.working.items.map(i => i.ref.a).join(), why: S.actionSheets.working.items[1].whyText, page: (document.querySelector('.t5-why-p') || {}).innerText || '', rows: document.querySelectorAll('.t5-newr').length, left: (document.querySelector('.t5-strip-add') || {}).innerText || '' }));
  R.ok(one.on === 'r1,r7' && /^New: raised/.test(one.why) && /New: raised/i.test(one.page), 'Add puts the new issue on and keeps its reason on the page');
  R.ok(one.rows >= 1 && /Suggested for this month \(3\)/.test(one.left), 'an issue with nothing planned shows "No action yet, add one"; three are still suggested');
  await page.evaluate(() => t5AddAll());
  const all = await page.evaluate(() => ({ on: S.actionSheets.working.items.map(i => i.ref.a).join(), strip: !!document.querySelector('.t5-strip-add'), whys: S.actionSheets.working.items.map(i => _t5WhyOf(i).replace(/\d+ \w{3} \d{4}/, 'DATE')) }));
  R.ok(all.on === 'r1,r7,r2,r3,r4' && !all.strip, 'Add all fills the five, and the suggestion goes');
  R.ok(all.whys.join(' | ') === 'Carried from last meeting | New: raised DATE | Check overdue: Fire alarm test (was due DATE) | Failed check DATE: Water temperature log | Highest open risk', 'every line carries its reason: ' + all.whys.join(' | '));
  await page.evaluate(() => { t5Go(4); document.querySelector('.t5-off').click(); });
  const off = await page.evaluate(() => ({ on: S.actionSheets.working.items.map(i => i.ref.a).join(), strip: (document.querySelector('.t5-strip-add') || {}).innerText || '' }));
  R.ok(off.on === 'r1,r7,r2,r3' && /Suggested for this month \(1\)/.test(off.strip) && /Highest open risk/.test(off.strip), 'a risk taken off is suggested again; the ladder order stays the fallback');
  const red = await page.evaluate(() => { const rgb = c => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : null; }; const redish = c => { const x = rgb(c); return !!x && x[0] > 150 && x[1] < 110 && x[2] < 110; }; return [...document.querySelectorAll('#t5Ov .t5-strip-add *')].filter(e => { const s = getComputedStyle(e); return redish(s.color) || redish(s.backgroundColor); }).length; });
  R.ok(red === 0, 'no red');
  await page.evaluate(() => { closeLiveTop5(); delete S.actionSheets.working; });
}
// ── the first meeting of all: the copy is the ladder's five, each with a reason ──
{
  const t = await page.evaluate(() => { delete S.actionSheets; toggleRiskTop5('r5'); openLiveTop5(); const w = S.actionSheets.working; const out = { n: w.items.length, whys: w.items.map(i => _t5WhyOf(i)), strip: !!document.querySelector('.t5-strip-add') }; closeLiveTop5(); delete S.actionSheets; return out; });
  R.ok(t.n === 4 && t.whys[0] === 'Ticked on the risk ladder' && t.whys.slice(1).every(x => x === 'Highest open risk') && t.strip, 'with no sheet yet the ladder\'s risks with open work are on (four here), tick first, each saying why, and the room is suggested: ' + t.whys.join(' | '));
}

// ── C2: four plain groups, in order, every button kept ──
{
  const t = await page.evaluate(() => { const nav = document.querySelector('.sidebar-nav'); const groups = [...nav.querySelectorAll('.nav-grp')];
    return { labels: groups.map(g => (g.querySelector('.nav-grp-h') || {}).innerText.trim()), tabs: groups.map(g => [...g.querySelectorAll('.tab-btn')].map(b => b.getAttribute('data-tab')).join()), front: [...groups[0].querySelectorAll('button')].map(b => b.getAttribute('data-tab') || b.id).join(), old: nav.querySelectorAll('.nav-phase:not(.nav-grp)').length,
      total: nav.querySelectorAll('.tab-btn[data-tab]').length, onclicks: [...nav.querySelectorAll('.tab-btn[data-tab]')].every(b => b.getAttribute('onclick') === "switchTab('" + b.getAttribute('data-tab') + "')"), note: !!(document.getElementById('navLinkedNote') && document.getElementById('navLinkedNote').previousElementSibling && document.getElementById('navLinkedNote').previousElementSibling.getAttribute('data-tab') === 'siteinsp') }; });
  R.ok(t.labels.join('|').toLowerCase() === 'front door|records|consultant tools|admin', 'four groups in order: ' + t.labels.join(' | '));
  R.ok(t.front === 'cockpit,t5Btn,qaBtn,risk,ladder,works', 'Front door: Cockpit, the live Top 5, Add an issue, Risk profile, Risk ladder, How the client works now (' + t.front + ')');
  R.ok(t.tabs[1] === 'documents,signoff,monitoring,toolbox,cpd,monthly,reports' && t.tabs[2] === 'howto,company,requirements,maturity,execplan,actions,siteinsp,journey,cas,review,audit,triage,links' && t.tabs[3] === 'setup,admin', 'Records, Consultant tools and Admin hold what the spec lists, in its order');
  R.ok(t.total === 26 && t.onclicks && t.old === 0 && t.note, 'all 26 tab buttons kept their onclick; the old phase boxes are gone; the linked-app note sits by Process assurance (' + JSON.stringify({ total: t.total, onclicks: t.onclicks, old: t.old, note: t.note }) + ')');
}
// ── the views decide what shows inside each group, as before ──
{
  const v = await page.evaluate(() => { const was = _viewMode, out = {}; const vis = () => [...document.querySelectorAll('.sidebar-nav .tab-btn[data-tab]')].filter(b => b.style.display !== 'none').map(b => b.getAttribute('data-tab')).sort().join();
    const grp = () => [...document.querySelectorAll('.nav-grp')].map(g => g.getAttribute('data-grp') + ':' + (g.style.display === 'none' ? 'hidden' : 'shown')).join();
    _viewMode = 'consultant'; applyViewMode(); out.cons = vis(); out.consG = grp(); _viewMode = 'management'; applyViewMode(); out.client = vis(); _viewMode = 'employee'; applyViewMode(); out.emp = vis(); out.empG = grp(); _viewMode = was; applyViewMode(); return out; });
  const all = ['cockpit', 'works', 'ladder', 'howto', 'company', 'risk', 'requirements', 'maturity', 'execplan', 'signoff', 'documents', 'cpd', 'toolbox', 'monitoring', 'siteinsp', 'journey', 'review', 'reports', 'cas', 'setup', 'links', 'audit', 'triage'];
  // offline there is no signed-in consultant, so the three data-consultant tabs (review, audit, triage) are hidden in every view, as before Stage C
  const offline = all.filter(t => !['audit', 'review', 'triage'].includes(t)).sort().join();
  R.ok(v.cons === offline, 'the consultant view shows every tab the harness could before (' + v.cons.split(',').length + '): ' + (v.cons === offline ? 'same set' : v.cons));
  R.ok(v.client === offline, 'the client view shows the same set here (its three exclusions are the offline-hidden ones)');
  R.ok(v.emp === ['signoff', 'documents', 'cpd', 'toolbox', 'journey', 'reports', 'links'].sort().join() && /front:hidden/.test(v.empG) && /admin:hidden/.test(v.empG), 'the employee view keeps its seven, and a group with nothing to show is hidden');
}
// ── a group closed is remembered ──
{
  await page.evaluate(() => { try { localStorage.removeItem('compass.nav.records'); } catch (e) {} });
  const c = await page.evaluate(() => { const g = document.querySelector('.nav-grp[data-grp="records"]'); g.querySelector('.nav-grp-btn').click(); return { closed: g.classList.contains('nav-closed'), hidden: getComputedStyle(g.querySelector('.nav-grp-b')).display === 'none', aria: g.querySelector('.nav-grp-btn').getAttribute('aria-expanded'), stored: localStorage.getItem('compass.nav.records') }; });
  R.ok(c.closed && c.hidden && c.aria === 'false' && c.stored === 'closed', 'Records closes with one click and the choice is kept');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"');
  await wait(page, 500);
  const after = await page.evaluate(() => { const g = document.querySelector('.nav-grp[data-grp="records"]'); const front = document.querySelector('.nav-grp[data-grp="front"]'); const r = { closed: g.classList.contains('nav-closed'), frontOpen: !front.classList.contains('nav-closed') && !front.querySelector('.nav-grp-btn') }; g.querySelector('.nav-grp-btn').click(); r.reopened = !g.classList.contains('nav-closed'); switchTab('documents'); r.reach = document.querySelector('.tab-btn.active').getAttribute('data-tab'); try { localStorage.removeItem('compass.nav.records'); } catch (e) {} return r; });
  R.ok(after.closed && after.frontOpen, 'after a reload Records is still closed; Front door never closes');
  R.ok(after.reopened && after.reach === 'documents', 'and it opens again; a tab inside is still reachable');
}

await R.done(browser, errors);
