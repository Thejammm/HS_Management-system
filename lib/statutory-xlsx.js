// ══════════════════════════════════════════════════════════════
//  Statutory register Excel engine — same philosophy as the
//  training matrix: the client's own workbook stays the source of
//  truth. parse() reads it into sections/items (each item anchored
//  to its sheet+row); build() writes the app's current values back
//  into a byte-faithful copy of their file. Appended items are
//  styled like the row above; formatting/tabs/formulas untouched.
//
//  Sheet model: every worksheet whose header row contains an
//  "item"-like column is a section (sheet name = section name).
// ══════════════════════════════════════════════════════════════
const ExcelJS = require('exceljs');

const ALIAS = {
  item:      ['item','statutory item','inspection','description','equipment','plant','asset'],
  area:      ['area','location','area/location','site','where'],
  frequency: ['frequency','freq','interval','how often','cycle'],
  lastDone:  ['last done','date carried out','completed','last','done','last inspection','last exam','last test'],
  nextDue:   ['next due','due','due date','next','renewal','expiry','next inspection','next exam','next test'],
  result:    ['result','outcome','pass/fail','status'],
  certRef:   ['certificate','cert','cert ref','certificate number','cert no','report number','report no','reference','ref'],
  notes:     ['notes','comment','comments','remarks']
};
const norm = s => String(s == null ? '' : s).trim().toLowerCase();

function cellRaw(cell){
  let v = cell.value;
  if(v && v.richText) v = v.richText.map(t => t.text).join('');
  if(v && typeof v === 'object' && !(v instanceof Date) && v.result !== undefined) v = v.result;
  if(v && typeof v === 'object' && !(v instanceof Date) && v.text !== undefined) v = v.text;
  return v;
}
function asStr(v){
  if(v == null) return '';
  if(v instanceof Date) return v.toISOString().slice(0, 10);   // ISO for the app
  return String(v).trim();
}

// Header map for one row + detection of where the table starts (titles and
// logos above the real headings are common; an explicit headerRow wins).
function headerMapAt(ws, rowIdx){
  const hdr = ws.getRow(rowIdx); const col = {};
  for(let c = 1; c <= ws.columnCount; c++){ const h = norm(cellRaw(hdr.getCell(c))); if(h && !(h in col)) col[h] = c; }
  return col;
}
function findHeaderRow(ws, explicit){
  if(explicit && explicit >= 1) return explicit;
  const top = Math.min(15, ws.rowCount || 1);
  for(let r = 1; r <= top; r++){
    const col = headerMapAt(ws, r);
    if(ALIAS.item.some(a => col[a])) return r;
  }
  return 1;
}

// opts: { headerRow, fixed:{item,area,frequency,lastDone,nextDue,result,certRef,notes} }
// fixed (1-based columns) is the explicit in-app mapping - beats the aliases.
async function parse(buffer, opts = {}){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheets = [], items = [];
  const fx = (opts.fixed && typeof opts.fixed === 'object') ? opts.fixed : null;
  wb.worksheets.forEach(ws => {
    const headerRow = fx ? (opts.headerRow || 1) : findHeaderRow(ws, opts.headerRow);
    const col = headerMapAt(ws, headerRow);
    const find = aliases => { for(const a of aliases){ if(col[a]) return col[a]; } return null; };
    const cols = {};
    Object.keys(ALIAS).forEach(k => { cols[k] = fx ? (fx[k] || null) : find(ALIAS[k]); });
    if(!cols.item) return;                       // not a register sheet
    for(let r = headerRow + 1; r <= ws.rowCount; r++){
      const row = ws.getRow(r);
      const name = asStr(cellRaw(row.getCell(cols.item)));
      if(!name) continue;
      const g = k => cols[k] ? asStr(cellRaw(row.getCell(cols[k]))) : '';
      items.push({ sheet: ws.name, row: r,
        item: name, area: g('area'), frequency: g('frequency'),
        resultDate: g('lastDone'), dueDate: g('nextDue'),
        result: g('result'), certRef: g('certRef'), notes: g('notes') });
    }
    sheets.push({ name: ws.name, cols, headerRow });
  });
  return { sheets, items };
}

// Brand-new workbook from the app's sections/items - used when there is no
// stored template (rows were typed in or pasted). One sheet per section.
async function buildFresh(state){
  const wb = new ExcelJS.Workbook();
  const items = (state && state.items) || [];
  const secNames = []; items.forEach(it => { const n = it.sheet || 'Statutory inspections'; if(!secNames.includes(n)) secNames.push(n); });
  secNames.forEach(name => {
    const ws = wb.addWorksheet(String(name).slice(0, 28) || 'Statutory');
    const hr = ws.addRow(['Item', 'Area', 'Frequency', 'Last done', 'Next due', 'Result', 'Certificate', 'Notes']); hr.font = { bold: true };
    items.filter(it => (it.sheet || 'Statutory inspections') === name).forEach(it => {
      const r = ws.addRow([it.item || '', it.area || '', it.frequency || '', toCell(it.resultDate), toCell(it.dueDate), it.result || '', it.certRef || '', it.notes || '']);
      [4, 5].forEach(ci => { const cell = r.getCell(ci); if(cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy'; });
    });
    ws.columns.forEach((colDef, i) => { colDef.width = i === 0 ? 30 : (i === 7 ? 26 : 14); });
  });
  if(!wb.worksheets.length){ const ws = wb.addWorksheet('Statutory'); ws.addRow(['Item', 'Area', 'Frequency', 'Last done', 'Next due', 'Result', 'Certificate', 'Notes']).font = { bold: true }; }
  return await wb.xlsx.writeBuffer();
}

// ISO date string → Date (so Excel keeps real dates + the cell's numFmt); else raw text.
function toCell(v){
  if(v == null || v === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if(m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return v;
}

// state = { items:[{sheet,row?,item,area,frequency,resultDate,dueDate,result,certRef,notes}] }
async function build(templateBuffer, state){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const { sheets } = await parse(templateBuffer);
  const byName = {}; sheets.forEach(s => { byName[s.name] = s; });
  const items = (state && state.items) || [];
  const firstSheet = sheets[0] && sheets[0].name;

  const writeRow = (ws, cols, rowIdx, it, includeItem) => {
    const put = (k, v) => { if(cols[k]) ws.getRow(rowIdx).getCell(cols[k]).value = toCell(v); };
    if(includeItem) put('item', it.item);
    put('area', it.area); put('frequency', it.frequency);
    put('lastDone', it.resultDate); put('nextDue', it.dueDate);
    put('result', it.result); put('certRef', it.certRef); put('notes', it.notes);
  };

  // 1) update existing rows in place
  items.filter(it => it.row && byName[it.sheet]).forEach(it => {
    const meta = byName[it.sheet]; const ws = wb.getWorksheet(it.sheet); if(!ws) return;
    writeRow(ws, meta.cols, it.row, it, true);
  });
  // 2) append new items (added in-app) to their sheet — styled like the row above
  items.filter(it => !it.row).forEach(it => {
    const target = byName[it.sheet] ? it.sheet : firstSheet; if(!target) return;
    const meta = byName[target]; const ws = wb.getWorksheet(target);
    const idx = ws.rowCount + 1; const tmpl = ws.getRow(idx - 1); const nr = ws.getRow(idx);
    writeRow(ws, meta.cols, idx, it, true);
    for(let c = 1; c <= ws.columnCount; c++){ try { nr.getCell(c).style = JSON.parse(JSON.stringify(tmpl.getCell(c).style)); } catch(e){} }
  });

  return await wb.xlsx.writeBuffer();
}

module.exports = { parse, build, buildFresh };
