// ══════════════════════════════════════════════════════════════
//  Training matrix Excel engine
//
//  parse(buffer)                  -> { sheets:[...], people:[...] }
//  build(templateBuffer, state)   -> Buffer (the client's workbook with the
//                                    current values written back into a copy)
//
//  The client's workbook is the single source of truth. We read it into a
//  people/cells model, let the app edit it, then write the current values
//  back into a byte-faithful copy of their own file on export (their exact
//  tabs, formatting and formulas are preserved because we only overwrite the
//  specific cells that changed, plus append joiners / move leavers).
// ══════════════════════════════════════════════════════════════
const ExcelJS = require('exceljs');
const { finish } = require('./exceljs-table-fix');   // an Excel table keeps its header row, and a sheet's parts go back in the order Excel wants

const ALIAS = {
  last:  ['last name', 'surname', 'lastname'],
  first: ['first name', 'forename', 'firstname'],
  badge: ['badge number', 'badge', 'badge no'],
  job:   ['job', 'role', 'position']
};
const norm = s => String(s == null ? '' : s).trim().toLowerCase();

function cellRaw(cell){
  let v = cell.value;
  if(v && v.richText) v = v.richText.map(t => t.text).join('');
  // formula → the value the workbook last worked out. With none saved there is nothing
  // to show - it used to come through as the text "[object Object]", and so did #N/A
  if(v && typeof v === 'object' && !(v instanceof Date) && (v.formula !== undefined || v.sharedFormula !== undefined || v.result !== undefined)) v = v.result === undefined ? null : v.result;
  if(v && typeof v === 'object' && !(v instanceof Date) && v.error !== undefined) v = null;
  if(v && typeof v === 'object' && !(v instanceof Date) && v.richText) v = v.richText.map(t => t.text).join('');
  if(v && typeof v === 'object' && !(v instanceof Date) && v.text !== undefined) v = v.text;      // hyperlink → text
  return v;
}
function classify(v){
  if(v == null || v === '') return { type: 'empty', v: '' };
  if(v instanceof Date)     return { type: 'date',  v: v.toISOString().slice(0, 10) };
  if(typeof v === 'number') return { type: 'number', v };
  return { type: 'text', v: String(v) };
}
// A person's identity has to survive the spreadsheet being edited. It used to
// be the sheet name and the row number, so inserting a single row above someone
// re-keyed everyone below them: renewal actions already raised against those
// people stopped matching, were re-raised as duplicates, and the originals were
// left open against nobody. Identity is now, in order of preference, their
// badge number, then their name, and only then their position - which is all a
// blank-badged unnamed row has left.
function stableId(person, sheetName, rowIdx){
  const clean = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
  const badge = clean(person.badge);
  if(badge) return 'trn_b_' + badge.replace(/[^0-9a-z]+/g, '');
  const name = (clean(person.lastName) + '_' + clean(person.firstName)).replace(/^_+|_+$/g, '');
  if(name) return 'trn_n_' + name.replace(/[^0-9a-z_]+/g, '_');
  return 'trn_' + String(sheetName).replace(/[^0-9A-Za-z]+/g, '') + '_' + rowIdx;
}

// A spreadsheet gives us nothing to classify a sheet by except its name, so
// these are the words real training matrices actually use. Two rules of thumb:
//   - the LEAVER test used to be the single exact word "left", so a tab called
//     "Leavers" or "Ex staff" loaded as current employees - they then showed up
//     in the matrix, generated renewal actions and counted towards coverage;
//   - where a name says nothing, fall back to active staff. That direction is
//     recoverable (a leaver kept active shows as a gap you can see), where the
//     other one is not (a current employee silently archived).
// A consultant can override either per sheet; see sheetClass in the app.
const LEFT_RE   = /(^|[^a-z])(left|leaver|leavers|ex[-\s]?staff|ex[-\s]?employee|former|archive|archived|inactive|dormant)([^a-z]|$)/i;
const GARAGE_RE = /(garage|workshop|vehicle|fleet|mechanic|technician|fitter)/i;
function groupFor(name){ return GARAGE_RE.test(String(name)) ? 'garage' : 'staff'; }
function statusFor(name){ return LEFT_RE.test(String(name)) ? 'left' : 'active'; }

// Read one row as a header map { normalised heading -> column index }.
function headerMap(ws, rowIdx){
  const hdr = ws.getRow(rowIdx); const col = {};
  for(let c = 1; c <= ws.columnCount; c++){ const h = norm(cellRaw(hdr.getCell(c))); if(h && !(h in col)) col[h] = c; }
  return col;
}
// Real spreadsheets rarely start at row 1 (titles, logos, blank rows). Find
// the first row in the top 15 whose headings contain a name column; an
// explicit opts.headerRow (the "where does the table start" option) wins.
function findHeaderRow(ws, wanted, explicit){
  if(explicit && explicit >= 1) return explicit;
  const top = Math.min(15, ws.rowCount || 1);
  for(let r = 1; r <= top; r++){
    const col = headerMap(ws, r);
    const hit = wanted.some(aliases => aliases.some(a => col[a]));
    if(hit) return r;
  }
  return 1;
}

// The people on a tab: one for every row below the headings with a name on it.
// One reading, used by the import and by the export (which has to know where
// the people are in the client's own file before it moves anyone).
function personRows(ws, start, cols){
  const rows = [];
  for(let r = start; r <= ws.rowCount; r++){
    const row = ws.getRow(r);
    let lastName = cols.last ? cellRaw(row.getCell(cols.last)) : '';
    let firstName = cols.first ? cellRaw(row.getCell(cols.first)) : '';
    if(cols.full && (lastName == null || lastName === '') && (firstName == null || firstName === '')){
      firstName = cellRaw(row.getCell(cols.full));   // whole name lives in one column
    }
    if((lastName == null || lastName === '') && (firstName == null || firstName === '')) continue;
    rows.push({ r, lastName: lastName == null ? '' : String(lastName), firstName: firstName == null ? '' : String(firstName) });
  }
  return { rows };
}

// opts: { headerRow, fixed:{last,first,full,badge,job}, skip:[colIdx,...] }
// - fixed (1-based column numbers) is the DRM-style EXPLICIT mapping from the
//   in-app wizard: it beats the alias lookup entirely, so any heading works
//   ("NAME" as the surname column, etc). 'full' = a whole-name column.
// - skip lists columns to ignore completely (never a course).
async function parse(buffer, opts = {}){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheets = [];
  const people = [];
  const seenId = {};   // identity collisions, resolved by a counter (see below)
  const skipSet = new Set(Array.isArray(opts.skip) ? opts.skip : []);
  const fx = (opts.fixed && typeof opts.fixed === 'object') ? opts.fixed : null;
  wb.worksheets.forEach(ws => {
    const headerRow = fx ? (opts.headerRow || 1) : findHeaderRow(ws, [ALIAS.last, ALIAS.first], opts.headerRow);
    const hdr = ws.getRow(headerRow);
    const col = headerMap(ws, headerRow);
    const find = aliases => { for(const a of aliases){ if(col[a]) return col[a]; } return null; };
    const cLast  = fx ? (fx.last  || null) : find(ALIAS.last);
    const cFirst = fx ? (fx.first || null) : find(ALIAS.first);
    const cFull  = fx ? (fx.full  || null) : null;
    const cBadge = fx ? (fx.badge || null) : find(ALIAS.badge);
    const cJob   = fx ? (fx.job   || null) : find(ALIAS.job);
    if(!cLast && !cFirst && !cFull) return; // not a staff sheet
    const fixed = new Set([cLast, cFirst, cFull, cBadge, cJob, ...skipSet].filter(Boolean));
    const courses = [];
    for(let c = 1; c <= ws.columnCount; c++){ const h = cellRaw(hdr.getCell(c)); if(h && !fixed.has(c)) courses.push({ name: String(h).trim(), col: c }); }
    const group = groupFor(ws.name), status = statusFor(ws.name);
    const cols = { last: cLast, first: cFirst, full: cFull, badge: cBadge, job: cJob };
    personRows(ws, headerRow + 1, cols).rows.forEach(({ r, lastName, firstName }) => {
      const row = ws.getRow(r);
      const cells = {};
      courses.forEach(cc => { cells[cc.name] = classify(cellRaw(row.getCell(cc.col))); });
      const person = {
        sheet: ws.name, row: r, group, status,
        lastName, firstName,
        badge: cBadge ? String(cellRaw(row.getCell(cBadge)) ?? '') : '',
        job: cJob ? String(cellRaw(row.getCell(cJob)) ?? '') : '',
        cells
      };
      person.id = stableId(person, ws.name, r);
      // Two unbadged people can genuinely share a name. Keep them apart with a
      // counter rather than falling back to the row, so they stay stable when
      // rows move; they only shift if their order relative to each other does.
      if(seenId[person.id]){ person.id = person.id + '_' + (++seenId[person.id]); }
      else { seenId[person.id] = 1; }
      people.push(person);
    });
    sheets.push({ name: ws.name, group, status, cols, headerRow, courses: courses.map(c => ({ name: c.name, col: c.col })) });
  });
  return { sheets, people };
}

// Build a brand-new workbook straight from the app's people model - used when
// there is no stored template (the data came in by PASTE or was typed in).
// One sheet per group plus Left; date cells are real Excel dates.
async function buildFresh(state){
  const wb = new ExcelJS.Workbook();
  const people = (state && state.people) || [];
  const groups = [
    { key: 'staff',  name: 'Staff',        pick: p => p.status !== 'left' && (p.group || 'staff') === 'staff' },
    { key: 'garage', name: 'Garage staff', pick: p => p.status !== 'left' && p.group === 'garage' },
    { key: 'left',   name: 'Left',         pick: p => p.status === 'left' },
  ];
  groups.forEach(g => {
    const rows = people.filter(g.pick);
    if(!rows.length) return;
    const courses = [];
    rows.forEach(p => Object.keys(p.cells || {}).forEach(c => { if(!courses.includes(c)) courses.push(c); }));
    const ws = wb.addWorksheet(g.name);
    const head = ['Last Name', 'First Name', 'Badge Number', 'Job', ...courses];
    const hr = ws.addRow(head); hr.font = { bold: true };
    rows.sort((a, b) => (((a.lastName || '') + a.firstName).toLowerCase()).localeCompare(((b.lastName || '') + b.firstName).toLowerCase()))
      .forEach(p => {
        const r = ws.addRow([p.lastName || '', p.firstName || '', p.badge || '', p.job || '',
          ...courses.map(c => toCell((p.cells || {})[c] ? p.cells[c].v : null))]);
        courses.forEach((c, i) => { const cell = r.getCell(5 + i); if(cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy'; });
      });
    ws.columns.forEach((colDef, i) => { colDef.width = i < 2 ? 16 : (i < 4 ? 13 : 14); });
  });
  if(!wb.worksheets.length) wb.addWorksheet('Staff').addRow(['Last Name', 'First Name', 'Badge Number', 'Job']).font = { bold: true };
  return await wb.xlsx.writeBuffer();
}

// Coerce an app cell value back to the right Excel type for writing.
function toCell(value){
  if(value == null || value === '') return null;
  // ISO date → Date object so Excel keeps it as a real date (the cell's numFmt renders it)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if(m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return value; // status text, number-as-text, etc.
}
// A date written into a cell with no date format (a blank cell, or one that held
// "P" or "NA") shows in Excel as a number such as 47922: give it day/month/year.
const isDateFmt = f => /[dmy]/i.test(String(f || '').replace(/"[^"]*"|\[[^\]]*\]/g, ''));
function dateFmt(cell){ if(cell.value instanceof Date && !isDateFmt(cell.numFmt)) cell.numFmt = 'dd/mm/yyyy'; }

// The import's own layout ({name, group, status, cols, headerRow, courses}), kept
// only where it fits the stored file: the tab is there and every column number is
// a real column. A layout saved before the Name column was recorded (cols.full)
// gets it back from the file: the column on a person's row that holds their name.
function sheetsFromState(wb, list, people){
  if(!Array.isArray(list)) return [];
  const ok = n => n == null || (Number.isInteger(n) && n > 0 && n <= 16384);
  const out = [];
  list.forEach(s => {
    if(!s || typeof s.name !== 'string' || !wb.getWorksheet(s.name) || !Array.isArray(s.courses)) return;
    const c = s.cols || {};
    const cols = { last: c.last || null, first: c.first || null, full: c.full || null, badge: c.badge || null, job: c.job || null };
    if(!Object.values(cols).every(ok)) return;
    const courses = s.courses.filter(x => x && typeof x.name === 'string' && Number.isInteger(x.col) && x.col > 0 && x.col <= 16384).map(x => ({ name: x.name, col: x.col }));
    if(!cols.last && !cols.first && !cols.full){
      const ws = wb.getWorksheet(s.name), taken = new Set([cols.badge, cols.job, ...courses.map(x => x.col)]);
      const p = (people || []).find(x => x && x.sheet === s.name && x.row && String(x.firstName || '').trim());
      if(p){ const row = ws.getRow(p.row); for(let k = 1; k <= ws.columnCount; k++){ if(!taken.has(k) && String(cellRaw(row.getCell(k)) ?? '').trim() === String(p.firstName).trim()){ cols.full = k; break; } } }
    }
    out.push({ name: s.name, group: s.group || 'staff', status: s.status || 'active', cols, headerRow: s.headerRow || 1, courses });
  });
  return out;
}

// ── Rows that move ─────────────────────────────────────────────
// Someone marked as left in Compass leaves their tab and joins the Left tab
// when the workbook is exported - the app has always said they would ("They
// are kept, archived, and move to the Left tab on export"), and they did
// not (Simon, 12 November 2026: the export had the "wrong content"). A row
// is taken out by moving the rows of people below it up by one - what each
// cell holds, how it looks and any note on it - and only within the block
// of people, so nothing under the table moves.
const { slideFormula } = require('exceljs/lib/utils/shared-formula');
const cloneStyle = s => { try { return JSON.parse(JSON.stringify(s || {})); } catch(e){ return {}; } };
function setNote(cell, note){
  if(note) cell.note = (typeof note === 'string') ? note : JSON.parse(JSON.stringify(note));
  else if(cell._comment) cell._comment = undefined;
}
function takeRow(ws, r){
  const row = ws.getRow(r), cells = {};
  for(let c = 1; c <= ws.columnCount; c++){
    const cell = row.getCell(c), f = cell.type === ExcelJS.ValueType.Formula;
    cells[c] = { value: f ? null : cell.value, formula: f ? cell.formula : null, from: cell.address, result: f ? cell.result : undefined, style: cloneStyle(cell.style), note: cell.note };
  }
  return { cells, height: row.height };
}
function putRow(ws, r, data){
  const row = ws.getRow(r);
  for(let c = 1; c <= ws.columnCount; c++){
    const cell = row.getCell(c), d = data.cells[c] || { value: null, style: {}, note: null };
    cell.value = d.formula ? { formula: slideFormula(d.formula, d.from, cell.address), result: d.result } : d.value;
    cell.style = cloneStyle(d.style); setNote(cell, d.note);
  }
  if(data.height) row.height = data.height;
}
function clearRow(ws, r){ const row = ws.getRow(r); for(let c = 1; c <= ws.columnCount; c++){ const cell = row.getCell(c); cell.value = null; setNote(cell, null); } }
function rowIsFree(ws, r){
  const row = ws.getRow(r);
  for(let c = 1; c <= ws.columnCount; c++){ const cell = row.getCell(c); if(cell.isMerged) return false; const v = cellRaw(cell); if(v != null && String(v).trim() !== '') return false; }
  return true;
}
function mergedIn(ws, r1, r2){
  return (ws.model.merges || []).some(rg => { const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(rg); return m && +m[2] <= r2 && +m[4] >= r1; });
}

// state = { people:[{sheet,row,group,status,lastName,firstName,badge,job,cells:{course:{type,v}}}], sheets? }
// -> { buffer, moved:[names], notMoved:[{name,why}], dropped:[{name,course}], added, notRemoved, formulaKept }
async function buildReport(templateBuffer, state){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const people = (state && state.people) || [];
  // Where each column is: the layout the people were read with at import, when
  // it fits this file. Working it out again with the automatic read alone could
  // not find a matrix brought in through the mapping screen (headings on row 8,
  // one Name column), so nothing was written back and every change made in
  // Compass was missing from the export (Simon, 12 November 2026).
  let sheets = sheetsFromState(wb, state && state.sheets, people);
  if(!sheets.length) sheets = (await parse(templateBuffer)).sheets;
  const byName = {}; sheets.forEach(s => { byName[s.name] = s; });
  const leftMeta = sheets.find(s => s.status === 'left' && wb.getWorksheet(s.name)) || null;
  const report = { moved: [], notMoved: [], dropped: [], added: 0, notRemoved: 0, formulaKept: 0 };

  // where the people are in the client's file, before anything is written
  const inFile = {}, last = {};
  sheets.forEach(s => { const ws = wb.getWorksheet(s.name); if(!ws) return;
    const rows = personRows(ws, (s.headerRow || 1) + (s.headRows === 2 ? 2 : 1), s.cols).rows;
    inFile[s.name] = {}; rows.forEach(x => { inFile[s.name][x.r] = x; });
    last[s.name] = rows.length ? Math.max(...rows.map(x => x.r)) : 0; });
  const origLast = Object.assign({}, last);

  const existing = people.filter(p => p.row && byName[p.sheet]);
  const joiners  = people.filter(p => !p.row);
  // someone deleted in Compass is never deleted from the client's file: counted, so the app can say so
  const have = new Set(existing.map(p => p.sheet + '|' + p.row));
  Object.keys(inFile).forEach(n => Object.keys(inFile[n]).forEach(r => { if(!have.has(n + '|' + r)) report.notRemoved++; }));

  // 1) the cells changed in Compass, and only those. A cell that still holds what
  //    was read from it is left exactly as the client has it (it used to be
  //    written again, which turned part-bold text and links into plain text). A
  //    cell the spreadsheet works out by a formula is never written over: it used
  //    to be replaced by the value, on every export, changed or not.
  const held = x => (x && x.type !== 'empty' && x.v != null) ? String(x.v) : '';
  existing.forEach(p => {
    const meta = byName[p.sheet]; const ws = wb.getWorksheet(p.sheet); if(!ws) return;
    const colFor = {}; meta.courses.forEach(c => { colFor[c.name] = c.col; });
    Object.entries(p.cells || {}).forEach(([course, cell]) => {
      const c = colFor[course]; if(!c) return;
      const x = ws.getRow(p.row).getCell(c);
      if(held(classify(cellRaw(x))) === held(cell)) return;
      if(x.type === ExcelJS.ValueType.Formula){ report.formulaKept++; return; }
      x.value = toCell(cell && cell.v); dateFmt(x);
    });
  });

  // 2) people marked as left in Compass: off their tab, onto the Left tab. Bottom
  //    up on each tab, so the rows above the one taken out stay where they are.
  const nameOf = p => [p.firstName, p.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'someone';
  const leavers = existing.filter(p => p.status === 'left' && byName[p.sheet].status !== 'left')
    .sort((a, b) => a.sheet === b.sheet ? b.row - a.row : (a.sheet < b.sheet ? -1 : 1));
  const arrivals = [];
  leavers.forEach(p => {
    const ws = wb.getWorksheet(p.sheet), name = nameOf(p);
    if(!ws) return;
    if(!leftMeta){ report.notMoved.push({ name, why: 'no Left tab' }); return; }
    const there = (inFile[p.sheet] || {})[p.row];
    // never move a row that is not this person's: the names on it must be theirs
    const sameName = there && norm(there.lastName) === norm(p.lastName) && norm(there.firstName) === norm(p.firstName);
    if(!sameName){ report.notMoved.push({ name, why: 'not on the row' }); return; }
    const end = last[p.sheet];
    if(mergedIn(ws, p.row, end)){ report.notMoved.push({ name, why: 'merged cells' }); return; }
    arrivals.push({ p, name, from: byName[p.sheet], data: takeRow(ws, p.row) });
    for(let r = p.row; r < end; r++) putRow(ws, r, takeRow(ws, r + 1));
    clearRow(ws, end);
    last[p.sheet] = end - 1;
  });
  arrivals.sort((a, b) => a.p.sheet === b.p.sheet ? a.p.row - b.p.row : (a.p.sheet < b.p.sheet ? -1 : 1)).forEach(a => {
    const ws = wb.getWorksheet(leftMeta.name), lastRow = last[leftMeta.name] || 0;
    let idx = ws.rowCount + 1; if(lastRow && rowIsFree(ws, lastRow + 1)) idx = lastRow + 1;
    const tmpl = ws.getRow(lastRow || Math.max(1, idx - 1)), nr = ws.getRow(idx);
    for(let c = 1; c <= ws.columnCount; c++) nr.getCell(c).style = cloneStyle(tmpl.getCell(c).style);
    const src = a.data.cells, from = a.from.cols, to = leftMeta.cols;
    const put = (c, d) => { const cell = nr.getCell(c); cell.value = d.formula ? (d.result === undefined ? null : d.result) : d.value; setNote(cell, d.note); dateFmt(cell); };
    const ident = (kind, text) => { if(!to[kind]) return; if(from[kind] && src[from[kind]]) put(to[kind], src[from[kind]]); else nr.getCell(to[kind]).value = text || ''; };
    const whole = [a.p.firstName, a.p.lastName].filter(Boolean).join(' ');
    if(to.full && !to.last && !to.first) ident('full', whole);
    else { ident('last', a.p.lastName); ident('first', (from.full && !from.first) ? whole : a.p.firstName); }
    ident('badge', a.p.badge); ident('job', a.p.job);
    const toCol = {}; leftMeta.courses.forEach(c => { if(!(norm(c.name) in toCol)) toCol[norm(c.name)] = c.col; });
    a.from.courses.forEach(c => {
      const d = src[c.col]; if(!d) return;
      const v = d.formula ? d.result : d.value, has = v != null && (v instanceof Date || String(typeof v === 'object' ? (v.text || (v.richText || []).map(t => t.text).join('') || '') : v).trim() !== '');
      const t = toCol[norm(c.name)];
      if(t) put(t, d); else if(has) report.dropped.push({ name: a.name, course: c.name });   // the Left tab has no such column
    });
    if(idx === lastRow + 1 || !lastRow) last[leftMeta.name] = idx;
    report.moved.push(a.name);
  });

  // 3) people added in Compass: directly under the last person on their tab when
  //    that row is free (so they are part of the list, and of its table), else
  //    below everything as before. Styled like the row above.
  joiners.forEach(p => {
    // the tab they were added to in the app (p.tab), else the first tab of their group; someone added and then marked as left goes to the Left tab
    const target = (p.status === 'left' && leftMeta)
      || (p.tab && sheets.find(s => s.name === p.tab && s.status === 'active'))
      || sheets.find(s => s.group === (p.group || 'staff') && s.status === 'active') || sheets[0];
    if(!target) return;
    const targetSheetName = target.name;
    const meta = byName[targetSheetName]; const ws = wb.getWorksheet(targetSheetName); if(!ws || !meta) return;
    const lastRow = last[targetSheetName] || 0;
    let idx = ws.rowCount + 1; if(lastRow && rowIsFree(ws, lastRow + 1)) idx = lastRow + 1;
    const tmpl = ws.getRow(idx === lastRow + 1 ? lastRow : idx - 1); const nr = ws.getRow(idx);
    // copy styling from the template row across all used columns
    for(let c = 1; c <= ws.columnCount; c++){ try { nr.getCell(c).style = JSON.parse(JSON.stringify(tmpl.getCell(c).style)); } catch(e){} }
    if(meta.cols.last)  nr.getCell(meta.cols.last).value = p.lastName || '';
    if(meta.cols.first) nr.getCell(meta.cols.first).value = p.firstName || '';
    if(meta.cols.full && !meta.cols.last && !meta.cols.first) nr.getCell(meta.cols.full).value = [p.firstName, p.lastName].filter(Boolean).join(' ');
    if(meta.cols.badge) nr.getCell(meta.cols.badge).value = p.badge || '';
    if(meta.cols.job)   nr.getCell(meta.cols.job).value = p.job || '';
    const colFor = {}; meta.courses.forEach(c => { colFor[c.name] = c.col; });
    Object.entries(p.cells || {}).forEach(([course, cell]) => { const c = colFor[course]; if(c) nr.getCell(c).value = toCell(cell && cell.v); });
    for(let c = 1; c <= ws.columnCount; c++) dateFmt(nr.getCell(c));
    if(lastRow && idx === lastRow + 1) last[targetSheetName] = idx;   // still one block of people
    report.added++;
  });

  // 4) an Excel table that ended on the last person still ends on the last person
  sheets.forEach(s => {
    const ws = wb.getWorksheet(s.name); if(!ws || !ws.tables || last[s.name] === origLast[s.name]) return;
    Object.values(ws.tables).forEach(t => {
      const m = t && (t.model || t.table); if(!m || m.totalsRow) return;
      const rg = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(String(m.tableRef || '')); if(!rg) return;
      if(+rg[4] !== origLast[s.name] || last[s.name] <= +rg[2]) return;
      const ref = rg[1] + rg[2] + ':' + rg[3] + last[s.name];
      if(m.autoFilterRef === m.tableRef) m.autoFilterRef = ref;
      m.tableRef = ref;
    });
  });

  return Object.assign({ buffer: await finish(await wb.xlsx.writeBuffer()) }, report);
}
async function build(templateBuffer, state){ return (await buildReport(templateBuffer, state)).buffer; }

// First rows of every sheet as plain strings - the "Map & import" preview
// (the consultant clicks the row that holds the column headings). Generic:
// the statutory route uses this same function.
async function peek(buffer, opts = {}){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const maxR = opts.rows || 15, maxC = opts.cols || 12;
  return { sheets: wb.worksheets.map(ws => ({
    name: ws.name,
    rows: Array.from({ length: Math.min(maxR, ws.rowCount || 0) }, (_, i) => {
      const row = ws.getRow(i + 1); const out = [];
      for(let c = 1; c <= Math.min(maxC, Math.max(1, ws.columnCount || 1)); c++){
        const v = cellRaw(row.getCell(c));
        out.push(v == null ? '' : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)));
      }
      return out;
    }),
  })) };
}

module.exports = {
  stableId, parse, build, buildReport, buildFresh, peek };
