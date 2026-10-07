// ══════════════════════════════════════════════════════════════
//  Action sheet layout - both kinds (Top 5 and Risk), every page.
//  Simon, 2026-10-07, after seeing the sheet live: "Nearly there, but you
//  have put the high level control in the table to answer when it should be
//  the action - frame it the same as it is in the Action delegation &
//  timescale modal view, but obviously in the table so it can be edited. One
//  thing I noticed: the sheets and the restrictions on white space need to be
//  reviewed - make sure white space is minimised and nothing bleeds into
//  headers or footers."
//  So each risk page's table lists the risk's OPEN plan actions grouped
//  under the high level control each puts in place, in tab 4's order (a
//  heading row a control, a gap row for a control nothing puts in place yet,
//  then Not linked to a control); who and by when come prefilled from the
//  plan. And on every page of both kinds: one content box - nothing above
//  the masthead rule but the masthead, nothing below the bottom margin but
//  the footer _pdfFormFooter draws - no spread gaps, the comments box right
//  under its table, a page break only when the next row truly does not fit,
//  the closing parts straight on when they fit.
//  After the rendered pages (the orchestrator): a control already in place
//  with nothing open has its heading alone - no gap row; a gap row reads, on
//  one line, "No action identified - please propose".
//  The matrix: Top 5 with five risks (0, 1, 3 and 9 controls; 1 to 12 open
//  actions; a long action, a long control, a very long recommendation; two
//  controls in place with nothing open), Top 5 with one free action, a risk
//  sheet of one (an owner named Łukasz, ≥ and ✓ in an action), of six (a
//  control with nothing open, a risk with nothing open at all, a 12-row
//  table, meetings) and of fourteen with 30 meetings and a 2,000-word note.
//  Then the Client Meeting Notes PDF over the same 30 meetings: jsPDF never
//  writes below its bottom margin or into its footer band. Then a table that
//  breaks with the least room left (Continued overleaf where it is tightest),
//  and a last comments box squeezed so the closing part follows straight on.
//  Every sheet is built through the app's own functions (toggleRiskTop5 /
//  toggleRiskSheet / asNewSheet / asRec / buildActionSheetPDF); pdf-lib's
//  draw calls are watched per page while it builds and every field widget's
//  rectangle is read afterwards.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Action sheet layout - actions under their controls, nothing in the header or footer');
const { browser, page, errors } = await openApp();

// ── the page as buildActionSheetPDF sets it out ──
const W = 595.28, H = 841.89, ML = 40, MR = W - 40, CW = MR - ML, BOT = 60, TOPIN = H - 58;
const INK = '1D1F20', ACC = '5980A6', GROUND = 'F2F2F3', PANEL = 'E6EDF4';
const BANDC = { Critical: 'DC2626', High: 'EA580C', Medium: 'F59E0B', Low: '16A34A', '': '9CA3AF' };
// one line in the action column (the orchestrator, after the rendered pages): the same words under a control
// not yet in place and for a risk with nothing open and no controls
const GAP_CTL = 'No action identified - please propose';
const GAP_NONE = 'No action identified - please propose';

const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const inMonth = dd => { const d = new Date(); d.setDate(Math.max(1, Math.min(28, dd))); return ymd(d); };
const dmy = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;
const short = s => { s = norm(s); return s.length > 60 ? s.slice(0, 57) + '...' : s; };
const ctl = (id, desc, o) => Object.assign({ id, desc, owner: '', due: '', status: 'Not started', hideFromPlan: true }, o || {});
const act = (id, desc, o) => Object.assign({ id, desc, owner: 'Jo Fine', due: day(30), status: 'Not started', priority: 'High' }, o || {});
const COMPANY = { tradingName: 'Fairbank Fabrications Ltd', slt: [
  { name: 'Jo Fine', role: 'Managing Director', email: 'jo@fairbank.example' },
  { name: 'Sam Line', role: 'Operations Director', email: 'sam@fairbank.example' }] };

// Words that run on: an action, a control and a recommendation far longer
// than a page wants, so the sheet has to clip them and still start its table.
const LONG_DESC = 'Replace the asbestos-containing gaskets on the plant room boiler flanges with non-asbestos gaskets, using a licensed contractor working to a written plan of work with air monitoring and a four-stage clearance, and keep the waste consignment notes on file';
const LONG_CTL = 'No one disturbs any material in the plant room until a refurbishment and demolition survey has been done, the register is updated, every material is labelled, the permit to work names the asbestos check and the contractor has signed to say they have read the register before any tool touches the fabric of the building';
const LONG_REC = ('A licensed asbestos contractor removes the gaskets under a written plan of work notified to the HSE, with an enclosure, air monitoring by an independent analyst and a four-stage clearance before the plant room is reopened; the register and the labels are updated the same day and the waste goes out under a consignment note kept on file for three years. ').repeat(5).slice(0, 1500);

// a long note for the minutes: about 2,000 words, a few paragraphs
const WORDS = ['the', 'yard', 'gate', 'forklift', 'route', 'was', 'walked', 'with', 'Jo', 'and', 'Sam', 'who', 'agreed', 'that', 'marking', 'needs', 'doing', 'before', 'next', 'delivery',
  'racking', 'labels', 'paint', 'store', 'door', 'survey', 'roof', 'hatch', 'rescue', 'plan', 'training', 'booked', 'November', 'contractor', 'induction', 'checked', 'records', 'kept'];
const LONG_NOTE = Array.from({ length: 2000 }, (_, i) => WORDS[(i * 7 + (i >> 3)) % WORDS.length] + ((i + 1) % 180 === 0 ? '.\n' : (i + 1) % 23 === 0 ? '.' : '')).join(' ').replace(/ \n/g, '\n') + ' end of the long note.';

// ── what the pages watch and read ──
await page.evaluate(() => {
  // The sheet as built: every text, rectangle, line and path drawn, with its
  // page (in the order the pages were added), its box and its colour, and
  // whether _pdfFormFooter drew it; then every field's rectangle, page and
  // text, and the meta.
  window.__collect = async sid => {
    const L = PDFLib, P = L.PDFPage.prototype, D = L.PDFDocument.prototype;
    const o = { t: P.drawText, r: P.drawRectangle, l: P.drawLine, s: P.drawSvgPath, add: D.addPage, foot: window._pdfFormFooter };
    const els = [], pages = []; let ph = 'body', seq = 0;
    const hex = c => (c && typeof c.red === 'number') ? [c.red, c.green, c.blue].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase() : '';
    const push = e => { e.i = seq++; e.ph = ph; els.push(e); };
    D.addPage = function () { const p = o.add.apply(this, arguments); pages.push(p); return p; };
    P.drawText = function (s, q) { q = q || {}; const size = q.size || 24, f = q.font; let w = 0; try { w = f ? f.widthOfTextAtSize(String(s), size) : 0; } catch (e) {}
      const x = q.x || 0, y = q.y || 0;
      push({ k: 't', p: pages.indexOf(this), s: String(s), x, y, size, x0: x, x1: x + w, y0: y - 0.21 * size, y1: y + 0.72 * size, c: hex(q.color), bold: !!(f && /Bold/.test(String(f.name || ''))) });
      return o.t.call(this, s, q); };
    P.drawRectangle = function (q) { q = q || {}; const x = q.x || 0, y = q.y || 0, w = q.width || 0, h = q.height || 0, bw = q.borderColor ? (q.borderWidth == null ? 1 : q.borderWidth) : 0;
      push({ k: 'r', p: pages.indexOf(this), x0: Math.min(x, x + w) - bw / 2, x1: Math.max(x, x + w) + bw / 2, y0: Math.min(y, y + h) - bw / 2, y1: Math.max(y, y + h) + bw / 2, w: Math.abs(w), h: Math.abs(h), c: q.color ? hex(q.color) : '', bc: hex(q.borderColor) });
      return o.r.call(this, q); };
    P.drawLine = function (q) { q = q || {}; const a = q.start || {}, b = q.end || {}, t = q.thickness == null ? 1 : q.thickness, hz = a.y === b.y, vt = a.x === b.x;
      push({ k: 'l', p: pages.indexOf(this), x0: Math.min(a.x, b.x) - (vt ? t / 2 : 0), x1: Math.max(a.x, b.x) + (vt ? t / 2 : 0), y0: Math.min(a.y, b.y) - (hz ? t / 2 : 0), y1: Math.max(a.y, b.y) + (hz ? t / 2 : 0), y: (a.y + b.y) / 2, t, c: hex(q.color) });
      return o.l.call(this, q); };
    P.drawSvgPath = function (path, q) { q = q || {}; const sc = q.scale || 1, x = q.x || 0, y = q.y || 0;
      const n = (String(path).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number), xs = [x], ys = [y];
      for (let k = 0; k + 1 < n.length; k += 2) { xs.push(x + n[k] * sc); ys.push(y - n[k + 1] * sc); }      // pdf-lib draws an SVG path with its y axis pointing down
      push({ k: 's', p: pages.indexOf(this), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), c: hex(q.color) });
      return o.s.call(this, path, q); };
    window._pdfFormFooter = function () { ph = 'footer'; try { return o.foot.apply(this, arguments); } finally { ph = 'body'; } };
    let bytes;
    try { bytes = await buildActionSheetPDF(sid); }
    finally { P.drawText = o.t; P.drawRectangle = o.r; P.drawLine = o.l; P.drawSvgPath = o.s; D.addPage = o.add; window._pdfFormFooter = o.foot; }
    const doc = await L.PDFDocument.load(bytes), form = doc.getForm(), dp = doc.getPages();
    const pageOf = f => {
      const w = f.acroField.getWidgets()[0], at = w && w.P ? w.P() : null;
      if (at) { const i = dp.findIndex(p => String(p.ref) === String(at)); if (i >= 0) return i; }
      const kids = f.acroField.Kids ? f.acroField.Kids() : null, wr = String(kids && kids.size() ? kids.get(0) : f.ref);
      return dp.findIndex(p => { const an = p.node.Annots(); if (!an) return false; for (let k = 0; k < an.size(); k++) if (String(an.get(k)) === wr) return true; return false; });
    };
    const fields = {};
    form.getFields().forEach(f => { const n = f.getName(); let r = null; try { r = f.acroField.getWidgets()[0].getRectangle(); } catch (e) {}
      let text = null; try { text = typeof f.getText === 'function' ? (f.getText() || '') : null; } catch (e) {}
      fields[n] = r ? { x: r.x, y: r.y, w: r.width, h: r.height, p: pageOf(f), multi: typeof f.isMultiline === 'function' ? f.isMultiline() : null, text } : null; });
    let meta = null; try { meta = JSON.parse(form.getTextField('as__meta').getText()); } catch (e) {}
    // the footer's own positions, read from the code that draws it
    const FL = _pdfFooterLayout({ widthOfTextAtSize: () => 10 }, { ML: 40, MR: 595.28 - 40, producer: 'x', mid: 'y', page: 1, pages: 1 });
    let b = ''; bytes.forEach(x => { b += String.fromCharCode(x); });
    return { els, fields, meta, pages: dp.length, added: pages.length, FL: { ruleY: FL.ruleY, leftY: FL.leftY, labelY: FL.labelY, midY: FL.midY }, b64: btoa(b) };
  };
  // What each page's table must hold, derived here from the plan as tab 4
  // shows it: a risk's open actions (not deleted, not a control row, with
  // words, not Complete or Accepted) under each control with words, in the
  // control table's order - a gap row for a control not yet in place that
  // nothing open puts in place; a control in place with nothing open, its
  // heading alone (bare) - then those not linked to a live control; a risk
  // with no controls, its open actions; nothing at all, one gap row; no risk,
  // the action itself. Who is as the PDF's letters print it (_pdfAscii).
  window.__expect = sid => {
    const s = _asSheet(sid), A = t => _pdfAscii(String(t == null ? '' : t)), F = d => d ? _pdfAscii(fmtDate(d)) : '';
    const kind = _asKindOf(s), N = s.items.length, whoOf = a => A(_ownersOf(a).join(', '));
    const items = s.items.map((it, i) => {
      const r = _execRiskOf({ ref: it.ref }), own = it.ref.t === 'free' ? it.ref.a : (it.ref.t === 'mgmt' ? it.ref.c : it.ref.b);
      const sc = r ? _riskScore(r) : null, band = (sc && sc.rating) ? (sc.priority || '') : '';
      const row = (a, c, gap) => ({ a: a ? a.id : null, c: c ? c.id : null, who: a ? whoOf(a) : '', due: a ? (a.due || '') : '', text: a ? A(String(a.desc || '').trim()) : gap,
        stat: a ? [a.status || 'Not started', _actionStatus(a)] : [], prio: a ? (a.priority || '') : '', own: !!a && a.id === own, head: null, grp: null });
      let rows = [], ctlN = 0; const bare = [];
      if (!r) rows = [row(_execOrigin(it.ref), null)];
      else {
        const open = (r.actions || []).filter(a => a && !a.deleted && !a.hideFromPlan && String(a.desc || '').trim() && a.status !== 'Complete' && a.status !== 'Accepted');
        const all = _riskCtlRows(r), ctls = all.filter(c => String(c.desc || '').trim());
        ctlN = ctls.length;
        if (!ctls.length) rows = open.length ? open.map(a => row(a, null)) : [row(null, null, GAP_NONE)];
        else {
          ctls.forEach((c, j) => {
            // tab 4 numbers a control by its row on the control table; a blank row there may or may not be counted
            const grp = { kind: 'ctl', id: c.id, nums: [j + 1, all.indexOf(c) + 1], words: A(String(c.desc).trim()),
              st: c.status === 'Complete' ? { done: true, since: F(c.completedDate) } : { done: false, owner: A(whoOf(c)), by: F(c.due) } };
            const mine = open.filter(a => a.forCtl === c.id);
            if (!mine.length && c.status === 'Complete') { bare.push(grp); return; }      // in place, nothing open: its heading alone
            const rs = mine.length ? mine.map(a => row(a, c)) : [row(null, c, GAP_CTL)];
            rs.forEach(x => { x.grp = grp; }); rs[0].head = grp; rows.push(...rs);
          });
          const loose = open.filter(a => !_ctlOfAction(r, a)), grp = { kind: 'loose' };
          if (loose.length) { const rs = loose.map(a => row(a, null)); rs.forEach(x => { x.grp = grp; }); rs[0].head = grp; rows.push(...rs); }
        }
      }
      return { n: i + 1, key: it.key, own, free: !r, band, ctlN, bare, kick: (kind === 'risk' ? 'RISK ' : 'ACTION ') + (i + 1) + ' OF ' + N, rows };
    });
    return { kind, N, client: _sltClient(), sid, no: s.no, keys: s.items.map(i => i.key), made: _asToday(), items };
  };
});
await page.evaluate((a, b) => { window.GAP_CTL = a; window.GAP_NONE = b; }, GAP_CTL, GAP_NONE);

// ── the checks every sheet gets ──
const covers = {};
function checkSheet(tag, b, x, opt = {}) {
  const T = s => '[' + tag + '] ' + s;
  const E = b.els, Fd = b.fields, FL = b.FL;
  const fld = n => Fd[n] || null;
  const isMast = e => e.p > 0 && e.ph === 'body' && ((e.k === 't' && (near(e.y, H - 34) || near(e.y, H - 33))) || (e.k === 'l' && near(e.y, H - 41) && e.x1 - e.x0 > 0.9 * CW));
  const isFoot = e => (e.k === 'l' && near(e.y, FL.ruleY)) || (e.k === 't' && [FL.leftY, FL.labelY, FL.midY].some(v => near(e.y, v)));
  const content = E.filter(e => e.ph === 'body' && !isMast(e));
  const texts = content.filter(e => e.k === 't');
  const desc = e => (e.k === 't' ? '"' + short(e.s) + '"' : e.k === 'r' ? 'rect' : e.k === 'l' ? 'line' : 'path') + ' p' + (e.p + 1) + ' y' + (e.k === 't' ? e.y : e.y0).toFixed(1) + '-' + e.y1.toFixed(1);
  const fieldList = Object.keys(Fd).filter(n => Fd[n]).map(n => Object.assign({ n }, Fd[n]));
  const items = x.items, N = items.length;
  const rowsOf = n => { const out = []; for (let k = 1; fld('as_' + n + '_r' + k + '_cmt'); k++) { const c = fld('as_' + n + '_r' + k + '_cmt');
    out.push({ k, c, who: fld('as_' + n + '_r' + k + '_who'), due: fld('as_' + n + '_r' + k + '_due'), p: c.p, top: c.y + c.h + 2, bot: c.y - 2 }); } return out; };
  const diag = { breaks: 0, closing: [] };
  const rowText = (p, top, bot, x1) => texts.filter(e => e.p === p && e.y >= bot - 0.6 && e.y <= top + 0.6 && e.x0 < x1).map(e => e.s).join(' ');

  // ── the meta (v3) ──
  {
    const m = b.meta || {}, bad = [];
    if (!(m.v === 3 && m.kind === x.kind && m.client === x.client && m.sheet === x.sid && m.no === x.no && m.made === x.made && JSON.stringify(m.keys) === JSON.stringify(x.keys))) bad.push('head ' + JSON.stringify({ v: m.v, kind: m.kind, no: m.no, sheet: m.sheet === x.sid }));
    if ('ctls' in m) bad.push('still carries ctls');
    if (!Array.isArray(m.rows) || m.rows.length !== N) bad.push('rows ' + (Array.isArray(m.rows) ? m.rows.length : typeof m.rows) + ' for ' + N + ' items');
    else items.forEach((it, i) => { const got = m.rows[i] || [];
      if (got.length !== it.rows.length) { bad.push('item ' + it.n + ': ' + got.length + ' rows, want ' + it.rows.length); return; }
      it.rows.forEach((r, k) => { const g = got[k] || {}; if ((g.a || null) !== r.a || (g.c || null) !== r.c || (g.who || '') !== r.who || (g.due || '') !== r.due) bad.push('item ' + it.n + ' row ' + (k + 1) + ': ' + JSON.stringify(g) + ' want ' + JSON.stringify({ a: r.a, c: r.c, who: r.who, due: r.due })); }); });
    R.ok(!bad.length, T('the meta is v3: kind, client, sheet, no, made and keys as before, no ctls, and per item its rows { a, c, who, due } in row order' + (bad.length ? ' - ' + bad.slice(0, 3).join(' | ') : '')));
  }
  // ── the fields: a comment, who and by when on each data row, the comments box, and nothing else ──
  {
    const want = new Set(['as__meta', 'as__general']);
    if (x.kind === 'risk') [1, 2, 3, 4].forEach(k => ['what', 'who', 'due'].forEach(f => want.add('as__m' + k + '_' + f)));
    items.forEach(it => { want.add('as_' + it.n + '_what'); it.rows.forEach((r, k) => ['cmt', 'who', 'due'].forEach(f => want.add('as_' + it.n + '_r' + (k + 1) + '_' + f))); });
    const names = Object.keys(Fd), missing = [...want].filter(n => !names.includes(n)), extra = names.filter(n => !want.has(n));
    R.ok(!missing.length && !extra.length, T('the fields: as_<n>_r<k>_cmt / _who / _due for every data row (headings are not numbered), as_<n>_what, as__general' + (x.kind === 'risk' ? ' and the four meeting rows' : '') + ' - and nothing else'
      + (missing.length ? ' - missing ' + missing.slice(0, 4).join(',') : '') + (extra.length ? ' - extra ' + extra.slice(0, 4).join(',') : '')));
  }
  // ── who and by when prefilled from the plan; gap rows blank; comments empty ──
  {
    const bad = [];
    items.forEach(it => it.rows.forEach((r, k) => { const f = s => { const z = fld('as_' + it.n + '_r' + (k + 1) + '_' + s); return z ? (z.text || '') : null; };
      if (f('who') !== r.who || f('due') !== dmy(r.due) || f('cmt') !== '') bad.push(it.n + '.' + (k + 1) + ' who "' + f('who') + '" due "' + f('due') + '" want "' + r.who + '" "' + dmy(r.due) + '"'); }));
    R.ok(!bad.length, T('WHO is prefilled with the action\'s owner (several as "A, B") and BY WHEN with its due as dd/mm/yyyy; a gap row\'s are blank' + (bad.length ? ' - ' + bad.slice(0, 3).join(' | ') : '')));
  }
  // ── the rows, as tab 4 frames them ──
  const geo = {};
  {
    const bad = [], tag2 = [], heads = [], noHeads = [];
    items.forEach(it => {
      const rs = rowsOf(it.n); geo[it.n] = rs;
      if (rs.length !== it.rows.length) { bad.push('item ' + it.n + ' has ' + rs.length + ' field rows'); return; }
      rs.forEach((g, k) => {
        const r = it.rows[k], line = norm(rowText(g.p, g.top, g.bot, g.c.x - 1));
        if (r.a) {
          if (line.indexOf(norm(r.text).slice(0, 40)) < 0) bad.push(it.n + '.' + g.k + ' action "' + short(r.text) + '" not in its cell ("' + short(line) + '")');
          if (!r.stat.some(s => line.indexOf(s) >= 0) || (r.prio && line.indexOf(r.prio) < 0)) bad.push(it.n + '.' + g.k + ' no "' + r.stat[0] + ' · ' + r.prio + '" line ("' + short(line) + '")');
        } else if (line.indexOf(r.text) < 0) bad.push(it.n + '.' + g.k + ' gap row does not say "' + r.text + '" ("' + short(line) + '")');
        if (r.own !== (line.indexOf('PRIORITY') >= 0)) tag2.push(it.n + '.' + g.k + (r.own ? ' has no tag' : ' tagged but not the sheet line'));
        // the region above the row, up to the row above it on the page (or the header rule)
        const prev = rs[k - 1] && rs[k - 1].p === g.p ? rs[k - 1].bot : Math.min(TOPIN, ...E.filter(e => e.p === g.p && e.k === 'l' && e.c === ACC && e.t >= 1 && e.x1 - e.x0 > 0.9 * CW && e.y > g.top).map(e => e.y).concat([TOPIN]));
        const above = texts.filter(e => e.p === g.p && e.y > g.top - 0.6 && e.y < prev);
        const firstOnPage = !(rs[k - 1] && rs[k - 1].p === g.p);
        const ctlT = above.filter(e => /^CONTROL \d+\b/.test(norm(e.s))), loose = above.some(e => /OTHER ACTIONS/.test(norm(e.s).toUpperCase()));
        const reg = norm(above.map(e => e.s).join(' '));
        if (r.head && r.head.kind === 'ctl') {
          const num = ctlT.map(e => +/^CONTROL (\d+)/.exec(norm(e.s))[1]);
          const words = norm(r.head.words).slice(0, 30), wEl = above.find(e => norm(e.s).length > 2 && words.indexOf(norm(e.s).slice(0, 12)) === 0);
          const st = r.head.st, stOk = st.done ? (!st.since || reg.indexOf('In place since ' + st.since) >= 0) : (/Planned/.test(reg) && (!st.owner || reg.indexOf(st.owner) >= 0) && (!st.by || reg.indexOf('by ' + st.by) >= 0));
          if (!num.some(v => r.head.nums.includes(v)) || reg.indexOf(words) < 0 || !wEl || !wEl.bold || wEl.c !== INK || !stOk)
            heads.push(it.n + '.' + g.k + ' CONTROL ' + r.head.nums[0] + ' heading (' + (num.join('/') || 'none') + ', words ' + (reg.indexOf(words) >= 0) + ', bold ink ' + !!(wEl && wEl.bold && wEl.c === INK) + ', status ' + stOk + ')');
          else if (!E.some(e => e.p === g.p && e.k === 'r' && e.c === PANEL && e.x1 - e.x0 >= 0.9 * CW && e.y0 <= ctlT[0].y && e.y1 >= ctlT[0].y)) heads.push(it.n + '.' + g.k + ' heading row is not tinted');
        } else if (r.head && r.head.kind === 'loose') { if (!loose) heads.push(it.n + '.' + g.k + ' no OTHER ACTIONS heading'); }
        else if (!firstOnPage && (ctlT.length || loose)) noHeads.push(it.n + '.' + g.k + ' has a heading over it');
        else if (firstOnPage && ctlT.length && r.grp && r.grp.kind === 'ctl' && !ctlT.some(e => r.grp.nums.includes(+/^CONTROL (\d+)/.exec(norm(e.s))[1]))) noHeads.push(it.n + '.' + g.k + ' sits under another control\'s heading');
      });
      if (!it.ctlN && texts.some(e => geo[it.n].some(g => g.p === e.p) && (/^CONTROL \d+\b/.test(norm(e.s)) || /OTHER ACTIONS/i.test(e.s)))) noHeads.push('item ' + it.n + ' has no controls but prints a heading');
    });
    R.ok(!bad.length, T('each data row prints its action and a "status · priority" line in the ACTION column; a gap row says "' + GAP_CTL + '"' + (bad.length ? ' - ' + bad.slice(0, 3).join(' | ') : '')));
    // a gap row's words sit on one line of the action column
    {
      const gl = []; items.forEach(it => it.rows.forEach((r, k) => { const g = (geo[it.n] || [])[k]; if (!g || r.a) return;
        const ls = texts.filter(e => e.p === g.p && e.y >= g.bot - 0.6 && e.y <= g.top + 0.6 && e.x0 < g.c.x - 1 && /\S/.test(e.s) && !/^\d+$/.test(e.s.trim()));
        if (ls.length !== 1 || norm(ls[0].s) !== r.text) gl.push(it.n + '.' + (k + 1) + ' ' + ls.length + ' lines ("' + short(ls.map(e => e.s).join(' / ')) + '")'); }));
      R.ok(!gl.length, T('a gap row\'s words fit on one line of the action column' + (gl.length ? ' - ' + gl.slice(0, 3).join(' | ') : '')));
    }
    R.ok(!tag2.length, T('the sheet line\'s own action, and only it, carries PRIORITY in its cell' + (tag2.length ? ' - ' + tag2.slice(0, 3).join(' | ') : '')));
    R.ok(!heads.length, T('each control heads its actions as in tab 4: a tinted row, CONTROL k, its words in bold ink and In place since / Planned, owner, by when - then OTHER ACTIONS' + (heads.length ? ' - ' + heads.slice(0, 3).join(' | ') : '')));
    R.ok(!noHeads.length, T('no heading anywhere else - none on a risk with no controls, and a heading never left behind its first row' + (noHeads.length ? ' - ' + noHeads.slice(0, 3).join(' | ') : '')));
    // a control already in place with nothing open: its heading alone - tinted, CONTROL k, its words, In place
    // (since) - and no gap row asking what will be done (the rows above hold none for it)
    const bareBad = []; let bareN = 0;
    items.forEach(it => (it.bare || []).forEach(h => {
      bareN++;
      const ps = (geo[it.n] || []).map(g => g.p).concat(fld('as_' + it.n + '_what') ? [fld('as_' + it.n + '_what').p] : []);
      const lo = Math.min(...ps), hi = Math.max(...ps);
      const lab = texts.find(e => e.p >= lo && e.p <= hi && (m => !!m && h.nums.includes(+m[1]))(/^CONTROL (\d+)$/.exec(norm(e.s))));
      if (!lab) { bareBad.push(it.n + ' CONTROL ' + h.nums[0] + ' has no heading'); return; }
      const after = []; for (let j = lab.i + 1; j < E.length && E[j].k === 't'; j++) after.push(E[j].s);
      const said = norm(after.join(' ')), rect = E[lab.i - 1];
      if (said.indexOf(norm(h.words).slice(0, 20)) !== 0 || said.indexOf('In place' + (h.st.since ? ' since ' + h.st.since : '')) < 0 || !rect || rect.k !== 'r' || rect.c !== PANEL || rect.x1 - rect.x0 < 0.9 * CW)
        bareBad.push(it.n + ' CONTROL ' + h.nums[0] + ' heading reads "' + short(said) + '"');
    }));
    R.ok(!bareBad.length, T('a control in place with nothing open has its heading alone - tinted, its words, In place since - and no gap row (' + bareN + ' on this sheet)' + (bareBad.length ? ' - ' + bareBad.slice(0, 3).join(' | ') : '')));
  }
  // ── the columns and the table's look ──
  {
    const it = items.find(z => z.rows.some(r => r.a)), k = it ? it.rows.findIndex(r => r.a) + 1 : 1, n = it ? it.n : 1;
    const c = fld('as_' + n + '_r' + k + '_cmt'), w = fld('as_' + n + '_r' + k + '_who'), d = fld('as_' + n + '_r' + k + '_due');
    const inR = (v, lo, hi) => v >= lo && v <= hi;
    R.ok(!!c && !!w && !!d && inR(c.x, ML + 0.35 * CW, ML + 0.45 * CW) && inR(c.w, 0.25 * CW, 0.35 * CW) && inR(w.w, 0.10 * CW, 0.20 * CW) && inR(d.w, 0.10 * CW, 0.20 * CW) && c.x < w.x && w.x < d.x && d.x + d.w <= MR + 1.5 && c.multi === true,
      T('the columns: ACTION printed on the left (about 40%), COMMENTS (about 30%, several lines), WHO and BY WHEN (about 15% each)' + (c ? ' (' + [c.x - ML, c.w, w && w.w, d && d.w].map(v => Math.round(v || 0)).join('/') + ')' : '')));
    const bad = [];
    items.forEach(it2 => {
      const rs = geo[it2.n] || []; if (!rs.length) return;
      const p0 = rs[0].p, onP = texts.filter(e => e.p === p0).map(e => norm(e.s));
      if (!onP.includes('RECOMMENDED ACTIONS')) bad.push(it2.n + ' title');
      if (!onP.includes('Proposed owner and target date shown - amend where required')) bad.push(it2.n + ' hint');
      if (!['RECOMMENDED ACTION', 'COMMENTS', 'OWNER'].every(h => onP.includes(h)) || !onP.some(s => /^TARGET DATE/.test(s)) || !onP.some(s => /dd\/mm\/yyyy/.test(s))) bad.push(it2.n + ' header');
      [...new Set(rs.map(g => g.p))].forEach(p => {
        const mine = rs.filter(g => g.p === p), top = Math.max(...mine.map(g => g.top)), bot = Math.min(...mine.map(g => g.bot));
        if (!E.some(e => e.p === p && e.k === 'l' && e.c === ACC && e.t >= 1 && e.x1 - e.x0 >= 0.9 * CW && e.y >= top - 1)) bad.push(it2.n + ' p' + (p + 1) + ' no accent rule under the header');
        if (!E.some(e => e.p === p && e.k === 'r' && e.bc === ACC && e.x1 - e.x0 >= 0.9 * CW && e.y0 <= bot + 2 && e.y1 >= top - 2)) bad.push(it2.n + ' p' + (p + 1) + ' no accent border');
        const bc = BANDC[it2.band] || BANDC[''];
        if (!E.some(e => e.p === p && e.c === bc && e.x0 <= ML + 1.5 && e.x1 - e.x0 <= 5 && e.y0 <= bot + 2 && e.y1 >= top - 2)) bad.push(it2.n + ' p' + (p + 1) + ' no ' + (it2.band || 'unrated') + ' band rule down the left');
        mine.forEach(g => { const mid = (g.top + g.bot) / 2; if (!E.some(e => e.p === p && e.k === 'r' && e.c === GROUND && e.x0 <= ML + 4 && e.x1 >= ML + 0.3 * CW && e.y0 <= mid && e.y1 >= mid)) bad.push(it2.n + '.' + g.k + ' action cell not shaded'); });
      });
    });
    R.ok(!bad.length, T('the table: RECOMMENDED ACTIONS with its hint, ACTION / COMMENTS / WHO / BY WHEN (dd/mm/yyyy), the accent rule under the header, the accent border, the band rule down the left, the printed cells shaded'
      + (bad.length ? ' - ' + bad.slice(0, 4).join(' | ') : '')));
  }
  // ── the content box: nothing above the masthead rule but the masthead, nothing below BOT but the footer ──
  {
    const above = [], below = [], foot = [];
    E.forEach(e => {
      if (e.ph === 'footer') { if (!isFoot(e)) foot.push(desc(e)); return; }
      if (isMast(e)) return;
      const top = e.k === 't' ? e.y + 0.72 * e.size : e.y1, bot = e.k === 't' ? e.y : e.y0;
      if (top > (e.p === 0 ? H : TOPIN) + 1) above.push(desc(e));
      if (bot < BOT - 0.5) below.push(desc(e));
    });
    fieldList.filter(f => f.n !== 'as__meta').forEach(f => {
      if (f.y + f.h > (f.p === 0 ? H : TOPIN) + 1) above.push('field ' + f.n + ' p' + (f.p + 1));
      if (f.y < BOT - 1) below.push('field ' + f.n + ' p' + (f.p + 1) + ' y' + f.y.toFixed(1));
    });
    const masts = [...Array(b.pages).keys()].slice(1).filter(p => !(E.some(e => e.p === p && isMast(e) && e.k === 'l') && E.some(e => e.p === p && isMast(e) && e.k === 't')));
    R.ok(!above.length, T('on every inner page nothing is drawn above the content box (just under the masthead rule) but the masthead - kickers, (continued), the SIF tag, chips, fields' + (above.length ? ' - ' + above.slice(0, 4).join(' | ') : '')));
    R.ok(!below.length, T('on every page nothing is drawn below the bottom margin - rows, rules, Continued overleaf, fields' + (below.length ? ' - ' + below.slice(0, 4).join(' | ') : '')));
    R.ok(!foot.length && E.filter(e => e.ph === 'footer').length >= 3 * b.pages, T('below it only the footer _pdfFormFooter draws: its rule and its two lines of text, on every page' + (foot.length ? ' - ' + foot.slice(0, 3).join(' | ') : '')));
    R.ok(!masts.length && b.added === b.pages, T('every page after the cover opens with the masthead' + (masts.length ? ' - not on page ' + masts.map(p => p + 1).join(',') : '')));
    const m = fld('as__meta');
    R.ok(!!m && m.y >= BOT - 1 && m.y + m.h <= H + 0.5 && m.x >= 0 && m.x + m.w <= W, T('the hidden as__meta field sits inside the content box too' + (m ? ' (y ' + m.y.toFixed(1) + ')' : '')));
    const off = E.filter(e => e.x0 < -0.5 || e.x1 > W + 0.5 || e.y0 < -0.5 || e.y1 > H + 0.5).map(desc).concat(fieldList.filter(f => f.x < 0 || f.x + f.w > W + 0.5 || f.y < 0 || f.y + f.h > H + 0.5 || f.p < 0).map(f => 'field ' + f.n));
    const side = E.filter(e => e.k === 't' && (e.x0 < ML - 0.6 || e.x1 > MR + 0.6)).map(e => desc(e) + ' x' + e.x0.toFixed(1) + '-' + e.x1.toFixed(1));
    R.ok(!off.length, T('nothing is off the page' + (off.length ? ' - ' + off.slice(0, 4).join(' | ') : '')));
    R.ok(!side.length, T('no text runs past the side margins - a clipped line ending " ..." still fits its width' + (side.length ? ' - ' + side.slice(0, 3).join(' | ') : '')));
  }
  // ── each risk on a fresh page, its kicker first: RISK n OF N / ACTION n OF N ──
  const first = {};
  {
    const re = x.kind === 'risk' ? /^RISK (\d+) OF (\d+)\b/ : /^PRIORITY (\d+) OF (\d+)\b/, other = x.kind === 'risk' ? /^PRIORITY \d+ OF \d+\b/ : /^RISK \d+ OF \d+\b/;
    const bad = [];
    items.forEach(it => {
      const k = texts.find(e => { const m = re.exec(norm(e.s)); return m && +m[1] === it.n && +m[2] === N && !/CONTINUED/i.test(e.s); });
      if (!k) { bad.push('no ' + it.kick); return; }
      first[it.n] = k.p;
      const higher = content.filter(e => e.p === k.p && e !== k && e.y1 > k.y + 0.72 * k.size + 4);
      if (higher.length) bad.push(it.kick + ' is not first on its page (' + desc(higher[0]) + ')');
      if (it.n > 1) { const prevWhat = fld('as_' + (it.n - 1) + '_what'); if (prevWhat && prevWhat.p >= k.p) bad.push(it.kick + ' shares a page with the risk before it'); }
      if (fieldList.some(f => f.p === k.p && new RegExp('^as_(?!' + it.n + '_)\\d+_').test(f.n))) bad.push(it.kick + ' page holds another risk\'s boxes');
    });
    R.ok(!bad.length && !texts.some(e => other.test(norm(e.s))), T('each risk starts on a fresh page, headed ' + (x.kind === 'risk' ? 'RISK n OF N (never PRIORITY n OF N)' : 'PRIORITY n OF N') + (bad.length ? ' - ' + bad.slice(0, 3).join(' | ') : '')));
  }
  // ── white space: the table starts on the risk's first page; the comments box right under it; breaks only when needed ──
  {
    const bad = [];
    items.forEach(it => { const rs = geo[it.n] || []; if (rs.length && first[it.n] != null && rs[0].p !== first[it.n]) bad.push(it.kick + ': table starts on page ' + (rs[0].p + 1) + ', not ' + (first[it.n] + 1)); });
    R.ok(!bad.length, T('every risk\'s table starts on the risk\'s own first page - a long text is clipped, not pushed over' + (bad.length ? ' - ' + bad.slice(0, 3).join(' | ') : '')));
  }
  {
    const bad = [];
    items.forEach(it => {
      const rs = geo[it.n] || [], last = rs[rs.length - 1], w = fld('as_' + it.n + '_what'); if (!last || !w) return;
      if (w.p !== last.p) { bad.push(it.n + ': comments box on page ' + (w.p + 1) + ', last row on ' + (last.p + 1)); return; }
      const panel = E.filter(e => e.p === w.p && e.k === 'r' && e.c === PANEL && e.x0 <= w.x + 0.5 && e.x1 >= w.x + w.w - 0.5 && e.y0 <= w.y + 0.5 && e.y1 >= w.y + w.h - 0.5).sort((a, b2) => b2.y1 - a.y1)[0];
      const top = panel ? panel.y1 : w.y + w.h + 20, gap = last.bot - top;
      if (gap < -1 || gap > 30) bad.push(it.n + ': ' + gap.toFixed(1) + 'pt between the table and the comments box');
    });
    R.ok(!bad.length, T('the comments box sits on the same page as the table\'s last row, within 30pt under it - never pinned to the foot, never alone on a page' + (bad.length ? ' - ' + bad.slice(0, 3).join(' | ') : '')));
  }
  {
    const bad = [], strand = [];
    items.forEach(it => {
      const rs = geo[it.n] || [];
      for (let k = 0; k + 1 < rs.length; k++) {
        const a = rs[k], nx = rs[k + 1]; if (nx.p === a.p) continue;
        diag.breaks++;
        const room = a.bot - BOT;
        const head = E.filter(e => e.p === nx.p && e.k === 'r' && e.c === PANEL && e.x1 - e.x0 >= 0.9 * CW && e.y0 >= nx.top - 4 && e.y0 <= nx.top + 4).sort((p, q) => q.y1 - p.y1)[0];
        const unit = (nx.top - nx.bot) + ((it.rows[k + 1] || {}).head ? (head ? head.y1 - head.y0 : 18) : 0) + (k + 1 === rs.length - 1 ? 72 : 0);
        if (room >= unit + 18) bad.push(it.n + '.' + nx.k + ' moved to page ' + (nx.p + 1) + ' with ' + room.toFixed(0) + 'pt left for ' + unit.toFixed(0));
        if (texts.some(e => e.p === a.p && e.y < a.bot && e.y > BOT && (/^CONTROL \d+\b/.test(norm(e.s)) || /OTHER ACTIONS/i.test(e.s)))) strand.push(it.n + ': a heading left at the foot of page ' + (a.p + 1));
      }
    });
    R.ok(!bad.length, T('a page breaks inside a table only when the next row (with its heading, and with the squeezed comments box for the last row) truly does not fit' + (bad.length ? ' - ' + bad.slice(0, 3).join(' | ') : '')));
    R.ok(!strand.length, T('a heading row never sits alone at the foot of a page' + (strand.length ? ' - ' + strand.slice(0, 2).join(' | ') : '')));
  }
  // ── the closing parts: straight on when they fit whole, else a new page - never a half-empty page before them ──
  {
    const bad = [];
    const titles = (x.kind === 'risk' ? ['MEETING RECORD'] : []).concat(['GENERAL COMMENTS']);
    const starts = titles.map(t => { const e = texts.find(z => norm(z.s) === t); if (!e) return null; let i = e.i;
      // a rule drawn just before the title opens the part
      for (let j = i - 1; j >= 0 && j >= e.i - 3; j--) { const z = E[j]; if (z && z.ph === 'body' && z.k === 'l' && z.p === e.p && !isMast(z) && z.y - e.y < 26 && z.y > e.y) i = j; else break; }
      return { t, e, i, p: e.p }; });
    if (starts.some(s => !s)) bad.push('missing ' + titles.filter((t, k) => !starts[k]).join(', '));
    else starts.forEach((s, k) => {
      const end = starts[k + 1] ? starts[k + 1].i : Infinity;
      const part = content.filter(e => e.i >= s.i && e.i < end), partTop = Math.max(...part.filter(e => e.p === s.p).map(e => e.k === 't' ? e.y + 0.72 * e.size : e.y1));
      const before = content.filter(e => e.i < s.i), last = before[before.length - 1];
      const prevP = last ? last.p : 0;
      const fBefore = fieldList.filter(f => f.n !== 'as__meta' && f.p === prevP && !(s.t === 'GENERAL COMMENTS' && f.n === 'as__general') && (prevP !== s.p || f.y > s.e.y));
      const prevBot = Math.min(...before.filter(e => e.p === prevP).map(e => e.k === 't' ? e.y : e.y0).concat(fBefore.map(f => f.y)));
      diag.closing.push(s.t.toLowerCase() + (s.p === prevP ? ' straight on' : ' on a new page') + (part.some(e => e.p > s.p) ? ', running over' : ''));
      if (s.p === prevP) { const gap = prevBot - partTop; if (gap < -1 || gap > 30) bad.push(s.t + ' follows on ' + gap.toFixed(0) + 'pt under what comes before it');
        if (part.some(e => e.p > s.p)) bad.push(s.t + ' follows on but runs over the page - it did not fit whole, so it should start the next page'); }
      else {
        const spans = part.some(e => e.p > s.p), fPart = fieldList.filter(f => f.p === s.p && (s.t === 'MEETING RECORD' ? /^as__m\d/.test(f.n) : f.n === 'as__general'));
        const partBot = Math.min(...part.filter(e => e.p === s.p).map(e => e.k === 't' ? e.y : e.y0).concat(fPart.map(f => f.y)));
        const h = spans ? Infinity : partTop - partBot, room = prevBot - BOT;
        if (s.p !== prevP + 1) bad.push(s.t + ' leaves a blank page before it');
        else if (room >= h + 30) bad.push(s.t + ' starts a new page though ' + room.toFixed(0) + 'pt were left for its ' + h.toFixed(0));
      }
    });
    R.ok(!bad.length, T('the closing parts (' + titles.join(', ').toLowerCase() + ') follow straight on when they fit whole, otherwise start the next page - no half-empty page before them' + (bad.length ? ' - ' + bad.slice(0, 3).join(' | ') : '')));
  }
  // ── no spread gaps: the largest empty band on any page ──
  {
    const bad = [];
    for (let p = 0; p < b.pages; p++) {
      // (the cover's full-bleed accent bar is its top edge, not content)
      const iv = content.filter(e => e.p === p && !(e.x0 <= 0.5 && e.x1 >= W - 0.5)).map(e => [e.k === 't' ? e.y - 0.21 * e.size : e.y0, e.k === 't' ? e.y + 0.72 * e.size : e.y1])
        .concat(fieldList.filter(f => f.p === p && f.n !== 'as__meta').map(f => [f.y, f.y + f.h])).sort((a, c) => c[1] - a[1]);
      let low = null, max = 0, at = 0;
      iv.forEach(([lo, hi]) => { if (low != null && hi < low) { if (low - hi > max) { max = low - hi; at = hi; } } low = low == null ? lo : Math.min(low, lo); });
      const lim = p === 0 ? 30 : 40;
      if (max > lim) bad.push('page ' + (p + 1) + ': ' + max.toFixed(0) + 'pt empty above y' + at.toFixed(0));
    }
    R.ok(!bad.length, T('no spread gaps - nothing on a page sits more than 30pt (cover) or 40pt (inner pages) below what is above it' + (bad.length ? ' - ' + bad.slice(0, 3).join(' | ') : '')));
  }
  // the cover's sections stack with gaps of at most 18pt: the empty band from
  // the end of one section to the next heading is that gap plus the last
  // line's leading (about 4pt), so it never passes 23pt
  {
    const c0 = content.filter(e => e.p === 0 && !(e.x0 <= 0.5 && e.x1 >= W - 0.5)), hd = t => texts.find(z => z.p === 0 && (t instanceof RegExp ? t.test(norm(z.s)) : norm(z.s) === t));
    const P = hd('PURPOSE'), G = hd(/^SUMMARY OF (PRIORITY )?RISKS$/), Wn = hd('RESPONSE REQUIRED');
    const band = (a, b) => { if (!a || !b) return null; const inner = c0.filter(e => e.i > a.i && e.i < b.i && e.y1 <= a.y + 1); if (!inner.length) return null;
      return Math.min(...inner.map(e => e.k === 't' ? e.y - 0.21 * e.size : e.y0)) - (b.y + 0.72 * b.size); };
    const b1 = band(P, G), b2 = band(G, Wn), bad = [];
    if (b1 == null) bad.push('no Purpose and glance on the cover'); else if (b1 > 23) bad.push('Purpose to the glance ' + b1.toFixed(1) + 'pt');
    if (b2 != null && b2 > 23) bad.push('the glance to What we need ' + b2.toFixed(1) + 'pt');
    (covers[x.kind] = covers[x.kind] || []).push({ tag, b1, b2 });
    R.ok(!bad.length, T('the cover stacks its sections with gaps of at most 18pt - never spread to fill the page (' + [b1, b2].map(v => v == null ? '-' : v.toFixed(1)).join('/') + 'pt bands)' + (bad.length ? ' - ' + bad.join(' | ') : '')));
  }
  console.log('    (' + tag + ': ' + diag.breaks + ' table page break' + (diag.breaks !== 1 ? 's' : '') + ' checked; ' + diag.closing.join('; ') + ')');
  // the text a scenario expects clipped
  if (opt.clipped) {
    const n = opt.clipped, pgs = new Set((geo[n] || []).map(g => g.p).concat(first[n] != null ? [first[n]] : []));
    R.ok(texts.some(e => pgs.has(e.p) && / \.\.\.$/.test(e.s)), T('the long text on risk ' + n + '\'s page is clipped, ending " ..."'));
  }
}

// Build a sheet through the app and check it.
async function sheetOf(tag, sid, opt) {
  const t = await page.evaluate(async sid => { const x = __expect(sid); const b = await __collect(sid); return { x, b }; }, sid);
  const f = path.join(os.tmpdir(), 'sheet-layout-' + tag.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf');
  try { fs.writeFileSync(f, Buffer.from(t.b.b64, 'base64')); } catch (e) {}
  console.log('  (' + tag + ': ' + t.b.pages + ' pages, ' + t.x.items.length + ' items, ' + t.x.items.map(i => i.rows.length).join('/') + ' rows - ' + f + ')');
  checkSheet(tag, t.b, t.x, opt || {});
  return t;
}

// ══ A. Top 5: five risks - 3 controls with a gap, none, one, nine, a long one ══
const fireCtls = [], fireActs = [];
{
  const link = { 1: [1, 2], 2: [3], 3: [], 4: [4, 5, 6], 5: [7], 6: [], 7: [8, 9], 8: [10], 9: [11] };
  for (let j = 1; j <= 9; j++) fireCtls.push(ctl('Fk' + j, ['Fire door to the paint store kept shut and self-closing', 'Flammables kept in a fire-rated cabinet, no more than a day\'s use out', 'Hot work permit for any work within ten metres of the store',
    'Extraction serviced every six months and the ducts cleaned', 'No smoking or vaping signs at both entrances', 'Fire alarm call point by the store door, tested weekly',
    'Spill kit at the store and staff shown how to use it', 'Waste rags in a lidded metal bin, emptied daily', 'Fire risk assessment reviewed after any change to the store'][j - 1],
    j % 3 === 0 ? { status: 'Complete', completedDate: day(-30 - j) } : { owner: j % 2 ? 'Dave Morley' : 'Sam Line', due: day(20 + j) }));
  for (let i = 1; i <= 12; i++) {
    const cj = Object.keys(link).find(j => link[j].includes(i));
    fireActs.push(act('Fa' + i, 'Paint store action ' + i + ': ' + ['check the self-closer and the intumescent strips on the store door and record it', 'move the thinners into the fire-rated cabinet and label the shelves',
      'brief the maintenance team on the hot work permit and keep the pad in the office', 'book the extraction service and keep the certificate', 'fit the signs at both entrances',
      'test the call point weekly and log it', 'buy a second spill kit for the mixing bench', 'swap the open rag bin for a lidded metal one', 'add the store to the weekly walk round',
      'review the fire risk assessment for the new mixing bench', 'train two fire marshals for the paint shop', 'write a one-page emergency plan for the store'][i - 1],
      Object.assign({ owner: ['Dave Morley', 'Sam Line', 'Jo Fine', 'Dave, Sam'][i % 4], due: day(4 + i * 3), priority: ['High', 'Medium', 'Low'][i % 3] }, cj ? { forCtl: 'Fk' + cj } : {})));
  }
}
const A_RISKS = () => ([
  { id: 'A1', activity: 'Work at height on the loading bay roof', category: 'Physical', area: 'Premises', likelihood: '5', severity: '5', targetL: '1', targetS: '5',
    hazard: 'Fragile roof sheets and an unguarded edge', assocRisk: 'Stepping onto a rooflight that gives way', harm: 'Death or life-changing injury from the fall',
    personsAtRisk: ['Maintenance staff', 'Contractors'], businessImpact: 'Prosecution and the loss of the site lease.',
    actions: [
      ctl('A1k1', 'Guard rail on the roof edge', { status: 'Complete', completedDate: day(-20), owner: 'Dave' }),
      ctl('A1k2', 'Roof access permit signed by a director', { owner: 'Dave Morley', due: day(30) }),
      ctl('A1kb', '   '),
      ctl('A1kx', 'Ladder tied at the top', { deleted: true }),
      ctl('A1k3', 'Harness training for roof work', { status: 'In progress' }),
      act('A1x1', 'Fit edge protection to the loading bay roof', { forCtl: 'A1k1', owner: 'Dave', due: day(30), priority: 'High' }),
      act('A1x2', 'Write the rescue plan for harness work', { forCtl: 'A1k3', owner: 'Jo;Priya', due: '', status: 'In progress', priority: 'Medium' }),
      act('A1x3', 'Paint the edge markings', { forCtl: 'A1k1', status: 'Complete', completedDate: day(-2) }),
      act('A1x4', 'Rope access considered and accepted', { status: 'Accepted', acceptedBy: 'Jo Fine' }),
      act('A1x5', 'Survey the roof lights', { forCtl: 'A1kx', owner: '', due: day(12), priority: '' }),
      act('A1x6', 'An action taken off', { deleted: true }),
      act('A1x7', '   ', { owner: 'Sam', due: day(5) }),
      act('A1x8', 'Lock the roof hatch', { owner: 'Sam', due: day(-3), priority: 'Critical' })] },
  { id: 'A2', activity: 'Manual handling in the stores', category: 'Ergonomic', area: 'Stores', likelihood: '3', severity: '4', targetL: '2', targetS: '3',
    hazard: 'Heavy boxed stock on the bottom shelves', assocRisk: 'Lifting from the floor and twisting', harm: 'Back injury', personsAtRisk: ['Stores staff'],
    actions: [
      act('A2m1', 'Buy a pallet truck for the stores', { owner: 'Sam', due: day(10), status: 'In progress', priority: 'High' }),
      act('A2m2', 'Manual handling training for the stores staff', { owner: 'Dave, Sam', due: day(60), priority: 'Medium' }),
      act('A2m3', 'Rack the heavy stock at waist height', { owner: '', due: '', priority: 'Low' }),
      act('A2m4', 'Write a safe system of work for the stores', { owner: 'Jo Fine', due: day(20), priority: 'Medium' }),
      act('A2m5', 'Clear the stores aisle', { status: 'Complete', completedDate: day(-9) })] },
  { id: 'A3', activity: 'Vehicle movements in the yard', category: 'Physical', area: 'Yard', likelihood: '3', severity: '4', targetL: '1', targetS: '4',
    hazard: 'Reversing HGVs and pedestrians share the yard', assocRisk: 'A pedestrian struck by a reversing lorry', harm: 'Crush injury or death', personsAtRisk: ['Drivers', 'Visitors'],
    actions: [
      ctl('A3k1', 'One-way system with painted walkways', { owner: 'Sam Line', due: day(40) }),
      act('A3y2', 'Paint the walkways and fit the signs', { forCtl: 'A3k1', owner: 'Sam', due: day(25), priority: 'High' })] },
  { id: 'A4', activity: 'Fire in the paint store', category: 'Fire', area: 'Paint shop', likelihood: '4', severity: '4', targetL: '2', targetS: '4',
    hazard: 'Thinners and solvent-soaked rags', assocRisk: 'A spark from the extraction motor', harm: 'Burns and smoke inhalation', personsAtRisk: ['Paint shop staff', 'Neighbours'],
    actions: fireCtls.concat(fireActs) },
  { id: 'A5', activity: 'Asbestos in the plant room', category: 'Health', area: 'Plant room', likelihood: '4', severity: '5', targetL: '1', targetS: '5',
    hazard: 'Asbestos gaskets on the boiler flanges', assocRisk: 'Fibres released when the flanges are broken for maintenance, spreading across the plant room floor',
    harm: 'Mesothelioma decades later', personsAtRisk: ['Maintenance staff', 'Boiler engineers', 'Cleaners'], businessImpact: 'HSE enforcement and a long-tail civil claim.',
    actions: [
      ctl('A5k1', LONG_CTL, { owner: 'Dave Morley', due: day(15) }),
      act('A5z2', LONG_DESC, { forCtl: 'A5k1', owner: 'Dave Morley', due: day(2), priority: 'Critical' }),
      act('A5z3', 'Label the plant room door as an asbestos area', { owner: 'Sam', due: day(50), priority: 'Medium' })] },
]);
{
  await seed(page, { riskProfile: A_RISKS(), actionPlan: [], company: COMPANY, meetings: [], decisions: [] }, 'cockpit');
  const sid = await page.evaluate(LONG_REC => {
    delete S.actionSheets;
    ['A1', 'A2', 'A3', 'A4', 'A5'].forEach(id => toggleRiskTop5(id));
    asNewSheet();
    const s = _asList('top5')[0]; if (!s) return null;
    s.items.forEach(it => asRec(s.id, it.key, it.ref.a === 'A5' ? LONG_REC : 'The control we recommend for ' + it.desc + ', in place within the month.'));
    return s.id;
  }, LONG_REC);
  const setup = sid ? await page.evaluate(sid => _asSheet(sid).items.map(i => i.ref.a + ':' + i.ref.b), sid) : [];
  R.ok(!!sid && setup.length === 5 && ['A1', 'A2', 'A3', 'A4', 'A5'].every(r => setup.some(k => k.indexOf(r + ':') === 0)), 'setup: the Top 5 sheet carries one action from each of the five risks (' + setup.join(', ') + ')');
  if (sid) {
    const n5 = setup.findIndex(k => /^A5:/.test(k)) + 1;
    await sheetOf('Top 5, five risks', sid, { clipped: n5 });
  }
}

// ══ B. Top 5: one free action, no risk behind it ══
{
  await seed(page, { riskProfile: [], company: COMPANY, meetings: [], decisions: [],
    actionPlan: [{ id: 'fp1', desc: 'Renew the employers liability insurance certificate and put it on the noticeboard', owner: 'Jo Fine', due: day(14), status: 'Not started', priority: 'High', source: 'Added directly' }] }, 'cockpit');
  const sid = await page.evaluate(() => { delete S.actionSheets; asNewSheet(); const s = _asList('top5')[0]; if (!s) return null; asRec(s.id, s.items[0].key, 'Keep the certificate current and displayed.'); return s.id; });
  R.ok(!!sid, 'setup: a Top 5 sheet with one free action');
  if (sid) await sheetOf('Top 5, one free action', sid);
}

// ══ C. Risk sheet: one risk - a control nothing puts in place, the sheet line not linked, and a second
//    action in letters and signs a standard PDF font has not got (Ł, ≥, ✓ - an owner named Łukasz must
//    never stop the sheet; what prints is what the meta records) ══
{
  await seed(page, { riskProfile: [
    { id: 'C1', activity: 'Noise from the press shop', category: 'Health', area: 'Press shop', likelihood: '3', severity: '3', targetL: '2', targetS: '3',
      hazard: 'Presses running at over 85 dB(A)', assocRisk: 'Noise-induced hearing loss', personsAtRisk: ['Press operators'],
      actions: [ctl('C1k1', 'Hearing protection zone marked and enforced', { owner: 'Sam Line', due: day(21) }),
        act('C1a1', 'Commission a noise survey of the press shop', { owner: 'Jo Fine', due: day(14), priority: 'Medium' }),
        act('C1a2', 'Check the screen at the press is ≥ 1.1 m high ✓ and log it', { owner: 'Łukasz Nowak, Siobhán O’Neill', due: day(40), priority: 'Low' })] }],
    actionPlan: [], company: COMPANY, meetings: [], decisions: [] }, 'cockpit');
  const sid = await page.evaluate(() => { delete S.actionSheets; toggleRiskSheet('C1'); asNewSheet('risk'); const s = _asList('risk')[0]; if (!s) return null;
    s.items.forEach(it => asRec(s.id, it.key, 'A noise survey, then the zone marked from it.')); return s.id; });
  R.ok(!!sid, 'setup: a risk sheet of one risk');
  if (sid) {
    const t = await sheetOf('Risk sheet, one risk', sid);
    const k = t.x.items[0].rows.findIndex(r => r.a === 'C1a2') + 1, fw = t.b.fields['as_1_r' + k + '_who'], said = t.b.els.filter(e => e.k === 't').map(e => e.s).join(' ');
    R.ok(k > 0 && !!fw && fw.text === 'Lukasz Nowak, Siobhán O\'Neill' && (t.b.meta.rows[0][k - 1] || {}).who === fw.text && said.indexOf('Check the screen at the press is >= 1.1 m high * and log it') >= 0,
      '[Risk sheet, one risk] an owner named Łukasz and an action with ≥ and ✓ build: printed as "Lukasz" (Siobhán and O\'Neill as they are), ">=" and "*", the meta recording who as printed (' + (fw ? fw.text : 'no field') + ')');
  }
}

// ══ D. Risk sheet: six risks - a gap under a control, nothing open at all, a 12-row table, three meetings ══
{
  const D6 = Array.from({ length: 12 }, (_, i) => act('D6a' + (i + 1), ['Measure the vibration on grinder ' + (i + 1) + ' and record the exposure points',
    'Swap grinder ' + (i + 1) + ' for a low-vibration model and keep the data sheet'][i % 2], { owner: ['Sam Line', 'Dave Morley', 'Jo Fine'][i % 3], due: day(6 + i * 4), priority: ['High', 'Medium'][i % 2] }));
  const D_RISKS = [
    { id: 'D1', activity: 'Work at height on the mezzanine', category: 'Physical', area: 'Warehouse', likelihood: '4', severity: '5', targetL: '1', targetS: '5',
      hazard: 'Open edge on the mezzanine', assocRisk: 'Falling while loading the mezzanine', personsAtRisk: ['Warehouse staff'],
      actions: [ctl('D1k1', 'Gate at the mezzanine loading point', { status: 'Complete', completedDate: day(-40) }),
        ctl('D1k2', 'Loading only by forklift with a cage', { owner: 'Dave Morley', due: day(30) }),
        ctl('D1k3', 'Mezzanine load notices', { owner: 'Sam Line' }),
        act('D1a1', 'Check the gate closes on its own', { forCtl: 'D1k1', owner: 'Sam Line', due: day(9) }),
        act('D1a2', 'Add the gate to the weekly checks', { forCtl: 'D1k1', owner: 'Sam Line', due: day(16) }),
        act('D1a3', 'Print and fit the load notices', { forCtl: 'D1k3', owner: 'Jo Fine', due: day(12) }),
        act('D1a4', 'Fit a second handrail on the stairs', { owner: 'Dave Morley', due: day(2), priority: 'Critical' })] },
    { id: 'D2', activity: 'Dust from the cutting saws', category: 'Health', area: 'Workshop', likelihood: '3', severity: '4', targetL: '2', targetS: '3',
      hazard: 'Fine wood dust', assocRisk: 'Breathing in dust while cutting', personsAtRisk: ['Saw operators'],
      actions: [act('D2a1', 'Get the extraction tested (LEV) and keep the report', { owner: 'Dave Morley', due: day(21) })] },
    { id: 'D3', activity: 'Legionella in the hot water system', category: 'Health', area: 'Premises', likelihood: '3', severity: '4', targetL: '1', targetS: '4',
      hazard: 'Little-used outlets', assocRisk: 'Water standing in dead legs', personsAtRisk: ['Staff', 'Visitors'],
      actions: [act('D3a1', 'Flush the little-used outlets weekly', { owner: 'Sam Line', due: day(5) })] },
    { id: 'D4', activity: 'Electrical installation out of test', category: 'Physical', area: 'Premises', likelihood: '3', severity: '4', targetL: '2', targetS: '4',
      hazard: 'The EICR is two years overdue', assocRisk: 'A fault going unnoticed', personsAtRisk: ['Everyone on site'],
      actions: [ctl('D4k1', 'Fixed wiring tested every five years'), ctl('D4k2', 'Portable appliances tested yearly', { owner: 'Dave Morley' }),
        act('D4a1', 'Book the electrician for the EICR', { owner: 'Jo Fine', due: day(8) })] },
    { id: 'D5', activity: 'Contractors on site without an induction', category: 'Management', area: 'Site', likelihood: '2', severity: '4', targetL: '1', targetS: '4',
      hazard: 'Contractors arriving unannounced', assocRisk: 'Working without knowing the site rules', personsAtRisk: ['Contractors', 'Staff'],
      actions: [ctl('D5k1', 'Signing-in with a site induction card', { owner: 'Jo Fine', due: day(18) }),
        act('D5a1', 'Print the induction cards and brief reception', { forCtl: 'D5k1', owner: 'Jo Fine', due: day(7) })] },
    { id: 'D6', activity: 'Hand-arm vibration from the grinders', category: 'Health', area: 'Fabrication', likelihood: '3', severity: '3', targetL: '2', targetS: '3',
      hazard: 'Angle grinders used for hours a day', assocRisk: 'White finger and nerve damage', personsAtRisk: ['Fabricators'], actions: D6 },
  ];
  const MEET = [1, 2, 3].map(k => ({ id: 'mD' + k, quick: true, forum: 'Client meeting', date: inMonth(k * 2), status: 'finished', finishedAt: inMonth(k * 2) + 'T16:00:00.000Z',
    attendees: [{ name: 'Jo Fine', role: 'Managing Director', email: '' }, { name: 'Sam Line', role: 'Operations Director', email: '' }],
    note: 'Walked the workshop and the yard. ' + 'We talked through the grinders, the mezzanine gate and the induction cards, and agreed who does what before the next visit. '.repeat(k) }));
  const DECS = MEET.map((m, k) => ({ id: 'dD' + k, meetingId: m.id, agendaItem: 0, forum: 'Client meeting', date: m.date, decision: 'Agreed action ' + (k + 1) + ' from the walk round', owner: 'Sam Line', due: day(20 + k), status: 'Agreed', raised: 0 }));
  await seed(page, { riskProfile: D_RISKS, actionPlan: [], company: COMPANY, meetings: MEET, decisions: DECS }, 'cockpit');
  const sid = await page.evaluate(() => {
    delete S.actionSheets;
    ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].forEach(id => toggleRiskSheet(id));
    asNewSheet('risk');
    const s = _asList('risk')[0]; if (!s) return null;
    s.items.forEach(it => asRec(s.id, it.key, 'The control we recommend for ' + it.desc + '.'));
    // since the sheet was drafted: D3's only action and D4's sheet line are done
    s.items.filter(it => it.ref.a === 'D3' || it.ref.a === 'D4').forEach(it => { const a = _execOrigin(it.ref); if (a) { a.status = 'Complete'; a.completedDate = _asToday(); } });
    return s.id;
  });
  const setup = sid ? await page.evaluate(sid => _asSheet(sid).items.map(i => i.ref.a), sid) : [];
  R.ok(!!sid && setup.length === 6, 'setup: a risk sheet of six risks (' + setup.join(',') + ')');
  if (sid) {
    const t = await sheetOf('Risk sheet, six risks', sid);
    const it = n => t.x.items.find(i => i.key.indexOf('risk:' + n + ':') === 0) || { rows: [] };
    R.ok(it('D3').rows.length === 1 && it('D3').rows[0].a === null && it('D3').rows[0].c === null && it('D4').rows.length === 2 && it('D4').rows.every(r => !r.a && r.c)
      && it('D1').rows.map(r => r.a || ('gap:' + r.c)).join(',') === 'D1a1,D1a2,gap:D1k2,D1a3,D1a4' && it('D6').rows.length === 12,
      'setup: the six cover a gap under a control, nothing open at all, controls with nothing open, and a 12-row table (' + ['D1', 'D3', 'D4', 'D6'].map(n => n + ' ' + it(n).rows.length).join(', ') + ')');
  }
}

// ══ E. Risk sheet: fourteen risks, and 30 meetings this month - one with a 2,000-word note ══
const MEET30 = Array.from({ length: 30 }, (_, k) => ({ id: 'mE' + k, quick: true, forum: 'Client meeting', date: inMonth(1 + (k % 28)), status: k === 29 ? 'open' : 'finished',
  finishedAt: inMonth(1 + (k % 28)) + 'T16:00:00.000Z', attendees: [{ name: 'Jo Fine', role: 'Managing Director', email: '' }].concat(k % 2 ? [{ name: 'Sam Line', role: 'Operations Director', email: '' }] : []),
  note: k === 0 ? LONG_NOTE : ('Visit ' + (k + 1) + '. ' + 'Went round the workshop, checked the actions from last time and agreed the next steps with the team. '.repeat(1 + (k % 4))) }));
const DEC30 = MEET30.flatMap((m, k) => Array.from({ length: 1 + (k % 3) }, (_, j) => ({ id: 'dE' + k + '_' + j, meetingId: m.id, agendaItem: 0, forum: 'Client meeting', date: m.date,
  decision: 'Action ' + (j + 1) + ' from visit ' + (k + 1) + ': ' + ['fix the yard gate', 'book the forklift refresher', 'clear the fire exit by the stores', 'order new racking labels'][(k + j) % 4], owner: ['Sam Line', 'Jo Fine', ''][(k + j) % 3], due: j === 2 ? '' : day(10 + k), status: 'Agreed', raised: k % 2 })));
{
  const RS = Array.from({ length: 14 }, (_, i) => {
    const n = i + 1, nc = n % 4, na = 1 + (n % 3), cs = Array.from({ length: nc }, (_, j) => ctl('E' + n + 'k' + (j + 1), 'Control ' + (j + 1) + ' for hazard ' + n + ': kept in place and checked at the monthly walk round', j === 0 ? { status: 'Complete', completedDate: day(-10 - n) } : { owner: 'Dave Morley', due: day(10 + n + j) }));
    const as = Array.from({ length: na }, (_, j) => act('E' + n + 'a' + (j + 1), 'Action ' + (j + 1) + ' on hazard ' + n + ': get it done and keep the record', Object.assign({ owner: ['Jo Fine', 'Sam Line', 'Dave Morley'][(n + j) % 3], due: day(3 + n + j * 5), priority: ['High', 'Medium', 'Low'][(n + j) % 3] }, (nc && j < nc && (n + j) % 2) ? { forCtl: 'E' + n + 'k' + (j + 1) } : {})));
    return { id: 'E' + n, activity: 'Hazard ' + n + ' in the works: ' + ['dust', 'noise', 'falls', 'fire', 'vehicles', 'chemicals', 'electrics'][n % 7], category: 'Physical', area: 'Works',
      likelihood: String(1 + (n % 5)), severity: String(2 + (n % 4)), targetL: '1', targetS: String(2 + (n % 4)), hazard: 'What is wrong with hazard ' + n, assocRisk: 'How hazard ' + n + ' hurts someone', personsAtRisk: ['Staff'], actions: cs.concat(as) };
  });
  await seed(page, { riskProfile: RS, actionPlan: [], company: COMPANY, meetings: MEET30, decisions: DEC30 }, 'cockpit');
  const sid = await page.evaluate(() => {
    delete S.actionSheets;
    S.riskProfile.forEach(r => toggleRiskSheet(r.id));
    asNewSheet('risk');
    const s = _asList('risk')[0]; if (!s) return null;
    s.items.forEach(it => asRec(s.id, it.key, 'The control we recommend for ' + it.desc + '.'));
    return s.id;
  });
  const n = sid ? await page.evaluate(sid => _asSheet(sid).items.length, sid) : 0;
  R.ok(!!sid && n === 14, 'setup: a risk sheet of fourteen risks, with 30 meetings minuted this month (' + n + ' items)');
  if (sid) {
    const t = await sheetOf('Risk sheet, fourteen risks', sid);
    const said = t.b.els.filter(e => e.k === 't').map(e => e.s).join(' ');
    R.ok(norm(said).indexOf('end of the long note.') >= 0, '[Risk sheet, fourteen risks] the 2,000-word note runs on over the pages, printed to its last words');
  }
}

// ── a short sheet's cover is not spread out to fill its page: its gaps are no wider than a long one's allow ──
for (const k of ['top5', 'risk']) {
  const l = (covers[k] || []).filter(c => c.b1 != null), b = l.map(c => c.b1);
  R.ok(l.length >= 2 && Math.max(...b) <= 23, '[' + (k === 'top5' ? 'Top 5' : 'Risk') + ' covers] one risk or many, the same at most 18pt between the sections (' + l.map(c => c.tag + ': ' + c.b1.toFixed(1)).join('; ') + ')');
}

// ══ the Client Meeting Notes PDF: 30 meetings, a 2,000-word note - jsPDF stays above its bottom margin ══
{
  const t = await page.evaluate(() => {
    const mk = window._mkPdf, ft = window._pdfBrandFooter, log = []; let ph = 'body', K = null;
    window._mkPdf = function () {
      K = mk.apply(this, arguments); const doc = K.doc, pg = () => { try { return doc.internal.getCurrentPageInfo().pageNumber; } catch (e) { return 0; } };
      const watch = (m, ys) => { const f = doc[m]; if (typeof f !== 'function') return; doc[m] = function () { const a = [...arguments]; let r = null; try { r = ys(a); } catch (e) {}
        log.push({ m, p: pg(), ph, lo: r ? r[0] : null, hi: r ? r[1] : null, s: m === 'text' ? String(Array.isArray(a[0]) ? a[0].join(' ') : a[0]) : '' }); return f.apply(this, arguments); }; };
      // jsPDF's y runs down the page: a text's baseline, a shape's top and bottom
      watch('text', a => typeof a[0] === 'number' ? [a[1], a[1]] : [a[2], a[2]]);
      watch('line', a => [Math.min(a[1], a[3]), Math.max(a[1], a[3])]);
      watch('rect', a => [Math.min(a[1], a[1] + a[3]), Math.max(a[1], a[1] + a[3])]);
      watch('roundedRect', a => [Math.min(a[1], a[1] + a[3]), Math.max(a[1], a[1] + a[3])]);
      watch('circle', a => [a[1] - a[2], a[1] + a[2]]);
      return K;
    };
    window._pdfBrandFooter = function () { ph = 'footer'; try { return ft.apply(this, arguments); } finally { ph = 'body'; } };
    let p = null, err = '';
    try { p = _clientNotesPdf(); } catch (e) { err = String(e && e.message || e); } finally { window._mkPdf = mk; window._pdfBrandFooter = ft; }
    return { err, log, BOT: K ? K.BOT : null, TOP: K ? K.TOP : null, pages: K ? K.doc.getNumberOfPages() : 0, ok: !!(p && p.blob) };
  });
  const body = t.log.filter(e => e.ph === 'body' && e.hi != null), foot = t.log.filter(e => e.ph === 'footer' && e.hi != null);
  const low = body.filter(e => e.hi > t.BOT + 0.01).map(e => e.m + ' p' + e.p + ' y' + e.hi.toFixed(1) + (e.s ? ' "' + short(e.s) + '"' : ''));
  R.ok(!t.err && t.ok && t.pages > 3, '[Client meeting notes] the notes of 30 meetings, one of 2,000 words, build (' + t.pages + ' pages' + (t.err ? ', ' + t.err : '') + ')');
  R.ok(t.BOT != null && !low.length, '[Client meeting notes] nothing is written below the bottom margin (' + t.BOT + 'mm) - text, rules and table rows all stop above it' + (low.length ? ' - ' + low.slice(0, 4).join(' | ') : ''));
  R.ok(foot.length > 0 && foot.every(e => e.lo >= t.BOT + 2), '[Client meeting notes] the footer band below it holds only the footer, on every page' + (foot.length ? '' : ' - no footer seen'));
  R.ok(t.log.filter(e => e.m === 'text').map(e => e.s).join(' ').replace(/\s+/g, ' ').indexOf('end of the long note.') >= 0, '[Client meeting notes] the 2,000-word note is printed in full, to its last words');
}

// ══ F. A table that breaks with the least room left: thirty one-line actions, the recommendation one line
//    longer each try until the last row on the page leaves 12-22pt above the bottom margin - so "Continued
//    overleaf", in the 12pt kept for it, is checked where it is tightest ══
{
  const acts = Array.from({ length: 30 }, (_, i) => act('Fa' + (i + 1), 'Check ladder ' + (i + 1) + ' and tag it', { owner: 'Sam Line', due: day(5 + i), priority: 'Low' }));
  await seed(page, { riskProfile: [{ id: 'F1', activity: 'Ladders in the stores', category: 'Physical', area: 'Stores', likelihood: '3', severity: '3', targetL: '2', targetS: '3',
    hazard: 'Old wooden ladders', assocRisk: 'A ladder giving way under someone', personsAtRisk: ['Stores staff'], actions: acts }], actionPlan: [], company: COMPANY, meetings: [], decisions: [] }, 'cockpit');
  const sid = await page.evaluate(() => { delete S.actionSheets; toggleRiskSheet('F1'); asNewSheet('risk'); const s = _asList('risk')[0]; return s ? s.id : null; });
  let best = null, tried = [];
  for (let L = 1; sid && L <= 14 && !best; L++) {
    const t = await page.evaluate(async (sid, L) => { const s = _asSheet(sid);
      asRec(s.id, s.items[0].key, Array.from({ length: L }, (_, i) => 'Line ' + (i + 1) + ' of the control we recommend.').join('\n'));
      return { x: __expect(sid), b: await __collect(sid) }; }, sid, L);
    const rs = []; for (let k = 1; t.b.fields['as_1_r' + k + '_cmt']; k++) rs.push(t.b.fields['as_1_r' + k + '_cmt']);
    const i = rs.findIndex((f, k) => rs[k + 1] && rs[k + 1].p !== f.p), left = i >= 0 ? (rs[i].y - 2) - BOT : null;
    tried.push(left == null ? '-' : left.toFixed(1));
    if (left != null && left >= 12 && left < 22) best = { t, L, left };
  }
  R.ok(!!best, 'setup: a table that breaks with 12-22pt left under the last row on its page (' + (best ? best.left.toFixed(1) + 'pt, ' + best.L + ' lines of recommendation' : 'tried ' + tried.join('/')) + ')');
  if (best) {
    checkSheet('Risk sheet, a tight break', best.t.b, best.t.x);
    const co = best.t.b.els.filter(e => e.k === 't' && e.s === 'Continued overleaf');
    R.ok(co.length >= 1 && co.every(e => e.y - 0.21 * e.size >= BOT - 0.5), '[Risk sheet, a tight break] "Continued overleaf" sits in the room kept for it, above the bottom margin (' + co.map(e => (e.y - 0.21 * e.size).toFixed(1)).join(', ') + ')');
  }
}

// ══ G. The last comments box squeezed so the closing part follows straight on: a Top 5 sheet of one action,
//    its risk's open actions and its recommendation tried a size at a time until "General comments"
//    fits under the squeezed box but would not under the full one - a page saved, nothing half empty ══
{
  const acts = Array.from({ length: 9 }, (_, i) => act('Ga' + (i + 1), 'Check shelf ' + (i + 1) + ' and tag it', { owner: 'Sam Line', due: day(5 + i), priority: i ? 'Low' : 'High' }));
  await seed(page, { riskProfile: [{ id: 'G1', activity: 'Racking in the stores', category: 'Physical', area: 'Stores', likelihood: '4', severity: '4', targetL: '2', targetS: '4',
    hazard: 'Overloaded racking', assocRisk: 'A bay collapsing onto someone', personsAtRisk: ['Stores staff'], actions: acts }], actionPlan: [], company: COMPANY, meetings: [], decisions: [] }, 'cockpit');
  const sid = await page.evaluate(() => { delete S.actionSheets; toggleRiskTop5('G1'); asNewSheet(); const s = _asList('top5')[0]; if (!s) return null; const one = s.items.find(i => i.ref.b === 'Ga1') || s.items[0]; s.items = one ? [one] : []; return s.items.length === 1 ? s.id : null; });
  let best = null;
  for (let nOpen = 9; sid && nOpen >= 1 && !best; nOpen--) for (let L = 1; L <= 6 && !best; L++) {
    const t = await page.evaluate(async (sid, L, nOpen) => { const s = _asSheet(sid);
      S.riskProfile[0].actions.forEach((a, i) => { a.status = i < nOpen ? 'Not started' : 'Complete'; });
      asRec(s.id, s.items[0].key, Array.from({ length: L }, (_, i) => 'Line ' + (i + 1) + ' of the control we recommend.').join('\n'));
      return { x: __expect(sid), b: await __collect(sid) }; }, sid, L, nOpen);
    const w = t.b.fields.as_1_what, g = t.b.fields.as__general;
    if (w && g && w.h < 50 && g.p === w.p) best = { t, L, nOpen, h: w.h };
  }
  R.ok(!!best, 'setup: a Top 5 sheet whose last comments box is squeezed so Anything else follows on' + (best ? ' (' + best.nOpen + ' open actions, ' + best.L + ' lines of recommendation, a ' + best.h.toFixed(0) + 'pt writing box, ' + best.t.b.pages + ' pages)' : ''));
  if (best) {
    checkSheet('Top 5, the closing part squeezed on', best.t.b, best.t.x);
    R.ok(best.t.b.pages === 2, '[Top 5, the closing part squeezed on] a cover and one page - no page of its own for General comments (' + best.t.b.pages + ' pages)');
  }
}

await R.done(browser, errors);
