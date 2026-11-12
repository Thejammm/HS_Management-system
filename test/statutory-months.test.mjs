// ══════════════════════════════════════════════════════════════
//  The FM register month by month - the server side (Simon, 12 November
//  2026): "when the spread sheet is exported to excel it should include the
//  hyperlink that was added to the modal so the client can see the
//  document", and a tick that works the next due date out the way the
//  client's own sheet does (last done + lifespan in months, =EDATE).
//  A made-up workbook shaped like a real FM sheet: headings merged over two
//  rows, shared formulas, and a narrow merged spacer column beside the table.
//  Run: node --test test/statutory-months.test.mjs
// ══════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { parseLayout, buildLayout, docHref, docFromHref, docText } = require('../lib/statutory-xlsx.js');

const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
async function workbook({ spacer = true, plainDue = false } = {}){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('In Use');
  ws.getCell('A1').value = 'Facilities register';
  ['Asset ID', 'Description', 'Location', 'Status', 'Last service', 'Life (months)', 'Next due'].forEach((h, i) => { ws.getRow(2).getCell(i + 1).value = h; ws.mergeCells(2, i + 1, 3, i + 1); });
  ws.getRow(2).getCell(7).font = { bold: true, color: { argb: 'FF1F4E79' } };
  if(spacer){ ws.mergeCells('H2:H9'); ws.getColumn(8).width = 2.5; }   // the client's narrow spacer beside the table
  [['A1', 'Extinguisher', 'Front door', D(2026, 1, 10), 12], ['A2', 'Extinguisher', 'Back door', D(2025, 1, 31), 13], ['B1', 'Vehicle lift', 'Workshop', D(2026, 6, 1), 6]].forEach((r, i) => {
    const n = 4 + i, row = ws.getRow(n);
    row.getCell(1).value = r[0]; row.getCell(2).value = r[1]; row.getCell(3).value = r[2]; row.getCell(5).value = r[3]; row.getCell(6).value = r[4];
    const due = new Date(Date.UTC(r[3].getUTCFullYear(), r[3].getUTCMonth() + r[4], r[3].getUTCDate()));
    if(plainDue) row.getCell(7).value = due;
    else if(i === 0) row.getCell(7).value = { formula: 'IF(OR(E4="",F4=""),"",EDATE(E4,F4))', result: due, shareType: 'shared', ref: 'G4:G6' };
    else row.getCell(7).value = { sharedFormula: 'G4', result: due };
    row.getCell(4).value = { formula: `IF(G${n}<TODAY(),"expired","in date")`, result: 'in date' };
    row.getCell(3).font = { italic: true };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const ALL = { headerRow: 2, layout: { include: [1, 2, 3, 4, 7], itemCol: 2, dueCol: 7 } };   // Last service and Life NOT shown

test('the next-due rule is read from the client\'s own formula, shared formulas included', async () => {
  const p = await parseLayout(await workbook(), ALL);
  assert.deepEqual(p.layout.rule, { doneCol: 5, lifeCol: 6, unit: 'months' });
  assert.deepEqual(p.layout.sheets[0].rule, { doneCol: 5, lifeCol: 6, unit: 'months' });
  const a2 = p.items.find(i => i.row === 5);
  assert.deepEqual(a2.cols[5], { v: '2025-01-31', type: 'date', formula: false }, 'the tick needs last service even when it is not shown');
  assert.deepEqual(a2.cols[6], { v: 13, type: 'number', formula: false });
  assert.ok(!p.layout.sheets[0].columns.find(c => c.col === 5).included, 'it is still not shown');
});

test('no rule when the due date is typed in, not worked out', async () => {
  const p = await parseLayout(await workbook({ plainDue: true }), ALL);
  assert.equal(p.layout.rule, undefined);
  assert.ok(!('5' in p.items[0].cols), 'nothing extra carried when there is no rule');
});

test('locations become links Excel can open, and come back as they were typed', () => {
  const cases = [
    ['S:\\H&S\\FM\\Lift #2 cert 2026.pdf', 'file:///S:/H&S/FM/Lift%20%232%20cert%202026.pdf', 'Lift #2 cert 2026.pdf'],
    ['\\\\srv01\\Shared Docs\\FM\\x.pdf', 'file://srv01/Shared%20Docs/FM/x.pdf', 'x.pdf'],
    ['https://example.sharepoint.com/sites/fm/FE-01.pdf?web=1', 'https://example.sharepoint.com/sites/fm/FE-01.pdf?web=1', 'FE-01.pdf'],
  ];
  for(const [loc, href, text] of cases){
    assert.equal(docHref(loc), href); assert.equal(docFromHref(href), loc); assert.equal(docText(loc), text);
  }
  assert.equal(docHref('"C:\\Certs\\Gas.pdf"'), 'file:///C:/Certs/Gas.pdf', 'the quotes from "Copy as path" come off');
  assert.equal(docHref('Filing cabinet 2'), '', 'not a path or a web address: no link');
  assert.equal(docText('https://example.com/folder/'), 'Open document');
});

test('the export adds one Document column after the spacer, with links only where there is a document', async () => {
  const buf = await workbook(), p = await parseLayout(buf, ALL);
  const items = JSON.parse(JSON.stringify(p.items));
  items[1].doc = 'S:\\H&S\\FM\\A2 service.pdf';
  items[2].doc = 'Filing cabinet 2';
  const out = await buildLayout(buf, { layout: p.layout, items });
  assert.equal(out.docs, 2);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(out.buffer)); const ws = wb.getWorksheet('In Use');
  assert.equal(ws.getCell('I2').value, 'Document', 'the spacer H is stepped over');
  assert.ok(ws.getCell('I3').isMerged && ws.getCell('I3').master.address === 'I2', 'the heading is merged down like the others');
  assert.deepEqual(ws.getCell('I2').font, ws.getCell('G2').font, 'and looks like the last heading');
  assert.equal(ws.getCell('I4').value, null, 'no document, no link');
  assert.deepEqual(ws.getCell('I5').value, { text: 'A2 service.pdf', hyperlink: 'file:///S:/H&S/FM/A2%20service.pdf' });
  assert.equal(ws.getCell('I5').font.underline, true);
  assert.equal(ws.getCell('I6').value, 'Filing cabinet 2', 'a location that is not a path is written as typed');
  assert.ok(ws.getCell('H5').isMerged && ws.getColumn(8).width === 2.5, 'the spacer is as it was');
  assert.equal(ws.getCell('C5').font.italic, true);
  const rels = await (await JSZip.loadAsync(Buffer.from(out.buffer))).file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
  assert.match(rels, /Target="file:\/\/\/S:\/H&amp;S\/FM\/A2%20service\.pdf" TargetMode="External"/);
});

test('no document anywhere: no column is added', async () => {
  const buf = await workbook(), p = await parseLayout(buf, ALL);
  const out = await buildLayout(buf, { layout: p.layout, items: p.items });
  assert.equal(out.changed, 0);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(out.buffer));
  assert.equal(wb.getWorksheet('In Use').getCell('I2').value, null);
});

test('round trip: the Document column is read back as links, never as one of their columns, and an unchanged export writes nothing', async () => {
  const buf = await workbook(), p = await parseLayout(buf, ALL);
  const items = JSON.parse(JSON.stringify(p.items)); items[1].doc = '\\\\srv01\\FM\\A2.pdf';
  items[1].cols[5] = { v: '2026-11-12', type: 'date', formula: false };   // ticked done in Compass
  const out = await buildLayout(buf, { layout: p.layout, items });
  const p2 = await parseLayout(Buffer.from(out.buffer), { headerRow: 2, layout: { include: [1, 2, 3, 4, 7, 9], itemCol: 2, dueCol: 7 } });
  assert.equal(p2.layout.docCol, 9);
  assert.ok(!p2.layout.sheets[0].columns.some(c => c.heading === 'Document'));
  assert.equal(p2.items[1].doc, '\\\\srv01\\FM\\A2.pdf');
  assert.equal(p2.items[0].doc, undefined);
  assert.equal(p2.items[1].cols[5].v, '2026-11-12', 'the date done went into their Last service column');
  const again = await buildLayout(Buffer.from(out.buffer), { layout: p2.layout, items: p2.items });
  assert.equal(again.changed, 0, 'nothing to write the second time');
  items[1].doc = '';
  const cleared = await buildLayout(Buffer.from(out.buffer), { layout: p2.layout, items: items.map(i => Object.assign({}, i, { cols: p2.items.find(x => x.row === i.row).cols })) });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(cleared.buffer));
  assert.equal(wb.getWorksheet('In Use').getCell('I5').value, null, 'a location cleared in Compass is cleared in the file');
});
