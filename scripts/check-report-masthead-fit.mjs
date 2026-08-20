// The HTML reports (board report, risk assessment) print to PDF through the
// browser, so their masthead is laid out by CSS rather than drawn at fixed
// coordinates. This renders every one of them with a deliberately long company
// name and measures the result: the organisation name must not overlap the
// document-control meta beside it, and nothing may overflow the page box.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer-core';
import { reportHTML } from '../public/reports/engine.js';
import { REPORTS, buildReport } from '../public/reports/templates/index.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const fixture = n => JSON.parse(fs.readFileSync(path.join(root, 'public', 'reports', 'fixtures', n + '.json'), 'utf8'));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const NAMES = [
  'Short Ltd',
  'Easy Travel Service (Passenger Transport and Garage Services) Limited',
  'The Yorkshire and Humberside Integrated Passenger Transport, Vehicle Maintenance and Fleet Engineering Services Group Limited',
];
const OPTS = { period: 'Q3 2026', today: '2026-08-18' };

const css = fs.readFileSync(path.join(root, 'public', 'reports', 'report.css'), 'utf8');
const ids = Object.keys(REPORTS);
const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--headless=new', '--disable-gpu'] });
const page = await browser.newPage();
const fails = [];

for (const name of NAMES) {
  const state = fixture('typical');
  state.company = Object.assign({}, state.company, { legalName: name, tradingName: name });
  for (const id of ids) {
    let html;
    try { html = reportHTML(buildReport(state, id, OPTS)); }
    catch (e) { fails.push(id + ' [' + name.length + ' chars] failed to build: ' + e.message); continue; }
    await page.setContent('<style>' + css + '</style>' + html, { waitUntil: 'load' });
    const bad = await page.evaluate(() => {
      const out = [];
      const rect = el => el.getBoundingClientRect();
      document.querySelectorAll('.r-masthead').forEach((m, i) => {
        const org = m.querySelector('.r-mast-org'), meta = m.querySelector('.r-mast-meta');
        if (org && meta) {
          const a = rect(org), b = rect(meta);
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 0.5 && oy > 0.5) out.push('masthead ' + i + ': org overlaps meta by ' + Math.round(ox) + 'x' + Math.round(oy) + 'px');
          if (meta.scrollHeight > meta.clientHeight + 1) out.push('masthead ' + i + ': the document control meta is clipped');
        }
        if (m.scrollWidth > m.clientWidth + 1) out.push('masthead ' + i + ': overflows by ' + (m.scrollWidth - m.clientWidth) + 'px');
      });
      // Cover page and any page: nothing may spill out of its page box.
      document.querySelectorAll('.r-page').forEach((p, i) => {
        if (p.scrollWidth > p.clientWidth + 1) out.push('page ' + i + ': content overflows the page width by ' + (p.scrollWidth - p.clientWidth) + 'px');
      });
      document.querySelectorAll('.r-cover-org').forEach((c, i) => {
        if (c.scrollWidth > c.clientWidth + 1) out.push('cover org ' + i + ': clipped by ' + (c.scrollWidth - c.clientWidth) + 'px');
      });
      // The practice identity belongs in the running footer of every page and
      // nowhere in the masthead.
      const pages = document.querySelectorAll('.r-page').length;
      const brand = document.querySelectorAll('.r-pagefoot .r-foot-brand');
      if (brand.length !== pages) out.push('practice name in the footer of only ' + brand.length + ' of ' + pages + ' pages');
      brand.forEach((el, i) => {
        if (!/AHS Compliance Consulting/.test(el.textContent)) out.push('footer brand ' + i + ': name missing');
        if (!el.querySelector('svg')) out.push('footer brand ' + i + ': mark missing');
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 4) out.push('footer brand ' + i + ': not rendered (' + Math.round(r.width) + 'x' + Math.round(r.height) + ')');
      });
      document.querySelectorAll('.r-masthead').forEach((m, i) => {
        if (/AHS Compliance Consulting/.test(m.textContent)) out.push('masthead ' + i + ': still carries the practice name');
      });
      return out;
    });
    bad.forEach(b => fails.push(id + ' [' + name.length + ' chars] ' + b));
  }
}
await browser.close();

if (fails.length) {
  console.error('X HTML REPORT MASTHEAD FAILURES (' + fails.length + '):');
  [...new Set(fails)].forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log('OK HTML REPORT MASTHEADS CLEAN - ' + ids.length + ' report(s) x ' + NAMES.length + ' name lengths: no org/meta overlap, no clipping, no page overflow.');
