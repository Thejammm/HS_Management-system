// The CAS question-set workbook (triage shape) - run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildCasWorkbook } = require('../lib/cas-xlsx.js');
const ExcelJS = require('exceljs');

const rows = [
  { section: '1. Identity', q: '1-4', req: 'Legal name, trading name, registered and trading addresses', flags: '', docType: 'Company detail', scope: 'In scope', status: 'Ready', evidence: 'Companies House extract' },
  { section: '7. Building Safety Act', q: '135', req: 'BSA competence arrangements', flags: 'GATE', docType: 'Policy', scope: 'In scope', status: 'Gap', evidence: '' },
  { section: '7. Building Safety Act', q: '151', req: 'Higher-Risk Building golden thread', flags: '', docType: 'Statement / declaration', scope: 'Not in scope (Q23)', status: 'Unassessed', evidence: '' },
];

test('the workbook keeps the triage shape and its promises', async () => {
  const buf = await buildCasWorkbook({ client: 'Hartley Construction Ltd', trade: 'Construction; Scaffolding', rows });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('CAS question set');
  assert.ok(ws, 'question-set sheet missing');
  assert.ok(wb.getWorksheet('Read me'), 'read-me sheet missing');
  assert.equal(ws.rowCount, rows.length + 1);
  // nine columns, no more - the 13-column wall must not come back
  assert.equal(ws.columnCount, 9, 'column creep: ' + ws.columnCount);
  // client and trade lead every row so collated workbooks filter by who and what
  assert.equal(String(ws.getRow(2).getCell('A').value), 'Hartley Construction Ltd');
  assert.equal(String(ws.getRow(2).getCell('B').value), 'Construction; Scaffolding');
  // one status the reader parses at a glance - out-of-scope says so THERE
  assert.equal(String(ws.getRow(2).getCell('G').value), 'Ready');
  assert.equal(String(ws.getRow(3).getCell('G').value), 'Gap');
  assert.equal(String(ws.getRow(4).getCell('G').value), 'Not in scope (Q23)');
  // the filter spans the DATA - the header-only filter bug must never return
  const af = typeof ws.autoFilter === 'string' ? ws.autoFilter : JSON.stringify(ws.autoFilter);
  assert.ok(af.includes(String(rows.length + 1)), 'autoFilter does not reach the last data row: ' + af);
  // BSA rows present; evidence expectation carries the doc type
  const texts = [];
  ws.eachRow(r => texts.push(r.values.map(v => String(v == null ? '' : v)).join('|')));
  assert.ok(texts.some(t => t.includes('Building Safety Act') && t.includes('135')), 'BSA row missing');
  assert.ok(texts.some(t => t.includes('Statement / declaration')), 'evidence-expected column missing');
  // the client answer dropdown on a data row
  const dv = ws.getRow(2).getCell('H').dataValidation;
  assert.ok(dv && dv.type === 'list' && String(dv.formulae[0]).includes('We have this'), 'answer dropdown missing');
});

test('an empty payload is refused, not shipped hollow', async () => {
  await assert.rejects(() => buildCasWorkbook({ client: 'X', rows: [] }), /no_rows/);
});
