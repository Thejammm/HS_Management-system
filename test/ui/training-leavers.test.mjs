// ══════════════════════════════════════════════════════════════
//  Training matrix export - leavers, new people and deleted people (Simon,
//  12-13 November 2026: "the trining matrix export is not working" - "wrong
//  content"). The app says of someone moved to Left: "They are kept,
//  archived, and move to the Left tab on export" - and the export left them
//  on their tab. In the user's order: upload a matrix whose Staff tab is an
//  Excel table -> move someone to Left -> add a person -> delete a person ->
//  change a date -> reload -> export -> the message says what was done and
//  stays up long enough to read -> the file: the leaver on the Left tab, the
//  new person under the last one inside the table, the deleted one still
//  there -> import that file back -> read only -> first use with no data.
//  The server code runs for real in Node behind a bridge for /api/training.
//  Run: node test/ui/training-leavers.test.mjs
// ══════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { openApp, seed, wait, reporter } from './harness.mjs';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { parse, buildReport, buildFresh, peek } = require('../../lib/training-xlsx.js');

const R = reporter('Training matrix - leavers move to the Left tab on export');
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
// a made-up matrix shaped like a real one: Staff is an Excel table (as Excel saves it) with a cell note; a Left tab; a Garage tab
async function matrix(){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Staff');
  ws.addTable({ name: 'Table1', ref: 'A1', headerRow: true, style: { theme: 'TableStyleLight18', showRowStripes: true },
    columns: ['Last Name', 'First Name', 'Badge Number', 'Job', 'First Aid', 'Autism'].map(n => ({ name: n, filterButton: true })),
    rows: [['Morgan', 'Alex', '101', 'Driver', D(2027, 5, 1), 'Yes'], ['Kerr', 'Sam', '102', 'Escort', D(2026, 2, 1), 'Yes'], ['Bloggs', 'Jo', '103', 'Driver', 'N/A', ''], ['Patel', 'Chris', '104', 'Driver', D(2028, 3, 3), '']] });
  for(let r = 2; r <= 5; r++) ws.getCell('E' + r).numFmt = 'dd/mm/yyyy';
  ws.getCell('B3').note = 'Back in the spring';
  ws.getCell('B7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };   // blank formatted rows under the table
  const lf = wb.addWorksheet('Left'); lf.getRow(1).values = ['Last Name', 'First Name', 'Badge Number', 'Job', 'First Aid']; lf.getRow(2).values = ['Gone', 'Pat', '001', 'Driver', D(2025, 1, 1)]; lf.getCell('E2').numFmt = 'dd/mm/yyyy';
  const g = wb.addWorksheet('Garage Staff'); g.getRow(1).values = ['Last Name', 'First Name', 'Job', 'First Aid']; g.getRow(2).values = ['Wrench', 'Lee', 'Garage', D(2027, 1, 1)];
  const zip = await JSZip.loadAsync(Buffer.from(await wb.xlsx.writeBuffer()));
  zip.file('xl/tables/table1.xml', (await zip.file('xl/tables/table1.xml').async('string')).replace(/ headerRowCount="\d"/, '').replace(/<filterColumn [^>]*\/>/g, ''));
  return zip.generateAsync({ type: 'nodebuffer' });
}
const FILE = await matrix();
let stored = null; const exports = [];
await page.exposeFunction('__trnApi', async (path, b64) => {
  const body = Buffer.from(b64 || '', 'base64'), u = new URL('http://x' + path);
  if (u.pathname === '/api/training/peek') return { status: 200, json: await peek(body) };
  if (u.pathname === '/api/training/parse') { const model = await parse(body); return model.people.length ? { status: 200, json: model } : { status: 422, json: { error: 'no_people_found' } }; }
  if (u.pathname === '/api/training/store') { stored = body; return { status: 200, json: { ok: true } }; }
  if (u.pathname === '/api/training/export') { const state = JSON.parse(body.toString('utf8')).state;
    const headers = { 'content-disposition': 'attachment; filename="Matrix (rev).xlsx"' }; let buf;
    if (stored) { const out = await buildReport(stored, state); buf = Buffer.from(out.buffer);   // the header the route sends
      headers['X-Export-Report'] = encodeURIComponent(JSON.stringify({ moved: out.moved.length, movedNames: out.moved.slice(0, 6), notMoved: out.notMoved.length, noLeftTab: out.notMoved.filter(x => x.why === 'no Left tab').length, dropped: out.dropped.length, added: out.added, notRemoved: out.notRemoved, formulaKept: out.formulaKept })); }
    else buf = Buffer.from(await buildFresh(state));
    exports.push(buf); return { status: 200, b64: buf.toString('base64'), headers }; }
  return { status: 404, json: { error: 'not_here' } };
});
const bridge = () => page.evaluate(() => {
  window._tOnline = () => true; Auth.activeTenantId = () => 'test-tenant';
  window._tApiRaw = async (path, body) => {
    let b64 = ''; if (body instanceof ArrayBuffer) { const u = new Uint8Array(body); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); b64 = btoa(s); } else if (typeof body === 'string') b64 = btoa(unescape(encodeURIComponent(body)));
    const r = await window.__trnApi(path, b64);
    if (r.json) return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'Content-Type': 'application/json' } });
    const bin = atob(r.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Response(u, { status: r.status, headers: r.headers || {} });
  };
  window.__toasts = []; if (!window.__kt) { window.__kt = showToast; window.showToast = (m, ...a) => { window.__toasts.push(String(m)); return window.__kt(m, ...a); }; }
  URL.createObjectURL = () => 'blob:held'; HTMLAnchorElement.prototype.click = function(){ window.__downloaded = this.download; };
  if (document.getElementById('tab-monitoring').classList.contains('active')) renderMonitoring();
});
const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); });
const toasts = () => page.evaluate(() => { const t = window.__toasts.slice(); window.__toasts.length = 0; return t; });
async function upload(buf){ const [fc] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), page.evaluate(() => { const b = document.querySelector('#tab-monitoring button[onclick="trainingUploadXlsx()"]'); b.scrollIntoView({ block: 'center' }); b.click(); })]);
  const tmp = require('node:path').join(require('node:os').tmpdir(), 'compass-training-leavers-test.xlsx'); require('node:fs').writeFileSync(tmp, buf); await fc.accept([tmp]); await wait(page, 700); }
const state = () => page.evaluate(() => { const d = S.trainingData; return { active: d.people.filter(p => p.status === 'active').map(p => p.lastName).sort().join(','), left: d.people.filter(p => p.status === 'left').map(p => p.lastName).sort().join(','), archived: ([...document.querySelectorAll('#tab-monitoring details')].find(x => /^Left \/ archived/.test((x.querySelector('summary') || { innerText: '' }).innerText.trim())) || { textContent: '' }).textContent.replace(/\s+/g, ' ') }; });
const idOf = last => page.evaluate(l => (S.trainingData.people.find(p => p.lastName === l) || {}).id, last);
const txt = c => { const v = c.value; if (v instanceof Date) return v.toISOString().slice(0, 10); if (v && typeof v === 'object') return JSON.stringify(v); return v == null ? '' : String(v); };
const names = ws => { const out = []; ws.eachRow((row, r) => { if (r > 1 && txt(row.getCell(1))) out.push(txt(row.getCell(1))); }); return out.join(','); };

await seed(page, { company: { tradingName: 'Testing Client Ltd' } }, 'monitoring');
await bridge();
// ── upload: the matrix reads straight in ──
await upload(FILE);
{
  const s = await state();
  R.ok(!(await page.$('#xlsxMapOv')) && s.active === 'Bloggs,Kerr,Morgan,Patel,Wrench' && s.left === 'Gone', 'the matrix reads straight in: five current people, one already on the Left tab');
}
// ── move someone to Left ──
{
  dialogs.length = 0;
  const id = await idOf('Kerr');
  await page.evaluate(i => document.querySelector(`#tab-monitoring button[onclick="trainingOffboard('${i}')"]`).click(), id); await wait(page, 300);
  const s = await state();
  R.ok(/They are kept, archived, and move to the Left tab on export\./.test(dialogs[0] || ''), 'moving someone to Left says they move to the Left tab on export: ' + (dialogs[0] || '').slice(0, 90));
  R.ok(s.left === 'Gone,Kerr' && /Kerr, Sam/.test(s.archived), 'Sam Kerr is archived in Compass');
}
// ── add a person, delete a person, change a date ──
{
  await page.evaluate(() => document.querySelector('#tab-monitoring button[onclick="trainingAddPerson()"]').click()); await wait(page, 200);
  await page.type('#_tpF', 'Nia'); await page.type('#_tpL', 'Newman');
  await page.select('#_tpG', 'sheet:Staff'); await wait(page, 100);
  await page.evaluate(() => { document.querySelector('#_tpCols input[data-course="First Aid"]').value = '01/09/2028'; });
  await page.click('#_tpSave'); await wait(page, 300);
  dialogs.length = 0;
  const gone = await idOf('Wrench');
  await page.evaluate(i => document.querySelector(`#tab-monitoring button[onclick="trainingDeletePerson('${i}')"]`).click(), gone); await wait(page, 300);
  const pid = await idOf('Patel');
  await page.click(`#tab-monitoring [data-pid="${pid}"][data-course="First Aid"]`); await wait(page, 200);
  await page.$eval('#_tED', el => { el.value = '2030-01-31'; }); await page.click('#_tESave'); await wait(page, 300);
  const s = await state();
  R.ok(s.active === 'Bloggs,Morgan,Newman,Patel' && /Permanently delete Lee Wrench/.test(dialogs[0] || ''), 'a person added, a person deleted, a date changed: ' + s.active);
}
// ── reload ──
await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"'); await wait(page, 300);
await page.evaluate(() => switchTab('monitoring')); await wait(page, 300); await bridge();
// ── export ──
{
  await toasts();
  await page.evaluate(() => { const b = document.querySelector('#tab-monitoring button[onclick="trainingExportXlsx()"]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await wait(page, 800);
  const tt = (await toasts()).join(' | ');
  R.ok(/Sam Kerr moved to the Left tab\./.test(tt), 'the export says who moved to the Left tab: ' + tt);
  R.ok(/1 person deleted in Compass is still in the spreadsheet - remove them there if they should go\./.test(tt), 'and that the person deleted in Compass is still in the client\'s file');
  R.ok(/1 entry was not carried over - the Left tab has no column for it\./.test(tt), 'and that one of his entries has no column on the Left tab');
  await wait(page, 4200);
  R.ok(await page.evaluate(() => document.getElementById('toast').classList.contains('show')), 'a message with something to act on is still up after four seconds (every message used to go after three)');
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(exports[exports.length - 1]);
  const st = wb.getWorksheet('Staff'), lf = wb.getWorksheet('Left');
  R.ok(names(st) === 'Morgan,Bloggs,Patel,Newman', 'the Staff tab: the leaver gone, the others closed up in their order, the new person directly under the last: ' + names(st));
  R.ok(names(lf) === 'Gone,Kerr' && txt(lf.getCell('C3')) === '102' && txt(lf.getCell('E3')) === '2026-02-01' && !!lf.getCell('B3').note, 'the Left tab: Sam Kerr under the last leaver, with his badge, his date and the note that was on his name');
  R.ok(txt(st.getCell('E4')) === '2030-01-31' && txt(st.getCell('E5')) === '2028-09-01' && /d/.test(st.getCell('E5').numFmt || ''), 'the changed date is on the row Patel is now on; the new person\'s date is a date');
  R.ok(names(wb.getWorksheet('Garage Staff')) === 'Wrench', 'the person deleted in Compass is not deleted from the client\'s file');
  const z = await JSZip.loadAsync(exports[exports.length - 1]); const table = await z.file('xl/tables/table1.xml').async('string'), sheet = await z.file('xl/worksheets/sheet1.xml').async('string');
  R.ok(/ ref="A1:F5"/.test(table) && !/headerRowCount="0"/.test(table), 'the table ends on the last person and keeps its header row: ' + (/ ref="[^"]+"/.exec(table) || [''])[0]);
  R.ok(sheet.indexOf('<legacyDrawing') < 0 || sheet.indexOf('<legacyDrawing') < sheet.indexOf('<tableParts'), 'and the file is in the order Excel requires');
}
// ── a quick message still goes after about three seconds ──
{
  await page.evaluate(() => showToast('✓ Saved', 'success')); await wait(page, 3600);
  R.ok(!(await page.evaluate(() => document.getElementById('toast').classList.contains('show'))), 'an ordinary message still clears after about three seconds');
}
// ── import the exported file back ──
{
  dialogs.length = 0;
  await upload(exports[exports.length - 1]);
  const s = await state();
  R.ok(s.left === 'Gone,Kerr' && s.active === 'Bloggs,Morgan,Newman,Patel,Wrench', 'importing the exported file: Sam Kerr is read from the Left tab as left; the person not removed from the file is back, as the export warned: ' + s.active + ' / ' + s.left);
  await toasts();
  await page.evaluate(() => { const b = document.querySelector('#tab-monitoring button[onclick="trainingExportXlsx()"]'); b.click(); }); await wait(page, 700);
  const tt = (await toasts()).join(' | ');
  R.ok(/^✓ Exported Matrix \(rev\)\.xlsx$/.test(tt), 'with nothing moved or deleted the export just says it exported: ' + tt);
}
// ── read only ──
{
  const t = await page.evaluate(() => { const keep = window._roLocked; window._roLocked = () => true; renderMonitoring(); const n = document.querySelectorAll('#tab-monitoring button[onclick^="trainingOffboard("], #tab-monitoring button[onclick^="trainingDeletePerson("]').length; window._roLocked = keep; renderMonitoring(); return n; });
  R.ok(t === 0, 'read only: nobody can be moved to Left or deleted');
}
// ── first use ──
{
  await seed(page, { company: { tradingName: 'Testing Client Ltd' } }, 'monitoring'); await bridge();
  const t = await page.evaluate(() => ({ none: document.getElementById('tab-monitoring').innerText.includes('No training data yet'), exp: !!document.querySelector('#tab-monitoring button[onclick="trainingExportXlsx()"]') }));
  R.ok(t.none && !t.exp, 'with no matrix yet there is nothing to export');
}
await R.done(browser, errors);
