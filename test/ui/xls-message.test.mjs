// ══════════════════════════════════════════════════════════════
//  An old Excel file (.xls) on the spreadsheet imports (Simon, 12 November
//  2026: "check the training matrix import it wont read a spreadsheet" - the
//  client's matrix was an .xls, and all it said was "Could not read that
//  file"). In the user's order: pick the .xls on each of the three import
//  buttons -> told to save it as .xlsx, nothing sent to the server -> an
//  .xlsx locked with a password -> told to take the password off -> an
//  ordinary .xlsx still goes through as before.
//  Run: node test/ui/xls-message.test.mjs
// ══════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { openApp, seed, wait, reporter } from './harness.mjs';
const require = createRequire(import.meta.url);
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const ExcelJS = require('exceljs');

const R = reporter('Spreadsheet imports - an old .xls file says what to do');
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
// what Excel writes for an .xls, and for an .xlsx with a password: a compound file, not a zip
const OLE = Buffer.concat([Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]), Buffer.alloc(504)]);
const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Staff'); ws.addRow(['Last Name', 'First Name', 'First Aid']); ws.addRow(['Smith', 'Jo', '2027-01-01']);
const XLSX = Buffer.from(await wb.xlsx.writeBuffer());
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compass-xls-'));
const file = (name, buf) => { const p = path.join(dir, name); fs.writeFileSync(p, buf); return p; };
const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); });

await seed(page, { company: { tradingName: 'Testing Client Ltd' } }, 'monitoring');
const stub = () => page.evaluate(() => {
  window._tOnline = () => true; Auth.activeTenantId = () => 'test-tenant';
  window.__calls = []; window._tApiRaw = async (p) => { window.__calls.push(p); return new Response(JSON.stringify({ error: 'no_people_found' }), { status: 422, headers: { 'Content-Type': 'application/json' } }); };
  window.__accept = []; if (!window.__kc) { window.__kc = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function(){ if (this.type === 'file') window.__accept.push(this.accept); return window.__kc.call(this); }; }
  renderMonitoring();
});
await stub();
async function pickWith(call, p){
  dialogs.length = 0; await page.evaluate(() => { window.__calls.length = 0; });
  const [fc] = await Promise.all([page.waitForFileChooser({ timeout: 10000 }), page.evaluate(c => { (0, eval)(c); }, call)]);
  await fc.accept([p]); await wait(page, 600);
  return page.evaluate(() => ({ calls: window.__calls.slice(), wizard: !!document.getElementById('xlsxMapOv'), accept: window.__accept[window.__accept.length - 1] }));
}
const xls = file('Development & Training Matrix - August 2026.xls', OLE);
for (const [call, label] of [['trainingUploadXlsx()', 'training: Upload spreadsheet'], ["xlsxMappedImport('training')", 'training: Map & import'], ['statutoryUploadXlsx()', 'statutory: Import / update']]) {
  const r = await pickWith(call, xls);
  R.ok(r.accept === '.xlsx,.xls', label + ' - the file picker shows .xls files too, so one can be picked and be told what to do');
  R.ok(dialogs.length === 1 && dialogs[0] === '"Development & Training Matrix - August 2026.xls" is an older Excel file (.xls), which Compass cannot read.\n\nOpen it in Excel, choose File > Save As > Excel Workbook (.xlsx), then import that copy.', label + ' - an .xls says to save it as .xlsx, not "Could not read that file": ' + JSON.stringify(dialogs[0] || ''));
  R.ok(!r.calls.length && !r.wizard, label + ' - and nothing is sent to the server, no mapping screen');
}
{
  const r = await pickWith('trainingUploadXlsx()', file('Matrix locked.xlsx', OLE));
  R.ok(dialogs.length === 1 && /^"Matrix locked\.xlsx" is protected with a password, so Compass cannot read it\./.test(dialogs[0]) && /take the password off/.test(dialogs[0]) && !r.calls.length, 'an .xlsx locked with a password is told to take the password off: ' + JSON.stringify(dialogs[0] || ''));
}
{
  const r = await pickWith('trainingUploadXlsx()', file('Matrix.xlsx', XLSX));
  R.ok(!dialogs.some(d => /cannot read/.test(d)) && r.calls[0] === '/api/training/parse', 'an ordinary .xlsx goes to the server as before: ' + r.calls.join(', '));
}
fs.rmSync(dir, { recursive: true, force: true });
await R.done(browser, errors);
