// ══════════════════════════════════════════════════════════════
//  Training matrix import - the matrix's own mapping screen (Simon, 12-13
//  November 2026: "check the training matrix import it wont read a
//  spreadsheet", "Yes, fix the import"). In the user's order, with two
//  made-up workbooks shaped like the real ones:
//    1. three dated tabs of one list, headings over two rows: upload ->
//       pick the tab -> click the headings row -> the tabs with a tick each
//       (another version of the same list is left unticked, and says why) ->
//       the columns under the names they will carry -> untick "two rows" and
//       back -> tick a second tab -> import -> the confirm -> two tables ->
//       reload -> upload again: straight to the columns, as left -> Back.
//    2. one matrix tab among others, a key under the table, month headings:
//       upload -> the other tabs named as not brought in -> the name column
//       changed and put back -> import -> the confirm -> the people only.
//  Then read only, and first use with no data.
//  The server code runs for real in Node behind a bridge for /api/training.
//  Run: node test/ui/training-import.test.mjs
// ══════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { openApp, seed, wait, reporter } from './harness.mjs';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const { parse, layout, buildReport, buildFresh, peek } = require('../../lib/training-xlsx.js');

const R = reporter('Training matrix import - pick the tab, tick the tabs');
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
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
async function attendance(){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Training Matrix');
  ws.getCell('B2').value = 'Testing Client Ltd - Training Record';
  ws.getRow(4).values = ['', 'Name', 'Role', 'Basis', 'Weekly'];
  ws.getRow(4).getCell(6).value = D(2025, 1, 1); ws.getRow(4).getCell(6).numFmt = 'mmm-yy'; ws.getRow(4).getCell(7).value = D(2025, 2, 1); ws.getRow(4).getCell(7).numFmt = 'mmm-yy';
  ws.getRow(5).values = ['1', 'Alex Morgan', 'Director', 'Employee', 'P', 'P', 'P']; ws.getRow(6).values = ['2', 'Sam Kerr', 'Fitter', 'Employee', 'P', '', 'P']; ws.getRow(7).values = ['3', 'Jo Bloggs', 'Fitter', 'Employee', 'P', 'P', ''];
  ws.getCell('B9').value = 'P = present. Yellow cells: attendance from the office diary.';
  const q = wb.addWorksheet('Qualifications'); q.getRow(2).values = ['Name', 'Role', 'Qualifications']; q.getRow(3).values = ['Alex Morgan', 'Director', 'C&G 236'];
  const c = wb.addWorksheet('Certificates'); c.getRow(4).values = ['Name', 'Course or card', 'Expiry']; c.getRow(5).values = ['Alex Morgan', 'CSCS card', D(2027, 1, 1)];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const DATED = await dated(), ATT = await attendance();
let stored = null; const exports = [], calls = [];
await page.exposeFunction('__trnApi', async (path, b64) => {
  const body = Buffer.from(b64 || '', 'base64'), u = new URL('http://x' + path), q = Object.fromEntries(u.searchParams);
  calls.push(u.pathname.replace('/api/training/', ''));
  if (u.pathname === '/api/training/peek') return { status: 200, json: await peek(body) };
  if (u.pathname === '/api/training/layout') { const hr2 = parseInt(q.headRows || '', 10);
    return { status: 200, json: await layout(body, { sheet: q.sheet || '', headerRow: parseInt(q.headerRow || '', 10) || 1, headRows: (hr2 === 1 || hr2 === 2) ? hr2 : undefined, fixed: q.fixed ? JSON.parse(q.fixed) : {} }) }; }
  if (u.pathname === '/api/training/parse') { const m = q.mapping ? JSON.parse(q.mapping) : null; const hr = parseInt(q.headerRow || '', 10) || 0;
    const model = await parse(body, Object.assign({}, hr ? { headerRow: hr } : {}, m ? { fixed: m.fixed || null, skip: m.skip || [], sheet: m.sheet, headRows: m.headRows, tabs: m.tabs } : {}));
    return model.people.length ? { status: 200, json: model } : { status: 422, json: { error: 'no_people_found' } }; }
  if (u.pathname === '/api/training/store') { stored = body; return { status: 200, json: { ok: true } }; }
  if (u.pathname === '/api/training/export') { const state = JSON.parse(body.toString('utf8')).state; const buf = Buffer.from(stored ? (await buildReport(stored, state)).buffer : await buildFresh(state)); exports.push(buf);
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
const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); });
async function upload(buf){ const [fc] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), page.evaluate(() => { const b = document.querySelector('#tab-monitoring button[onclick="trainingUploadXlsx()"]'); b.scrollIntoView({ block: 'center' }); b.click(); })]);
  const tmp = require('node:path').join(require('node:os').tmpdir(), 'compass-training-import-test.xlsx'); require('node:fs').writeFileSync(tmp, buf); await fc.accept([tmp]); await page.waitForSelector('#xlsxMapOv', { timeout: 10000 }); await wait(page, 300); }
const wiz = () => page.evaluate(() => { const ov = document.getElementById('xlsxMapOv'); if (!ov) return null; return {
  title: ov.innerText.split('\n')[0], strip: [...ov.querySelectorAll('button[data-sheet]')].map(b => b.innerText.trim() + (b.classList.contains('btn-primary') ? '*' : '')),
  tabs: [...ov.querySelectorAll('#_twTabs label')].map(l => (l.querySelector('input').checked ? '[x] ' : '[ ] ') + l.innerText.replace(/\s+/g, ' ').trim() + (l.querySelector('input').disabled ? ' (locked)' : '')),
  out: (ov.querySelector('#_twOut') || { innerText: '' }).innerText.trim(), hint: (ov.querySelector('#_twTabs') || { innerText: '' }).innerText.replace(/\s+/g, ' ').trim(),
  two: ov.querySelector('#_twTwo') ? ov.querySelector('#_twTwo').checked : null,
  cols: [...ov.querySelectorAll('select[data-col]')].map(s => s.closest('tr').children[0].innerText.trim() + '=' + s.value), samples: [...ov.querySelectorAll('select[data-col]')].map(s => s.closest('tr').children[2].innerText.trim()) }; });
const step2 = async () => { await page.waitForSelector('#xlsxMapOv #_mwGo', { timeout: 10000 }); await wait(page, 250); };
const matrix = () => page.evaluate(() => ({ people: S.trainingData.people.length, tables: [...document.querySelectorAll('#tab-monitoring [data-keepscroll^="trn-"]')].map(d => ({ label: d.previousElementSibling.innerText.replace(/\s+/g, ' ').trim(), heads: [...d.querySelectorAll('thead th')].map(t => t.innerText.trim()).filter(Boolean), names: [...d.querySelectorAll('tbody tr td:first-child')].map(t => t.innerText.trim()) })) }));

await seed(page, { company: { tradingName: 'Testing Client Ltd' } }, 'monitoring');
await bridge();
// ══ 1. three dated tabs of one list ══
await upload(DATED);
{
  const w = await wiz();
  R.ok(/step 1 of 2/.test(w.title) && w.strip.join(',') === 'Cards Aug 25*,Skills Oct 25,Skills Aug 26', 'step 1 shows the workbook\'s tabs to pick from, the first one showing: ' + w.strip.join(', '));
  R.ok(/Pick the tab the matrix is on, then click the row that holds the column headings/.test(await page.$eval('#xlsxMapOv', e => e.innerText.replace(/\s+/g, ' '))), 'and says to pick the tab, then the headings row');
  await page.evaluate(() => [...document.querySelectorAll('#xlsxMapOv button[data-sheet]')].find(b => b.innerText.trim() === 'Skills Aug 26').click()); await wait(page, 200);
  const w2 = await wiz(); const cell = await page.$eval('#xlsxMapOv tr[data-row="6"]', tr => tr.children[1].innerText.trim());
  R.ok(w2.strip.join(',') === 'Cards Aug 25,Skills Oct 25,Skills Aug 26*' && cell === 'Nia Newman', 'clicking a tab shows that tab\'s rows');
  await page.click('#xlsxMapOv tr[data-row="2"]'); await step2();
}
{
  const w = await wiz();
  R.ok(w.title === 'Map the columns step 2 of 2 - "Skills Aug 26", headings on row 2 and 3' && w.two === true, 'step 2 names the tab and has seen the headings run over two rows: ' + w.title);
  R.ok(w.tabs.join(' | ') === '[ ] Cards Aug 25 - 3 people, 2 also on "Skills Aug 26" - looks like another version of the same list | [ ] Skills Oct 25 - 2 people, all also on "Skills Aug 26" - looks like another version of the same list | [x] Skills Aug 26 - this tab, 3 people (locked)',
    'the tabs: the chosen one ticked and locked; the two that repeat its people left unticked, saying why: ' + w.tabs.join(' | '));
  R.ok(w.cols.join(' | ') === 'Name=full | Title=job | Ductwork Skillcard - Started NVQ L3=course | Ductwork Skillcard - Blue Card=course | Fire Dampers=course', 'each column under the name it will carry; Name is the name and Title the job: ' + w.cols.join(' | '));
  R.ok(w.samples[0] === 'Alex Morgan · Sam Kerr · Nia Newman' && w.samples[2] === 'Grandfather · Completed · NA', 'the samples are from below both heading rows');
  const wrap = await page.$eval('#xlsxMapOv select[data-col="3"]', s => getComputedStyle(s.closest('tr').children[0]).whiteSpace);
  R.ok(wrap === 'normal', 'a long column name wraps, so the part that tells two columns apart is not cut off');
  // one row of headings instead: the names change, and the two columns are still kept apart
  await page.click('#_twTwo'); await step2();
  const one = await wiz();
  R.ok(one.two === false && /headings on row 2$/.test(one.title) && one.cols.join(' | ') === 'Name=full | Title=job | Ductwork Skillcard=course | Ductwork Skillcard (2)=course | Fire Dampers=course', 'unticking "two rows" names the columns by the one row: ' + one.cols.slice(2).join(' | '));
  await page.click('#_twTwo'); await step2();
  // bring the cards tab in as well
  await page.evaluate(() => document.querySelector('#_twTabs input[data-tab="Cards Aug 25"]').click()); await wait(page, 100);
  dialogs.length = 0; await page.click('#_mwGo'); await wait(page, 700);
}
{
  const c = dialogs.find(d => /REPLACES/.test(d)) || '';
  R.ok(/6 people in the sheet/.test(c) && /from 2 tabs: Cards Aug 25, Skills Aug 26/.test(c) && /not ticked: Skills Oct 25/.test(c), 'the confirm says how many people, from which tabs, and which tab was not ticked: ' + c.split('\n').filter(l => /•/.test(l)).join(' / '));
  const m = await matrix();
  R.ok(m.people === 6 && m.tables.map(t => t.label).join(' | ') === 'Cards Aug 25 (3) | Skills Aug 26 (3)', 'each ticked tab is its own table: ' + m.tables.map(t => t.label).join(' | '));
  R.ok(m.tables[0].heads.join(' | ') === 'NAME | CSCS - EXPIRY DATE | IPAF - EXPIRY DATE' && m.tables[1].heads.join(' | ') === 'NAME | DUCTWORK SKILLCARD - STARTED NVQ L3 | DUCTWORK SKILLCARD - BLUE CARD | FIRE DAMPERS', 'with its own columns, each under both heading rows');
  const cell = await page.evaluate(() => { const p = S.trainingData.people.find(x => x.sheet === 'Skills Aug 26' && x.firstName === 'Sam Kerr'); return { a: p.cells['Ductwork Skillcard - Started NVQ L3'].v, b: p.cells['Ductwork Skillcard - Blue Card'].v, job: p.job }; });
  R.ok(cell.a === 'Completed' && cell.b === 'NVQ L2' && cell.job === 'Fitter', 'the two columns under one group heading are no longer run together: ' + JSON.stringify(cell));
  const wrap = await page.evaluate(() => { const th = [...document.querySelectorAll('#tab-monitoring [data-keepscroll^="trn-"] thead th')].find(t => /STARTED NVQ L3/.test(t.innerText)); return getComputedStyle(th).whiteSpace; });
  R.ok(wrap === 'normal', 'a long heading wraps in the matrix instead of stretching it');
}
// ── reload, then the same workbook again ──
await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"'); await wait(page, 300);
await page.evaluate(() => switchTab('monitoring')); await wait(page, 300); await bridge();
{
  const m = await matrix(); R.ok(m.people === 6 && m.tables.length === 2, 'after a reload the matrix is as left');
  calls.length = 0; await upload(DATED); await step2();
  const w = await wiz();
  R.ok(/step 2 of 2 - "Skills Aug 26", headings on row 2 and 3/.test(w.title), 'the same workbook again opens straight on the columns: ' + w.title);
  R.ok(w.tabs.filter(t => t.startsWith('[x]')).map(t => t.split(' - ')[0]).join() === '[x] Cards Aug 25,[x] Skills Aug 26', 'with the tabs ticked as they were left: ' + w.tabs.map(t => t.slice(0, 20)).join(' | '));
  await page.click('#_mwBack'); await wait(page, 200);
  const b = await wiz();
  R.ok(/step 1 of 2/.test(b.title) && b.strip.join(',') === 'Cards Aug 25,Skills Oct 25,Skills Aug 26*', 'Back shows the tabs, the one used last time picked');
  await page.click('#_mwCancel'); await wait(page, 150);
  R.ok(!(await page.$('#xlsxMapOv')) && (await matrix()).people === 6, 'Cancel leaves the matrix as it was');
}
// ══ 2. one matrix tab among others, a key under the table, month headings ══
{
  await upload(ATT);
  const w = await wiz();
  R.ok(/step 1 of 2/.test(w.title) && w.strip[0] === 'Training Matrix*', 'a workbook with different tabs starts at step 1: ' + w.strip.join(', '));
  await page.click('#xlsxMapOv tr[data-row="4"]'); await step2();
  const s = await wiz();
  R.ok(s.two === false && s.tabs.join() === '[x] Training Matrix - this tab, 3 people (locked)' && s.out === 'Not brought in - no "Name" column on row 4: Qualifications, Certificates', 'the tabs laid out differently are named as not brought in: ' + s.out);
  R.ok(s.cols.join(' | ') === '(blank)=skip | Name=full | Role=job | Basis=course | Weekly=course | Jan-25=course | Feb-25=course', 'a heading that is a date reads as its cell shows it: ' + s.cols.slice(4).join(' | '));
  // the name column decides which tabs can come in: take it away and put it back
  await page.select('#xlsxMapOv select[data-col="2"]', 'course'); await step2();
  const none = await wiz();
  R.ok(/Choose which column holds the name below/.test(none.hint) && none.tabs.length === 0, 'with no name column chosen the tabs wait for one');
  dialogs.length = 0; await page.click('#_mwGo'); await wait(page, 200);
  R.ok(/Map at least one name column/.test(dialogs[0] || '') && !!(await page.$('#xlsxMapOv')), 'and Import asks for a name column');
  await page.select('#xlsxMapOv select[data-col="2"]', 'full'); await step2();
  dialogs.length = 0; await page.click('#_mwGo'); await wait(page, 700);
  const c = dialogs.find(d => /REPLACES/.test(d)) || '';
  R.ok(/3 people in the sheet/.test(c) && /from the "Training Matrix" tab/.test(c) && /not brought in - laid out differently: Qualifications, Certificates/.test(c) && /1 line skipped - a note, not a person \(row 9\)/.test(c), 'the confirm: 3 people, the two tabs left alone, the key under the table skipped: ' + c.split('\n').filter(l => /•/.test(l)).join(' / '));
  const m = await matrix();
  R.ok(m.people === 3 && m.tables.length === 1 && m.tables[0].names.join('; ') === 'Alex Morgan; Jo Bloggs; Sam Kerr' && m.tables[0].heads.join(' | ') === 'NAME | BASIS | WEEKLY | JAN-25 | FEB-25', 'the matrix holds the three people and nothing else: ' + m.tables[0].names.join('; ') + ' / ' + m.tables[0].heads.join(' | '));
}
// ── read only ──
{
  const t = await page.evaluate(() => { const keep = window._roLocked; window._roLocked = () => true; renderMonitoring(); const n = document.querySelectorAll('#tab-monitoring button[onclick="trainingUploadXlsx()"], #tab-monitoring button[onclick="xlsxMappedImport(\'training\')"]').length; trainingUploadXlsx(); const o = !!document.getElementById('xlsxMapOv'); window._roLocked = keep; renderMonitoring(); return { n, o }; });
  R.ok(t.n === 0 && !t.o, 'read only: nothing to import with');
}
// ── first use ──
{
  await seed(page, { company: { tradingName: 'Testing Client Ltd' } }, 'monitoring'); await bridge();
  const t = await page.evaluate(() => ({ none: document.getElementById('tab-monitoring').innerText.includes('No training data yet'), up: !!document.querySelector('#tab-monitoring button[onclick="trainingUploadXlsx()"]') }));
  R.ok(t.none && t.up, 'with no matrix yet the upload is offered');
  await upload(DATED);
  const w = await wiz();
  R.ok(/step 1 of 2/.test(w.title) && w.strip[0] === 'Cards Aug 25*', 'a client with nothing remembered starts at step 1 on the first tab');
  await page.click('#_mwCancel');
}
await R.done(browser, errors);
