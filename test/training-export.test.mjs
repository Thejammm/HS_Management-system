// ══════════════════════════════════════════════════════════════
//  Training matrix export, the server side (Simon, 12 November 2026: "the
//  excel export didnt work" - "wrong content"). The export used to work the
//  layout out again with the automatic read alone, which cannot find a matrix
//  mapped by hand, so nothing was written back. It now uses the layout the
//  people were read with, kept only where it fits the stored file.
//  Run: node --test test/training-export.test.mjs
// ══════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const { parse, build } = require('../lib/training-xlsx.js');
const { parseLayout, buildLayout } = require('../lib/statutory-xlsx.js');

async function matrix(){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Training Matrix');
  ws.getCell('A1').value = 'Testing Client Ltd - Training Matrix';
  ws.getRow(3).values = ['Name', 'Role', 'First Aid', 'Fire Marshal'];
  ws.getRow(4).values = ['Alex Morgan', 'Director', new Date(Date.UTC(2027, 4, 1)), 'P'];
  ws.getRow(5).values = ['Sam Kerr', 'Fitter', 'NA', 'P'];
  ws.getCell('C4').numFmt = 'dd/mm/yyyy';
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const MAP = { headerRow: 3, fixed: { full: 1, job: 2 } };
const read = async buf => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(buf)); return wb.getWorksheet('Training Matrix'); };

test('a matrix mapped by hand: the change made in Compass is written back', async () => {
  const buf = await matrix(), m = await parse(buf, MAP);
  assert.equal(m.sheets[0].cols.full, 1, 'the Name column is recorded with the layout');
  const people = JSON.parse(JSON.stringify(m.people)); people[1].cells['First Aid'] = { type: 'date', v: '2029-06-30' };
  const ws = await read(await build(buf, { people, sheets: m.sheets }));
  assert.equal(ws.getCell('C5').value.toISOString().slice(0, 10), '2029-06-30');
  assert.equal(ws.getCell('C5').numFmt, 'dd/mm/yyyy', 'it was "NA" with no date format: the date gets one');
  assert.equal(ws.getCell('C4').numFmt, 'dd/mm/yyyy');
});

test('without the layout (the page before this fix) nothing could be written - the reason for the fix', async () => {
  const buf = await matrix(), m = await parse(buf, MAP);
  const people = JSON.parse(JSON.stringify(m.people)); people[1].cells['First Aid'] = { type: 'date', v: '2029-06-30' };
  const ws = await read(await build(buf, { people }));
  assert.equal(ws.getCell('C5').value, 'NA');
});

test('a layout saved before the Name column was recorded finds it on the person\'s row; a new person goes in under it', async () => {
  const buf = await matrix(), m = await parse(buf, MAP);
  const sheets = JSON.parse(JSON.stringify(m.sheets)); delete sheets[0].cols.full;
  const people = JSON.parse(JSON.stringify(m.people)).concat([{ firstName: 'Chris Patel', lastName: '', job: 'Fitter', group: 'staff', status: 'active', cells: { 'First Aid': { type: 'date', v: '2028-09-01' } } }]);
  const ws = await read(await build(buf, { people, sheets }));
  assert.equal(ws.getCell('A6').value, 'Chris Patel'); assert.equal(ws.getCell('B6').value, 'Fitter');
  assert.equal(ws.getCell('C6').value.toISOString().slice(0, 10), '2028-09-01'); assert.match(ws.getCell('C6').numFmt, /d/);
});

test('a layout that does not fit the file is ignored, and the automatic read is used as before', async () => {
  const buf = await matrix(), m = await parse(buf, MAP);
  for (const sheets of [[{ name: 'Not a tab', cols: { full: 1 }, courses: [{ name: 'First Aid', col: 3 }] }], [{ name: 'Training Matrix', cols: { full: -4 }, courses: [] }], 'nonsense']) {
    const out = await build(buf, { people: m.people, sheets });
    assert.ok(Buffer.from(out).length > 0);
  }
});

test('no change in Compass: the exported matrix is the client\'s file, cell for cell', async () => {
  const buf = await matrix(), m = await parse(buf, MAP);
  const a = await read(buf), b = await read(await build(buf, { people: m.people, sheets: m.sheets }));
  for (let r = 1; r <= 5; r++) for (let c = 1; c <= 4; c++) assert.deepEqual(b.getRow(r).getCell(c).value, a.getRow(r).getCell(c).value);
});

test('the statutory export gives a date a date format when the cell had none', async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('In Use');
  ws.getRow(1).values = ['Description', 'Last service', 'Next due'];
  ws.getRow(2).values = ['Extinguisher', null, new Date(Date.UTC(2026, 0, 1))]; ws.getCell('C2').numFmt = 'dd/mm/yyyy';
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const p = await parseLayout(buf, { headerRow: 1, layout: { include: [1, 2, 3], itemCol: 1, dueCol: 3 } });
  const items = JSON.parse(JSON.stringify(p.items)); items[0].cols[2] = { v: '2026-11-12', type: 'date', formula: false };
  const out = await buildLayout(buf, { layout: p.layout, items });
  const w2 = new ExcelJS.Workbook(); await w2.xlsx.load(Buffer.from(out.buffer));
  assert.equal(w2.getWorksheet('In Use').getCell('B2').numFmt, 'dd/mm/yyyy', 'a blank Last service filled in from Compass reads as a date in Excel');
});
