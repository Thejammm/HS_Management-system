// ══════════════════════════════════════════════════════════════
//  Training matrix export - the rows that move (Simon, 12-13 November 2026:
//  "the excel export didnt work" - "wrong content"). The app has always said
//  of someone moved to Left: "They are kept, archived, and move to the Left
//  tab on export" - and the export left them where they were. A person added
//  in Compass landed below everything on the sheet (row 174 of a table that
//  ended on row 167), and someone deleted in Compass was still in the file
//  with nothing said.
//  A made-up workbook shaped like a real one: a Staff tab that is an Excel
//  table (as Excel saves it) with a cell note and blank formatted rows under
//  it, a Left tab with fewer columns, and a Garage tab.
//  Run: node --test test/training-moves.test.mjs
// ══════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { parse, build, buildReport } = require('../lib/training-xlsx.js');

const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
async function matrix({ leftTab = true, totals = false } = {}){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Staff');
  ws.addTable({ name: 'Table1', ref: 'A1', headerRow: true, totalsRow: totals, style: { theme: 'TableStyleLight18', showRowStripes: true },
    columns: ['Last Name', 'First Name', 'Badge Number', 'Job', 'First Aid', 'Autism', 'Renewal'].map(n => ({ name: n, filterButton: true })),
    rows: [['Morgan', 'Alex', '101', 'Driver', D(2027, 5, 1), 'Yes', null], ['Kerr', 'Sam', '102', 'Escort', D(2026, 2, 1), 'Yes', null], ['Bloggs', 'Jo', '103', 'Driver', 'N/A', '', null], ['Patel', 'Chris', '104', 'Driver', D(2028, 3, 3), '', null]] });
  for(let r = 2; r <= 5; r++){ ws.getCell('E' + r).numFmt = 'dd/mm/yyyy'; ws.getCell('G' + r).value = { formula: `E${r}+365`, result: null }; ws.getCell('G' + r).numFmt = 'dd/mm/yyyy'; }
  ws.getCell('B3').note = 'Back in the spring';                      // on Sam Kerr's row
  ws.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };   // and a highlight that is his
  ws.getCell('B7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };   // blank formatted rows under the table
  if(leftTab){
    const lf = wb.addWorksheet('Left'); lf.getRow(1).values = ['Last Name', 'First Name', 'Badge Number', 'Job', 'First Aid'];
    lf.getRow(2).values = ['Gone', 'Pat', '001', 'Driver', D(2025, 1, 1)]; lf.getCell('E2').numFmt = 'dd/mm/yyyy'; lf.getCell('A2').font = { italic: true };
  }
  const g = wb.addWorksheet('Garage Staff'); g.getRow(1).values = ['Last Name', 'First Name', 'Job', 'First Aid']; g.getRow(2).values = ['Wrench', 'Lee', 'Garage', D(2027, 1, 1)];
  const zip = await JSZip.loadAsync(Buffer.from(await wb.xlsx.writeBuffer()));   // as Excel saves a table: no headerRowCount, no filterColumn entries
  zip.file('xl/tables/table1.xml', (await zip.file('xl/tables/table1.xml').async('string')).replace(/ headerRowCount="\d"/, '').replace(/<filterColumn [^>]*\/>/g, ''));
  return zip.generateAsync({ type: 'nodebuffer' });
}
const load = async buf => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(buf)); return wb; };
const txt = c => { const v = c.value; if(v instanceof Date) return v.toISOString().slice(0, 10); if(v && typeof v === 'object') return v.formula ? '=' + v.formula : JSON.stringify(v); return v == null ? '' : String(v); };
const names = ws => { const out = []; ws.eachRow((row, r) => { if(r > 1 && txt(row.getCell(1))) out.push(txt(row.getCell(1))); }); return out; };
const tableRef = async buf => (/ ref="([^"]+)"/.exec(await (await JSZip.loadAsync(Buffer.from(buf))).file('xl/tables/table1.xml').async('string')) || [])[1];
const byName = (m, last) => m.people.find(p => p.lastName === last);

test('someone moved to Left in Compass leaves their tab and joins the Left tab, with what is theirs', async () => {
  const buf = await matrix(), m = await parse(buf);
  const people = JSON.parse(JSON.stringify(m.people)); people.find(p => p.lastName === 'Kerr').status = 'left';
  const out = await buildReport(buf, { people, sheets: m.sheets });
  assert.deepEqual(out.moved, ['Sam Kerr']); assert.deepEqual(out.notMoved, []);
  const wb = await load(out.buffer), st = wb.getWorksheet('Staff'), lf = wb.getWorksheet('Left');
  assert.deepEqual(names(st), ['Morgan', 'Bloggs', 'Patel'], 'he is off the Staff tab and the others close up, in their order');
  assert.deepEqual(names(lf), ['Gone', 'Kerr'], 'and under the last person on the Left tab');
  assert.equal(txt(lf.getCell('B3')), 'Sam'); assert.equal(txt(lf.getCell('C3')), '102'); assert.equal(txt(lf.getCell('D3')), 'Escort');
  assert.equal(txt(lf.getCell('E3')), '2026-02-01'); assert.match(lf.getCell('E3').numFmt, /d/, 'his date is a date on the Left tab');
  assert.ok(lf.getCell('B3').note, 'the note on his name went with him'); assert.ok(!st.getCell('B3').note, 'and is not left on whoever is now on that row');
  assert.equal(lf.getCell('A3').font.italic, true, 'he is styled like the row above him on the Left tab');
  assert.equal((st.getCell('A3').fill || {}).fgColor, undefined, 'his highlight did not stay behind on the next person');
  assert.equal(txt(st.getCell('E3')), 'N/A', 'Jo Bloggs moved up into row 3 with her own values');
  assert.equal(txt(st.getCell('G3')), '=E3+365', 'a formula on a row that moved up now points at its own row');
  assert.equal(txt(st.getCell('A5')), '', 'the last row of the list is cleared');
  assert.equal(await tableRef(out.buffer), 'A1:G4', 'the table ends on the last person');
  assert.deepEqual(out.dropped, [{ name: 'Sam Kerr', course: 'Autism' }], 'what the Left tab has no column for is not carried - and is reported');
});

test('a person added in Compass sits directly under the last person, inside the table', async () => {
  const buf = await matrix(), m = await parse(buf);
  const people = JSON.parse(JSON.stringify(m.people)).concat([{ id: 'n1', sheet: null, row: null, group: 'staff', tab: 'Staff', status: 'active', lastName: 'Newman', firstName: 'Nia', badge: '105', job: 'Driver', cells: { 'First Aid': { type: 'date', v: '2028-09-01' } } }]);
  const out = await buildReport(buf, { people, sheets: m.sheets });
  assert.equal(out.added, 1);
  const st = (await load(out.buffer)).getWorksheet('Staff');
  assert.equal(txt(st.getCell('A6')), 'Newman', 'row 6, straight under Patel on row 5 - not below the formatted rows');
  assert.equal(txt(st.getCell('E6')), '2028-09-01'); assert.match(st.getCell('E6').numFmt, /d/);
  assert.equal(await tableRef(out.buffer), 'A1:G6', 'and the table grows to take her in');
});

test('two leavers, a joiner, a change and a deletion in one export', async () => {
  const buf = await matrix(), m = await parse(buf);
  let people = JSON.parse(JSON.stringify(m.people));
  people.find(p => p.lastName === 'Morgan').status = 'left'; people.find(p => p.lastName === 'Bloggs').status = 'left';
  people.find(p => p.lastName === 'Patel').cells['First Aid'] = { type: 'date', v: '2030-01-31' };
  people = people.filter(p => p.lastName !== 'Wrench').concat([{ id: 'n1', sheet: null, row: null, group: 'staff', tab: 'Staff', status: 'active', lastName: 'Newman', firstName: 'Nia', badge: '', job: '', cells: {} }]);
  const out = await buildReport(buf, { people, sheets: m.sheets });
  assert.deepEqual(out.moved, ['Alex Morgan', 'Jo Bloggs']); assert.equal(out.added, 1);
  assert.equal(out.notRemoved, 1, 'the person deleted in Compass is counted');
  const wb = await load(out.buffer);
  assert.deepEqual(names(wb.getWorksheet('Staff')), ['Kerr', 'Patel', 'Newman']);
  assert.deepEqual(names(wb.getWorksheet('Left')), ['Gone', 'Morgan', 'Bloggs'], 'in the order they were on their tab');
  assert.equal(txt(wb.getWorksheet('Staff').getCell('E3')), '2030-01-31', 'the change made to Patel is on the row he is now on');
  assert.ok(wb.getWorksheet('Staff').getCell('B2').note, 'the note is still on Sam Kerr, who is now on row 2');
  assert.deepEqual(names(wb.getWorksheet('Garage Staff')), ['Wrench'], 'someone deleted in Compass is never deleted from the client\'s file');
  assert.equal(await tableRef(out.buffer), 'A1:G4');
});

test('no Left tab in the workbook: the person stays where they are, and the export says so', async () => {
  const buf = await matrix({ leftTab: false }), m = await parse(buf);
  const people = JSON.parse(JSON.stringify(m.people)); people.find(p => p.lastName === 'Kerr').status = 'left';
  const out = await buildReport(buf, { people, sheets: m.sheets });
  assert.deepEqual(out.moved, []); assert.deepEqual(out.notMoved, [{ name: 'Sam Kerr', why: 'no Left tab' }]);
  assert.deepEqual(names((await load(out.buffer)).getWorksheet('Staff')), ['Morgan', 'Kerr', 'Bloggs', 'Patel']);
});

test('a row is never moved unless the name on it is the person\'s', async () => {
  const buf = await matrix(), m = await parse(buf);
  const people = JSON.parse(JSON.stringify(m.people)); const k = people.find(p => p.lastName === 'Kerr'); k.status = 'left'; k.row = 4;   // points at Jo Bloggs's row
  const out = await buildReport(buf, { people, sheets: m.sheets });
  assert.deepEqual(out.moved, []); assert.equal(out.notMoved[0].why, 'not on the row');
  assert.deepEqual(names((await load(out.buffer)).getWorksheet('Staff')), ['Morgan', 'Kerr', 'Bloggs', 'Patel'], 'nobody was taken off the tab');
});

test('nothing moved, added or deleted: the export is the client\'s file, and build() still returns the bytes', async () => {
  const buf = await matrix(), m = await parse(buf);
  const out = await buildReport(buf, { people: m.people, sheets: m.sheets });
  assert.deepEqual({ moved: out.moved, notMoved: out.notMoved, dropped: out.dropped, added: out.added, notRemoved: out.notRemoved }, { moved: [], notMoved: [], dropped: [], added: 0, notRemoved: 0 });
  const a = await load(buf), b = await load(await build(buf, { people: m.people, sheets: m.sheets }));
  a.worksheets.forEach(ws => { const w2 = b.getWorksheet(ws.name); for(let r = 1; r <= ws.rowCount; r++) for(let c = 1; c <= ws.columnCount; c++) assert.equal(txt(w2.getRow(r).getCell(c)), txt(ws.getRow(r).getCell(c)), ws.name + ' r' + r + ' c' + c); });
  assert.equal(await tableRef(out.buffer), 'A1:G5');
});

test('a matrix mapped by hand (one Name column): a leaver moves, a joiner goes under the last name', async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Matrix'); ws.getCell('A1').value = 'Testing Client Ltd';
  ws.getRow(3).values = ['Name', 'Role', 'First Aid']; ws.getRow(4).values = ['Alex Morgan', 'Driver', 'P']; ws.getRow(5).values = ['Sam Kerr', 'Escort', 'P'];
  const lf = wb.addWorksheet('Leavers'); lf.getRow(3).values = ['Name', 'Role', 'First Aid']; lf.getRow(4).values = ['Pat Gone', 'Driver', ''];
  const buf = Buffer.from(await wb.xlsx.writeBuffer()), m = await parse(buf, { headerRow: 3, fixed: { full: 1, job: 2 } });
  const people = JSON.parse(JSON.stringify(m.people)); people.find(p => p.firstName === 'Alex Morgan').status = 'left';
  people.push({ id: 'n1', sheet: null, row: null, group: 'staff', tab: 'Matrix', status: 'active', lastName: '', firstName: 'Nia Newman', badge: '', job: 'Driver', cells: {} });
  const out = await buildReport(buf, { people, sheets: m.sheets });
  assert.deepEqual(out.moved, ['Alex Morgan']);
  const w = await load(out.buffer);
  assert.deepEqual([4, 5, 6].map(r => txt(w.getWorksheet('Matrix').getCell('A' + r))), ['Sam Kerr', 'Nia Newman', ''], 'the leaver is off the tab and the new person is under the last name');
  assert.deepEqual([4, 5].map(r => txt(w.getWorksheet('Leavers').getCell('A' + r))), ['Pat Gone', 'Alex Morgan'], 'a tab called Leavers is the Left tab; the whole name goes in its Name column');
  assert.equal(txt(w.getWorksheet('Leavers').getCell('B5')), 'Driver');
});

test('a cell not changed in Compass is left exactly as the client has it; a formula is never written over', async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Staff');
  ws.getRow(1).values = ['Last Name', 'First Name', 'First Aid', 'Renewal', 'Card', 'Notes'];
  ws.getRow(2).values = ['Morgan', 'Alex', D(2027, 5, 1)];
  ws.getCell('D2').value = { formula: 'C2+365', result: D(2028, 4, 30) };
  ws.getCell('E2').value = { text: 'CSCS 123', hyperlink: 'https://example.com/card/123' };
  ws.getCell('F2').value = { richText: [{ font: { bold: true }, text: 'Lead ' }, { text: 'driver' }] };
  ws.getRow(3).values = ['Kerr', 'Sam', '2027-05-01'];                                   // a date kept as text by the client
  ws.getCell('D3').value = { formula: 'C3+365' };                                        // a formula with no saved result
  const buf = Buffer.from(await wb.xlsx.writeBuffer()), m = await parse(buf);
  assert.deepEqual(byName(m, 'Kerr').cells['Renewal'], { type: 'empty', v: '' }, 'a formula with nothing saved reads as empty, not as "[object Object]"');
  assert.deepEqual(byName(m, 'Morgan').cells['Renewal'], { type: 'date', v: '2028-04-30' });
  const none = await load((await buildReport(buf, { people: m.people, sheets: m.sheets })).buffer), s0 = none.getWorksheet('Staff');
  assert.equal(s0.getCell('D2').formula, 'C2+365', 'the formula is still a formula'); assert.equal(s0.getCell('D3').formula, 'C3+365');
  assert.deepEqual(s0.getCell('E2').value, { text: 'CSCS 123', hyperlink: 'https://example.com/card/123' }, 'the link is still a link');
  assert.equal(s0.getCell('F2').value.richText[0].font.bold, true, 'part-bold text is still part bold');
  assert.equal(s0.getCell('C3').value, '2027-05-01', 'text that looks like a date is not turned into one');
  const people = JSON.parse(JSON.stringify(m.people)); const a = people.find(p => p.lastName === 'Morgan');
  a.cells['Renewal'] = { type: 'date', v: '2031-01-01' }; a.cells['Card'] = { type: 'text', v: 'CSCS 999' };
  const out = await buildReport(buf, { people, sheets: m.sheets }), s1 = (await load(out.buffer)).getWorksheet('Staff');
  assert.equal(out.formulaKept, 1, 'a change made in Compass to a cell the spreadsheet works out is not written, and is counted');
  assert.equal(s1.getCell('D2').formula, 'C2+365'); assert.equal(s1.getCell('E2').value, 'CSCS 999', 'a real change is written');
});
