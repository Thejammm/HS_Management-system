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
  if(v && typeof v === 'object' && !(v instanceof Date) && v.result !== undefined) v = v.result; // formula → result
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
    for(let r = headerRow + 1; r <= ws.rowCount; r++){
      const row = ws.getRow(r);
      let lastName = cLast ? cellRaw(row.getCell(cLast)) : '';
      let firstName = cFirst ? cellRaw(row.getCell(cFirst)) : '';
      if(cFull && (lastName == null || lastName === '') && (firstName == null || firstName === '')){
        firstName = cellRaw(row.getCell(cFull));   // whole name lives in one column
      }
      if((lastName == null || lastName === '') && (firstName == null || firstName === '')) continue;
      const cells = {};
      courses.forEach(cc => { cells[cc.name] = classify(cellRaw(row.getCell(cc.col))); });
      const person = {
        sheet: ws.name, row: r, group, status,
        lastName: lastName == null ? '' : String(lastName),
        firstName: firstName == null ? '' : String(firstName),
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
    }
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

// state = { people:[{sheet,row,group,status,lastName,firstName,badge,job,cells:{course:{type,v}}}], sheets? }
async function build(templateBuffer, state){
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
  const leftSheetName = (sheets.find(s => s.status === 'left') || {}).name;

  const existing = people.filter(p => p.row && byName[p.sheet]);
  const joiners  = people.filter(p => !p.row);
  const nowLeft  = people.filter(p => p.status === 'left' && p.row && byName[p.sheet] && byName[p.sheet].status !== 'left');

  // 1) overwrite cells for existing people
  existing.forEach(p => {
    const meta = byName[p.sheet]; const ws = wb.getWorksheet(p.sheet); if(!ws) return;
    const colFor = {}; meta.courses.forEach(c => { colFor[c.name] = c.col; });
    Object.entries(p.cells || {}).forEach(([course, cell]) => {
      const c = colFor[course]; if(!c) return;
      const x = ws.getRow(p.row).getCell(c); x.value = toCell(cell && cell.v); dateFmt(x);
    });
  });

  // 2) append joiners to their group's sheet, styled like the row above
  joiners.forEach(p => {
    // the tab they were added to in the app (p.tab), else the first tab of their group
    const target = (p.tab && sheets.find(s => s.name === p.tab && s.status === 'active'))
      || sheets.find(s => s.group === (p.group || 'staff') && s.status === 'active') || sheets[0];
    if(!target) return;
    const targetSheetName = target.name;
    const meta = byName[targetSheetName]; const ws = wb.getWorksheet(targetSheetName); if(!ws || !meta) return;
    const idx = ws.rowCount + 1; const tmpl = ws.getRow(idx - 1); const nr = ws.getRow(idx);
    if(meta.cols.last)  nr.getCell(meta.cols.last).value = p.lastName || '';
    if(meta.cols.first) nr.getCell(meta.cols.first).value = p.firstName || '';
    if(meta.cols.full && !meta.cols.last && !meta.cols.first) nr.getCell(meta.cols.full).value = [p.firstName, p.lastName].filter(Boolean).join(' ');
    if(meta.cols.badge) nr.getCell(meta.cols.badge).value = p.badge || '';
    if(meta.cols.job)   nr.getCell(meta.cols.job).value = p.job || '';
    const colFor = {}; meta.courses.forEach(c => { colFor[c.name] = c.col; });
    Object.entries(p.cells || {}).forEach(([course, cell]) => { const c = colFor[course]; if(c) nr.getCell(c).value = toCell(cell && cell.v); });
    // copy styling from the template row across all used columns
    for(let c = 1; c <= ws.columnCount; c++){ try { nr.getCell(c).style = JSON.parse(JSON.stringify(tmpl.getCell(c).style)); } catch(e){} dateFmt(nr.getCell(c)); }
  });

  return await finish(await wb.xlsx.writeBuffer());
  // Note: leaver movement between tabs is handled by the app marking status:'left'
  // and re-exporting; for now leavers keep their row and are shown archived in-app.
  // (A later pass can physically move rows to the Left tab if required.)
}

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
  stableId, parse, build, buildFresh, peek };
