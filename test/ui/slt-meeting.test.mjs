// ══════════════════════════════════════════════════════════════
//  The SLT leadership briefing and the meeting it is run in. Simon,
//  2026-09-30: "I want the board report to reflect these items as I want to
//  talk round them, then create some actions for people/directors in the
//  meeting so I can just finish my slot after I have taken the notes and
//  actions, and email it when I sit back down".
//  Report side: the board report arranged as his ten items (board-briefing).
//  App side: the meeting on the same ten items - who is there, notes,
//  actions with who and by when - then Finish: actions onto the plan, the
//  minutes made, and an email ready with the actions written in.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';
import { SLT_AGENDA, sltAgenda } from '../../public/reports/templates/board-report.js';
import { buildReport } from '../../public/reports/templates/index.js';

const R = reporter('SLT briefing and the leadership meeting');
const { browser, page, errors } = await openApp();

const today = new Date().toISOString().slice(0, 10);
await seed(page, {
  company: { legalName: 'Fineline Architects Ltd', sector: 'Design / architecture / surveying',
    personnel: [ { role: 'Managing Director', name: 'Jo Fine', contact: 'jo@fineline.example' },
                 { role: 'Technical Director', name: 'Sam Line', contact: 'sam@fineline.example' },
                 { role: 'Office Manager', name: 'Alex Desk', contact: '01234 567890' } ] },
  riskProfile: [ { id: 'r1', activity: 'Site visits during the construction phase', likelihood: '3', severity: '4', actions: [] } ],
  decisions: [ { id: 'dec_old', date: '2026-06-01', forum: 'Board meeting', decision: 'Appoint a fire warden for the studio', owner: 'Jo Fine', due: '2026-07-01', status: 'Agreed', raised: 0 } ],
  actionPlan: [],
  policySignoff: { policies: [], staff: [ { id: 's1', name: 'Priya Nair', role: 'Architect' } ], signed: {}, log: [], logMigrated: true },
  meetings: [] }, 'reports');
await wait(page, 300);

// ── one agenda, in the app and in the report ──
{
  const app = await page.evaluate(() => ({ raw: SLT_AGENDA, design: _sltAgenda(),
    other: (function () { const keep = S.company.sector; S.company.sector = 'Motor trade'; const a = _sltAgenda(); S.company.sector = keep; return a; })() }));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  R.ok(same(app.raw, SLT_AGENDA), 'the meeting screen and the report carry the same ten items, word for word');
  R.ok(same(app.design, sltAgenda({ company: { sector: 'Design / architecture / surveying' } })) && same(app.other, sltAgenda({ company: { sector: 'Motor trade' } })), 'and the same rule for item 3 in both');
  R.ok(/architectural/.test(app.design[2].cover[0]) && !/architectural/.test(app.other[2].cover[0]), 'item 3 names architectural work for a design practice, the core work for anyone else');
}

// ── the Reports tab offers both ──
{
  const t = await page.evaluate(() => { switchTab('reports'); const txt = document.getElementById('tab-reports').innerText; return { brief: /Leadership Briefing/.test(txt), meet: /Leadership Meeting/.test(txt) }; });
  R.ok(t.brief && t.meet, 'the Reports tab has the Leadership Briefing and the Leadership Meeting');
}

// ── run the meeting ──
{
  const t = await page.evaluate(async () => {
    const out = {};
    openSltMeeting();
    const ov = document.getElementById('sltOv');
    out.open = !!ov && document.body.classList.contains('slt-open');
    out.items = [...ov.querySelectorAll('.slt-sec h3')].map(h => h.textContent);
    out.nav = ov.querySelectorAll('.slt-nb').length;
    // who is here: the directors in one click, then a name from the list
    sltAddDirectors();
    const n = document.getElementById('sltAttName'); n.value = 'Priya Nair'; n.dispatchEvent(new Event('change')); sltAddAttendee();
    const m = _sltCur();
    out.att = m.attendees.map(a => a.name + '|' + a.role + '|' + a.email);
    // notes on item 1 - typing never redraws the screen
    const ta = document.getElementById('sltNote1'); ta.focus(); ta.value = 'Good quarter. Two near misses on site visits.'; ta.dispatchEvent(new Event('input'));
    out.noteKept = m.notes[1] === 'Good quarter. Two near misses on site visits.' && document.activeElement === ta;
    // an action on item 4, typed straight in
    sltAddAction(4); await new Promise(r => setTimeout(r, 20));
    const d = _decisions().find(x => x.meetingId === m.id && x.agendaItem === 4);
    out.focusNew = document.activeElement && document.activeElement.classList.contains('slt-a-what');
    const row = document.getElementById('slta-' + d.id);
    const put = (sel, v, ev) => { const el = row.querySelector(sel); el.value = v; el.dispatchEvent(new Event(ev || 'input')); };
    put('.slt-a-what', 'Review the pre-construction information template with the design team');
    put('.slt-a-who', 'Sam Line');
    put('.slt-a-due', '2026-11-15', 'change');
    out.dec = { forum: d.forum, date: d.date, status: d.status, what: d.decision, who: d.owner, due: d.due, why: d.why };
    // a second action with no owner, and an empty line that will be dropped
    sltAddAction(6); const d6 = _decisions().find(x => x.meetingId === m.id && x.agendaItem === 6);
    const r6 = document.getElementById('slta-' + d6.id); const w6 = r6.querySelector('.slt-a-what'); w6.value = 'Book DSE assessments for the studio'; w6.dispatchEvent(new Event('input'));
    sltAddAction(9);
    out.navCounts = [...document.querySelectorAll('.slt-nb i')].map(i => i.parentElement.firstChild.textContent + ':' + i.textContent).join(',');
    // the meeting's date is its actions' date
    sltSet('date', today2());
    function today2() { return new Date().toISOString().slice(0, 10); }
    out.dateFollows = _sltActions(m).every(x => x.date === m.date);
    return out;
  });
  R.ok(t.open && t.nav === 10, 'Run the leadership meeting opens full screen, with the ten items to jump between');
  R.ok(t.items[0] === 'Who is here' && t.items.slice(1).join('|') === SLT_AGENDA.map(a => a.title).join('|'), 'who is here, then the ten items in agenda order');
  R.ok(t.att.join(';') === 'Jo Fine|Managing Director|jo@fineline.example;Sam Line|Technical Director|sam@fineline.example;Priya Nair|Architect|', 'the directors come in one click with their emails; anyone else by name - ' + t.att.join('; '));
  R.ok(t.noteKept, 'notes are kept as they are typed, and the cursor stays put');
  R.ok(t.focusNew && t.dec.forum === 'Board meeting' && t.dec.status === 'Agreed' && t.dec.who === 'Sam Line' && t.dec.due === '2026-11-15' && /item 4: Design risk & CDM responsibilities/.test(t.dec.why), 'an action is a decision on the register - who, by when, and the item it came from');
  R.ok(t.navCounts === '4:1,6:1,9:1', 'the item buttons count the actions on each (' + t.navCounts + ')');
  R.ok(t.dateFollows, 'change the meeting date and its actions follow');
}

// ── Finish, the minutes and the email ──
{
  const t = await page.evaluate(async () => {
    const out = {};
    const m = _sltCur();
    const apBefore = _apList().length;
    sltFinish();                                        // the harness says yes to "no one named - finish anyway?"
    const acts = _sltActions(m);
    out.acts = acts.map(d => d.agendaItem + ':' + d.raised).join(',');
    out.plan = _apList().slice(apBefore).map(a => a.desc + ' | ' + a.owner + ' | ' + a.due + ' | ' + a.note);
    out.status = m.status;
    out.pdf = _sltDone && _sltDone.pdf ? { size: _sltDone.pdf.blob.size, fname: _sltDone.pdf.fname } : null;
    const ov = document.getElementById('sltOv');
    out.done = /2 actions agreed/.test(ov.innerText) && /To: jo@fineline\.example, sam@fineline\.example/.test(ov.innerText);
    // the email: the minutes saved, an email to those present with the actions written in
    const saved = [], opened = [];
    window._sltSaveBlob = (b, f) => saved.push(f + ':' + b.size);
    window._sltOpenLink = h => opened.push(h);
    [...ov.querySelectorAll('button')].find(b => /Download \+ open an email/.test(b.textContent)).click();
    out.saved = saved; out.mail = opened[0] || '';
    const q = new URLSearchParams(out.mail.split('?')[1] || '');
    out.to = decodeURIComponent(out.mail.slice(7).split('?')[0]); out.subject = q.get('subject'); out.body = q.get('body');
    // Finish again never doubles the plan
    const n = _apList().length; sltFinish(); out.again = _apList().length === n;
    closeSltMeeting();
    out.closed = !document.getElementById('sltOv') && !document.body.classList.contains('slt-open');
    // the decisions register offers the last minutes again
    switchTab('monitoring'); _renderDecisions();
    out.lastBtn = /Last meeting minutes/.test(document.getElementById('decisionPanel').textContent);
    const saved2 = []; window._sltSaveBlob = (b, f) => saved2.push(f); downloadLastMinutes(); out.again2 = saved2[0] || '';
    // a new meeting starts clean; the finished one is kept
    openSltMeeting(); out.fresh = _sltCur().id !== m.id && _meetings().length === 2 && !_sltActions(_sltCur()).length; closeSltMeeting();
    out.state = JSON.parse(JSON.stringify(S));
    return out;
  });
  R.ok(t.acts === '4:1,6:1', 'Finish drops the empty line and puts each action on the plan once (' + t.acts + ')');
  R.ok(t.plan.length === 2 && /pre-construction information/.test(t.plan[0]) && /Sam Line \| 2026-11-15/.test(t.plan[0]) && /item 4: Design risk/.test(t.plan[0]), 'on the execution plan with the owner, the date and where it was agreed');
  R.ok(t.status === 'finished' && t.pdf && t.pdf.size > 3000 && /^meeting-minutes-fineline-architects-ltd-\d{4}-\d\d-\d\d\.pdf$/.test(t.pdf.fname), 'the minutes are made (' + (t.pdf && t.pdf.fname) + ', ' + (t.pdf && t.pdf.size) + ' bytes)');
  R.ok(t.done, 'the screen says what happened and who the email goes to');
  R.ok(t.saved.length === 1 && t.to === 'jo@fineline.example,sam@fineline.example' && /^H&S leadership meeting - Fineline Architects Ltd - /.test(t.subject), 'Download + open an email: the minutes saved, an email to those present');
  R.ok(/1\. Review the pre-construction information template with the design team - Sam Line, by 15 Nov 2026/.test(t.body) && /2\. Book DSE assessments for the studio - owner to be named/.test(t.body) && /minutes are attached \(meeting-minutes-/.test(t.body), 'with the actions written into it, and the file named to attach');
  R.ok(t.again && t.closed, 'Finish twice never doubles the plan; Close puts the screen away');
  R.ok(t.lastBtn && /^meeting-minutes-/.test(t.again2), 'the last meeting\'s minutes can be made again from the decisions register');
  R.ok(t.fresh, 'the next meeting starts clean, and the last one is kept');

  // the next briefing opens by asking whether they happened
  const rep = buildReport(t.state, 'board-briefing', { today: '2026-12-01' });
  const p10 = rep.pages.find(p => p.agendaItem === 10);
  const open = (p10.blocks.find(b => b.type === 'dataTable' && /Still open/.test(b.title || '')) || { rows: [] }).rows.map(r => String(r[1]));
  R.ok(open.some(x => /pre-construction information/.test(x)) && open.some(x => /fire warden/.test(x)), 'the next briefing\'s item 10 asks whether they happened, with the earlier ones');
}

// ── the briefing itself ──
{
  const rep = buildReport({ company: { legalName: 'Fineline Architects Ltd', sector: 'Design / architecture / surveying' } }, 'board-briefing', { today: '2026-10-01' });
  const items = rep.pages.filter(p => p.agendaItem).map(p => p.agendaItem).join(',');
  const cover = rep.pages.filter(p => p.agendaItem).every(p => p.blocks.some(b => b.type === 'coverList') && p.blocks.some(b => b.type === 'titleBlock' && /^Item \d+ of 10$/.test(b.kicker)));
  const notes = rep.pages.filter(p => p.agendaItem).every(p => p.blocks.some(b => b.type === 'notesLines' || (b.type === 'dataTable' && /Agreed in the meeting/.test(b.title || ''))));
  R.ok(rep.meta.title === 'Health & Safety Leadership Briefing' && rep.pages.length === 12 && items === '1,2,3,4,5,6,7,8,9,10', 'the briefing is a front page, the ten items in order, and the sign-off page');
  R.ok(cover && notes, 'every item page says what it covers and leaves room for the notes');
}

await R.done(browser, errors);
