// ══════════════════════════════════════════════════════════════
//  Client meeting notes - Simon's own record of his client meetings.
//  Simon, 2026-10-07: "The minutes just need their own report to be printed
//  out for my own personal notes."
//  Every client meeting taken with the quick minute taker on the cockpit,
//  newest first under its month: who was there, the notes in full, and the
//  actions agreed with who, by when and where each stands. One report from
//  the Reports tab (all of them), one from the minute taker (just that
//  meeting). Built like the leadership meeting's minutes (_mkPdf).
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Client meeting notes - the minutes as your own record');
const { browser, page, errors } = await openApp();

const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
// a given day of the month `back` months ago - always in the past, always a different month
const monthDay = (back, dd) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back); d.setDate(dd); return ymd(d); };
const TODAY = day(0), MID = monthDay(1, 10), EMPTY = monthDay(1, 20), OLD = monthDay(2, 14);

const COMPANY = { tradingName: 'Fairbank Fabrications Ltd', slt: [
  { name: 'Jo Fine', role: 'Managing Director', email: 'jo@fairbank.example' },
  { name: 'Sam Line', role: 'Operations Director', email: 'sam@fairbank.example' }] };
// Kept out of date order on purpose: the report has to sort them.
//   old   - finished, two months ago: Jo there, notes on two lines, one action
//           overdue and not raised, one raised onto the plan
//   mid   - finished, last month: nobody recorded, no notes, one action raised
//   open  - today, still open: Sam there, notes, one action not raised
//   empty - finished but nothing written (an empty action line only): never printed
//   board - a leadership meeting: never in the client notes
const MEETINGS = () => ([
  { id: 'mtg_old1', quick: true, forum: 'Client meeting', date: OLD, status: 'finished', finishedAt: OLD + 'T16:00:00.000Z',
    attendees: [{ name: 'Jo Fine', role: 'Managing Director', email: 'jo@fairbank.example' }],
    note: 'Walked the yard with Jo.\nAgreed the forklift route needs marking before the next delivery.' },
  { id: 'mtg_open1', quick: true, forum: 'Client meeting', date: TODAY, status: 'open',
    attendees: [{ name: 'Sam Line', role: 'Operations Director', email: 'sam@fairbank.example' }], note: 'Still talking about the paint store.' },
  { id: 'mtg_empty1', quick: true, forum: 'Client meeting', date: EMPTY, status: 'finished', finishedAt: EMPTY + 'T16:00:00.000Z',
    attendees: [{ name: 'Ghost Person', role: 'Visitor', email: '' }], note: '' },
  { id: 'mtg_board1', forum: 'Board meeting', date: day(-7), status: 'finished', finishedAt: day(-7) + 'T16:00:00.000Z', attendees: [], notes: { 1: 'Boardroom only talk' } },
  { id: 'mtg_mid1', quick: true, forum: 'Client meeting', date: MID, status: 'finished', finishedAt: MID + 'T16:00:00.000Z', attendees: [], note: '' },
]);
const dec = (id, meetingId, date, decision, owner, due, extra) => Object.assign({ id, meetingId, agendaItem: 0, forum: 'Client meeting', date,
  decision, owner, due, status: 'Agreed', why: 'Agreed at the client meeting', outcome: '', raised: 0 }, extra || {});
const DECISIONS = () => ([
  dec('dec_open1', 'mtg_open1', TODAY, 'Fit a fire door to the paint store', 'Dave', day(15)),
  dec('dec_empty1', 'mtg_empty1', EMPTY, '', 'Ghost Owner', ''),
  dec('dec_mid1', 'mtg_mid1', MID, 'Book a first aid refresher for two staff', '', ''),
  dec('dec_old1', 'mtg_old1', OLD, 'Mark the forklift route in the yard', 'Sam Line', day(-10)),
  dec('dec_old2', 'mtg_old1', OLD, 'Order new racking labels', 'Jo Fine', day(20)),
  dec('dec_board1', 'mtg_board1', day(-7), 'Board-only decision text', 'Jo Fine', day(30), { forum: 'Board meeting', agendaItem: 1 }),
  { id: 'dec_loose', date: day(-3), forum: 'Board meeting', decision: 'A loose decision on no meeting', owner: '', due: '', status: 'Agreed', raised: 0 },
]);

await seed(page, { company: COMPANY, meetings: MEETINGS(), decisions: DECISIONS(), actionPlan: [], riskProfile: [] }, 'cockpit');
await wait(page, 300);

// Raise two actions onto the plan through the app's own door, so whatever
// link it keeps between a decision and its plan action is really there.
// One plan action has since moved on to In progress.
await page.evaluate(() => {
  const d2 = _decisions().find(d => d.id === 'dec_old2'), d3 = _decisions().find(d => d.id === 'dec_mid1');
  const ap2 = _decisionAction(d2, 'Agreed at the client meeting on ' + fmtDate(d2.date));
  _decisionAction(d3, 'Agreed at the client meeting on ' + fmtDate(d3.date));
  ap2.status = 'In progress';
  saveData();
});

// Small readers the steps share.
await page.evaluate(() => {
  window.__fn = n => { try { return new Function('return typeof ' + n)() === 'function'; } catch (e) { return false; } };
  window.__text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  window.__cell = c => (c == null ? '' : (typeof c === 'object' ? String(c.text !== undefined ? c.text : (c.pill !== undefined ? c.pill : '')) : String(c)));
  window.__colour = c => (c && typeof c === 'object' && Array.isArray(c.color)) ? c.color : null;
  window.__red = c => { const k = __colour(c); return !!k && k[0] > 150 && k[1] < 90 && k[2] < 90; };
  // Watch the report being built: every heading, line of text, key-value and
  // table it draws through the PDF kit, in order, plus any text drawn on the
  // page directly (a heading the kit was not used for).
  window.__spy = () => {
    const log = [], meta = {}, mk = window._mkPdf;
    window._mkPdf = function (title, client, d, sub) {
      meta.title = title; meta.client = client; meta.sub = sub || ''; meta.code = d && d.ref;
      const K = mk.apply(null, arguments); let depth = 0;
      const wrap = (name, toS) => { const f = K[name]; K[name] = function () {
        depth++;
        try { log.push({ k: name, s: toS.apply(null, arguments), a: [...arguments].map(x => { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return null; } }) }); return f.apply(this, arguments); }
        finally { depth--; } }; };
      wrap('section', t => String(t));
      wrap('text', t => String(t));
      wrap('kv', (l, v) => String(l) + ': ' + String(v == null ? '' : v));
      wrap('table', (cols, rows) => (cols || []).map(c => c.header).join(' | ') + ' || ' + (rows || []).map(r => r.map(__cell).join(' | ')).join(' || '));
      const dt = K.doc.text; K.doc.text = function (t) { if (!depth) log.push({ k: 'doc', s: Array.isArray(t) ? t.join(' ') : String(t) }); return dt.apply(this, arguments); };
      return K;
    };
    return { log, meta, undo: () => { window._mkPdf = mk; } };
  };
  // the meeting sections in a log, and the slice of the log under each
  window.__meetings = log => {
    const at = log.map((e, i) => (e.k === 'section' && / - client meeting/.test(e.s)) ? i : -1).filter(i => i >= 0);
    return at.map((i, j) => ({ title: log[i].s, at: i, seg: log.slice(i, j + 1 < at.length ? at[j + 1] : log.length) }));
  };
  window.__monthAt = (log, label) => log.map((e, i) => (e.k !== 'table' && e.k !== 'kv' && new RegExp('^\\s*' + label + '\\b', 'i').test(e.s)) ? i : -1).filter(i => i >= 0);
  window.__table = seg => { const e = seg.find(x => x.k === 'table'); if (!e) return null;
    return { head: (e.a[0] || []).map(c => c.header), rows: (e.a[1] || []).map(r => ({ cells: r.map(__cell), raw: r })) }; };
  window.__blobHead = async b => (b && b.slice) ? await b.slice(0, 5).text() : '';
});

// ── 0. what the builders agreed to provide ──
{
  const miss = await page.evaluate(() => ['_clientNotesPdf', 'downloadClientNotes', 'openQuickMinutes', 'closeQuickMinutes', '_qmWritten', '_sltSaveBlob', '_mkPdf'].filter(n => !__fn(n)));
  if (!R.ok(!miss.length, 'every function the client notes need is there' + (miss.length ? ' - missing: ' + miss.join(', ') : ''))) await R.done(browser, errors);
}

// ── 1. a controlled document of its own ──
{
  const t = await page.evaluate(() => {
    const i = REPORT_DOCS.findIndex(r => r.key === 'clientNotes'), j = REPORT_DOCS.findIndex(r => r.key === 'meetingMinutes');
    return { row: REPORT_DOCS[i] || null, next: i >= 0 && j >= 0 && Math.abs(i - j) === 1, ref: _docFor('clientNotes').ref };
  });
  R.ok(t.row && t.row.title === 'Client Meeting Notes' && t.row.code === 'CMN', 'REPORT_DOCS has Client Meeting Notes, code CMN');
  R.ok(t.next && /-CMN$/.test(t.ref), 'next to the leadership Meeting Minutes, with its own reference (' + t.ref + ')');
}

// ── 2. the whole report: newest first, under its month ──
{
  const t = await page.evaluate(async (D) => {
    const spy = __spy();
    let p; try { p = _clientNotesPdf(); } finally { spy.undo(); }
    const log = spy.log, ms = __meetings(log);
    const label = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const all = log.map(e => e.s).join(' \n ');
    const segText = m => m.seg.map(e => e.s).join(' \n ');
    const presentOf = m => (m.seg.find(e => e.k === 'kv' && /^Present:/.test(e.s)) || {}).s || '';
    const order = m => { const iP = m.seg.findIndex(e => e.k === 'kv' && /^Present:/.test(e.s)), iT = m.seg.findIndex(e => e.k === 'table');
      return { iP, iT }; };
    return {
      meta: spy.meta, fname: p && p.fname, size: p && p.blob ? p.blob.size : 0, head: await __blobHead(p && p.blob),
      titles: ms.map(m => m.title),
      want: [fmtDate(D.TODAY) + ' - client meeting - still open', fmtDate(D.MID) + ' - client meeting', fmtDate(D.OLD) + ' - client meeting'],
      months: [label(D.TODAY), label(D.MID), label(D.OLD)].map(l => ({ l, at: __monthAt(log, l) })),
      secAt: ms.map(m => m.at),
      oldest: fmtDate(D.OLD), newest: fmtDate(D.TODAY), emptyDate: fmtDate(D.EMPTY),
      ghost: /Ghost/.test(all), board: /Boardroom only talk|Board-only decision text|A loose decision/.test(all),
      emptySection: log.some(e => e.k === 'section' && e.s.indexOf(fmtDate(D.EMPTY)) >= 0),
      present: ms.map(presentOf), order: ms.map(order),
      seg: ms.map(segText),
      // the notes may be drawn as text or as a Notes key-value - either way after Present
      noteIdx: ms.map(m => m.seg.findIndex(e => e.k !== 'table' && !(e.k === 'kv' && /^Present:/.test(e.s)) && /Still talking about the paint store|Walked the yard with Jo|No notes\./.test(e.s))),
      tables: ms.map(m => __table(m.seg)),
      redOld1: (() => { const tb = __table((ms[2] || { seg: [] }).seg); const r = tb && tb.rows.find(x => /forklift route/.test(x.cells[0])); return r ? __red(r.raw[2]) : null; })(),
      redOld2: (() => { const tb = __table((ms[2] || { seg: [] }).seg); const r = tb && tb.rows.find(x => /racking labels/.test(x.cells[0])); return r ? __red(r.raw[2]) : null; })(),
      due: { old1: fmtDate(D.OLD1DUE), old2: fmtDate(D.OLD2DUE), open1: fmtDate(D.OPEN1DUE) },
    };
  }, { TODAY, MID, OLD, EMPTY, OLD1DUE: day(-10), OLD2DUE: day(20), OPEN1DUE: day(15) });

  R.ok(t.meta.title === 'Client Meeting Notes', 'the report is titled Client Meeting Notes (' + t.meta.title + ')');
  R.ok(t.meta.sub.indexOf(t.oldest) >= 0 && t.meta.sub.indexOf(t.newest) >= 0, 'its subtitle is the date range it covers (' + t.meta.sub + ')');
  R.ok(/^client-meeting-notes-fairbank-fabrications-ltd-\d{4}-\d\d-\d\d\.pdf$/.test(t.fname || '') && t.head === '%PDF-' && t.size > 2000,
    'a real PDF, named for the client and the day (' + t.fname + ', ' + t.size + ' bytes)');
  R.ok(t.titles.join(' | ') === t.want.join(' | '), 'every client meeting minuted, newest first, the open one marked still open: ' + t.titles.join(' | '));
  const mAt = t.months.map(m => m.at), s = t.secAt;
  const monthsOk = mAt.every(a => a.length === 1) && s.length === 3 && mAt[0][0] < s[0] && s[0] < mAt[1][0] && mAt[1][0] < s[1] && s[1] < mAt[2][0] && mAt[2][0] < s[2];
  R.ok(monthsOk, 'each under its month heading: ' + t.months.map(m => m.l + '@' + m.at.join('/')).join(', ') + ' / meetings@' + s.join(','));
  R.ok(!t.ghost && !t.emptySection, 'a meeting with nothing written in it is left out (' + t.emptyDate + ')');
  R.ok(!t.board, 'the leadership meeting and loose decisions are not client meeting notes');
  R.ok(/Sam Line/.test(t.present[0]) && /Operations Director/.test(t.present[0]) && /Not recorded/.test(t.present[1]) && /Jo Fine/.test(t.present[2]) && /Managing Director/.test(t.present[2]),
    'who was there, with their roles - or "Not recorded": ' + t.present.join(' / '));
  R.ok(/Walked the yard with Jo\./.test(t.seg[2] || '') && /Agreed the forklift route needs marking before the next delivery\./.test(t.seg[2] || '')
    && /No notes\./.test(t.seg[1] || '') && /Still talking about the paint store\./.test(t.seg[0] || ''),
    'the notes in full, every line of them - "No notes." where none were taken');
  R.ok(t.order.every((o, i) => o.iP > 0 && t.noteIdx[i] > o.iP && o.iT > t.noteIdx[i]), 'each meeting reads: heading, who was there, the notes, then the actions');
  const heads = t.tables.map(tb => tb ? tb.head.join('|') : '(no table)');
  R.ok(heads.every(h => h === 'ACTION|WHO|BY WHEN|STATUS'), 'the actions as a table - ACTION / WHO / BY WHEN / STATUS (' + heads.join('; ') + ')');
  const row = (i, rx) => { const tb = t.tables[i]; const r = tb && tb.rows.find(x => rx.test(x.cells[0])); return r ? r.cells : null; };
  const open1 = row(0, /fire door to the paint store/), mid1 = row(1, /first aid refresher/), old1 = row(2, /forklift route/), old2 = row(2, /racking labels/);
  R.ok(!!(open1 && open1[1] === 'Dave' && open1[2] === t.due.open1 && open1[3] === 'Agreed'), 'an action not raised reads Agreed, with who and by when: ' + (open1 || []).join(' | '));
  R.ok(!!(old1 && old1[1] === 'Sam Line' && old1[2] === t.due.old1 && old1[3] === 'Agreed'), 'and so does the overdue one: ' + (old1 || []).join(' | '));
  R.ok(!!(old2 && old2[1] === 'Jo Fine' && old2[2] === t.due.old2 && (old2[3] === 'On the plan' || old2[3] === 'In progress')),
    'an action raised onto the plan says so - or where its plan action now stands: ' + (old2 || []).join(' | '));
  R.ok(!!(mid1 && (mid1[3] === 'On the plan' || mid1[3] === 'Not started')), 'every raised action does: ' + (mid1 || []).join(' | '));
  R.ok(t.redOld1 === true && t.redOld2 === false, 'a date that has passed on an open action prints in red; one still to come does not');
}

// ── 3. Download: saved through the one door, with a word to say so ──
{
  const t = await page.evaluate(async () => {
    const saved = [], keep = window._sltSaveBlob;
    window._sltSaveBlob = (b, f) => saved.push({ f, b });
    try { await downloadClientNotes(); } finally { window._sltSaveBlob = keep; }
    return { n: saved.length, f: saved[0] ? saved[0].f : '', type: saved[0] && saved[0].b ? saved[0].b.type : '', head: await __blobHead(saved[0] && saved[0].b),
      toast: __text(document.getElementById('toast')) };
  });
  R.ok(t.n === 1 && /^client-meeting-notes-fairbank-fabrications-ltd-\d{4}-\d\d-\d\d\.pdf$/.test(t.f) && t.head === '%PDF-', 'downloadClientNotes() saves the PDF (' + t.f + ')');
  R.ok(/✓ Client meeting notes saved/.test(t.toast), 'and says so: ' + t.toast);
}

// ── 4. one meeting on its own ──
{
  const t = await page.evaluate(async (D) => {
    const one = id => { const spy = __spy(); let p; try { p = _clientNotesPdf(id); } finally { spy.undo(); }
      const all = spy.log.map(e => e.s).join(' \n ');
      return { titles: __meetings(spy.log).map(m => m.title), sub: spy.meta.sub, fname: p && p.fname, all }; };
    const open = one('mtg_open1'), mid = one('mtg_mid1');
    return { open, mid, today: fmtDate(D.TODAY), midDate: fmtDate(D.MID) };
  }, { TODAY, MID });
  R.ok(t.open.titles.length === 1 && t.open.titles[0] === t.today + ' - client meeting - still open' && t.open.sub.indexOf(t.today) >= 0,
    'given a meeting, it prints that one only - even while still open - dated in the subtitle (' + t.open.sub + ')');
  R.ok(!/Walked the yard|first aid refresher/.test(t.open.all) && /fire door to the paint store/.test(t.open.all), 'nothing from the other meetings creeps in');
  R.ok(t.mid.titles.length === 1 && t.mid.titles[0] === t.midDate + ' - client meeting' && t.mid.sub.indexOf(t.midDate) >= 0, 'a finished one prints on its own the same way');
  R.ok(/^client-meeting-notes-fairbank-fabrications-ltd-/.test(t.open.fname || ''), 'under the same file name');
}

// ── 5. the minute taker prints its own meeting ──
{
  const t = await page.evaluate(() => new Promise(res => {
    openQuickMinutes();
    const ov = document.getElementById('qmOv');
    const foot = ov ? ov.querySelector('.qm-foot') : null;
    const btns = foot ? [...foot.querySelectorAll('button')] : [];
    const names = btns.map(b => b.textContent.trim());
    const iClose = names.indexOf('Close - keep for later'), iPrint = names.indexOf('⭳ Print notes');
    const pb = btns[iPrint];
    const out = { names, iClose, iPrint, cls: pb ? pb.className : '', call: pb ? (pb.getAttribute('onclick') || '') : '', current: (_qmCurrent() || {}).id };
    if (!pb) { closeQuickMinutes(); res(out); return; }
    // click it, watching the save, the file and what was printed
    const seq = [], keepSave = window.saveData, keepBlob = window._sltSaveBlob, spy = __spy();
    window.saveData = function () { seq.push('save'); return keepSave.apply(this, arguments); };
    window._sltSaveBlob = (b, f) => { seq.push('file:' + f); };
    pb.click();
    setTimeout(() => {
      window.saveData = keepSave; window._sltSaveBlob = keepBlob; spy.undo();
      out.seq = seq; out.titles = __meetings(spy.log).map(m => m.title);
      out.stillOpen = !!document.getElementById('qmOv');
      closeQuickMinutes();
      res(out);
    }, 300);
  }));
  R.ok(t.iPrint > t.iClose && t.iClose >= 0, 'the minute taker\'s footer has "⭳ Print notes" after "Close - keep for later": ' + t.names.join(' / '));
  R.ok(/\bbtn\b/.test(t.cls) && /\bbtn-ghost\b/.test(t.cls), 'a quiet button, like Close (' + t.cls + ')');
  R.ok(/saveData\(\)/.test(t.call) && /downloadClientNotes\(\s*['"]mtg_open1['"]\s*\)/.test(t.call) && t.call.indexOf('saveData') < t.call.indexOf('downloadClientNotes'),
    'it saves, then prints this meeting (' + t.call + ')');
  const iS = (t.seq || []).indexOf('save'), iF = (t.seq || []).findIndex(x => /^file:client-meeting-notes-/.test(x));
  R.ok(iS >= 0 && iF > iS, 'clicking it saves the minutes first, then the PDF (' + (t.seq || []).join(' > ') + ')');
  R.ok((t.titles || []).length === 1 && /still open$/.test(t.titles[0]), 'and prints only the meeting on screen: ' + (t.titles || []).join(' | '));
}

// ── 6. the Reports tab ──
{
  const t = await page.evaluate(() => {
    switchTab('reports');
    const tab = document.getElementById('tab-reports');
    const cards = [...tab.querySelectorAll('.rep-card')].map(c => ({ title: __text(c.querySelector('h3')), meta: __text(c.querySelector('.rep-meta')), text: __text(c), c }));
    const titles = cards.map(c => c.title), i = titles.indexOf('Client Meeting Notes'), j = titles.indexOf('Risk Action Sheet');
    const out = { i, j, meta: i >= 0 ? cards[i].meta : '', text: i >= 0 ? cards[i].text : '' };
    if (i >= 0) {
      const saved = [], keep = window._sltSaveBlob; window._sltSaveBlob = (b, f) => saved.push(f);
      const btn = cards[i].c.querySelector('.rep-btn');
      try { if (btn) btn.click(); } finally { window._sltSaveBlob = keep; }
      out.saved = saved;
    }
    // with nothing minuted, the card says where minutes are taken
    const keepM = S.meetings; S.meetings = keepM.filter(m => !m.quick);
    switchTab('cockpit'); switchTab('reports');
    const c2 = [...document.querySelectorAll('#tab-reports .rep-card')].find(c => __text(c.querySelector('h3')) === 'Client Meeting Notes');
    out.emptyMeta = c2 ? __text(c2.querySelector('.rep-meta')) : '';
    S.meetings = keepM;
    switchTab('cockpit');
    return out;
  });
  R.ok(t.i >= 0 && t.j >= 0 && t.i === t.j + 1, 'the Reports tab has a Client Meeting Notes card, straight after the Risk Action Sheet');
  R.ok(t.meta === '3 meetings minuted', 'its line counts the meetings that print - the open one too, not the empty one (' + t.meta + ')');
  R.ok(/Your own notes from client meetings/.test(t.text) && /Personal notes/.test(t.text) && /Client meetings/.test(t.text), 'it says what it is: your own notes from client meetings');
  R.ok((t.saved || []).length === 1 && /^client-meeting-notes-/.test(t.saved[0]), 'and its button saves the notes (' + (t.saved || []).join(', ') + ')');
  R.ok(/^Nothing minuted yet/.test(t.emptyMeta) && /Minutes on the cockpit ladder/.test(t.emptyMeta), 'with nothing minuted, it says where to take them: ' + t.emptyMeta);
}

// ── 7. nothing minuted at all ──
{
  const t = await page.evaluate(() => {
    const keepM = S.meetings; S.meetings = [];
    const spy = __spy(); let p;
    try { p = _clientNotesPdf(); } finally { spy.undo(); S.meetings = keepM; }
    return { said: spy.log.map(e => e.s).join(' \n '), sections: __meetings(spy.log).length, ok: !!(p && p.blob && p.blob.size > 1000) };
  });
  R.ok(t.ok && t.sections === 0 && /No client meeting notes yet/.test(t.said) && /Minutes/.test(t.said),
    'with none at all, the report still prints and says where to take them');
}

// ── 8. a month heading never sits alone at the foot of a page ──
// The newest meeting's notes grow a line at a time, walking the next month's
// heading down the page and over the page break; at every length the heading
// must be on the same page as the meeting under it.
{
  const t = await page.evaluate((D) => {
    const label = new Date(D.MID + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const rx = new RegExp('^\\s*' + label + '\\b', 'i');
    const keepM = S.meetings, bad = [], pages = [];
    try {
      for (let n = 1; n <= 64; n++) {
        S.meetings = [
          { id: 'mtg_long', quick: true, forum: 'Client meeting', date: D.TODAY, status: 'finished', finishedAt: D.TODAY + 'T16:00:00.000Z', attendees: [],
            note: Array.from({ length: n }, (_, i) => 'Line ' + (i + 1) + ' of a long set of notes.').join('\n') },
          { id: 'mtg_prev', quick: true, forum: 'Client meeting', date: D.MID, status: 'finished', finishedAt: D.MID + 'T16:00:00.000Z', attendees: [], note: 'The meeting the month before.' }];
        const log = [], mk = window._mkPdf;
        window._mkPdf = function () {
          const K = mk.apply(null, arguments);
          const pg = () => (K.doc.getNumberOfPages ? K.doc.getNumberOfPages() : K.doc.internal.getNumberOfPages());
          ['text', 'section'].forEach(name => { const f = K[name]; K[name] = function (s) { const r = f.apply(this, arguments); log.push({ k: name, s: String(s), pg: pg() }); return r; }; });
          return K;
        };
        try { _clientNotesPdf(); } finally { window._mkPdf = mk; }
        const iH = log.findIndex(e => e.k === 'text' && rx.test(e.s));
        const iS = log.findIndex((e, i) => i > iH && e.k === 'section' && / - client meeting/.test(e.s));
        if (iH < 0 || iS < 0) { bad.push(n + ' lines: heading or meeting missing'); continue; }
        if (log[iH].pg !== log[iS].pg) bad.push(n + ' lines: ' + label + ' on page ' + log[iH].pg + ', its meeting on page ' + log[iS].pg);
        pages.push(log[iH].pg);
      }
    } finally { S.meetings = keepM; }
    return { bad, label, maxPage: Math.max(0, ...pages) };
  }, { TODAY, MID });
  R.ok(t.maxPage >= 2, 'the notes grow long enough to carry ' + t.label + ' over the page break (page ' + t.maxPage + ')');
  R.ok(!t.bad.length, 'at every length the month heading stays on the page with its first meeting' + (t.bad.length ? ' - stranded at ' + t.bad.join('; ') : ''));
}

await R.done(browser, errors);
