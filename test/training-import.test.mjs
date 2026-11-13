// ══════════════════════════════════════════════════════════════
//  Training matrix import - real client workbooks (Simon, 12-13 November
//  2026: "check the training matrix import it wont read a spreadsheet",
//  "Yes, fix the import"). The mapping screen read every tab with the first
//  tab's layout, so:
//    - other tabs (qualifications, certificates) and the key under the table
//      came in as "people" (16 rows read, 3 of them people);
//    - three dated tabs of one list came in as the same people three times;
//    - headings over two rows ran columns together under one name, and a
//      heading that was a date came in as "Wed Jan 01 2025 00:00:00 GMT...".
//  Two made-up workbooks shaped like the real ones.
//  Run: node --test test/training-import.test.mjs
// ══════════════════════════════════════════════════════════════
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const { parse, layout, buildReport } = require('../lib/training-xlsx.js');

const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
// one matrix tab under a title block, month columns, a key under the table; two other tabs laid out differently
async function attendance(){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Training Matrix');
  ws.getCell('B2').value = 'Testing Client Ltd - Training Record';
  ws.getRow(4).values = ['', 'Name', 'Role', 'Basis', 'Weekly'];
  [[6, D(2025, 1, 1), 'mmm-yy'], [7, D(2025, 2, 1), 'mmm-yy'], [8, D(2025, 3, 15), 'dd/mm/yyyy'], [9, D(2025, 4, 1), '[$-809]d mmmm yyyy'], [10, D(2025, 5, 1), 'mm-dd-yy'], [11, D(2025, 6, 1), undefined]]
    .forEach(([c, d, f]) => { ws.getRow(4).getCell(c).value = d; if(f) ws.getRow(4).getCell(c).numFmt = f; });
  ws.getRow(4).getCell(12).value = 'Weekly';                       // a heading used twice
  ws.getRow(4).getCell(13).value = '  Fire \n Marshal ';           // spaces and a line break inside a heading
  ws.getRow(5).values = ['1', 'Alex Morgan', 'Director', 'Employee', 'P', 'P', 'P'];
  ws.getRow(6).values = ['2', 'Sam Kerr', 'Fitter', 'Employee', 'P', '', 'P'];
  ws.getRow(7).values = ['', 'Jo Bloggs'];                         // somebody new: a name and nothing else yet
  ws.getCell('B9').value = 'P = present. Yellow cells: attendance from the office diary.';   // a key under the table
  ws.getCell('B10').value = 'Reviewed monthly'; ws.mergeCells('B10:F10');                    // a note merged across the columns
  ws.getCell('B11').value = 'Any person who has not attended for three months in a row is to be spoken to by their manager first';   // a long line
  const q = wb.addWorksheet('Qualifications'); q.getRow(2).values = ['Name', 'Role', 'Qualifications']; q.getRow(3).values = ['Alex Morgan', 'Director', 'C&G 236']; q.getRow(4).values = ['Sam Kerr', 'Fitter', 'NVQ 2'];
  const c = wb.addWorksheet('Certificates'); c.getRow(4).values = ['Name', 'Course or card', 'Expiry']; c.getRow(5).values = ['Alex Morgan', 'CSCS card', D(2027, 1, 1)];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
// three dated tabs of one list; the two later ones with headings over two rows and a group heading repeated
async function dated(){
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet('Cards Aug 25'); a.getCell('A1').value = 'Testing Client Ltd - Training Matrix';
  a.getRow(2).values = ['Name', 'Title', 'CSCS', 'IPAF']; a.getRow(3).values = ['', '', 'Expiry Date', 'Expiry Date'];
  a.getRow(4).values = ['Alex Morgan', 'Director', D(2028, 1, 31), 'NA']; a.getRow(5).values = ['Sam Kerr', 'Fitter', D(2026, 11, 1), D(2030, 8, 31)]; a.getRow(6).values = ['Old Hand', 'Fitter', 'NA', 'NA'];
  for(const [name, rows] of [['Skills Oct 25', [['Alex Morgan', 'Director', 'Grandfather', 'NVQ L2', 'Attended'], ['Sam Kerr', 'Fitter', 'Started', 'NVQ L2', 'Attended']]], ['Skills Aug 26', [['Alex Morgan', 'Director', 'Grandfather', 'NVQ L2', 'Attended'], ['Sam Kerr', 'Fitter', 'Completed', 'NVQ L2', 'Attended'], ['Nia Newman', 'Mate', 'NA', 'Started', 'NA']]]]){
    const ws = wb.addWorksheet(name); ws.getCell('A1').value = 'Testing Client Ltd - Training Matrix';
    ws.getRow(2).values = ['Name', 'Title', 'Ductwork Skillcard', 'Ductwork Skillcard', 'Fire Dampers'];
    ws.getRow(3).values = ['', '', 'Started NVQ L3', 'Blue Card', 'Fire Dampers']; ws.mergeCells('E2:E3');
    rows.forEach((r, i) => { ws.getRow(4 + i).values = r; });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const MAP_A = { headerRow: 4, fixed: { full: 2, job: 3 }, skip: [1], sheet: 'Training Matrix' };
const MAP_D = { headerRow: 2, fixed: { full: 1, job: 2 }, sheet: 'Skills Aug 26' };

test('only the tab laid out like the chosen one is read; the others are named, not turned into people', async () => {
  const m = await parse(await attendance(), MAP_A);
  assert.deepEqual(m.sheets.map(s => s.name), ['Training Matrix']);
  assert.deepEqual(m.notBrought, ['Qualifications', 'Certificates']);
  assert.deepEqual(m.people.map(p => p.firstName), ['Alex Morgan', 'Sam Kerr', 'Jo Bloggs'], 'the three people - and a new name with nothing else on its row is kept');
});

test('a key or a note under the table is not a person, and is reported', async () => {
  const m = await parse(await attendance(), MAP_A);
  assert.deepEqual(m.skipped.map(x => x.row), [9, 10, 11], 'a line with = or : in it, one merged across the columns, a long line');
  assert.equal(m.skipped[0].sheet, 'Training Matrix'); assert.match(m.skipped[0].text, /^P = present/);
});

test('a heading that is a date reads the way its cell shows it; a heading used twice stays two columns', async () => {
  const m = await parse(await attendance(), MAP_A);
  assert.deepEqual(m.sheets[0].courses.map(c => c.name), ['Basis', 'Weekly', 'Jan-25', 'Feb-25', '15/03/2025', '1 April 2025', '01/05/2025', '01/06/2025', 'Weekly (2)', 'Fire Marshal']);
  const alex = m.people[0];
  assert.deepEqual(alex.cells['Jan-25'], { type: 'text', v: 'P' }); assert.deepEqual(alex.cells['Weekly'], { type: 'text', v: 'P' });
  assert.deepEqual(alex.cells['Weekly (2)'], { type: 'empty', v: '' }, 'the second Weekly column keeps its own (empty) cell instead of overwriting the first');
});

test('headings over two rows: each column carries both, and the data starts below them', async () => {
  const m = await parse(await dated(), Object.assign({ tabs: ['Skills Aug 26'] }, MAP_D));
  const s = m.sheets[0];
  assert.equal(s.headRows, 2);
  assert.deepEqual(s.courses.map(c => c.name), ['Ductwork Skillcard - Started NVQ L3', 'Ductwork Skillcard - Blue Card', 'Fire Dampers'], 'a heading merged down over both rows is said once');
  assert.deepEqual(m.people.map(p => p.firstName), ['Alex Morgan', 'Sam Kerr', 'Nia Newman']);
  assert.equal(m.people[1].cells['Ductwork Skillcard - Started NVQ L3'].v, 'Completed'); assert.equal(m.people[1].cells['Ductwork Skillcard - Blue Card'].v, 'NVQ L2');
  assert.equal(m.people[1].job, 'Fitter');
  const one = await parse(await dated(), Object.assign({ tabs: ['Skills Aug 26'], headRows: 1 }, MAP_D));
  assert.deepEqual(one.sheets[0].courses.map(c => c.name), ['Ductwork Skillcard', 'Ductwork Skillcard (2)', 'Fire Dampers'], 'told the headings are on one row, the two columns are still kept apart');
});

test('only the tabs ticked are read; the ones that could have been are named', async () => {
  const buf = await dated();
  const one = await parse(buf, Object.assign({ tabs: ['Skills Aug 26'] }, MAP_D));
  assert.equal(one.people.length, 3); assert.deepEqual(one.notTicked, ['Cards Aug 25', 'Skills Oct 25']); assert.deepEqual(one.notBrought, []);
  const two = await parse(buf, Object.assign({ tabs: ['Skills Aug 26', 'Cards Aug 25'] }, MAP_D));
  assert.deepEqual(two.sheets.map(s => s.name), ['Cards Aug 25', 'Skills Aug 26'], 'each ticked tab is its own table, with its own columns');
  assert.deepEqual(two.sheets[0].courses.map(c => c.name), ['CSCS - Expiry Date', 'IPAF - Expiry Date']);
  assert.deepEqual(two.people.filter(p => p.sheet === 'Cards Aug 25')[1].cells['CSCS - Expiry Date'], { type: 'date', v: '2026-11-01' });
  assert.equal(two.people.filter(p => p.sheet === 'Cards Aug 25')[0].job, 'Director', 'Title is the job on that tab too: it sits under the same heading');
  const all = await parse(buf, MAP_D);
  assert.equal(all.sheets.length, 3, 'with no ticks sent, every tab that fits is read');
});

test('the mapping screen is told the columns, and for every tab whether it fits and whose people it repeats', async () => {
  const L = await layout(await dated(), { sheet: 'Skills Aug 26', headerRow: 2, fixed: { full: 1 } });
  assert.equal(L.sheet, 'Skills Aug 26'); assert.equal(L.headRows, 2); assert.equal(L.autoHeadRows, 2);
  assert.deepEqual(L.columns.map(c => c.col + ':' + c.name), ['1:Name', '2:Title', '3:Ductwork Skillcard - Started NVQ L3', '4:Ductwork Skillcard - Blue Card', '5:Fire Dampers']);
  assert.deepEqual(L.columns[0].samples, ['Alex Morgan', 'Sam Kerr', 'Nia Newman']); assert.equal(L.columns[1].top, 'Title');
  assert.deepEqual(L.tabs, [
    { name: 'Cards Aug 25', chosen: false, fits: true, people: 3, same: 2, status: 'active' },
    { name: 'Skills Oct 25', chosen: false, fits: true, people: 2, same: 2, status: 'active' },
    { name: 'Skills Aug 26', chosen: true, fits: true, people: 3, same: 0, status: 'active' } ]);
  const A = await layout(await attendance(), { sheet: 'Training Matrix', headerRow: 4, fixed: { full: 2 } });
  assert.equal(A.headRows, 1);
  assert.deepEqual(A.tabs.map(t => t.name + ':' + t.fits + ':' + t.people), ['Training Matrix:true:3', 'Qualifications:false:0', 'Certificates:false:0']);
  assert.deepEqual(A.columns.slice(0, 3).map(c => c.col + ':' + c.name), ['1:', '2:Name', '3:Role'], 'a column with entries but no heading is still offered (it could be the name)');
  assert.equal(A.columns.find(c => c.col === 6).name, 'Jan-25');
  const none = await layout(await attendance(), { sheet: 'Training Matrix', headerRow: 4, fixed: {} });
  assert.deepEqual(none.tabs.map(t => t.fits), [true, false, false], 'with no name column chosen yet, only the chosen tab is offered');
  const one = await layout(await dated(), { sheet: 'Skills Aug 26', headerRow: 2, headRows: 1, fixed: { full: 1 } });
  assert.equal(one.headRows, 1); assert.equal(one.autoHeadRows, 2); assert.equal(one.columns[3].name, 'Ductwork Skillcard (2)');
});

test('a workbook read by its own Last Name / First Name headings is read as it always was', async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Staff');
  ws.getRow(1).values = ['Last Name', 'First Name', 'Badge Number', 'Job', 'First Aid', 'Fire Marshal'];
  ws.getRow(2).values = ['Morgan', 'Alex', '101', 'Driver', D(2027, 5, 1), 'Yes']; ws.getRow(3).values = ['Kerr', 'Sam', '', '', '', ''];
  const lf = wb.addWorksheet('Left'); lf.getRow(1).values = ['Last Name', 'First Name', 'First Aid']; lf.getRow(2).values = ['Gone', 'Pat', D(2025, 1, 1)];
  wb.addWorksheet('Notes').getCell('A1').value = 'Nothing to do with people';
  const m = await parse(Buffer.from(await wb.xlsx.writeBuffer()));
  assert.deepEqual(m.sheets.map(s => [s.name, s.status, s.headerRow, s.cols.last, s.cols.first, s.cols.badge, s.cols.job]), [['Staff', 'active', 1, 1, 2, 3, 4], ['Left', 'left', 1, 1, 2, null, null]]);
  assert.deepEqual(m.sheets[0].courses, [{ name: 'First Aid', col: 5 }, { name: 'Fire Marshal', col: 6 }]);
  assert.deepEqual(m.people.map(p => p.id), ['trn_b_101', 'trn_n_kerr_sam', 'trn_n_gone_pat']);
  assert.deepEqual(m.people[0].cells, { 'First Aid': { type: 'date', v: '2027-05-01' }, 'Fire Marshal': { type: 'text', v: 'Yes' } });
  assert.deepEqual([m.notBrought, m.notTicked, m.skipped], [[], [], []]);
});

test('export after a mapped import: a new person goes under the last name, and the key under the table stays where it is', async () => {
  const buf = await attendance(), m = await parse(buf, MAP_A);
  const people = JSON.parse(JSON.stringify(m.people));
  people.find(p => p.firstName === 'Sam Kerr').cells['Feb-25'] = { type: 'text', v: 'P' };
  people.push({ id: 'n1', sheet: null, row: null, group: 'staff', tab: 'Training Matrix', status: 'active', lastName: '', firstName: 'Nia Newman', badge: '', job: 'Fitter', cells: { 'Jan-25': { type: 'text', v: 'P' } } });
  const out = await buildReport(buf, { people, sheets: m.sheets });
  assert.equal(out.added, 1); assert.equal(out.notRemoved, 0, 'the key and the notes are not counted as people missing from Compass');
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(out.buffer)); const ws = wb.getWorksheet('Training Matrix');
  assert.equal(ws.getCell('B8').value, 'Nia Newman', 'row 8, directly under Jo Bloggs on row 7'); assert.equal(ws.getCell('C8').value, 'Fitter'); assert.equal(ws.getCell('F8').value, 'P');
  assert.equal(ws.getCell('G6').value, 'P', 'the change is in the Feb-25 column');
  assert.match(String(ws.getCell('B9').value), /^P = present/, 'the key is where it was');
  assert.equal(wb.getWorksheet('Qualifications').getCell('C3').value, 'C&G 236', 'the tabs not brought in are untouched');
});
