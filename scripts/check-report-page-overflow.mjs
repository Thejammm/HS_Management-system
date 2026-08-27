// Every report page is a fixed A4 box with overflow:hidden - content that
// runs past the edge is cut off silently, which the reader sees as text
// bleeding off the page (found for real on the Actions page, 2026-08-28,
// at real-world text lengths). This renders every report, format and fixture
// - plus a deliberately long-text state - and fails if any element inside a
// page reaches past the page edge.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import { reportHTML } from '../public/reports/engine.js';
import { REPORTS, buildReport } from '../public/reports/templates/index.js';
import { createRequire } from 'node:module';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const PUB = path.join(root, 'public');
const fixture = n => JSON.parse(fs.readFileSync(path.join(PUB, 'reports', 'fixtures', n + '.json'), 'utf8'));
const CHROME = (() => {
  const need = createRequire(import.meta.url);
  const found = need('../lib/chromium.js').findChromium();
  if (!found) { console.error('X No Chromium found. Set PUPPETEER_EXECUTABLE_PATH or CHROMIUM_PATH.'); process.exit(2); }
  return found;
})();

// Text at the lengths clients actually type - long activity names, ownerless
// actions - which is exactly what overran the Actions page.
const LONG = [
  'Any work at height across sites during surveys on both managed and unmanaged premises',
  'Driving and travel for work (fleet and grey fleet) including long-distance client visits',
  'Providing competent, trained and supervised people across the organisation',
  'Managing occupational health, wellbeing and work-related stress across all teams',
  'Lone working during out-of-hours surveys and remote site inspections nationwide',
  'Contractor and subcontractor management on client premises and construction sites',
  'Manual handling of survey equipment, materials and archive boxes between sites',
  'Use of powered access equipment and mobile elevating work platforms on surveys',
  'Asbestos disturbance risk during intrusive surveys of pre-2000 buildings',
  'Electrical safety when inspecting live installations and plant rooms',
  'Workplace transport and pedestrian segregation in shared yards',
  'Display screen equipment, homeworking and agile working arrangements',
];
const longnames = {
  company: { legalName: 'Live-shaped Ltd' },
  riskProfile: LONG.map((n, i) => ({ id: 'r' + i, activity: n, likelihood: String((i % 5) + 1), severity: String(((i + 3) % 5) + 1),
    controls: '', controlLevel: '',
    actions: [
      { id: 'a' + i + 'x', desc: 'Prepare and roll out the organisational standard for ' + n.toLowerCase().slice(0, 40), owner: '', due: '', status: 'Not started' },
      { id: 'a' + i + 'y', desc: 'Brief all affected staff and record attendance', owner: '', due: '2026-05-01', status: 'Not started' },
    ] }))
    .concat(Array.from({ length: 14 }, (_, i) => ({ id: 'rr' + i, activity: 'Further organisational risk theme number ' + (i + 1) + ' with a full descriptive title', likelihood: '2', severity: '2', controls: 'Documented controls', controlLevel: 'prevent', actions: [] }))),
  auditSnapshots: [{ date: '2026-05-01', metrics: { held: 0, ruleBreaches: 12, highCrit: 12, openActions: 13, overdueActions: 6 } }],
  consultation: { briefings: [
    { id: 'c1', date: '2026-08-01', topic: 'Toolbox', feedback: 'The racking in stores is too high for safe manual picking without steps and needs a proper platform solution' },
    { id: 'c2', date: '2026-08-12', topic: 'Start', feedback: 'Yard lighting on the north side is poor in the early starts and the walkway markings have faded badly' } ] },
};

const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  const p = path.join(PUB, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, b) => { if (e) { res.statusCode = 404; return res.end('nf'); }
    res.setHeader('Content-Type', MIME[path.extname(p).toLowerCase()] || 'application/octet-stream'); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const PORT = srv.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.emulateMediaType('print');

const STATES = { empty: fixture('empty'), typical: fixture('typical'), oversized: fixture('oversized'), longnames };
let bad = 0, pagesChecked = 0;
for (const reportId of Object.keys(REPORTS)) {
  for (const f of (REPORTS[reportId].formats || [{ id: undefined }])) {
    for (const [name, state] of Object.entries(STATES)) {
      const rep = buildReport(state, reportId, { period: 'Q3 2026', today: '2026-08-28', format: f.id });
      const html = '<!doctype html><html><head><meta charset="utf-8"><base href="http://127.0.0.1:' + PORT + '/">'
        + '<link rel="stylesheet" href="/reports/report.css"><style>body{margin:0;background:#fff}</style></head><body>'
        + reportHTML(rep) + '</body></html>';
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
      await new Promise(r => setTimeout(r, 250));
      try { await page.evaluateHandle('document.fonts.ready'); } catch (e) {}
      const rows = await page.evaluate(() => [...document.querySelectorAll('.r-page')].map((p, i) => {
        const body = p.querySelector('.r-page-body') || p;
        const top = p.getBoundingClientRect().top;
        const bottom = Math.max(0, ...[...body.querySelectorAll('*')].map(c => c.getBoundingClientRect().bottom - top));
        const label = p.getAttribute('data-label') || '';
        return { i: i + 1, label, over: Math.round(bottom - p.clientHeight) };
      }));
      pagesChecked += rows.length;
      rows.filter(r => r.over > 0).forEach(r => {
        bad++;
        console.error('X ' + reportId + '/' + (f.id || 'default') + '/' + name + ' page ' + r.i + ' (' + r.label + '): content ' + r.over + 'px past the page edge - it will be cut off in the PDF');
      });
    }
  }
}
await browser.close(); srv.close();
if (bad) { console.error('\nX ' + bad + ' overflowing page(s) of ' + pagesChecked + ' checked'); process.exit(1); }
console.log('OK report page overflow: ' + pagesChecked + ' pages checked across every report, format and fixture - nothing runs past a page edge');
