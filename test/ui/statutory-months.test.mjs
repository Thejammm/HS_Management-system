// ══════════════════════════════════════════════════════════════
//  The FM register month by month (Simon, 12 November 2026): "the
//  spreadsheet import view needs to be displayed month by month from date of
//  expiry", "when i click a item the modal should give me a location of where
//  to store the file like in the polices and the next due date thats it",
//  "a check to complete the item and move it from expired to completed and
//  then track it on a monthly report", "this process should not put actions
//  in to the compass app". In the user's order: import -> the months ->
//  tick an expired line done with its certificate's location -> add a link
//  to another line -> reload -> export (the date and the links go into their
//  file) -> nothing on the plan -> import the exported file again -> the
//  monthly report -> undo -> an older register unchanged -> read only ->
//  first use with nothing imported.
//  The server code runs for real in Node behind a bridge for /api/statutory.
//  Run: node test/ui/statutory-months.test.mjs
// ══════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { openApp, seed, wait, reporter } from './harness.mjs';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const { peekLayout, parseLayout, buildLayout } = require('../../lib/statutory-xlsx.js');

const R = reporter('Statutory register - month by month, the tick and the document link');
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
const T = new Date(); const ago = m => new Date(Date.UTC(T.getUTCFullYear(), T.getUTCMonth() - m, 10));
const iso = d => d.toISOString().slice(0, 10);
const TODAY = T.getFullYear() + '-' + String(T.getMonth() + 1).padStart(2, '0') + '-' + String(T.getDate()).padStart(2, '0');
const edate = (s, n) => { const [y, m, d] = s.split('-').map(Number); const mo = m - 1 + n, ty = y + Math.floor(mo / 12), tm = ((mo % 12) + 12) % 12; const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate(); return ty + '-' + String(tm + 1).padStart(2, '0') + '-' + String(Math.min(d, last)).padStart(2, '0'); };
// A1 in date, A2 expired, B1 due within 60 days, C1 no date - a made-up FM sheet
const LAST = { A1: ago(1), A2: ago(30), B1: ago(5) };
async function workbook(){
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('In Use');
  ws.getCell('A1').value = 'Facilities register';
  ['Asset ID', 'Description', 'Location', 'Status', 'Last service', 'Life (months)', 'Next due'].forEach((h, i) => { ws.getRow(2).getCell(i + 1).value = h; ws.mergeCells(2, i + 1, 3, i + 1); });
  [['A1', 'Extinguisher', 'Front door', LAST.A1, 24], ['A2', 'Extinguisher', 'Back door', LAST.A2, 12], ['B1', 'Vehicle lift', 'Workshop', LAST.B1, 6], ['C1', 'Emergency light', 'Office', null, null]].forEach((r, i) => {
    const n = 4 + i, row = ws.getRow(n);
    row.getCell(1).value = r[0]; row.getCell(2).value = r[1]; row.getCell(3).value = r[2]; row.getCell(5).value = r[3]; row.getCell(6).value = r[4];
    row.getCell(5).numFmt = 'dd/mm/yyyy'; row.getCell(7).numFmt = 'dd/mm/yyyy';
    const due = r[3] ? new Date(Date.UTC(r[3].getUTCFullYear(), r[3].getUTCMonth() + r[4], r[3].getUTCDate())) : '';
    row.getCell(7).value = { formula: `IF(OR(E${n}="",F${n}=""),"",EDATE(E${n},F${n}))`, result: due };
    row.getCell(4).value = { formula: `IF(G${n}="","",IF(G${n}<TODAY(),"expired","in date"))`, result: r[3] ? (due < new Date() ? 'expired' : 'in date') : '' };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const FILE = await workbook();
let stored = null; const exports = [];
await page.exposeFunction('__statApi', async (path, b64, hdrs) => {
  const body = Buffer.from(b64 || '', 'base64'), u = new URL('http://x' + path), q = Object.fromEntries(u.searchParams);
  if (u.pathname === '/api/statutory/peek') return { status: 200, json: await peekLayout(body) };
  if (u.pathname === '/api/statutory/parse') { const m = JSON.parse(q.mapping); const model = await parseLayout(body, { headerRow: parseInt(q.headerRow, 10) || 1, layout: m.layout }); return { status: 200, json: model }; }
  if (u.pathname === '/api/statutory/store') { stored = body; return { status: 200, json: { ok: true } }; }
  if (u.pathname === '/api/statutory/export') { const state = JSON.parse(body.toString('utf8')).state; const out = await buildLayout(stored, state); exports.push(Buffer.from(out.buffer));
    return { status: 200, b64: Buffer.from(out.buffer).toString('base64'), headers: { 'X-Not-Removed': String(out.notRemoved), 'content-disposition': 'attachment; filename="Register (rev).xlsx"' } }; }
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
  window.jspdf.jsPDF.API.save = function(n){ window.__pdf = this.output(); window.__downloaded = n; return this; };   // the report, read back as text
  if (document.getElementById('tab-monitoring').classList.contains('active')) renderMonitoring();
});
const toasts = () => page.evaluate(() => { const t = window.__toasts.slice(); window.__toasts.length = 0; return t; });
async function chooseFile(sel, buf){ const [fc] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), page.evaluate(s => { const b = document.querySelector(s); b.scrollIntoView({ block: 'center' }); b.click(); }, sel)]);
  const tmp = require('node:path').join(require('node:os').tmpdir(), 'compass-stat-months-test.xlsx'); require('node:fs').writeFileSync(tmp, buf); await fc.accept([tmp]); await page.waitForSelector('#xlsxMapOv', { timeout: 10000 }); await wait(page, 200); }
const view = () => page.evaluate(() => ({
  bands: [...document.querySelectorAll('#tab-monitoring tr.stat-band')].map(b => b.getAttribute('data-group')),
  rows: [...document.querySelectorAll('#tab-monitoring tr[onclick^="regEditItem("]')].map(tr => { let b = tr.previousElementSibling; while (b && !b.classList.contains('stat-band')) b = b.previousElementSibling; return { id: tr.children[1].innerText.trim(), group: b && b.getAttribute('data-group'), doc: tr.children[tr.children.length - 2].innerText.trim() }; }),
  done: [...document.querySelectorAll('#tab-monitoring tr.stat-done-row')].map(t => t.innerText.replace(/\s+/g, ' ').trim()) }));
const rowOf = id => `[...document.querySelectorAll('#tab-monitoring tr[onclick^="regEditItem("]')].find(r => r.children[1].innerText.trim() === '${id}')`;

await seed(page, { company: { tradingName: 'Testing Client Ltd' }, monitoring: { months: {}, meta: {}, regulatory: [], regSections: [] } }, 'monitoring');
await bridge();
// ── import ──
await chooseFile('button[onclick="statutoryUploadXlsx()"]', FILE);
await page.click('#xlsxMapOv tr[data-row="2"]'); await wait(page, 200); await page.click('#_mwGo'); await wait(page, 800);
const thisM = TODAY.slice(0, 7), dueA1 = edate(iso(LAST.A1), 24).slice(0, 7), dueB1 = edate(iso(LAST.B1), 6).slice(0, 7);
{
  const v = await view();
  const wantBands = ['expired'].concat([...new Set([dueB1, dueA1])].sort()).concat(['none']);
  R.ok(v.bands.join() === wantBands.join(), 'the register reads month by month: expired first, the months in order, then no date: ' + v.bands.join());
  R.ok(v.rows.map(r => r.id + ':' + r.group).join() === ['A2:expired', 'B1:' + dueB1, 'A1:' + dueA1, 'C1:none'].join(), 'each line under the month it falls due: ' + v.rows.map(r => r.id + ':' + r.group).join());
  const b = await page.evaluate(() => ({ months: !!document.querySelector('#tab-monitoring tr.stat-band[data-group]').closest('table.stat-months'), raise: document.querySelectorAll('#tab-monitoring button[onclick^="raiseRegItemAction("]').length, due: !!document.querySelector('#tab-monitoring button[onclick="raiseStatutoryDue()"]'), sect: !!document.querySelector('#tab-monitoring button[onclick="addRegSection()"]'), report: !!document.querySelector('#tab-monitoring button[onclick="openStatFmReportPicker()"]'), ticks: document.querySelectorAll('#tab-monitoring input.stat-tick').length, badge: (() => { const h = [...document.querySelectorAll('#tab-monitoring .card-band h3')].find(x => /Regulatory tracker/.test(x.innerText)); const bd = h && h.parentElement.querySelector('.badge'); return bd ? bd.innerText : ''; })() }));
  R.ok(!b.raise && !b.due && !b.sect, 'nothing that puts work on the plan: no ↗ plan, no Raise due actions, and no Add section (the tabs are the client\'s)');
  R.ok(b.report && b.ticks === 4, 'a Done tick on every line and a Monthly FM report button');
  R.ok(/1 expired/.test(b.badge || ''), 'the count says expired, the client\'s word: ' + b.badge);
}
// ── tick the expired line done, with where its certificate is kept ──
const nextA2 = edate(TODAY, 12);
{
  await page.evaluate(new Function(`${rowOf('A2')}.querySelector('input.stat-tick').click();`)); await wait(page, 200);
  const c = await page.evaluate(() => { const ov = document.getElementById('regEditOv'); return { card: !!ov.querySelector('.rar-card.rar-overdue'), status: ov.querySelector('.rar-status').innerText, done: ov.querySelector('#_scDone').checked, on: ov.querySelector('#_scOn').value, say: ov.querySelector('#_scNew').innerText, dueOff: ov.querySelector('#_scDue').disabled, tick: !!document.querySelector('#tab-monitoring ' + 'input.stat-tick:checked') }; });
  R.ok(c.card && c.status === 'Expired' && c.dueOff, 'the tick opens the card - the RA register\'s card - on the expired line, the next due date the spreadsheet\'s own');
  R.ok(c.done && c.on === TODAY && !c.tick, 'already ticked Completed and dated today; the box on the row is not left ticked behind it');
  const months = Math.round((new Date(nextA2) - new Date(TODAY)) / (30.44 * 864e5));
  R.ok(c.say.startsWith('Next due becomes ') && c.say.includes('(12 months on)'), 'it says what Save will do: ' + c.say + ' (~' + months + ' months)');
  await page.$eval('#_scOn', el => { el.value = '2999-01-01'; el.dispatchEvent(new Event('input')); });
  R.ok(/cannot be in the future/.test(await page.$eval('#_scNew', e => e.innerText)), 'a date done in the future is refused');
  await page.$eval('#_scOn', (el, d) => { el.value = d; el.dispatchEvent(new Event('input')); }, TODAY);
  await page.$eval('#_scDoc', el => { el.value = '"S:\\FM\\Certificates\\A2 service.pdf"'; el.dispatchEvent(new Event('input')); });
  R.ok((await page.$eval('#_scDocCtl', e => e.innerText.trim())) === 'Copy', 'a drive path gets Copy, as on the RA register');
  await toasts(); await page.click('#_scSave'); await wait(page, 300);
  const v = await view(), tt = await toasts();
  const a2 = v.rows.find(r => r.id === 'A2');
  R.ok(a2.group === nextA2.slice(0, 7) && !v.bands.includes('expired'), 'A2 has moved out of Expired to the month it is next due: ' + a2.group);
  R.ok(v.done.length === 1 && v.done[0].includes('A2') && v.done[0].includes('S:\\FM\\Certificates\\A2 service.pdf'), 'and is listed under Completed this month, with its document: ' + v.done[0]);
  R.ok(a2.doc === 'Copy location', 'the row\'s Document cell offers the location');
  R.ok(tt.some(t => /Extinguisher done - next due/.test(t)), 'the toast: ' + tt.join(' | '));
}
// ── a web link on another line, no tick ──
{
  await page.evaluate(new Function(`${rowOf('A1')}.click();`)); await wait(page, 200);
  const done = await page.$eval('#_scDone', e => e.checked);
  await page.$eval('#_scDoc', el => { el.value = 'https://example.com/certs/A1.pdf'; el.dispatchEvent(new Event('input')); });
  const open = await page.$eval('#_scDocCtl a', a => a.innerText.trim() + ' ' + a.target);
  R.ok(!done && open === 'Open ↗ _blank', 'clicking a line opens the card unticked; a web address gets Open');
  await page.click('#_scSave'); await wait(page, 300);
  const s = await page.evaluate(() => ({ log: S.monitoring.statDone.length, a1: _regSections()[0].items.find(i => i.cols[1].v === 'A1').dueDate }));
  R.ok(s.log === 1 && s.a1 === edate(iso(LAST.A1), 24), 'saving only a link records no completion and moves no date');
}
// ── reload ──
await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"'); await wait(page, 300);
await page.evaluate(() => switchTab('monitoring')); await wait(page, 300); await bridge();
{
  const v = await view();
  R.ok(v.rows.find(r => r.id === 'A2').group === nextA2.slice(0, 7) && v.done.length === 1 && v.rows.find(r => r.id === 'A1').doc === 'Open ↗', 'after a reload the tick, the completed list and the links are as left');
}
// ── export: the date done and the links go into their file, nothing else ──
{
  await page.evaluate(() => { const b = document.querySelector('button[onclick="statutoryExportXlsx()"]'); b.scrollIntoView({ block: 'center' }); b.click(); }); await wait(page, 800);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(exports[exports.length - 1]); const ws = wb.getWorksheet('In Use');
  const orig = new ExcelJS.Workbook(); await orig.xlsx.load(FILE); const ow = orig.getWorksheet('In Use');
  const key = c => c.type === ExcelJS.ValueType.Formula ? 'F' + c.formula : JSON.stringify(c.value);
  const diff = []; ws.eachRow({ includeEmpty: true }, row => row.eachCell({ includeEmpty: true }, c => { if (key(c) !== key(ow.getCell(c.address))) diff.push(c.address); }));
  R.ok(diff.sort().join() === ['E5', 'H2', 'H3', 'H4', 'H5'].sort().join(), 'the export changes A2\'s Last service, and adds the Document column with two links: ' + diff.join(' '));
  R.ok(iso(ws.getCell('E5').value) === TODAY && /EDATE\(E5,F5\)/.test(ws.getCell('G5').formula || ''), 'Last service is the date done; Next due is still their formula');
  R.ok(ws.getCell('H2').value === 'Document' && JSON.stringify(ws.getCell('H5').value) === JSON.stringify({ text: 'A2 service.pdf', hyperlink: 'file:///S:/FM/Certificates/A2%20service.pdf' }) && ws.getCell('H4').value.hyperlink === 'https://example.com/certs/A1.pdf', 'the Document column: each a link the client can click');
}
// ── nothing on the plan, even after the register's own sync ──
{
  const p = await page.evaluate(() => { _assuranceSync(); return { reg: (S.actionPlan || []).filter(a => a.regKey).length, sum: (S.riskProfile || []).flatMap(r => r.actions || []).filter(a => a && a.assuranceKey === 'statutory').length }; });
  R.ok(p.reg === 0 && p.sum === 0, 'no line actions and no summary action on the plan: ' + JSON.stringify(p));
}
// ── import the exported file as it came out: the links come back, the tick holds ──
{
  await chooseFile('button[onclick="statutoryUploadXlsx()"]', exports[exports.length - 1]);
  const w = await page.evaluate(() => ({ title: document.querySelector('#xlsxMapOv').innerText.split('\n')[0], cols: [...document.querySelectorAll('#_mwList tbody tr')].map(tr => tr.children[0].innerText.split('\n')[0]) }));
  R.ok(/step 2 of 2/.test(w.title) && !w.cols.includes('Document'), 'the import opens on the remembered columns; Document is not offered as one of theirs: ' + w.cols.join(' | '));
  await toasts(); await page.click('#_mwGo'); await wait(page, 800);
  const v = await view(), tt = await toasts();
  R.ok(v.rows.find(r => r.id === 'A1').doc === 'Open ↗' && v.rows.find(r => r.id === 'A2').doc === 'Copy location', 'both links are back after the import');
  R.ok(v.rows.find(r => r.id === 'A2').group === nextA2.slice(0, 7) && tt.some(t => /1 item ticked done in Compass kept/.test(t)), 'the file was not opened in Excel, so its Next due is stale: the tick is kept and the toast says so');
}
// ── the monthly report ──
{
  await page.evaluate(() => document.querySelector('button[onclick="openStatFmReportPicker()"]').click()); await wait(page, 200);
  await page.evaluate(() => { window.__pdf = ''; document.querySelector('#_sfrGo').click(); }); await wait(page, 600);
  const p = await page.evaluate(() => ({ name: window.__downloaded, pdf: window.__pdf || '' }));
  const has = t => p.pdf.includes(t);
  R.ok(/^statutory-fm-report-\d{4}-\d{2}-[a-z0-9-]+\.pdf$/.test(p.name) && p.name.includes(TODAY.slice(0, 7)), 'the report downloads: ' + p.name);
    R.ok(has('Statutory FM Compliance Report') && has('A2  Extinguisher') && has('S:\\\\FM\\\\Certificates\\\\A2 service.pdf') && has('COMING NEXT MONTH') && has('COMPLETED IN'), 'it lists A2 as completed this month, with its document, and what comes next month');
  R.ok(has('Nothing has expired') && has('75%'), 'nothing expired now; 3 of the 4 lines in date (C1 has no date)');
}
// ── undo ──
{
  await page.evaluate(() => document.querySelector('#tab-monitoring tr.stat-done-row button[onclick^="statUndoDone("]').click()); await wait(page, 300);
  const v = await view();
  R.ok(v.rows.find(r => r.id === 'A2').group === 'expired' && !v.done.length, 'Undo puts A2 back in Expired and takes it off Completed this month');
}
// ── read only ──
{
  const t = await page.evaluate(() => { const keep = window._roLocked; window._roLocked = () => true; renderMonitoring();
    const o = { ticks: document.querySelectorAll('#tab-monitoring input.stat-tick').length, clickable: !!document.querySelector('#tab-monitoring tr[onclick^="regEditItem("]'), bands: document.querySelectorAll('#tab-monitoring tr.stat-band').length, links: document.querySelectorAll('#tab-monitoring table.stat-months .rar-copy, #tab-monitoring table.stat-months .rar-open').length };
    window._roLocked = keep; renderMonitoring(); return o; });
  R.ok(!t.ticks && !t.clickable && t.bands >= 2 && t.links === 2, 'read only: the months and the links show; no ticks, nothing opens');
}
// ── a register imported the old way is unchanged: it still raises into the plan ──
{
  await seed(page, { company: { tradingName: 'Testing Client Ltd' }, monitoring: { months: {}, meta: {}, regulatory: [], regSections: [{ id: 's1', name: 'Lifting', items: [{ id: 'i1', item: 'Vehicle lift', area: 'Workshop', frequency: 'Annual', resultDate: '', dueDate: '2020-01-01', result: '', certRef: '', notes: '' }] }] } }, 'monitoring');
  const o = await page.evaluate(() => ({ months: !!document.querySelector('#tab-monitoring table.stat-months'), raise: document.querySelectorAll('#tab-monitoring button[onclick^="raiseRegItemAction("]').length, due: !!document.querySelector('#tab-monitoring button[onclick="raiseStatutoryDue()"]'), report: !!document.querySelector('#tab-monitoring button[onclick="openStatFmReportPicker()"]') }));
  R.ok(!o.months && o.raise === 1 && o.due && !o.report, 'a register imported the old way keeps its table, its ↗ plan and Raise due actions');
}
// ── first use: a layout with nothing in it ──
{
  await seed(page, { company: { tradingName: 'Testing Client Ltd' }, monitoring: { months: {}, meta: {}, regulatory: [], regSections: [], statLayout: { file: 'x.xlsx', headerRow: 2, sheets: [{ name: 'In Use', columns: [{ col: 1, heading: 'Item', included: true }] }], itemCol: 1, dueCol: null } } }, 'monitoring');
  const t = await page.evaluate(() => document.getElementById('tab-monitoring').innerText.includes("No items yet - import the client's spreadsheet."));
  R.ok(t, 'with nothing imported yet, the view says so');
}
await R.done(browser, errors);
