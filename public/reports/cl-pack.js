// ══════════════════════════════════════════════════════════════
//  Constructionline submission pack - accreditation engine step 6.
//
//  Builds what goes in the pack from AccredCore, and the two trackers in the
//  layout of the October 2026 EDL and ECL trackers. Plain script, no import
//  or export, like accred-core: the app loads it with ExcelJS from cdnjs,
//  the tests load it in Node with the exceljs package.
//    CLPack.packData(A, state, today, opts)   everything the pack holds
//    CLPack.buildTracker(ExcelJS, data, copy) the AHS tracker or the client copy
//    CLPack.FOLDERS / folderFor / willWording / issueRef / shortcut
// ══════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  // The submission folders, as in the EDL and ECL submissions. 13 is for
  // contractors (site evidence); designers file theirs under 03.
  var FOLDERS = ['01 Company Information', '02 Insurance', '03 Health and Safety and SSIP', '04 Training and Competence', '05 CDM and Building Safety',
    '06 Quality and Environment', '07 Equality and Harassment', '08 Anti-Bribery Fraud and Tax Evasion', '09 Modern Slavery and Right to Work',
    '10 Whistleblowing and Communication Evidence', '11 Data Protection', '12 Social Value and Wellbeing', '13 Site Evidence', '99 Do Not Upload - Old Versions'];
  var OLD = '99 Do Not Upload - Old Versions', SITE = '13 Site Evidence';
  function foldersFor(set) { return FOLDERS.filter(function (f) { return f !== SITE || set === 'contractor'; }); }
  // Where a CAS question's evidence is filed (by the EDL and ECL folders).
  var Q_FOLDER = {
    '03 Health and Safety and SSIP': ['HS-01', 'HS-02', 'HS-03', 'HS-04', 'HS-05', 'HS-08', 'HS-09', 'HS-10', 'HS-11', 'HS-14', 'HS-15', 'HS-16', 'HS-18', 'HS-19', 'HS-20', 'SS-01'],
    '04 Training and Competence': ['HS-12', 'HS-13', 'QA-06', 'BS-12'],
    '05 CDM and Building Safety': ['DS-01', 'DS-02', 'DS-03', 'DS-04', 'DS-05', 'BS-01', 'BS-02', 'BS-03', 'BS-04', 'BS-05', 'BS-06', 'BS-07', 'BS-08', 'BS-09', 'BS-10', 'BS-11', 'BS-13'],
    '06 Quality and Environment': ['QA-01', 'QA-02', 'QA-03', 'QA-04', 'QA-05', 'QA-07', 'QA-08', 'QA-09', 'QA-10', 'EN-01', 'EN-02', 'EN-03', 'EN-04', 'EN-05'],
    '07 Equality and Harassment': ['FR-01', 'FR-02', 'GV-09', 'GV-10'],
    '08 Anti-Bribery Fraud and Tax Evasion': ['GV-01', 'GV-03', 'GV-04'],
    '09 Modern Slavery and Right to Work': ['GV-05', 'GV-07'],
    '10 Whistleblowing and Communication Evidence': ['GV-02', 'HS-17', 'CN-04'],
    '11 Data Protection': ['IS-01', 'IS-02', 'IS-03'],
    '12 Social Value and Wellbeing': ['HS-06', 'HS-07', 'GV-06', 'GV-08', 'GV-11', 'GV-12', 'GV-13'],
    '13 Site Evidence': ['CN-01', 'CN-02', 'CN-03', 'CN-05']
  };
  var NAME_FOLDER = [
    [/insurance|liability|indemnity/i, '02 Insurance'],
    [/organisation|scope statement|confirmation statement|companies house|company information/i, '01 Company Information']
  ];
  function folderOfQ(id) { for (var f in Q_FOLDER) if (Q_FOLDER[f].indexOf(id) >= 0) return f; return ''; }
  function addMonths12(d) { var y = +d.slice(0, 4) + 1; return y + d.slice(4); }
  // The folder a record is filed in; '' when it has nowhere to go.
  function folderFor(item, set, today) {
    if (item.dated && addMonths12(item.dated) < today) return OLD;   // past the 12 months: kept, not uploaded
    var site = item.kind === 'site' || item.kind === 'visit' || item.kind === 'inspection' || (item.kind === 'service' && /AHS Ltd service (C1|C7)\b/.test(item.source || ''));
    if (site) return set === 'contractor' ? SITE : '03 Health and Safety and SSIP';
    for (var i = 0; i < item.qids.length; i++) {
      var f = folderOfQ(item.qids[i]);
      if (f === SITE && set !== 'contractor') f = '05 CDM and Building Safety';
      if (f === '10 Whistleblowing and Communication Evidence' && item.kind === 'toolbox' && set === 'contractor') f = SITE;
      if (f) return f;
    }
    for (var j = 0; j < NAME_FOLDER.length; j++) if (NAME_FOLDER[j][0].test(item.title || '')) return NAME_FOLDER[j][1];
    return '';
  }

  // The client copy says what AHS Ltd will do; the AHS tracker what it has done.
  var PAST = { written: 'write', rewritten: 'rewrite', made: 'make', sent: 'send', given: 'give', done: 'do', taken: 'take', set: 'set', put: 'put', held: 'hold', kept: 'keep', found: 'find', brought: 'bring', chosen: 'choose', run: 'run',
    updated: 'update', prepared: 'prepare', provided: 'provide', changed: 'change', completed: 'complete', uploaded: 'upload', answered: 'answer', refreshed: 'refresh', checked: 'check',
    entered: 'enter', added: 'add', reviewed: 'review', drafted: 'draft', filed: 'file', arranged: 'arrange', issued: 'issue', confirmed: 'confirm', raised: 'raise', recorded: 'record',
    removed: 'remove', replaced: 'replace', attached: 'attach', created: 'create', produced: 'produce', organised: 'organise', corrected: 'correct', amended: 'amend', compiled: 'compile',
    collated: 'collate', submitted: 'submit', logged: 'log', signed: 'sign', selected: 'select', included: 'include', listed: 'list', saved: 'save' };
  function presentBase(v) { return /(ches|shes|sses|xes|zes)$/.test(v) ? v.slice(0, -2) : v.slice(0, -1); }
  function willWording(text) {
    return String(text == null ? '' : text)
      .replace(/AHS Ltd (?:has|have) (\w+)/g, function (m, v) { var b = PAST[v.toLowerCase()]; return b ? 'AHS Ltd will ' + b : m; })
      .replace(/AHS Ltd (?!will\b|Ltd\b|has\b|is\b|was\b|does\b)([a-z]+s)\b/g, function (m, v) { return /ss$/.test(v) ? m : 'AHS Ltd will ' + presentBase(v); });
  }

  // One reference per client, kept once made: AHS-<SHORT>-<YYMM>-<4 hex>.
  function issueRef(short, today, rnd) {
    var code = String(short || 'CLIENT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CLIENT';
    var hex = (rnd != null ? rnd : Math.floor(Math.random() * 65536)).toString(16).toUpperCase();
    while (hex.length < 4) hex = '0' + hex;
    return 'AHS-' + code + '-' + String(today).slice(2, 4) + String(today).slice(5, 7) + '-' + hex.slice(-4);
  }
  // A Windows shortcut to where the file lives (a web link or a local path).
  function shortcut(loc) {
    var s = String(loc || '').trim().replace(/^["']+|["']+$/g, '');
    if (!s) return null;
    var url = /^https?:\/\//i.test(s) ? s : /^[a-z]:[\\\/]/i.test(s) ? 'file:///' + s.replace(/\\/g, '/') : /^\\\\/.test(s) ? 'file:' + s.replace(/\\/g, '/') : null;
    return url ? '[InternetShortcut]\r\nURL=' + url + '\r\n' : null;
  }
  function safeName(s) { return String(s || 'Record').replace(/[<>:"\/\\|?*\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Record'; }
  function monthLabel(d) { var m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; return m[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4); }
  function shortMonth(ym) { var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return ym ? m[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) : ''; }
  var SVC_TYPE = { S1: 'Review', S2: 'Document review', S3: 'Submission', S4: 'Submission', C1: 'Inspection', C2: 'Document', C3: 'Meeting', C4: 'Review', C5: 'Document', C6: 'Document', C7: 'Review',
    D1: 'Audit', D2: 'Review', D3: 'Document', D4: 'Training', B1: 'Review and reminder', B2: 'Bulletin', B3: 'Log', B4: 'Document', B5: 'Training', B6: 'Document', B7: 'Review', B8: 'Access' };

  // ── everything the pack holds, worked out once ──
  function packData(A, state, today, opts) {
    opts = opts || {};
    today = today || A.todayIso();
    var co = (state && state.company) || {};
    var short = String(co.shortName || '').trim() || String(co.tradingName || co.legalName || 'Client').trim();
    var legal = String(co.legalName || co.tradingName || short).trim();
    var v = A.clView(state, today, short);
    var set = v.set || 'contractor';
    // tracker lines, in the order of the trackers: sections to work on in portal
    // order, then the sections already verified (one line each), then the
    // Building Safety Act sections
    var lines = [], verified = [], bsa = [], n = 0;
    function suffix(c) { return !c ? '' : c.k === 'green' ? '' : c.label === 'Not yet valid' ? ' (not yet valid)' : c.label === 'Expired' ? ' (expired)' : ' (' + c.label.toLowerCase() + ')'; }
    function lineRow(l) {
      return { type: 'line', q: l.text, ev: l.evidence, act: l.action, st: l.st, stLabel: l.stLabel, hsRefs: l.hsRefs.join(', '), hsValid: l.hsRefs.length ? (l.hsValid || 'Not yet valid') : '',
        ssipRefs: l.ssipRefs.join(', '), ssipValid: l.ssipRefs.length ? (l.ssipValid || 'Not yet valid') : '', done: l.done || '' };
    }
    v.blocks.forEach(function (b) {
      var green = b.colour && b.colour.k === 'green';
      if (green && !b.bsa) { verified.push(b); return; }
      var target = b.bsa ? bsa : lines;
      target.push({ type: 'section', text: b.name + suffix(b.colour) });
      if (green) {
        target.push({ type: 'line', q: b.name, ev: 'Verified to ' + monthLabel(b.hsValid || b.ssipValid) + '.', act: 'None needed now.', st: 'already', stLabel: A.clStatusLabel('already', short),
          hsRefs: b.lines.map(function (l) { return l.hsRefs.join(', '); }).filter(Boolean).join(', '), hsValid: b.hsValid || b.ssipValid, ssipRefs: '', ssipValid: '', done: '' });
      } else b.lines.forEach(function (l) { target.push(lineRow(l)); });
    });
    if (verified.length) {
      lines.push({ type: 'section', text: 'Already verified in Constructionline (no action now)' });
      verified.forEach(function (b) {
        var d = b.hsValid || b.ssipValid;
        lines.push({ type: 'line', q: b.name, ev: 'Verified to ' + monthLabel(d) + '.', act: 'None needed now.', st: 'already', stLabel: A.clStatusLabel('already', short),
          hsRefs: '', hsValid: d, ssipRefs: '', ssipValid: '', done: '' });
      });
    }
    var rows = lines.concat(bsa);
    rows.forEach(function (r) { if (r.type === 'line') r.no = ++n; });
    // the price list (client copy) and the annual service plan, from the package
    var svc = A.clientServices(state), pc = A.pkgCfg(state);
    var groups = [];
    svc.forEach(function (s) { var g = groups.find(function (x) { return x.name === s.group; }); if (!g) groups.push(g = { name: s.group, items: [] }); g.items.push(s); });
    var priceList = { dayRate: (function () { var r = parseFloat(pc.dayRate); return isNaN(r) ? null : r; })(), groups: groups.map(function (g) {
      return { name: g.name, items: g.items.map(function (s) { var p = A.servicePrice(state, s);
        return { code: s.code, name: s.name + (s.times > 1 ? ' (' + s.times + ' a year, ' + s.unit + ')' : ''), days: Math.round(s.hours * s.times / 7.5 * 100) / 100, typedCost: p.typed ? p.yearly : null }; }) };
    }), packageLabel: (A.packageOf(pc.id) || {}).label || '' };
    var sched = A.serviceSchedule(state, today), log = A.serviceLog(state);
    var plan = svc.filter(function (s) { return !s.noTask; }).map(function (s) {
      var done = log.filter(function (e) { return e && e.code === s.code && e.done; }).map(function (e) { return e.done; }).sort();
      var next = sched.filter(function (x) { return x.code === s.code && x.status !== 'done'; })[0];
      return { activity: s.name, why: s.answers, often: s.often, type: SVC_TYPE[s.code] || '', who: 'AHS Ltd', last: done.length ? shortMonth(done[done.length - 1].slice(0, 7)) : '', next: next ? shortMonth(next.month) : '' };
    });
    // the evidence, filed into the folders
    var folders = foldersFor(set), files = [];
    A.evidenceItems(state).forEach(function (it) {
      var f = folderFor(it, set, today);
      files.push({ folder: f && folders.indexOf(f) >= 0 ? f : '', item: it, name: safeName(it.title + (it.dated ? ' ' + it.dated : '')), shortcut: shortcut(it.file) });
    });
    var bank = (root.CLBank && root.CLBank.sets[set]) || null;
    return { today: today, short: short, legal: legal, set: set, month: monthLabel(today), year: today.slice(0, 4), counts: v.counts,
      rows: rows, priceList: priceList, plan: plan, folders: folders, files: files, bank: bank, ref: opts.ref || '' };
  }

  // ── the tracker workbook, in the EDL and ECL layout ──
  var INK = 'FF3A3A3A', CYAN = 'FF38A8C2', GREY = 'FF787878', PURPLE = 'FF8E7CC3', HEAD = 'FFE3EBF0', LINE = 'FFC8C8C8';
  var ST_FILL = { client: 'FFFFF4C2', ahs_sign: 'FFFFF4C2', ahs: 'FFD7EEF4', covered: 'FFDFF0D8', already: 'FFDFF0D8' };
  function fill(c) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: c }, bgColor: { argb: c } }; }
  var BORDER = { top: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } };
  function font(o) { o = o || {}; return { name: 'Arial', size: o.sz || 10, bold: !!o.b, color: { argb: o.c || INK } }; }
  // A date goes in as Excel's own day number, so it is a real date in Excel
  // whichever JavaScript built the workbook.
  function dateVal(d) { if (!/^\d{4}-\d{2}-\d{2}/.test(d || '')) return d || ''; return Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000); }
  function sheetTracker(wb, data, copy) {
    var ws = wb.addWorksheet('Constructionline Gold', { views: [{ state: 'frozen', ySplit: 8, showGridLines: false }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    [5, 40, 46, 46, 20, 16, 14, 14, 14, 10].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    var title = ws.getCell('A1'); title.value = data.short + ' & AHS Ltd: Constructionline Gold, ' + data.month + (copy ? ' (client copy)' : ''); title.font = font({ sz: 14, b: true });
    var first = 9, last = 8 + data.rows.length, E = 'E' + first + ':E' + last, Jr = 'J' + first + ':J' + last;
    var cnt = data.rows.filter(function (r) { return r.type === 'line'; });
    var nClient = cnt.filter(function (r) { return !r.done && (r.st === 'client' || r.st === 'ahs_sign'); }).length;
    var nAhs = cnt.filter(function (r) { return !r.done && r.st === 'ahs'; }).length;
    var nCov = cnt.filter(function (r) { return !r.done && (r.st === 'covered' || r.st === 'already'); }).length;
    var nDone = cnt.filter(function (r) { return !!r.done; }).length;
    var sl = function (k) { return A_label(k, data.short); };
    [[3, data.short + ' to do', 'COUNTIFS(' + E + ',"' + sl('client') + '",' + Jr + ',"")+COUNTIFS(' + E + ',"' + sl('ahs_sign') + '",' + Jr + ',"")', nClient, 'FFFFF4C2'],
     [4, 'AHS Ltd to do', 'COUNTIFS(' + E + ',"AHS Ltd",' + Jr + ',"")', nAhs, 'FFD7EEF4'],
     [5, 'Covered or already in Constructionline', 'COUNTIFS(' + E + ',"Covered in another answer",' + Jr + ',"")+COUNTIFS(' + E + ',"Already in Constructionline",' + Jr + ',"")', nCov, 'FFDFF0D8'],
     [6, 'Ticked done', 'COUNTA(' + Jr + ')', nDone, 'FFFFFFFF']].forEach(function (x) {
      var b = ws.getCell('B' + x[0]), c = ws.getCell('C' + x[0]);
      b.value = x[1]; b.font = font({ b: true }); b.fill = fill(x[4]); b.border = BORDER;
      c.value = { formula: x[2], result: x[3] }; c.font = font(); c.alignment = { horizontal: 'left' }; c.border = BORDER;
    });
    var heads = ['No', 'Constructionline question', 'Expected evidence', 'Action', 'Status', 'H&S ref (and other sections)', 'Valid until (Constructionline)', 'SSIP ref', 'SSIP valid until (Constructionline)', 'Done'];
    heads.forEach(function (h, i) {
      var c = ws.getRow(8).getCell(i + 1); c.value = h;
      var tint = (i === 5 || i === 6) ? CYAN : (i === 7 || i === 8) ? PURPLE : HEAD;
      c.font = font({ b: true, c: tint === HEAD ? INK : 'FFFFFFFF' }); c.fill = fill(tint); c.alignment = { wrapText: true, vertical: 'top' }; c.border = BORDER;
    });
    data.rows.forEach(function (r, i) {
      var row = ws.getRow(first + i);
      if (r.type === 'section') {
        ws.mergeCells('A' + (first + i) + ':J' + (first + i));
        var c = row.getCell(1); c.value = r.text; c.font = font({ sz: 11, b: true, c: 'FFFFFFFF' }); c.fill = fill(CYAN); c.alignment = { vertical: 'middle' };
        return;
      }
      var act = copy ? willWording(r.act) : r.act;
      var vals = [r.no, r.q, r.ev, act, r.stLabel, r.hsRefs, dateVal(r.hsValid), r.ssipRefs, dateVal(r.ssipValid), r.done ? dateVal(r.done) : null];
      vals.forEach(function (val, k) {
        var c = row.getCell(k + 1);
        if (val !== '' && val != null) c.value = val;
        c.font = font(); c.border = BORDER;
        c.alignment = (k === 6 || k === 8 || k === 9) ? { vertical: 'top', horizontal: 'center' } : { wrapText: true, vertical: 'top' };
        if (k === 6 || k === 8 || k === 9) c.numFmt = 'dd/mm/yyyy';
        if (k === 4 && ST_FILL[r.st]) c.fill = fill(ST_FILL[r.st]);
        if (k === 5 && r.hsRefs) c.fill = fill('FFD7EEF4');
        if (k === 7 && r.ssipRefs) c.fill = fill('FFE8E4F3');
      });
    });
    // expiry colours, worked out by Excel on the day it is opened
    ['G', 'I'].forEach(function (col, j) {
      var ref = col + first + ':' + col + last, cell = col + first;
      ws.addConditionalFormatting({ ref: ref, rules: [
        { type: 'expression', priority: 1 + j * 4, formulae: ['AND(ISTEXT(' + cell + '),' + cell + '<>"")'], style: { fill: fill('FFF8D7DA') } },
        { type: 'expression', priority: 2 + j * 4, formulae: ['AND(ISNUMBER(' + cell + '),' + cell + '<TODAY())'], style: { fill: fill('FFF8D7DA') } },
        { type: 'expression', priority: 3 + j * 4, formulae: ['AND(ISNUMBER(' + cell + '),' + cell + '<TODAY()+90)'], style: { fill: fill('FFFFE8B3') } },
        { type: 'expression', priority: 4 + j * 4, formulae: ['ISNUMBER(' + cell + ')'], style: { fill: fill('FFDFF0D8') } }
      ] });
    });
    return ws;
  }
  var _A = null;
  function A_label(k, short) { return _A ? _A.clStatusLabel(k, short) : k; }
  function sheetPrices(wb, data) {
    var ws = wb.addWorksheet('Price List', { views: [{ showGridLines: false }], pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    [6, 90, 10, 14].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    var t = ws.getCell('A1'); t.value = 'AHS Ltd services for ' + data.short + ': Constructionline Gold ' + data.year + (data.priceList.packageLabel ? ' (' + data.priceList.packageLabel + ' package)' : ''); t.font = font({ sz: 14, b: true });
    var s = ws.getCell('A2'); s.value = 'Prepared by AHS Ltd for ' + data.legal + '. Prices are estimates in days at the day rate below.'; s.font = font({ sz: 9, c: GREY });
    ws.getCell('A4').value = 'Day rate (£, excluding VAT)'; ws.getCell('A4').font = font({ b: true });
    var dr = ws.getCell('C4'); if (data.priceList.dayRate != null) dr.value = data.priceList.dayRate; dr.font = font(); dr.fill = fill('FFFFF4C2'); dr.border = BORDER; dr.numFmt = '£#,##0.00';
    ['No', 'Service', 'Days', 'Cost (£)'].forEach(function (h, i) { var c = ws.getRow(6).getCell(i + 1); c.value = h; c.font = font({ b: true, c: 'FFFFFFFF' }); c.fill = fill(CYAN); c.alignment = { wrapText: true, vertical: 'top' }; c.border = BORDER; });
    var r = 7, n = 0, firstItem = null, lastItem = null;
    data.priceList.groups.forEach(function (g) {
      ws.mergeCells('A' + r + ':D' + r); var h = ws.getCell('A' + r); h.value = g.name; h.font = font({ sz: 11, b: true }); h.fill = fill(HEAD); r++;
      g.items.forEach(function (it) {
        var row = ws.getRow(r);
        if (firstItem == null) firstItem = r; lastItem = r;
        [++n, it.name, it.days, null].forEach(function (v, k) { var c = row.getCell(k + 1); if (v != null) c.value = v; c.font = font(); c.border = BORDER; c.alignment = { wrapText: true, vertical: 'top' }; });
        row.getCell(3).numFmt = '0.00'; row.getCell(3).fill = fill('FFFFF4C2');
        var cost = row.getCell(4); cost.numFmt = '£#,##0.00';
        cost.value = it.typedCost != null ? it.typedCost : { formula: 'C' + r + '*$C$4', result: data.priceList.dayRate != null ? Math.round(it.days * data.priceList.dayRate * 100) / 100 : 0 };
        r++;
      });
    });
    if (firstItem != null) {
      r++;
      var tot = [['Total days', 'C', 'SUM(C' + firstItem + ':C' + lastItem + ')', '0.00'], ['Subtotal', 'D', 'SUM(D' + firstItem + ':D' + lastItem + ')', '£#,##0.00'],
        ['VAT at 20%', 'D', 'D' + (r + 1) + '*0.2', '£#,##0.00'], ['Total', 'D', 'D' + (r + 1) + '+D' + (r + 2), '£#,##0.00']];
      tot.forEach(function (x) { var l = ws.getCell('B' + r); l.value = x[0]; l.font = font({ b: true }); var c = ws.getCell(x[1] + r); c.value = { formula: x[2] }; c.numFmt = x[3]; c.font = font({ b: true }); r++; });
    }
    r++;
    var on = ws.getCell('A' + r); on.value = 'Ongoing'; on.font = font({ sz: 11, b: true }); r++;
    ws.getCell('B' + r).value = 'Annual Service Plan: the services on the Annual Service Plan tab keep every Constructionline section in date.'; ws.getCell('B' + r).font = font();
    if (data.priceList.dayRate == null && !data.priceList.groups.some(function (g) { return g.items.some(function (i) { return i.typedCost != null; }); })) {
      r += 2; ws.getCell('B' + r).value = 'Prices to be confirmed by AHS Ltd.'; ws.getCell('B' + r).font = font({ c: GREY });
    }
    return ws;
  }
  function sheetPlan(wb, data) {
    var ws = wb.addWorksheet('Annual Service Plan', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    [44, 46, 18, 18, 24, 12, 16].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    var t = ws.getCell('A1'); t.value = 'Keeping ' + data.short + '’s Constructionline accreditation live: what happens each year'; t.font = font({ sz: 13, b: true });
    ['Activity', 'Why Constructionline needs it', 'How often', 'Type of service', 'Who', 'Last done', 'Next due'].forEach(function (h, i) {
      var c = ws.getRow(3).getCell(i + 1); c.value = h; c.font = font({ b: true, c: 'FFFFFFFF' }); c.fill = fill(CYAN); c.border = BORDER; });
    data.plan.forEach(function (p, i) {
      var row = ws.getRow(4 + i);
      [p.activity, p.why, p.often, p.type, p.who, p.last, p.next].forEach(function (v, k) { var c = row.getCell(k + 1); if (v) c.value = v; c.font = font(); c.border = BORDER; c.alignment = { wrapText: true, vertical: 'top' }; });
    });
    if (!data.plan.length) { ws.getCell('A4').value = 'No AHS Ltd service package is set for this client.'; ws.getCell('A4').font = font({ c: GREY }); }
    return ws;
  }
  function sheetBank(wb, data) {
    if (!data.bank) return null;
    var ws = wb.addWorksheet('CL Question Bank (' + (data.set === 'designer' ? 'Designer' : 'Contractor') + ')', { views: [{ showGridLines: false }], pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
    [6, 10, 100, 16].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    ws.getCell('A1').value = 'Constructionline Gold question bank: ' + (data.set === 'designer' ? 'Designer' : 'Contractor') + ' question set'; ws.getCell('A1').font = font({ sz: 13, b: true });
    ws.getCell('A2').value = 'Every question as written in the Constructionline portal, read on 13 October 2026. Follow-up questions that only appear after a particular answer are not shown.'; ws.getCell('A2').font = font({ sz: 9, c: GREY });
    ['No', 'Ref', 'Question (as written in Constructionline)', 'Answer type'].forEach(function (h, i) { var c = ws.getRow(4).getCell(i + 1); c.value = h; c.font = font({ b: true, c: 'FFFFFFFF' }); c.fill = fill(CYAN); c.border = BORDER; });
    var r = 5, n = 0;
    data.bank.sections.forEach(function (s) {
      ws.mergeCells('A' + r + ':D' + r); var h = ws.getCell('A' + r); h.value = s.name; h.font = font({ sz: 11, b: true }); h.fill = fill(HEAD); r++;
      s.qs.forEach(function (q) { var row = ws.getRow(r++); [++n, q[0], q[2], q[1]].forEach(function (v, k) { var c = row.getCell(k + 1); c.value = v; c.font = font(); c.border = BORDER; c.alignment = { wrapText: true, vertical: 'top' }; }); });
    });
    return ws;
  }
  // copy: false = the AHS tracker; true = the client copy (with "AHS Ltd will"
  // wording and the price list).
  function buildTracker(ExcelJS, data, copy, A) {
    _A = A || root.AccredCore || null;
    var wb = new ExcelJS.Workbook();
    wb.creator = 'AHS Ltd'; wb.created = new Date();
    sheetTracker(wb, data, copy);
    if (copy) sheetPrices(wb, data);
    sheetPlan(wb, data);
    sheetBank(wb, data);
    return wb;
  }

  root.CLPack = { FOLDERS: FOLDERS, foldersFor: foldersFor, folderFor: folderFor, folderOfQ: folderOfQ, willWording: willWording, issueRef: issueRef,
    shortcut: shortcut, safeName: safeName, packData: packData, buildTracker: buildTracker };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
