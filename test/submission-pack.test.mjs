// Submission pack - accreditation engine step 6. The folders, the filing of
// tagged records, the "AHS Ltd will" wording, the client reference and the two
// trackers, checked against the layout of the October 2026 EDL and ECL
// trackers. Node only (the trackers are built with the exceljs package, the
// same library the app loads from cdnjs). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';
import ExcelJS from 'exceljs';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const R = p => path.join(here, '..', p);
const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['cl-bank.js', 'accred-core.js', 'cl-pack.js']) vm.runInContext(fs.readFileSync(R('public/reports/' + f), 'utf8'), ctx);
const A = ctx.AccredCore, P = ctx.CLPack;
const J = x => JSON.parse(JSON.stringify(x));
const TODAY = '2026-10-13';
const client = (set, extra) => Object.assign({ company: { legalName: set === 'designer' ? 'Example Design Ltd' : 'Example Contracting Ltd', shortName: set === 'designer' ? 'EDL' : 'ECL' },
  accred: { roles: [set], schemes: { cl: { on: true } }, answers: {}, cl: { valid: { 'Health and Safety': '2026-08-05', 'Once For All Health & Safety - (SSIP)': '2026-09-26', Insurances: '2027-03-24', Quality: '2027-07-17' } },
    package: { id: 'standard', start: '2026-11', dayRate: '500' } } }, extra || {});

test('the folders match the EDL (designer) and ECL (contractor) submissions', () => {
  const edl = ['01 Company Information', '02 Insurance', '03 Health and Safety and SSIP', '04 Training and Competence', '05 CDM and Building Safety', '06 Quality and Environment',
    '07 Equality and Harassment', '08 Anti-Bribery Fraud and Tax Evasion', '09 Modern Slavery and Right to Work', '10 Whistleblowing and Communication Evidence', '11 Data Protection',
    '12 Social Value and Wellbeing', '99 Do Not Upload - Old Versions'];
  assert.deepEqual(J(P.foldersFor('designer')), edl);
  assert.deepEqual(J(P.foldersFor('contractor')), edl.slice(0, 12).concat(['13 Site Evidence', '99 Do Not Upload - Old Versions']));
});

test('tagged records are filed where the example submissions put them', () => {
  const it = (o) => Object.assign({ kind: 'doc', title: 'x', dated: '2026-09-01', qids: [], source: '' }, o);
  assert.equal(P.folderFor(it({ qids: ['HS-02'] }), 'designer', TODAY), '03 Health and Safety and SSIP');
  assert.equal(P.folderFor(it({ qids: ['HS-06'] }), 'contractor', TODAY), '12 Social Value and Wellbeing', 'drug and alcohol policy sits in 12, as in both examples');
  assert.equal(P.folderFor(it({ qids: ['DS-02'] }), 'designer', TODAY), '05 CDM and Building Safety');
  assert.equal(P.folderFor(it({ qids: ['CN-01'] }), 'contractor', TODAY), '13 Site Evidence', 'RAMS for a contractor');
  assert.equal(P.folderFor(it({ kind: 'visit', qids: ['HS-15'] }), 'contractor', TODAY), '13 Site Evidence');
  assert.equal(P.folderFor(it({ kind: 'visit', qids: ['HS-15'] }), 'designer', TODAY), '03 Health and Safety and SSIP', 'a designer has no 13');
  assert.equal(P.folderFor(it({ kind: 'toolbox', qids: ['HS-17'] }), 'contractor', TODAY), '13 Site Evidence');
  assert.equal(P.folderFor(it({ kind: 'toolbox', qids: ['HS-17'] }), 'designer', TODAY), '10 Whistleblowing and Communication Evidence');
  assert.equal(P.folderFor(it({ title: 'Insurance schedule' }), 'designer', TODAY), '02 Insurance', 'an untagged insurance document by its name');
  assert.equal(P.folderFor(it({ qids: ['HS-02'], dated: '2025-09-01' }), 'designer', TODAY), '99 Do Not Upload - Old Versions', 'older than 12 months');
  assert.equal(P.folderFor(it({ title: 'Van checklist' }), 'designer', TODAY), '', 'untagged and unnamed: not filed');
  // every CAS question has a folder
  A.MASTER.questions.forEach(q => assert.ok(P.folderOfQ(q.id), q.id + ' has a folder'));
});

test('the client copy says what AHS Ltd will do', () => {
  assert.equal(P.willWording('AHS Ltd has rewritten 01 and 01a. EDL to answer 4 survey questions.'), 'AHS Ltd will rewrite 01 and 01a. EDL to answer 4 survey questions.');
  assert.equal(P.willWording('AHS Ltd has updated policy 11. AHS Ltd enters it in the portal.'), 'AHS Ltd will update policy 11. AHS Ltd will enter it in the portal.');
  assert.equal(P.willWording('AHS Ltd prepares it. AHS Ltd uploads them from folder 13.'), 'AHS Ltd will prepare it. AHS Ltd will upload them from folder 13.');
  assert.equal(P.willWording('AHS Ltd has frobbed it. AHS Ltd will check.'), 'AHS Ltd has frobbed it. AHS Ltd will check.', 'a verb it does not know is left alone');
});

test('one reference per client, in the AHS-<short>-<yymm>-<hex> form', () => {
  assert.equal(P.issueRef('EDL', TODAY, 0x00e6), 'AHS-EDL-2610-00E6', 'the form of the EDL client issue reference');
  assert.match(P.issueRef('Example Contracting', TODAY), /^AHS-EXAMPLEC-2610-[0-9A-F]{4}$/);
});

test('a shortcut to where a file lives: a web link, a local path or a network path', () => {
  assert.equal(P.shortcut('https://x.example/a.pdf'), '[InternetShortcut]\r\nURL=https://x.example/a.pdf\r\n');
  assert.equal(P.shortcut('C:\\Docs\\ins.pdf'), '[InternetShortcut]\r\nURL=file:///C:/Docs/ins.pdf\r\n');
  assert.equal(P.shortcut('"\\\\server\\share\\a.pdf"'), '[InternetShortcut]\r\nURL=file://server/share/a.pdf\r\n');
  assert.equal(P.shortcut(''), null);
});

test('the pack data: tracker lines in tracker order, verified sections one line each, BSA last', () => {
  const d = P.packData(A, client('designer'), TODAY, { ref: 'AHS-EDL-2610-00E6' });
  const secs = d.rows.filter(r => r.type === 'section').map(r => r.text);
  assert.equal(secs[0], 'Health and Safety and Once For All Health & Safety - (SSIP) (expired)');
  const v = secs.indexOf('Already verified in Constructionline (no action now)');
  assert.ok(v > 0, 'the already verified group');
  assert.ok(secs.slice(v + 1).every(s => /^Building Safety Act/.test(s)), 'only the Building Safety Act sections follow it');
  const ins = d.rows.find(r => r.type === 'line' && r.q === 'Insurances');
  assert.deepEqual(J([ins.ev, ins.act, ins.stLabel, ins.hsValid]), ['Verified to March 2027.', 'None needed now.', 'Already in Constructionline', '2027-03-24']);
  assert.deepEqual(J(d.rows.filter(r => r.type === 'line').map(r => r.no)), J(d.rows.filter(r => r.type === 'line').map((r, i) => i + 1)), 'numbered 1 to n');
  assert.equal(d.priceList.packageLabel, 'Standard');
  assert.ok(d.plan.some(p => p.activity === 'CDM designer good practice audit'), 'the annual service plan from the package');
});

test('the trackers are laid out as the EDL and ECL trackers', async () => {
  const d = P.packData(A, client('designer'), TODAY, { ref: 'AHS-EDL-2610-00E6' });
  for (const copy of [false, true]) {
    const buf = await P.buildTracker(ExcelJS, d, copy, A).xlsx.writeBuffer();
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    assert.deepEqual(wb.worksheets.map(w => w.name), copy ? ['Constructionline Gold', 'Price List', 'Annual Service Plan', 'CL Question Bank (Designer)'] : ['Constructionline Gold', 'Annual Service Plan', 'CL Question Bank (Designer)']);
    const ws = wb.worksheets[0];
    assert.equal(ws.getCell('A1').value, 'EDL & AHS Ltd: Constructionline Gold, October 2026' + (copy ? ' (client copy)' : ''));
    assert.deepEqual(ws.getRow(8).values.slice(1), ['No', 'Constructionline question', 'Expected evidence', 'Action', 'Status', 'H&S ref (and other sections)', 'Valid until (Constructionline)', 'SSIP ref', 'SSIP valid until (Constructionline)', 'Done']);
    assert.deepEqual(ws.columns.map(c => c.width), [5, 40, 46, 46, 20, 16, 14, 14, 14, 10]);
    assert.deepEqual(['B3', 'B4', 'B5', 'B6'].map(c => ws.getCell(c).value), ['EDL to do', 'AHS Ltd to do', 'Covered or already in Constructionline', 'Ticked done']);
    assert.match(ws.getCell('C3').value.formula, /^COUNTIFS\(E9:E\d+,"EDL",J9:J\d+,""\)\+COUNTIFS\(E9:E\d+,"AHS Ltd, then EDL signs",J9:J\d+,""\)$/);
    assert.equal(ws.views[0].state, 'frozen'); assert.equal(ws.views[0].ySplit, 8);
    assert.equal(ws.getCell('A9').value, 'Health and Safety and Once For All Health & Safety - (SSIP) (expired)');
    assert.equal(ws.getCell('A9').fill.fgColor.argb, 'FF38A8C2');
    assert.ok(ws.model.merges.includes('A9:J9'), 'section rows span the table');
    // the first line: the SSIP certificate question with its expiry date as a real date
    assert.equal(ws.getCell('F10').value, '13131');
    assert.equal(typeof ws.getCell('G10').value === 'number' || ws.getCell('G10').value instanceof Date, true);
    assert.equal(ws.getCell('G10').numFmt, 'dd/mm/yyyy');
    const cf = ws.conditionalFormattings.map(c => c.ref.split(':')[0]);
    assert.deepEqual(cf, ['G9', 'I9'], 'the expiry colours on both date columns');
    const acts = []; ws.eachRow((r, n) => { if (n > 8) acts.push(String(r.getCell(4).value || '')); });
    if (copy) assert.ok(acts.some(a => /^AHS Ltd will /.test(a)) && !acts.some(a => /AHS Ltd (enters|prepares) /.test(a)), 'the client copy says "AHS Ltd will"');
    else assert.ok(acts.some(a => /^AHS Ltd enters /.test(a)), 'the AHS tracker keeps its own wording');
    if (copy) {
      const pl = wb.getWorksheet('Price List');
      assert.equal(pl.getCell('A1').value, 'AHS Ltd services for EDL: Constructionline Gold 2026 (Standard package)');
      assert.equal(pl.getCell('C4').value, 500);
      assert.deepEqual(pl.getRow(6).values.slice(1), ['No', 'Service', 'Days', 'Cost (\u00A3)']);
    }
  }
});
