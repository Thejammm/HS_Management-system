// ══════════════════════════════════════════════════════════════
//  Statutory register in the client's own layout (Simon, 12 November 2026:
//  "a way to map an excel spreadsheet so that it matches exactly", "surly the
//  drop down just needs to say include or dont include"). In the user's order:
//  Import opens the mapping screen -> click the headings row -> every column
//  ticked, formulas labelled, item name and due date guessed -> untick one ->
//  import -> the tracker under the sheet's own headings -> edit a date, the
//  formula cells read-only -> reload -> export writes only that cell -> add an
//  item, delete one -> export again -> read only -> first use with no data.
//  The server code runs for real in Node behind a bridge for /api/statutory.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { openApp, seed, wait, reporter } from './harness.mjs';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const { peekLayout, parseLayout, buildLayout, parse, build } = require('../../lib/statutory-xlsx.js');

const R = reporter('Statutory register - the client\'s own columns');
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
// dates set from today, so the traffic lights read the same whenever the suite runs:
// A1 in date, A2 overdue, B1 due within 60 days, C1 no date
const T = new Date(); const ago = m => new Date(Date.UTC(T.getUTCFullYear(), T.getUTCMonth() - m, 10));
const LAST = { A1: ago(1), A2: ago(30), B1: ago(5) };
const dmy = d => String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
const iso = d => d.toISOString().slice(0, 10);
// a made-up register shaped like a real FM sheet: title row, headings merged over rows 2-3, two formula columns
async function workbook(){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('In Use');
  ws.getCell('A1').value = 'Facilities register';
  ['Asset ID', 'Section', 'Description', 'Location', 'Status', 'Last service', 'Life (months)', 'Next due'].forEach((h, i) => { ws.getRow(2).getCell(i + 1).value = h; ws.mergeCells(2, i + 1, 3, i + 1); });
  [['A1', 'Fire', 'Extinguisher', 'Front door', LAST.A1, 24], ['A2', 'Fire', 'Extinguisher', 'Back door', LAST.A2, 12], ['B1', 'Lifting', 'Vehicle lift', 'Workshop', LAST.B1, 6], ['C1', 'Electrical', 'Emergency light', 'Office', null, null]].forEach((r, i) => {
    const n = 4 + i, row = ws.getRow(n); [0, 1, 2, 3].forEach(c => { row.getCell(c + 1).value = r[c]; });
    row.getCell(6).value = r[4]; row.getCell(7).value = r[5]; row.getCell(6).numFmt = 'dd/mm/yyyy'; row.getCell(8).numFmt = 'dd/mm/yyyy';
    const due = r[4] ? new Date(Date.UTC(r[4].getUTCFullYear(), r[4].getUTCMonth() + r[5], r[4].getUTCDate())) : '';
    row.getCell(8).value = { formula: `IF(OR(F${n}="",G${n}=""),"",EDATE(F${n},G${n}))`, result: due };
    row.getCell(5).value = { formula: `IF(H${n}="","",IF(H${n}<TODAY(),"expired","in date"))`, result: r[4] ? (due < new Date() ? 'expired' : 'in date') : 'not fitted' };
  });
  const arc = wb.addWorksheet('Archive'); arc.getRow(1).values = ['Asset ID', 'Description', 'Week 1', 'Week 2']; arc.getRow(2).values = ['Z9', 'Old extinguisher', 1, 2];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const FILE = await workbook();
// the bridge: the page's _tApiRaw goes to the real server functions in Node; the stored workbook lives here
let stored = null; const exports = [];
await page.exposeFunction('__statApi', async (path, b64, hdrs) => {
  const body = Buffer.from(b64 || '', 'base64'), u = new URL('http://x' + path), q = Object.fromEntries(u.searchParams);
  if (u.pathname === '/api/statutory/peek') return { status: 200, json: await peekLayout(body) };
  if (u.pathname === '/api/statutory/parse') { const m = q.mapping ? JSON.parse(q.mapping) : null; const hr = parseInt(q.headerRow || '', 10) || 0;
    const model = m && m.layout ? await parseLayout(body, { headerRow: hr || 1, layout: m.layout }) : await parse(body, Object.assign({}, hr ? { headerRow: hr } : {}, m ? { fixed: m.fixed } : {}));
    return model.items.length ? { status: 200, json: model } : { status: 422, json: { error: 'no_items_found' } }; }
  if (u.pathname === '/api/statutory/store') { stored = body; return { status: 200, json: { ok: true, filename: (hdrs || {})['X-Filename'] } }; }
  if (u.pathname === '/api/statutory/export') { const state = JSON.parse(body.toString('utf8')).state;
    if (state.layout && stored) { const out = await buildLayout(stored, state); exports.push(Buffer.from(out.buffer)); return { status: 200, b64: Buffer.from(out.buffer).toString('base64'), headers: { 'X-Not-Removed': String(out.notRemoved), 'content-disposition': 'attachment; filename="Register (rev).xlsx"' } }; }
    const buf = Buffer.from(await build(stored, state)); exports.push(buf); return { status: 200, b64: buf.toString('base64'), headers: { 'content-disposition': 'attachment; filename="Register (rev).xlsx"' } }; }
  return { status: 404, json: { error: 'not_here' } };
});
const bridge = () => page.evaluate(() => {
  window._tOnline = () => true; Auth.activeTenantId = () => 'test-tenant';
  window._tApiRaw = async (path, body, extra) => {
    let b64 = ''; if (body instanceof ArrayBuffer) { const u = new Uint8Array(body); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); b64 = btoa(s); } else if (typeof body === 'string') b64 = btoa(unescape(encodeURIComponent(body)));
    const r = await window.__statApi(path, b64, extra || {});
    if (r.json) return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'Content-Type': 'application/json' } });
    const bin = atob(r.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Response(u, { status: r.status, headers: r.headers || {} });
  };
  window.__toasts = []; if (!window.__kt) { window.__kt = showToast; window.showToast = (m, ...a) => { window.__toasts.push(String(m)); return window.__kt(m, ...a); }; }
  URL.createObjectURL = () => 'blob:held'; HTMLAnchorElement.prototype.click = function(){ window.__downloaded = this.download; };
  if (document.getElementById('tab-monitoring').classList.contains('active')) renderMonitoring();   // the buttons are drawn for a signed-in client
});
const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); });
const toasts = () => page.evaluate(() => { const t = window.__toasts.slice(); window.__toasts.length = 0; return t; });
async function chooseFile(sel){ const [fc] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), page.evaluate(s => { const b = document.querySelector(s); b.scrollIntoView({ block: 'center' }); b.click(); }, sel)]);
  const tmp = require('node:path').join(require('node:os').tmpdir(), 'compass-stat-layout-test.xlsx'); require('node:fs').writeFileSync(tmp, FILE); await fc.accept([tmp]); await page.waitForSelector('#xlsxMapOv', { timeout: 10000 }); await wait(page, 200); }
const tracker = () => page.evaluate(() => { const t = document.querySelector('#tab-monitoring tr[onclick^="regEditItem("]'); const tb = t && t.closest('table');
  return { heads: tb ? [...tb.querySelectorAll('thead th')].map(th => th.innerText.trim()).filter(Boolean) : [], rows: tb ? [...tb.querySelectorAll('tbody tr[onclick^="regEditItem("]')].map(tr => [...tr.children].map(td => td.innerText.trim())) : [] }; });

await seed(page, { company: { tradingName: 'Testing Client Ltd' }, monitoring: { months: {}, meta: {}, regulatory: [], regSections: [] } }, 'monitoring');
await bridge();
// ── Import / update opens the mapping screen ──
await chooseFile('button[onclick="statutoryUploadXlsx()"]');
{
  const t = await page.evaluate(() => document.querySelector('#xlsxMapOv').innerText.split('\n')[0]);
  R.ok(/step 1 of 2/.test(t), 'Import / update opens the mapping screen; the automatic read is gone for the statutory register');
  await page.hover('#xlsxMapOv tr[data-row="2"]'); await wait(page, 100);
  const line = (await page.$eval('#_mwTabs', e => e.innerText)).replace(/\s+/g, ' ');
  R.ok(line === 'Brought in: In Use · Not brought in - headings don’t match: Archive', 'pointing at the headings row lists the tabs brought in and not: ' + line);
  await page.click('#xlsxMapOv tr[data-row="2"]'); await wait(page, 200);
  const s = await page.evaluate(() => ({ title: document.querySelector('#xlsxMapOv').innerText.split('\n')[0], rows: [...document.querySelectorAll('#_mwList tbody tr')].map(tr => ({ h: tr.children[0].querySelector('div').innerText, f: !!tr.querySelector('.st-f'), on: tr.querySelector('input').checked, s: tr.children[2].innerText })),
    item: document.querySelector('#_mwItem').selectedOptions[0].textContent, due: document.querySelector('#_mwDue').selectedOptions[0].textContent, check: document.querySelector('#_mwCheck').innerText }));
  R.ok(/^Choose what to bring in/.test(s.title) && s.rows.length === 8 && s.rows.every(r => r.on), 'step 2: "Choose what to bring in", every column listed and ticked: ' + s.rows.map(r => r.h).join(' | '));
  R.ok(s.rows.filter(r => r.f).map(r => r.h).join() === 'Status,Next due', 'the formula columns say "Formula - shown, not changed"');
  R.ok(s.rows[0].s === 'A1 · A2 · B1' && s.rows[5].s.startsWith(dmy(LAST.A1)), 'up to three sample values, read from below the merged headings: ' + s.rows[0].s);
  R.ok(s.item === 'Description' && s.due === 'Next due', 'item name and due date are guessed from the headings: ' + s.item + ' / ' + s.due);
  R.ok(s.check === 'All 8 columns included', 'the check line: ' + s.check);
  await page.evaluate(() => document.querySelector('#_mwList input[data-col="3"]').click()); await wait(page, 100);
  const off = await page.evaluate(() => ({ check: document.querySelector('#_mwCheck').innerText, go: document.querySelector('#_mwGo').disabled }));
  R.ok(off.check === 'Pick the column that holds the item name' && off.go, 'unticking the item column turns Import off and says why');
  await page.evaluate(() => document.querySelector('#_mwList input[data-col="3"]').click()); await page.select('#_mwItem', '3'); await wait(page, 100);
  await page.evaluate(() => document.querySelector('#_mwList input[data-col="2"]').click()); await wait(page, 100);
  const c = await page.$eval('#_mwCheck', e => e.innerText);
  R.ok(c === '7 of 8 columns included - not included: Section', 'unticking Section: ' + c);
  dialogs.length = 0; await page.click('#_mwGo');
}
await wait(page, 400);
{
  const conf = dialogs.find(d => /REPLACES/.test(d)) || '';
  R.ok(/4 items across 1 sheet/.test(conf) && /7 of 8 columns brought in/.test(conf) && /not brought in - headings don't match: Archive/.test(conf), 'the confirm says what is coming: items, columns and the tab left alone');
}
// the confirm was accepted by the dialog handler below
await wait(page, 600);
{
  const t = await tracker();
  // moved 12 November 2026 to the agreed month view: a Done tick first and a Document column last
  R.ok(t.heads.join(' | ') === 'Done | Asset ID | Description | Location | Status | Last service | Life (months) | Next due | Document', 'the tracker shows the sheet\'s own headings, in its order, without Section, between the Done tick and the Document column: ' + t.heads.join(' | '));
  const a1 = t.rows.find(r => r[1] === 'A1');
  R.ok(t.rows.length === 4 && a1 && a1[5] === dmy(LAST.A1), 'one row a line of the sheet, dates as the sheet shows them: ' + (a1 || []).slice(0, 8).join(' | '));
  // grouped by when each line falls due: expired first, then the months, then no date ("Expired" is the client's word, 12 November 2026)
  const badges = await page.evaluate(() => [...document.querySelectorAll('#tab-monitoring tr[onclick^="regEditItem("]')].map(tr => tr.children[0 + 7].querySelector('span').title));
  R.ok(badges.join() === 'Expired,Due soon,In date,No due date', 'the due column carries the traffic light; no date is grey: ' + badges.join());
  const sticky = await page.evaluate(() => getComputedStyle(document.querySelector('#tab-monitoring tr[onclick^="regEditItem("]').children[0]).position);
  R.ok(sticky === 'sticky', 'the first column stays put when the table scrolls sideways');
}
// ── a line of their sheet opens the card; ticking it done writes the date done (moved 12 November 2026:
//    the pop-up is the card - next due, a tick, the document - not one field a column) ──
const DONE = iso(new Date(T.getFullYear(), T.getMonth(), T.getDate()));
{
  await page.evaluate(() => [...document.querySelectorAll('#tab-monitoring tr[onclick^="regEditItem("]')].find(r => r.children[1].innerText.trim() === 'B1').click()); await wait(page, 200);
  const e = await page.evaluate(() => { const ov = document.querySelector('#regEditOv'); return { card: !!ov.querySelector('.rar-card'), due: ov.querySelector('#_scDue').disabled, text: ov.innerText }; });
  R.ok(e.card && e.due && /Worked out in the spreadsheet from Last service and Life \(months\)\./.test(e.text), 'the next due date is the spreadsheet\'s formula: shown, not typed over, and says so');
  await page.click('#_scDone'); await page.$eval('#_scOn', (el, d) => { el.value = d; el.dispatchEvent(new Event('input')); }, DONE); await page.click('#_scSave'); await wait(page, 300);
  const t = await tracker(); const b1 = t.rows.find(r => r[1] === 'B1'); R.ok(b1 && b1[5] === dmy(new Date(DONE + 'T12:00:00Z')), 'ticked done, the tracker shows the new date in Last service');
}
// ── reload ──
await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"'); await wait(page, 300);
await page.evaluate(() => switchTab('monitoring')); await wait(page, 300); await bridge();
{
  const t = await tracker(); const b1 = t.rows.find(r => r[1] === 'B1'); R.ok(t.rows.length === 4 && b1 && b1[5] === dmy(new Date(DONE + 'T12:00:00Z')) && t.heads.length === 9, 'after a reload the layout and the edit are as left');
}
// ── export: only that cell ──
{
  await page.evaluate(() => { const b = document.querySelector('button[onclick="statutoryExportXlsx()"]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await wait(page, 800);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(exports[exports.length - 1]); const ws = wb.getWorksheet('In Use');
  const orig = new ExcelJS.Workbook(); await orig.xlsx.load(FILE); const ow = orig.getWorksheet('In Use');
  const diff = []; ow.eachRow({ includeEmpty: true }, (row, r) => row.eachCell({ includeEmpty: true }, c => { const a = c.type === ExcelJS.ValueType.Formula ? 'F' + c.formula : JSON.stringify(c.value), b2 = ws.getCell(c.address); const b = b2.type === ExcelJS.ValueType.Formula ? 'F' + b2.formula : JSON.stringify(b2.value); if (a !== b) diff.push(c.address); }));
  R.ok(diff.join() === 'F6', 'the export writes only the changed cell: ' + diff.join());
  R.ok(!!wb.getWorksheet('Archive') && wb.getWorksheet('Archive').getCell('B2').value === 'Old extinguisher', 'the tab not brought in is still there, untouched');
}
// ── add an item, delete one, export ──
{
  await page.evaluate(() => { const b = document.querySelector('#tab-monitoring button[onclick^="addRegItem("]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await wait(page, 300);
  const t = await page.evaluate(() => ({ title: document.querySelector('#regEditOv').innerText.split('\n')[0], ro: [5, 8].map(c => document.querySelector('#_rsc' + c).readOnly) }));
  R.ok(/^New item/.test(t.title) && t.ro.every(Boolean), 'Add opens the same pop-up; the formula columns are read-only there too');
  await page.$eval('#_rsc1', el => { el.value = 'D1'; }); await page.$eval('#_rsc3', el => { el.value = 'Fire blanket'; }); await page.$eval('#_rsc6', el => { el.value = '2026-11-01'; }); await page.$eval('#_rsc7', el => { el.value = '12'; });
  await page.click('#_reSave'); await wait(page, 300);
  await page.evaluate(() => { const tr = [...document.querySelectorAll('#tab-monitoring tr[onclick^="regEditItem("]')].find(r => r.children[1].innerText.trim() === 'A2'); tr.querySelector('button[onclick^="deleteRegItem("]').click(); }); await wait(page, 300);
  await toasts();
  await page.evaluate(() => { const b = document.querySelector('button[onclick="statutoryExportXlsx()"]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await wait(page, 800);
  const tt = await toasts();
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(exports[exports.length - 1]); const ws = wb.getWorksheet('In Use');
  R.ok(ws.getCell('A8').value === 'D1' && ws.getCell('C8').value === 'Fire blanket' && /EDATE\(F8,G8\)/.test(ws.getCell('H8').formula || ''), 'the new item goes below the last row, with the formulas carried down');
  R.ok(ws.getCell('A5').value === 'A2', 'the deleted item is still in the file');
  R.ok(tt.some(x => /1 item deleted in Compass is still in the spreadsheet - remove it there if it should go/.test(x)), 'and the toast says so: ' + tt.join(' | '));
}
// ── the n/a reason keeps to its own row when names repeat ──
{
  const k = await page.evaluate(() => { const sec = { name: 'In Use' }; const mk = (row, cols) => _regNAKey(sec, Object.assign({ sheet: 'In Use', item: 'Extinguisher', row }, cols ? { cols: {} } : {})); return { own: [mk(4, true), mk(5, true)], old: [mk(4, false), mk(5, false)] }; });
  R.ok(k.own[0] !== k.own[1] && k.old[0] === k.old[1] && k.old[0] === 'In Use|extinguisher', 'two lines of the client’s own sheet with the same name keep their own no-longer-applies reason; the older register keys as before: ' + k.own.join(' / '));
}
// ── read only ──
{
  const t = await page.evaluate(() => { const keep = window._roLocked; window._roLocked = () => true; renderMonitoring(); const tr = document.querySelector('#tab-monitoring tr[onclick^="regEditItem("]'); const td = document.querySelector('#tab-monitoring tr td[style*="sticky"]');
    const o = { clickable: !!tr, buttons: document.querySelectorAll('#tab-monitoring button[onclick^="addRegItem("], #tab-monitoring button[onclick="statutoryUploadXlsx()"]').length, cells: !!td };
    regEditItem(_regSections()[0].id, _regSections()[0].items[0].id); o.popup = !!document.getElementById('regEditOv'); window._roLocked = keep; renderMonitoring(); return o; });
  R.ok(!t.clickable && t.buttons === 0 && t.cells && !t.popup, 'read only: the table shows, nothing opens or edits');
}
// ── first use: nothing imported yet, the table is the usual one ──
{
  await seed(page, { company: { tradingName: 'Testing Client Ltd' }, monitoring: { months: {}, meta: {}, regulatory: [], regSections: [{ id: 's1', name: 'Lifting', items: [{ id: 'i1', item: 'Vehicle lift', area: 'Workshop', frequency: 'Annual', resultDate: '', dueDate: '2030-01-01', result: 'Pass', certRef: 'C1', notes: '' }] }] } }, 'monitoring');
  const t = await page.evaluate(() => { const tb = document.querySelector('#tab-monitoring tr[onclick^="regEditItem("]').closest('table'); const h = [...tb.querySelectorAll('thead th')].map(th => th.innerText.trim()).filter(Boolean); regEditItem('s1', 'i1'); const pop = document.querySelector('#regEditOv').innerText.split('\n')[0]; document.querySelector('#regEditOv').remove(); return { h: h.join(' | '), pop, layout: !!S.monitoring.statLayout }; });
  R.ok(!t.layout && /^ITEM \| AREA \| FREQUENCY/i.test(t.h) && /Edit statutory item/.test(t.pop), 'a client imported the old way keeps the usual table and pop-up: ' + t.h);
  await seed(page, { company: { tradingName: 'Testing Client Ltd' }, monitoring: { months: {}, meta: {}, regulatory: [], regSections: [] } }, 'monitoring');
  const e = await page.evaluate(() => document.getElementById('tab-monitoring').innerText.includes('No sections yet'));
  R.ok(e, 'with nothing at all, the tracker says there are no sections yet');
}
await R.done(browser, errors);
