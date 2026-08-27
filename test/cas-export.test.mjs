// The CAS question-set workbook - run with: npm test
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

test('the workbook round-trips with every structural promise kept', async () => {
  const buf = await buildCasWorkbook({ client: 'Hartley Construction Ltd', trade: 'Construction; Scaffolding', rows });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('CAS question set');
  assert.ok(ws, 'question-set sheet missing');
  assert.ok(wb.getWorksheet('How to use'), 'how-to-use sheet missing');
  assert.equal(ws.rowCount, rows.length + 1);
  // client and trade lead every row so collated workbooks filter by who and what
  assert.equal(String(ws.getRow(2).getCell('A').value), 'Hartley Construction Ltd');
  assert.equal(String(ws.getRow(2).getCell('B').value), 'Construction; Scaffolding');
  // needs-your-answer derives: in scope + not Ready = Yes
  assert.equal(String(ws.getRow(2).getCell('J').value), 'No');   // Ready
  assert.equal(String(ws.getRow(3).getCell('J').value), 'Yes');  // Gap, in scope
  assert.equal(String(ws.getRow(4).getCell('J').value), 'No');   // out of scope
  // the filter spans the DATA - the header-only filter bug must never return
  assert.equal(typeof ws.autoFilter === 'string' ? ws.autoFilter : (ws.autoFilter && ws.autoFilter.to ? 'obj' : ''),
    typeof ws.autoFilter === 'string' ? 'A1:M' + (rows.length + 1) : 'obj');
  const af = typeof ws.autoFilter === 'string' ? ws.autoFilter : JSON.stringify(ws.autoFilter);
  assert.ok(af.includes(String(rows.length + 1)), 'autoFilter does not reach the last data row: ' + af);
  // BSA rows are present and named
  const texts = [];
  ws.eachRow(r => texts.push(r.values.map(v => String(v == null ? '' : v)).join('|')));
  assert.ok(texts.some(t => t.includes('Building Safety Act') && t.includes('135')), 'BSA row missing');
  assert.ok(texts.some(t => t.includes('Not in scope (Q23)')), 'scope reason missing');
  // the client answer dropdown exists on a data row
  const dv = ws.getRow(2).getCell('L').dataValidation;
  assert.ok(dv && dv.type === 'list' && String(dv.formulae[0]).includes('We have this'), 'answer dropdown missing');
  // evidence expectation column carries the doc type
  assert.ok(texts.some(t => t.includes('Statement / declaration')), 'evidence-expected column missing');
});

test('an empty payload is refused, not shipped hollow', async () => {
  await assert.rejects(() => buildCasWorkbook({ client: 'X', rows: [] }), /no_rows/);
});
