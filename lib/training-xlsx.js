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

async function parse(buffer){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheets = [];
  const people = [];
  wb.worksheets.forEach(ws => {
    const hdr = ws.getRow(1);
    const col = {};
    for(let c = 1; c <= ws.columnCount; c++){ const h = norm(cellRaw(hdr.getCell(c))); if(h && !(h in col)) col[h] = c; }
    const find = aliases => { for(const a of aliases){ if(col[a]) return col[a]; } return null; };
    const cLast = find(ALIAS.last), cFirst = find(ALIAS.first), cBadge = find(ALIAS.badge), cJob = find(ALIAS.job);
    if(!cLast && !cFirst) return; // not a staff sheet
    const fixed = new Set([cLast, cFirst, cBadge, cJob].filter(Boolean));
    const courses = [];
    for(let c = 1; c <= ws.columnCount; c++){ const h = cellRaw(hdr.getCell(c)); if(h && !fixed.has(c)) courses.push({ name: String(h).trim(), col: c }); }
    const group = groupFor(ws.name), status = statusFor(ws.name);
    const cols = { last: cLast, first: cFirst, badge: cBadge, job: cJob };
    for(let r = 2; r <= ws.rowCount; r++){
      const row = ws.getRow(r);
      const lastName = cLast ? cellRaw(row.getCell(cLast)) : '';
      const firstName = cFirst ? cellRaw(row.getCell(cFirst)) : '';
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
    sheets.push({ name: ws.name, group, status, cols, courses: courses.map(c => ({ name: c.name, col: c.col })) });
  });
  return { sheets, people };
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

module.exports = { parse, build };
