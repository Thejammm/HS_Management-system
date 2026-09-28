// Calibrate the section-4 packer: what each card actually measures against
// what cardWeight guessed, and how much of each page is left empty.
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { createRequire } from 'node:module';

const repo = process.argv[2];
const need = createRequire(import.meta.url);
const CHROME = need(path.join(repo, 'lib', 'chromium.js')).findChromium();
const { HEAVY } = await import(url.pathToFileURL(path.join(repo, 'test', 'ui', '_probe_plan_heavy.mjs')).href);
const tpl = await import(url.pathToFileURL(path.join(repo, 'public', 'reports', 'templates', 'index.js')).href);
const eng = await import(url.pathToFileURL(path.join(repo, 'public', 'reports', 'engine.js')).href);

const rep = tpl.buildReport(HEAVY, 'management-plan', { today: '2026-09-28' });
const base = 'file://' + repo.split(path.sep).join('/') + '/public/';
const html = '<!doctype html><html><head><meta charset="utf-8"><base href="' + base + '">'
  + '<link rel="stylesheet" href="reports/report.css"></head><body>' + eng.reportHTML(rep) + '</body></html>';
const tmp = path.join(repo, '_cal.html');
fs.writeFileSync(tmp, html);

const b = await puppeteer.launch({ executablePath: CHROME, args: ['--headless=new', '--disable-gpu'], defaultViewport: { width: 1000, height: 1400 } });
const p = await b.newPage();
await p.emulateMediaType('print');
await p.goto(url.pathToFileURL(tmp).href, { waitUntil: 'networkidle0' });
try { await p.evaluateHandle('document.fonts.ready'); } catch (e) {}

const out = await p.evaluate(() => [...document.querySelectorAll('.r-page')].map((pg, i) => {
  const cards = [...pg.querySelectorAll('.r-mp')];
  if (!cards.length) return null;
  const body = pg.querySelector('.r-page-body');
  const gap = 10;
  const others = [...body.children].filter(c => !c.classList.contains('r-mps'));
  const usedByOthers = others.reduce((a, c) => a + c.getBoundingClientRect().height + gap, 0);
  const h = (c) => Math.round(c.getBoundingClientRect().height + 7);   // + margin-bottom
  return { page: i + 1, avail: Math.round(body.getBoundingClientRect().height - usedByOthers),
    cards: cards.map(h), total: cards.reduce((a, c) => a + h(c), 0) };
}).filter(Boolean));

out.forEach(o => console.log('page ' + String(o.page).padStart(2) + '  available ' + String(o.avail).padStart(4)
  + '  used ' + String(o.total).padStart(4) + '  spare ' + String(o.avail - o.total).padStart(4)
  + '  cards [' + o.cards.join(', ') + ']'));
const all = out.flatMap(o => o.cards);
console.log('cards: ' + all.length + ', min ' + Math.min(...all) + ', max ' + Math.max(...all) + ', mean ' + Math.round(all.reduce((a, x) => a + x, 0) / all.length));
fs.unlinkSync(tmp);
await b.close();
