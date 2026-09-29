// ══════════════════════════════════════════════════════════════
//  A training workbook with a tab per business. Simon, 2026-09-29: the
//  upload needs "a built in way of understanding multiple business needs
//  such as two or more tabs with different employees training needs".
//  The importer keeps each tab's name on every person; the export must put a
//  person added in the app back into the tab they were added to.
//  Run: node --test test/training-tabs.test.mjs
// ══════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const need = createRequire(import.meta.url);
const ExcelJS = need('exceljs');
const X = need('../lib/training-xlsx.js');

async function twoBusinesses(){
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet('Archer Ltd');
  a.addRow(['Surname', 'First name', 'Role', 'Fire Warden', 'First Aid']);
  a.addRow(['Kane', 'Mick', 'Supervisor', new Date('2027-03-01'), new Date('2026-12-01')]);
  a.addRow(['Nair', 'Priya', 'Fitter', new Date('2027-05-01'), '']);
  const f = wb.addWorksheet('Fineline Ltd');
  f.addRow(['Surname', 'First name', 'Role', 'Asbestos Awareness', 'Working at Height']);
  f.addRow(['Boyes', 'Sophie', 'Architect', new Date('2027-01-10'), new Date('2027-02-10')]);
  f.addRow(['Barrett', 'Chloe', 'Office Manager', new Date('2027-01-11'), '']);
  f.addRow(['Reid', 'Tom', 'Surveyor', '', new Date('2026-11-30')]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test('each tab keeps its own name and its own columns', async () => {
  const m = await X.parse(await twoBusinesses());
  const names = m.sheets.map(s => s.name);
  assert.deepEqual(names, ['Archer Ltd', 'Fineline Ltd']);
  const cols = Object.fromEntries(m.sheets.map(s => [s.name, s.courses.map(c => c.name)]));
  assert.deepEqual(cols['Archer Ltd'], ['Fire Warden', 'First Aid']);
  assert.deepEqual(cols['Fineline Ltd'], ['Asbestos Awareness', 'Working at Height']);
  assert.equal(m.people.filter(p => p.sheet === 'Fineline Ltd').length, 3, 'the three Fineline people carry their tab');
  assert.equal(m.people.filter(p => p.sheet === 'Archer Ltd').length, 2);
});

test('a person added in the app goes back into the tab they were added to', async () => {
  const buf = await twoBusinesses();
  const m = await X.parse(buf);
  const joiner = { id: 'trp_new', sheet: null, tab: 'Fineline Ltd', row: null, group: 'staff', status: 'active',
    lastName: 'Ashworth', firstName: 'Daniel', badge: '', job: 'Designer', cells: { 'Asbestos Awareness': { type: 'date', v: '2027-06-01' } } };
  const out = await X.build(buf, { people: m.people.concat([joiner]) });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(out);
  const surnames = (name) => { const ws = wb.getWorksheet(name); const v = []; ws.eachRow((row, r) => { if (r > 1) v.push(String(row.getCell(1).value || '')); }); return v; };
  assert.ok(surnames('Fineline Ltd').includes('Ashworth'), 'written into Fineline Ltd');
  assert.ok(!surnames('Archer Ltd').includes('Ashworth'), 'and not into the first tab of the group');
});

test('a person added before tabs were chosen still lands in their group\'s first tab', async () => {
  const buf = await twoBusinesses();
  const m = await X.parse(buf);
  const joiner = { id: 'trp_old', sheet: null, row: null, group: 'staff', status: 'active', lastName: 'Older', firstName: 'Record', badge: '', job: '', cells: {} };
  const out = await X.build(buf, { people: m.people.concat([joiner]) });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(out);
  const ws = wb.getWorksheet('Archer Ltd'); let found = false;
  ws.eachRow((row) => { if (String(row.getCell(1).value || '') === 'Older') found = true; });
  assert.ok(found, 'no tab recorded - behaves exactly as before');
});
