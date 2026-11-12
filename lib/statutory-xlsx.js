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


// ══════════════════════════════════════════════════════════════
//  The client's own layout (Simon, 12 November 2026: "a way to map an
//  excel spreadsheet so that it matches exactly", "surly the drop down
//  just needs to say include or dont include"). Every column comes in
//  under its own heading, in its own order. Two columns are named: where
//  the item name is and where the due date is, so the traffic lights
//  still work. Formula cells are read, never written. The export writes
//  only the cells changed in Compass back into the client's own file.
// ══════════════════════════════════════════════════════════════
const { slideFormula } = require('exceljs/lib/utils/shared-formula');

// One cell as Compass holds it: { v, type: 'date'|'number'|'text', formula }.
// A formula cell carries the value the workbook last worked out.
function cellInfo(cell){
  let v = cell.value;
  const formula = cell.type === ExcelJS.ValueType.Formula;
  if(formula) v = cell.result;
  if(v && typeof v === 'object' && !(v instanceof Date) && v.error !== undefined) v = null;   // #VALUE! and the like
  if(v && v.richText) v = v.richText.map(t => t.text).join('');
  if(v && typeof v === 'object' && !(v instanceof Date) && v.text !== undefined) v = v.text;  // a hyperlink
  if(v instanceof Date) return { v: v.toISOString().slice(0, 10), type: 'date', formula };
  if(typeof v === 'number') return { v, type: 'number', formula };
  if(typeof v === 'boolean') return { v: v ? 'TRUE' : 'FALSE', type: 'text', formula };
  return { v: v == null ? '' : String(v).trim(), type: 'text', formula };
}
const colNo = letters => String(letters).toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
// Headings merged down over several rows (rows 2 to 4 on a typical FM sheet):
// the data starts below the merge, never inside it. A merged blank column
// beside the table does not count.
function dataStartFor(ws, headerRow){
  let bottom = headerRow;
  (ws.model.merges || []).forEach(rg => {
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(rg); if(!m) return;
    const top = +m[2], bot = +m[4];
    if(top > headerRow || bot < headerRow || bot <= bottom) return;
    if(!asStr(cellRaw(ws.getRow(top).getCell(colNo(m[1]))))) return;
    bottom = bot;
  });
  return bottom + 1;
}
// The non-blank headings on a row, in order: two tabs match when these match.
function headingSig(ws, headerRow){
  const out = []; const row = ws.getRow(headerRow);
  for(let c = 1; c <= ws.columnCount; c++){ const h = norm(asStr(cellRaw(row.getCell(c)))); if(h) out.push(h); }
  return out.join('\u0001');
}
function lastDataRow(ws, start, lastCol){
  let last = start - 1;
  for(let r = start; r <= ws.rowCount; r++){ const row = ws.getRow(r);
    for(let c = 1; c <= lastCol; c++){ if(cellInfo(row.getCell(c)).v !== ''){ last = r; break; } } }
  return last;
}
// Every column that has a heading or anything below it.
function layoutColumns(ws, headerRow, start){
  const cols = [];
  for(let c = 1; c <= ws.columnCount; c++){
    const heading = asStr(cellRaw(ws.getRow(headerRow).getCell(c)));
    let data = false, f = 0;
    for(let r = start; r <= ws.rowCount; r++){ const i = cellInfo(ws.getRow(r).getCell(c)); if(i.formula) f++; if(i.v !== '') data = true; }
    if(!heading && !data && !f) continue;
    cols.push({ col: c, heading, formula: f > 0 });
  }
  return cols;
}

// The mapping screen's preview: the first rows of every tab, which cells hold
// formulas, and the merges (so the data start can be worked out on screen).
async function peekLayout(buffer, opts = {}){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const maxR = opts.rows || 15;
  return { sheets: wb.worksheets.map(ws => {
    const n = Math.min(maxR, ws.rowCount || 0), maxC = Math.min(80, Math.max(1, ws.columnCount || 1));
    const rows = [], f = [];
    for(let r = 1; r <= n; r++){ const row = ws.getRow(r), out = [], fo = [];
      for(let c = 1; c <= maxC; c++){ const cell = row.getCell(c), i = cellInfo(cell); out.push(i.v === '' ? '' : String(i.v)); fo.push(i.formula); }
      rows.push(out); f.push(fo); }
    return { name: ws.name, rows, f, merges: (ws.model.merges || []).slice() };
  }) };
}

// ── Compass's own Document column (Simon, 12 November 2026: "when the spread
//    sheet is exported to excel it should include the hyperlink that was added
//    to the modal so the client can see the document"). One column headed
//    Document at the end of the client's table: each cell a clickable link to
//    that line's certificate or report. Read back when the file is imported.
const DOC_HEADING = 'Document';
const isDocHeading = h => norm(h) === 'document';
const cleanLoc = loc => String(loc == null ? '' : loc).trim().replace(/^["']+|["']+$/g, '').trim();
// a location as Excel wants a link: web addresses as they are, drive and network paths as file links
function docHref(loc){
  const s = cleanLoc(loc); if(!s) return '';
  if(/^(https?|file):/i.test(s)) return s;
  const enc = p => encodeURI(p.replace(/\\/g, '/')).replace(/#/g, '%23');
  const unc = /^\\\\([^\\/]+)[\\/](.*)$/.exec(s);
  if(unc) return 'file://' + unc[1] + '/' + enc(unc[2]);
  const drv = /^([a-z]):[\\/](.*)$/i.exec(s);
  if(drv) return 'file:///' + drv[1].toUpperCase() + ':/' + enc(drv[2]);
  return '';
}
const safeDecode = s => { try { return decodeURI(s).replace(/%23/g, '#'); } catch(e){ return s; } };
function docFromHref(h){
  const s = String(h || '').trim(); if(!s) return '';
  let m = /^file:\/\/\/([a-z]):\/(.*)$/i.exec(s);
  if(m) return m[1].toUpperCase() + ':\\' + safeDecode(m[2]).replace(/\//g, '\\');
  m = /^file:\/\/([^/]+)\/(.*)$/i.exec(s);
  if(m) return '\\\\' + m[1] + '\\' + safeDecode(m[2]).replace(/\//g, '\\');
  return s;
}
// what the cell says: the file's name, or "Open document" when there is none to show
function docText(loc){
  const seg = cleanLoc(loc).split('?')[0].split(/[\\/]/).filter(Boolean).pop() || '';
  let name = seg; try { name = decodeURIComponent(seg); } catch(e){}
  return /\.[a-z0-9]{2,5}$/i.test(name) ? name : 'Open document';
}
function docOf(cell){
  const v = cell.value;
  if(v && typeof v === 'object' && v.hyperlink) return docFromHref(v.hyperlink);
  return cellInfo(cell).v === '' ? '' : String(cellInfo(cell).v);
}
// Where the due date comes from when the sheet works it out as last done plus
// months - =EDATE(H5,I5), on its own or inside an IF. Read from the client's
// own formula, so ticking a line done in Compass works the next due date out
// the same way the spreadsheet will.
function dueRule(ws, start, dueCol){
  if(!dueCol) return null; const n = {};
  for(let r = start; r <= ws.rowCount; r++){
    const cell = ws.getRow(r).getCell(dueCol); if(cell.type !== ExcelJS.ValueType.Formula) continue;
    let f = ''; try { f = String(cell.formula || ''); } catch(e){ continue; }
    const m = /EDATE\(\s*\$?([A-Z]{1,3})\$?(\d+)\s*,\s*\$?([A-Z]{1,3})\$?(\d+)\s*\)/i.exec(f);
    if(!m || +m[2] !== r || +m[4] !== r) continue;
    const k = colNo(m[1]) + ',' + colNo(m[3]); n[k] = (n[k] || 0) + 1;
  }
  const best = Object.keys(n).sort((a, b) => n[b] - n[a])[0]; if(!best) return null;
  const [doneCol, lifeCol] = best.split(',').map(Number);
  return { doneCol, lifeCol, unit: 'months' };
}

// opts: { headerRow, layout: { include: [col numbers], itemCol, dueCol } }
async function parseLayout(buffer, opts = {}){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const hr = opts.headerRow || 1, L = opts.layout || {};
  const inc = new Set((L.include || []).map(Number).filter(Boolean));
  const itemCol = +L.itemCol || null, dueCol = +L.dueCol || null;
  const first = wb.worksheets[0];
  const sig = first ? headingSig(first, hr) : '';
  const items = [], skipped = [], sheets = [], layoutSheets = [], notBrought = [];
  wb.worksheets.forEach((ws, i) => {
    if(i > 0 && (!sig || headingSig(ws, hr) !== sig)){ notBrought.push(ws.name); return; }
    const start = dataStartFor(ws, hr);
    const all = layoutColumns(ws, hr, start);
    const docCol = (all.find(c => isDocHeading(c.heading)) || {}).col || null;   // Compass's own column: read as links, never shown as one of theirs
    const columns = all.filter(c => c.col !== docCol).map(c => Object.assign(c, { included: inc.has(c.col) }));
    const rule = dueRule(ws, start, dueCol);
    layoutSheets.push(Object.assign({ name: ws.name, columns }, rule ? { rule } : {}, docCol ? { docCol } : {}));
    sheets.push({ name: ws.name, headerRow: hr, dataStart: start });
    const lastCol = columns.reduce((m, c) => Math.max(m, c.col), 0);
    const keepCol = c => inc.has(c) || (rule && (c === rule.doneCol || c === rule.lifeCol));   // the tick needs these even when not shown
    for(let r = start; r <= ws.rowCount; r++){
      const row = ws.getRow(r); let any = false; const cols = {};
      for(let c = 1; c <= lastCol; c++){ const info = cellInfo(row.getCell(c)); if(info.v !== '') any = true; if(keepCol(c)) cols[c] = info; }
      if(!any) continue;                                   // a blank row is not a skipped item
      const name = itemCol && cols[itemCol] ? String(cols[itemCol].v).trim() : '';
      if(!name){ skipped.push({ sheet: ws.name, row: r }); continue; }
      const due = dueCol && cols[dueCol] && cols[dueCol].type === 'date' ? cols[dueCol].v : '';
      const it = { sheet: ws.name, row: r, item: name, dueDate: due, cols };
      const doc = docCol ? docOf(row.getCell(docCol)) : ''; if(doc) it.doc = doc;
      items.push(it);
    }
  });
  const s0 = layoutSheets[0] || {};
  return { sheets, items, skipped, layout: Object.assign({ headerRow: hr, sheets: layoutSheets, itemCol, dueCol, notBrought }, s0.rule ? { rule: s0.rule } : {}, s0.docCol ? { docCol: s0.docCol } : {}) };
}

const sameValue = (cur, v) => {
  const a = cur.v, b = (v == null ? '' : v);
  if(a === '' || b === '') return String(a).trim() === String(b).trim();
  if(cur.type === 'number') return Number(b) === a;
  return String(a).trim() === String(b).trim();
};
const typedValue = (v, type) => {
  if(v == null || v === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if(m && type !== 'text') return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if(type === 'number' && String(v).trim() !== '' && !isNaN(Number(v))) return Number(v);
  return typeof v === 'number' ? v : String(v);
};

// state = { layout: {headerRow, sheets:[{name, columns}], itemCol}, items: [{sheet, row, cols}] }
async function buildLayout(templateBuffer, state){
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  wb.calcProperties = Object.assign({}, wb.calcProperties || {}, { fullCalcOnLoad: true });   // the client's formulas refresh in Excel
  const L = (state && state.layout) || {}, hr = +L.headerRow || 1, itemCol = +L.itemCol || null;
  const items = (state && state.items) || [];
  const names = (L.sheets || []).map(s => s.name).filter(n => wb.getWorksheet(n));
  const colsOf = n => ((L.sheets || []).find(s => s.name === n) || { columns: [] }).columns || [];
  let changed = 0, appended = 0, notRemoved = 0;
  // where each tab's table ends, measured on the client's file before anything is written
  const ends = {};
  names.forEach(n => { const ws = wb.getWorksheet(n), start = dataStartFor(ws, hr), lastCol = Math.max(ws.columnCount, ...colsOf(n).map(c => c.col));
    ends[n] = { start, lastCol, last: lastDataRow(ws, start, lastCol) }; });
  // rows still in the file that Compass no longer has: never deleted here, only counted
  const sent = new Set(items.filter(it => it.row).map(it => it.sheet + '|' + it.row));
  if(itemCol) names.forEach(n => { const ws = wb.getWorksheet(n), e = ends[n];
    for(let r = e.start; r <= e.last; r++){ if(cellInfo(ws.getRow(r).getCell(itemCol)).v !== '' && !sent.has(n + '|' + r)) notRemoved++; } });
  // 1) rows from the file: only the cells changed in Compass, never a formula
  items.filter(it => it.row && names.includes(it.sheet)).forEach(it => {
    const ws = wb.getWorksheet(it.sheet);
    Object.keys(it.cols || {}).forEach(k => {
      const cell = ws.getRow(+it.row).getCell(+k);
      if(cell.type === ExcelJS.ValueType.Formula) return;
      const cur = cellInfo(cell), nv = (it.cols[k] || {}).v;
      if(sameValue(cur, nv)) return;
      cell.value = typedValue(nv, cur.v !== '' ? cur.type : (it.cols[k] || {}).type);
      changed++;
    });
  });
  // 2) items added in Compass: directly below the last row of the tab, with the
  //    row above's formatting and the column's formulas carried down
  items.filter(it => !it.row).forEach(it => {
    const target = names.includes(it.sheet) ? it.sheet : names[0]; if(!target) return;
    const ws = wb.getWorksheet(target), e = ends[target];
    const idx = e.last + 1, above = ws.getRow(e.last), nr = ws.getRow(idx);
    if(above.height) nr.height = above.height;
    const fcols = new Set(colsOf(target).filter(c => c.formula).map(c => c.col));
    for(let c = 1; c <= e.lastCol; c++){
      const cell = nr.getCell(c);
      try { cell.style = JSON.parse(JSON.stringify(above.getCell(c).style || {})); } catch(err){}
      let src = above.getCell(c).type === ExcelJS.ValueType.Formula ? above.getCell(c) : null;
      for(let r = e.last - 1; !src && fcols.has(c) && r >= e.start; r--){ const s = ws.getRow(r).getCell(c); if(s.type === ExcelJS.ValueType.Formula) src = s; }
      if(src){ cell.value = { formula: slideFormula(src.formula, src.address, cell.address) }; continue; }
      const x = (it.cols || {})[c];
      if(x && x.v !== '' && x.v != null) cell.value = typedValue(x.v, x.type);
    }
    e.last = idx; appended++;
    it._at = { sheet: target, row: idx };
  });
  // 3) the Document column: added at the end of the table the first time a line
  //    has a document, a clickable link in each line's cell after that
  let docs = 0;
  const hasDoc = items.some(it => cleanLoc(it.doc));
  names.forEach(n => {
    const ws = wb.getWorksheet(n), sh = (L.sheets || []).find(s => s.name === n) || {};
    let dc = +sh.docCol || +L.docCol || 0;
    if(dc && !isDocHeading(asStr(cellRaw(ws.getRow(hr).getCell(dc))))) dc = 0;   // the stored column is not the Document one in this file
    if(!dc){ for(let c = 1; c <= ws.columnCount; c++){ if(isDocHeading(asStr(cellRaw(ws.getRow(hr).getCell(c))))){ dc = c; break; } } }
    const mine = items.filter(it => (it.row && it.sheet === n) || (it._at && it._at.sheet === n));
    if(!dc){
      if(!hasDoc || !mine.some(it => cleanLoc(it.doc))) return;
      let last = 0; for(let c = 1; c <= ws.columnCount; c++){ if(asStr(cellRaw(ws.getRow(hr).getCell(c)))) last = c; }
      // the first free column after the last heading: a merged spacer column beside
      // the table (K2:K34 on a typical FM sheet) is the client's and is stepped over
      const bottom = Math.max(ws.rowCount, ...mine.map(it => it.row || it._at.row));
      const free = c => { for(let r = hr; r <= bottom; r++){ const x = ws.getRow(r).getCell(c); if(x.isMerged || cellInfo(x).v !== '') return false; } return true; };
      dc = last + 1; while(!free(dc)) dc++;
      const hc = ws.getRow(hr).getCell(dc), src = ws.getRow(hr).getCell(last);
      try { hc.style = JSON.parse(JSON.stringify(src.style || {})); } catch(err){}
      hc.value = DOC_HEADING;
      (ws.model.merges || []).slice().forEach(rg => {   // a heading merged down over several rows is matched
        const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(rg); if(!m) return;
        if(colNo(m[1]) === last && colNo(m[3]) === last && +m[2] === hr && +m[4] > hr) ws.mergeCells(hr, dc, +m[4], dc);
      });
      ws.getColumn(dc).width = Math.max(ws.getColumn(dc).width || 0, 32);
      changed++;
    }
    let styleFrom = dc - 1;   // the cells take the look of the last headed column, not a spacer
    while(styleFrom > 1 && !asStr(cellRaw(ws.getRow(hr).getCell(styleFrom)))) styleFrom--;
    mine.forEach(it => {
      const r = it.row || it._at.row, cell = ws.getRow(r).getCell(dc), want = cleanLoc(it.doc);
      if(docOf(cell) === want) return;
      if(!want){ if(cell.value != null){ cell.value = null; docs++; } return; }
      const left = ws.getRow(r).getCell(styleFrom), href = docHref(want);
      try { cell.style = JSON.parse(JSON.stringify(left.style || {})); } catch(err){}
      if(href){
        cell.value = { text: docText(want), hyperlink: href, tooltip: want };
        cell.font = Object.assign({}, cell.font || {}, { color: { argb: 'FF0563C1' }, underline: true });
      } else cell.value = want;   // somewhere that is not a path or a web address: written as it was typed
      docs++;
    });
  });
  return { buffer: await wb.xlsx.writeBuffer(), changed: changed + docs, appended, notRemoved, docs };
}

module.exports = { parse, build, buildFresh, peekLayout, parseLayout, buildLayout, docHref, docFromHref, docText };
