// ══════════════════════════════════════════════════════════════
//  Training matrix export (Simon, 12 November 2026: "the excel export didnt
//  work" - "wrong content"). A matrix brought in through the mapping screen
//  (headings under a title block, one Name column) could not be found again
//  by the export's automatic read, so every change made in Compass was missing
//  from the exported file, and adding a person broke the export. In the
//  user's order: upload -> the mapping screen -> click the headings row ->
//  import -> change a date and set a status in the matrix -> reload ->
//  export: exactly those cells changed -> add a person -> export: their row is
//  there -> a matrix the automatic read finds is unchanged -> read only.
//  The server code runs for real in Node behind a bridge for /api/training.
//  Run: node test/ui/training-export.test.mjs
// ══════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { openApp, seed, wait, reporter } from './harness.mjs';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const { parse, build, buildFresh, peek } = require('../../lib/training-xlsx.js');

const R = reporter('Training matrix - the export writes back what was changed');
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
// a made-up matrix shaped like a real one: a title block, headings on row 4, a numbered first column, one Name column
async function mapped(){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Training Matrix');
  ws.getCell('B1').value = 'Testing Client Ltd - Training Matrix';
  ws.getCell('B2').value = 'Updated monthly';
  ws.getRow(4).values = ['', 'Name', 'Role', 'First Aid', 'Fire Marshal'];
  [['1', 'Alex Morgan', 'Director', D(2027, 5, 1), 'P'], ['2', 'Sam Kerr', 'Fitter', D(2026, 2, 1), 'NA'], ['3', 'Jo Bloggs', 'Fitter', null, 'P']].forEach((r, i) => {
    const row = ws.getRow(5 + i); r.forEach((v, c) => { row.getCell(c + 1).value = v; }); row.getCell(4).numFmt = 'dd/mm/yyyy'; row.getCell(2).font = { bold: true };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function auto(){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Staff');
  ws.getRow(1).values = ['Last Name', 'First Name', 'Job', 'First Aid'];
  ws.getRow(2).values = ['Morgan', 'Alex', 'Director', D(2027, 5, 1)]; ws.getCell('D2').numFmt = 'dd/mm/yyyy';
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const MAPPED = await mapped(), AUTO = await auto();
let stored = null; const exports = [];
await page.exposeFunction('__trnApi', async (path, b64) => {
  const body = Buffer.from(b64 || '', 'base64'), u = new URL('http://x' + path), q = Object.fromEntries(u.searchParams);
  if (u.pathname === '/api/training/peek') return { status: 200, json: await peek(body) };
  if (u.pathname === '/api/training/parse') { const m = q.mapping ? JSON.parse(q.mapping) : null; const hr = parseInt(q.headerRow || '', 10) || 0;
    const model = await parse(body, Object.assign({}, hr ? { headerRow: hr } : {}, m ? { fixed: m.fixed || null, skip: m.skip || [] } : {}));
    return model.people.length ? { status: 200, json: model } : { status: 422, json: { error: 'no_people_found' } }; }
  if (u.pathname === '/api/training/store') { stored = body; return { status: 200, json: { ok: true } }; }
  if (u.pathname === '/api/training/export') { const state = JSON.parse(body.toString('utf8')).state;
    const buf = Buffer.from(stored ? await build(stored, state) : await buildFresh(state)); exports.push(buf);
    return { status: 200, b64: buf.toString('base64'), headers: { 'content-disposition': 'attachment; filename="Matrix (rev).xlsx"' } }; }
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
  URL.createObjectURL = () => 'blob:held'; HTMLAnchorElement.prototype.click = function(){ window.__downloaded = this.download; };
  if (document.getElementById('tab-monitoring').classList.contains('active')) renderMonitoring();
});
async function upload(buf){ const [fc] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), page.evaluate(() => { const b = document.querySelector('#tab-monitoring button[onclick="trainingUploadXlsx()"]'); b.scrollIntoView({ block: 'center' }); b.click(); })]);
  const tmp = require('node:path').join(require('node:os').tmpdir(), 'compass-training-export-test.xlsx'); require('node:fs').writeFileSync(tmp, buf); await fc.accept([tmp]); await wait(page, 700); }
const cellOf = (pid, course) => `#tab-monitoring [data-pid="${pid}"][data-course="${course}"]`;
const exportNow = async () => { await page.evaluate(() => { const b = document.querySelector('#tab-monitoring button[onclick="trainingExportXlsx()"]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await wait(page, 700); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(exports[exports.length - 1]); return wb; };
const show = c => { const v = c.value; if (v instanceof Date) return v.toISOString().slice(0, 10); if (v && typeof v === 'object') return JSON.stringify(v); return String(v == null ? '' : v); };
async function diff(aBuf, b){ const a = new ExcelJS.Workbook(); await a.xlsx.load(aBuf); const out = [];
  a.worksheets.forEach(ws => { const w2 = b.getWorksheet(ws.name); const R2 = Math.max(ws.rowCount, w2.rowCount), C = Math.max(ws.columnCount, w2.columnCount);
    for (let r = 1; r <= R2; r++) for (let c = 1; c <= C; c++) { if (show(ws.getRow(r).getCell(c)) !== show(w2.getRow(r).getCell(c))) out.push(ws.getRow(r).getCell(c).address); } });
  return out; }

await seed(page, { company: { tradingName: 'Testing Client Ltd' } }, 'monitoring');
await bridge();
// ── import through the mapping screen ──
await upload(MAPPED);
{
  const t = await page.evaluate(() => document.querySelector('#xlsxMapOv') && document.querySelector('#xlsxMapOv').innerText.split('\n')[0]);
  R.ok(/step 1 of 2/.test(t || ''), 'the automatic read cannot find the table under the title block, so the mapping screen opens');
  await page.click('#xlsxMapOv tr[data-row="4"]'); await wait(page, 300);
  const m = await page.evaluate(() => [...document.querySelectorAll('#xlsxMapOv select')].map(s => s.value).join(','));
  R.ok(m === 'skip,full,job,course,course', 'headings on row 4: Name is the whole name, Role the job, the numbered column skipped: ' + m);
  await page.evaluate(() => [...document.querySelectorAll('#xlsxMapOv button')].find(x => /^Import/.test(x.innerText.trim())).click()); await wait(page, 700);
}
const ids = await page.evaluate(() => Object.fromEntries((S.trainingData.people || []).map(p => [p.firstName, p.id])));
R.ok(Object.keys(ids).join() === 'Alex Morgan,Sam Kerr,Jo Bloggs', 'three people in the matrix: ' + Object.keys(ids).join(', '));
// ── change a date and set a status, the way it is done in the matrix ──
{
  await page.click(cellOf(ids['Alex Morgan'], 'First Aid')); await wait(page, 200);
  await page.$eval('#_tED', el => { el.value = '2029-06-30'; }); await page.click('#_tESave'); await wait(page, 300);
  await page.click(cellOf(ids['Sam Kerr'], 'Fire Marshal')); await wait(page, 200);
  await page.$eval('#_tED', el => { el.value = '2028-01-15'; }); await page.click('#_tESave'); await wait(page, 300);
  await page.click(cellOf(ids['Jo Bloggs'], 'Fire Marshal')); await wait(page, 200);
  await page.evaluate(() => [...document.querySelectorAll('button[data-s]')].find(b => b.dataset.s === 'Trainer').click()); await wait(page, 300);
}
// ── reload ──
await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"'); await wait(page, 300);
await page.evaluate(() => switchTab('monitoring')); await wait(page, 300); await bridge();
// ── export: exactly the changed cells ──
{
  const wb = await exportNow(); const ws = wb.getWorksheet('Training Matrix');
  const d = await diff(MAPPED, wb);
  R.ok(d.sort().join() === ['D5', 'E6', 'E7'].sort().join(), 'the export holds the three changes and nothing else: ' + d.join(' '));
  R.ok(show(ws.getCell('D5')) === '2029-06-30', 'the new First Aid date is in Alex\'s row');
  R.ok(show(ws.getCell('E6')) === '2028-01-15' && /d/.test(ws.getCell('E6').numFmt || ''), 'a date put where "NA" was shows as a date, not a number like 47118: ' + ws.getCell('E6').numFmt);
  R.ok(show(ws.getCell('E7')) === 'Trainer', 'a status is written as its word');
  R.ok(ws.getCell('B5').font && ws.getCell('B5').font.bold && ws.getCell('B1').value === 'Testing Client Ltd - Training Matrix', 'the title block and the formatting are the client\'s, untouched');
}
// ── add a person ──
{
  await page.evaluate(() => document.querySelector('#tab-monitoring button[onclick="trainingAddPerson()"]').click()); await wait(page, 200);
  await page.type('#_tpF', 'Chris'); await page.type('#_tpL', 'Patel');
  await page.evaluate(() => { const i = document.querySelector('#_tpCols input[data-course="First Aid"]'); i.value = '01/09/2028'; });
  await page.click('#_tpSave'); await wait(page, 300);
  const wb = await exportNow(); const ws = wb.getWorksheet('Training Matrix');
  R.ok(ws.getCell('B8').value === 'Chris Patel' && show(ws.getCell('D8')) === '2028-09-01' && /d/.test(ws.getCell('D8').numFmt || ''), 'a person added in Compass is a new row: their name in the Name column, the date as a date: ' + show(ws.getCell('B8')) + ' / ' + show(ws.getCell('D8')));
  R.ok(show(ws.getCell('D5')) === '2029-06-30', 'and the earlier change is still there');
}
// ── a matrix the automatic read finds exports as before ──
{
  await seed(page, { company: { tradingName: 'Testing Client Ltd' } }, 'monitoring'); await bridge();
  await upload(AUTO);
  const id = await page.evaluate(() => (S.trainingData.people[0] || {}).id);
  await page.click(cellOf(id, 'First Aid')); await wait(page, 200);
  await page.$eval('#_tED', el => { el.value = '2030-01-31'; }); await page.click('#_tESave'); await wait(page, 300);
  const wb = await exportNow();
  R.ok(!(await page.$('#xlsxMapOv')) && show(wb.getWorksheet('Staff').getCell('D2')) === '2030-01-31' && (await diff(AUTO, wb)).join() === 'D2', 'a matrix with Last Name / First Name headings imports straight in and exports its change as before');
}
// ── read only ──
{
  const t = await page.evaluate(() => { const keep = window._roLocked; window._roLocked = () => true; renderMonitoring(); const n = document.querySelectorAll('#tab-monitoring [data-pid][onclick^="trainingEditCellEl"]').length; window._roLocked = keep; renderMonitoring(); return n; });
  R.ok(t === 0, 'read only: no cell opens for editing');
}
await R.done(browser, errors);
