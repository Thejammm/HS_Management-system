// ══════════════════════════════════════════════════════════════
//  ExcelJS 4.4 reads an Excel table as having NO header row unless the
//  file says headerRowCount="1" - and Excel leaves that attribute out,
//  because 1 is the default. Written back, the table said
//  headerRowCount="0" with a filter still on it, and Excel refused the
//  file ("We found a problem with some content..."). So every export of a
//  client workbook that holds a table - a training matrix whose Staff tab
//  is one - came out as a file Excel would not open (Simon, 12 November
//  2026: "the excel export didnt work", "the trining matrix export is not
//  working").
//
//  Three readings are put right here, the way Excel means them:
//    1. no headerRowCount attribute = one header row;
//    2. a filter button shows on every column unless the file hides it
//       (ExcelJS hid them all, and matched the hidden ones by position
//       instead of by their column number);
//    3. a table with no filter writes no <autoFilter> at all (ExcelJS wrote
//       an empty one, with no range).
//
//  Applied once, when this module is first required, to every workbook
//  loaded after that. Required by both spreadsheet engines (training and
//  statutory). test/xlsx-tables.test.mjs fails if it stops applying.
// ══════════════════════════════════════════════════════════════
let applied = false;
try {
  const TableXform = require('exceljs/lib/xlsx/xform/table/table-xform');
  const FilterColumnXform = require('exceljs/lib/xlsx/xform/table/filter-column-xform');
  const AutoFilterXform = require('exceljs/lib/xlsx/xform/table/auto-filter-xform');
  if(!TableXform.prototype.__ahsTableFix){
    // 1) the header row
    const tOpen = TableXform.prototype.parseOpen;
    TableXform.prototype.parseOpen = function(node){
      const isTable = !this.parser && node && node.name === this.tag;
      const out = tOpen.call(this, node);
      if(isTable && this.model){
        const a = node.attributes || {};
        this.model.headerRow = a.headerRowCount !== '0';                         // absent means one header row
        this.model.totalsRow = !!a.totalsRowCount && a.totalsRowCount !== '0';
      }
      return out;
    };
    // 2) the filter buttons, by the column each one names
    const fOpen = FilterColumnXform.prototype.parseOpen;
    FilterColumnXform.prototype.parseOpen = function(node){
      const isCol = !this.parser && node && node.name === this.tag;
      const out = fOpen.call(this, node);
      if(isCol && this.model){ const a = node.attributes || {}; this.model.__colId = a.colId; this.model.__hidden = a.hiddenButton === '1'; }
      return out;
    };
    const tClose = TableXform.prototype.parseClose;
    TableXform.prototype.parseClose = function(name){
      const isTable = !this.parser && name === this.tag;
      const filters = (isTable && this.map.autoFilter.model) ? (this.map.autoFilter.model.columns || []).slice() : [];
      if(isTable && this.map.autoFilter.model) this.map.autoFilter.model.columns = [];   // the library's own by-position pass has nothing to mis-place
      const out = tClose.call(this, name);
      if(isTable && this.model && Array.isArray(this.model.columns)){
        this.model.columns.forEach(c => { c.filterButton = true; });
        filters.forEach(fc => { const i = parseInt(fc.__colId, 10); if(Number.isInteger(i) && this.model.columns[i]) this.model.columns[i].filterButton = !fc.__hidden; });
      }
      return out;
    };
    // 3) no filter on the table: write none
    const aRender = AutoFilterXform.prototype.render;
    AutoFilterXform.prototype.render = function(xmlStream, model){
      if(!model || !model.autoFilterRef) return true;
      return aRender.call(this, xmlStream, model);
    };
    TableXform.prototype.__ahsTableFix = true;
  }
  applied = true;
} catch(err){
  // the library's insides moved: say so loudly - test/xlsx-tables.test.mjs fails on it
  console.error('exceljs-table-fix: could not apply - exports of workbooks with tables will not open in Excel:', err.message);
}

// ── The order of a worksheet's parts ───────────────────────────
//  ExcelJS writes the reference to a sheet's cell notes (<legacyDrawing>)
//  last of all - after the table references and the extension list. The
//  file format wants it before them, and Excel is strict about it: a sheet
//  that has BOTH a table and a cell note came out as a workbook Excel would
//  not open. finish() takes the bytes ExcelJS wrote and puts that one
//  element where it belongs; a workbook with nothing to move comes back
//  exactly as it was.
const JSZip = require('jszip');
const AFTER_NOTES = ['legacyDrawingHF', 'drawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'];
async function finish(buffer){
  const zip = await JSZip.loadAsync(buffer);
  let moved = false;
  for(const name of Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))){
    let xml = await zip.file(name).async('string'), touched = false;
    for(let guard = 0; guard < 20; guard++){
      const first = AFTER_NOTES.map(t => xml.search(new RegExp('<' + t + '[\\s/>]'))).filter(i => i >= 0).sort((a, b) => a - b)[0];
      if(first === undefined) break;
      const re = /<legacyDrawing\s[^>]*\/>/g; re.lastIndex = first;
      const m = re.exec(xml); if(!m) break;                       // none sits after a part it should precede
      xml = xml.slice(0, m.index) + xml.slice(m.index + m[0].length);
      xml = xml.slice(0, first) + m[0] + xml.slice(first);
      touched = true;
    }
    if(touched){ zip.file(name, xml); moved = true; }
  }
  return moved ? await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) : buffer;
}

module.exports = { applied, finish };
