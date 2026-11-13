// ══════════════════════════════════════════════════════════════
//  A client workbook with an Excel table in it (Simon, 12 November 2026:
//  "the excel export didnt work", "the trining matrix export is not
//  working"). The spreadsheet library read the table as having no header
//  row, hid every filter button, and wrote the reference to the sheet's cell
//  notes after the table reference - so a training matrix whose Staff tab is
//  a table with one note on it came out as a file Excel would not open.
//  The made-up workbook here is put together the way Excel writes one: no
//  headerRowCount on the table, no filterColumn entries, one cell note.
//  Run: node --test test/xlsx-tables.test.mjs
// ══════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { applied, finish } = require('../lib/exceljs-table-fix.js');
const training = require('../lib/training-xlsx.js');
const statutory = require('../lib/statutory-xlsx.js');

// as Excel saves it: the header row is the default and is not written; filter buttons show unless hidden
async function asExcelWritesIt(buf, { hide = [], noHeader = false } = {}){
  const zip = await JSZip.loadAsync(buf);
  for(const n of Object.keys(zip.files).filter(x => /^xl\/tables\/table\d+\.xml$/.test(x))){
    let x = await zip.file(n).async('string');
    x = x.replace(/ headerRowCount="\d"/, noHeader ? ' headerRowCount="0"' : '').replace(/<filterColumn [^>]*\/>/g, '');
    if(hide.length) x = x.replace(/(<autoFilter [^>]*)\/?>(<\/autoFilter>)?/, (m, open) => open + '>' + hide.map(i => `<filterColumn colId="${i}" hiddenButton="1"/>`).join('') + '</autoFilter>');
    zip.file(n, x);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}
async function matrix(opts){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Staff');
  ws.addTable({ name: 'Table1', ref: 'A1', headerRow: true, style: { theme: 'TableStyleLight18', showRowStripes: true },
    columns: [{ name: 'Last Name', filterButton: true }, { name: 'First Name', filterButton: true }, { name: 'Job', filterButton: true }, { name: 'First Aid', filterButton: true }],
    rows: [['Morgan', 'Alex', 'Driver', new Date(Date.UTC(2027, 4, 1))], ['Kerr', 'Sam', 'Escort', 'N/A']] });
  ws.getCell('D2').numFmt = 'dd/mm/yyyy';
  ws.getCell('B3').note = 'Returning in the spring';
  return asExcelWritesIt(Buffer.from(await wb.xlsx.writeBuffer()), opts);
}
async function parts(buf){
  const zip = await JSZip.loadAsync(Buffer.from(buf));
  const table = await zip.file('xl/tables/table1.xml').async('string'), sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  return { table, sheet, tag: (/<table [^>]*>/.exec(table) || [''])[0] };
}

test('the fix is in place (the library\'s insides are where it expects them)', () => { assert.equal(applied, true); });

test('training export: the table keeps its header row and filter buttons, and the notes come before the table', async () => {
  const buf = await matrix(), m = await training.parse(buf);
  assert.equal(m.people.length, 2);
  const people = JSON.parse(JSON.stringify(m.people)); people[1].cells['First Aid'] = { type: 'date', v: '2029-06-30' };
  const out = await parts(await training.build(buf, { people, sheets: m.sheets }));
  assert.ok(!/headerRowCount="0"/.test(out.tag), 'the table still has its header row: ' + out.tag);
  assert.match(out.tag, /ref="A1:D3"/);
  assert.equal((out.table.match(/hiddenButton="1"/g) || []).length, 0, 'no filter button is hidden');
  assert.ok(out.sheet.indexOf('<legacyDrawing') > 0 && out.sheet.indexOf('<legacyDrawing') < out.sheet.indexOf('<tableParts'), 'the notes reference comes before the table reference, as Excel requires');
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await training.build(buf, { people, sheets: m.sheets })));
  const ws = wb.getWorksheet('Staff');
  assert.equal(ws.getCell('D3').value.toISOString().slice(0, 10), '2029-06-30', 'the change is in the table');
  assert.equal(ws.getCell('B3').note.texts ? ws.getCell('B3').note.texts.map(t => t.text).join('') : ws.getCell('B3').note, 'Returning in the spring', 'the cell note is kept');
});

test('a table Excel saved with no header row stays that way, and a hidden filter button stays hidden on its own column', async () => {
  const none = await parts(await training.build(await matrix({ noHeader: true }), { people: [] }));
  assert.match(none.tag, /headerRowCount="0"/);
  const buf = await matrix({ hide: [2] }), m = await training.parse(buf);
  const out = await parts(await training.build(buf, { people: m.people, sheets: m.sheets }));
  const hidden = [...out.table.matchAll(/<filterColumn colId="(\d+)" hiddenButton="1"/g)].map(x => x[1]);
  assert.deepEqual(hidden, ['2'], 'only the Job column\'s button is hidden - by its column number, not its position in the list');
});

test('statutory export of a workbook with a table and a note opens the same way', async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('In Use');
  ws.addTable({ name: 'Assets', ref: 'A1', headerRow: true, columns: [{ name: 'Description', filterButton: true }, { name: 'Last service', filterButton: true }, { name: 'Next due', filterButton: true }],
    rows: [['Extinguisher', new Date(Date.UTC(2026, 0, 10)), new Date(Date.UTC(2027, 0, 10))], ['Vehicle lift', new Date(Date.UTC(2026, 5, 1)), new Date(Date.UTC(2026, 11, 1))]] });
  ws.getCell('A2').note = 'By the front door';
  const buf = await asExcelWritesIt(Buffer.from(await wb.xlsx.writeBuffer()));
  const p = await statutory.parseLayout(buf, { headerRow: 1, layout: { include: [1, 2, 3], itemCol: 1, dueCol: 3 } });
  const items = JSON.parse(JSON.stringify(p.items)); items[0].cols[2] = { v: '2026-11-12', type: 'date', formula: false };
  const out = await parts((await statutory.buildLayout(buf, { layout: p.layout, items })).buffer);
  assert.ok(!/headerRowCount="0"/.test(out.tag) && !/hiddenButton="1"/.test(out.table), out.tag);
  assert.ok(out.sheet.indexOf('<legacyDrawing') < out.sheet.indexOf('<tableParts'));
});

test('a workbook with nothing to put right comes back byte for byte', async () => {
  const wb = new ExcelJS.Workbook(); wb.addWorksheet('Plain').getCell('A1').value = 'x';
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  assert.ok((await finish(buf)).equals(buf));
});
