// ══════════════════════════════════════════════════════════════
//  Statutory register in the client's own layout (Simon, 12 November 2026):
//  every column in under its own heading, formula cells read but never
//  written, the export writing only the cells changed in Compass back into
//  the client's own file. A made-up workbook shaped like a real FM sheet:
//  a title row, headings merged down over two rows, shared formulas, a
//  stray mark below the table, and a second tab with other headings.
//  Run: node --test test/statutory-layout.test.mjs
// ══════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { peekLayout, parseLayout, buildLayout, parse } = require('../lib/statutory-xlsx.js');

const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
async function workbook(){
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('In Use');
  ws.getCell('A1').value = 'Facilities register';
  const heads = ['Asset ID', 'Section', 'Description', 'Location', 'Status', 'Last service', 'Life (months)', 'Next due'];
  heads.forEach((h, i) => { ws.getRow(2).getCell(i + 1).value = h; ws.mergeCells(2, i + 1, 3, i + 1); });
  const rows = [
    ['A1', 'Fire', 'Extinguisher', 'Front door', D(2026, 1, 10), 12],
    ['A2', 'Fire', 'Extinguisher', 'Back door', D(2025, 1, 10), 12],
    ['B1', 'Lifting', 'Vehicle lift', 'Workshop', D(2026, 6, 1), 6],
    ['C1', 'Electrical', 'Emergency light', 'Office', null, null],
  ];
  rows.forEach((r, i) => {
    const n = 4 + i, row = ws.getRow(n);
    [r[0], r[1], r[2], r[3]].forEach((v, c) => { row.getCell(c + 1).value = v; });
    row.getCell(6).value = r[4]; row.getCell(7).value = r[5];
    const due = r[4] ? new Date(Date.UTC(r[4].getUTCFullYear(), r[4].getUTCMonth() + r[5], r[4].getUTCDate())) : '';
    row.getCell(8).value = { formula: `IF(OR(F${n}="",G${n}=""),"",EDATE(F${n},G${n}))`, result: due };
    row.getCell(5).value = { formula: `IF(H${n}="","",IF(H${n}<TODAY(),"expired","in date"))`, result: r[4] ? 'in date' : '' };
    row.getCell(6).numFmt = 'dd/mm/yyyy'; row.getCell(8).numFmt = 'dd/mm/yyyy';
    row.getCell(3).font = { bold: true };
  });
  ws.getRow(8).getCell(2).value = 'u';                   // a stray mark below the table, no item name
  ws.getColumn(3).width = 28;
  ws.addConditionalFormatting({ ref: 'E4:E7', rules: [{ type: 'containsText', operator: 'containsText', text: 'expired', style: { font: { bold: true } } }] });
  const arc = wb.addWorksheet('Archive');
  arc.getRow(1).values = ['Asset ID', 'Section', 'Description', 'Location', 'Status', 'Last service', 'Life (months)', 'Next due', '', 'Week 1', 'Week 2'];
  arc.getRow(2).values = ['Z9', 'Fire', 'Old extinguisher', 'Gone', 'expired', D(2024, 1, 1), 12, D(2025, 1, 1)];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const ALL = { headerRow: 2, layout: { include: [1, 2, 3, 4, 5, 6, 7, 8], itemCol: 3, dueCol: 8 } };
const canon = x => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((o, kk) => (o[kk] = v[kk], o), {}) : v);
async function cells(buf){
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const o = {};
  wb.worksheets.forEach(ws => ws.eachRow({ includeEmpty: true }, row => row.eachCell({ includeEmpty: true }, c => {
    o[ws.name + '!' + c.address] = (c.type === ExcelJS.ValueType.Formula ? 'F:' + c.formula : JSON.stringify(c.value)) + '|' + canon(c.style); })));
  wb.worksheets.forEach(ws => { o[ws.name + '#merges'] = (ws.model.merges || []).slice().sort().join(); o[ws.name + '#widths'] = canon((ws.columns || []).map(c => c && c.width)); });
  return { o, wb };
}

test('the preview shows every tab, which cells are formulas, and the merges', async () => {
  const pk = await peekLayout(await workbook());
  assert.deepEqual(pk.sheets.map(s => s.name), ['In Use', 'Archive']);
  const s = pk.sheets[0];
  assert.equal(s.rows[1][2], 'Description');
  assert.deepEqual(s.f[3].map(Boolean), [false, false, false, false, true, false, false, true]);
  assert.ok(s.merges.includes('C2:C3'));
});

test('the import reads every included column under its own heading, from below the merged headings', async () => {
  const p = await parseLayout(await workbook(), ALL);
  assert.equal(p.sheets[0].dataStart, 4, 'data starts below the headings merged over rows 2 and 3');
  assert.deepEqual(p.layout.sheets[0].columns.map(c => c.heading), ['Asset ID', 'Section', 'Description', 'Location', 'Status', 'Last service', 'Life (months)', 'Next due']);
  assert.deepEqual(p.layout.sheets[0].columns.filter(c => c.formula).map(c => c.heading), ['Status', 'Next due']);
  assert.deepEqual(p.layout.notBrought, ['Archive'], 'a tab whose headings row does not match is left alone');
  assert.equal(p.items.length, 4);
  assert.deepEqual(p.skipped, [{ sheet: 'In Use', row: 8 }], 'a row with something in it but no item name is counted');
  const a1 = p.items[0];
  assert.equal(a1.item, 'Extinguisher'); assert.equal(a1.row, 4); assert.equal(a1.dueDate, '2027-01-10');
  assert.deepEqual(a1.cols[6], { v: '2026-01-10', type: 'date', formula: false });
  assert.deepEqual(a1.cols[5], { v: 'in date', type: 'text', formula: true }, 'a formula cell carries the value the workbook worked out');
  const c1 = p.items[3]; assert.equal(c1.dueDate, '', 'no due date when the formula gives nothing');
});

test('an unticked column is not brought in, and the count says so', async () => {
  const p = await parseLayout(await workbook(), { headerRow: 2, layout: { include: [1, 3, 4, 5, 6, 7, 8], itemCol: 3, dueCol: 8 } });
  assert.equal(p.layout.sheets[0].columns.find(c => c.heading === 'Section').included, false);
  assert.ok(!('2' in p.items[0].cols));
});

test('the export writes only the changed cell, never a formula, and keeps everything else', async () => {
  const buf = await workbook(), p = await parseLayout(buf, ALL);
  const items = JSON.parse(JSON.stringify(p.items));
  items[2].cols[6].v = '2026-07-15';                     // B1 last service
  items[2].cols[5].v = 'changed by hand';                // a formula cell: must be ignored
  items[2].cols[8].v = '2030-01-01';                     // a formula cell: must be ignored
  const out = await buildLayout(buf, { layout: p.layout, items });
  assert.equal(out.changed, 1); assert.equal(out.appended, 0); assert.equal(out.notRemoved, 0);
  const a = await cells(buf), b = await cells(Buffer.from(out.buffer));
  const diff = Object.keys(Object.assign({}, a.o, b.o)).filter(k => a.o[k] !== b.o[k]);
  assert.deepEqual(diff, ['In Use!F6'], 'only the one cell changed: ' + diff.join());
  const z = await JSZip.loadAsync(Buffer.from(out.buffer));
  assert.match(await z.file('xl/workbook.xml').async('string'), /fullCalcOnLoad="1"/, 'Excel works the formulas out again on opening');
  assert.match(await z.file('xl/worksheets/sheet1.xml').async('string'), /<conditionalFormatting/, 'conditional formatting kept');
});

test('a new item goes below the last row of the tab, with the formulas carried down; a deleted one stays and is counted', async () => {
  const buf = await workbook(), p = await parseLayout(buf, ALL);
  const items = p.items.filter(it => it.row !== 5).concat([{ sheet: 'In Use', row: null, item: 'Fire blanket', cols: { 1: { v: 'D1', type: 'text' }, 3: { v: 'Fire blanket', type: 'text' }, 6: { v: '2026-11-01', type: 'date' }, 7: { v: 12, type: 'number' } } }]);
  const out = await buildLayout(buf, { layout: p.layout, items });
  assert.equal(out.appended, 1); assert.equal(out.notRemoved, 1, 'the deleted row is counted, not removed');
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(out.buffer)); const ws = wb.getWorksheet('In Use');
  assert.equal(ws.getCell('A5').value, 'A2', 'the deleted row is still in the file');
  assert.equal(ws.getCell('A9').value, 'D1', 'below the last row (the stray mark on row 8)');
  assert.equal(ws.getCell('C9').value, 'Fire blanket');
  assert.equal(ws.getCell('H9').formula, 'IF(OR(F9="",G9=""),"",EDATE(F9,G9))', 'the formula from the rows above, moved to row 9');
  assert.equal(ws.getCell('E9').formula, 'IF(H9="","",IF(H9<TODAY(),"expired","in date"))');
  assert.equal(ws.getCell('F9').value.toISOString().slice(0, 10), '2026-11-01');
  const before = await cells(buf), after = await cells(Buffer.from(out.buffer));
  assert.ok(Object.keys(before.o).filter(k => k.startsWith('Archive')).every(k => before.o[k] === after.o[k]), 'the tab not brought in is untouched');
});

test('the older field-mapped import is unchanged', async () => {
  const p = await parse(await workbook(), { headerRow: 2, fixed: { item: 3, nextDue: 8 } });
  assert.ok(p.items.length >= 4);
  assert.equal(p.items.find(i => i.row === 4).item, 'Extinguisher');
});
