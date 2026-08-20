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
function groupFor(name){ return /garage/i.test(name) ? 'garage' : 'staff'; }
function statusFor(name){ return /^\s*left\s*$/i.test(name) ? 'left' : 'active'; }

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
    const cols = { last: cLast, first: cFirst, badge: cBadge, job: cJob };
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
      people.push({
        id: 'trn_' + ws.name.replace(/\W+/g, '') + '_' + r,
        sheet: ws.name, row: r, group, status,
        lastName: lastName == null ? '' : String(lastName),
        firstName: firstName == null ? '' : String(firstName),
        badge: cBadge ? String(cellRaw(row.getCell(cBadge)) ?? '') : '',
        job: cJob ? String(cellRaw(row.getCell(cJob)) ?? '') : '',
        cells
      });
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

// state = { people:[{sheet,row,group,status,lastName,firstName,badge,job,cells:{course:{type,v}}}] }
async function build(templateBuffer, state){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  // Re-derive the structure from the stored template so column positions are exact.
  const { sheets } = await parse(templateBuffer);
  const byName = {}; sheets.forEach(s => { byName[s.name] = s; });
  const leftSheetName = (sheets.find(s => s.status === 'left') || {}).name;

  const people = (state && state.people) || [];
  const existing = people.filter(p => p.row && byName[p.sheet]);
  const joiners  = people.filter(p => !p.row);
  const nowLeft  = people.filter(p => p.status === 'left' && p.row && byName[p.sheet] && byName[p.sheet].status !== 'left');

  // 1) overwrite cells for existing people
  existing.forEach(p => {
    const meta = byName[p.sheet]; const ws = wb.getWorksheet(p.sheet); if(!ws) return;
    const colFor = {}; meta.courses.forEach(c => { colFor[c.name] = c.col; });
    Object.entries(p.cells || {}).forEach(([course, cell]) => {
      const c = colFor[course]; if(!c) return;
      ws.getRow(p.row).getCell(c).value = toCell(cell && cell.v);
    });
  });

  // 2) append joiners to their group's sheet, styled like the row above
  joiners.forEach(p => {
    const targetSheetName = (sheets.find(s => s.group === (p.group || 'staff') && s.status === 'active') || sheets[0]).name;
    const meta = byName[targetSheetName]; const ws = wb.getWorksheet(targetSheetName); if(!ws || !meta) return;
    const idx = ws.rowCount + 1; const tmpl = ws.getRow(idx - 1); const nr = ws.getRow(idx);
    if(meta.cols.last)  nr.getCell(meta.cols.last).value = p.lastName || '';
    if(meta.cols.first) nr.getCell(meta.cols.first).value = p.firstName || '';
    if(meta.cols.badge) nr.getCell(meta.cols.badge).value = p.badge || '';
    if(meta.cols.job)   nr.getCell(meta.cols.job).value = p.job || '';
    const colFor = {}; meta.courses.forEach(c => { colFor[c.name] = c.col; });
    Object.entries(p.cells || {}).forEach(([course, cell]) => { const c = colFor[course]; if(c) nr.getCell(c).value = toCell(cell && cell.v); });
    // copy styling from the template row across all used columns
    for(let c = 1; c <= ws.columnCount; c++){ try { nr.getCell(c).style = JSON.parse(JSON.stringify(tmpl.getCell(c).style)); } catch(e){} }
  });

  return await wb.xlsx.writeBuffer();
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

module.exports = { parse, build, buildFresh, peek };
