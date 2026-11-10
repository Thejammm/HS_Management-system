// ══════════════════════════════════════════════════════════════
//  No red anywhere, and no orange close to red (Simon, 6 November 2026). In the
//  source, however a colour is written; then every tab, drawn, in each view and in
//  the dark theme, with risks in every band and everything overdue; then the plan
//  and the Top 5 sheet on paper.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('No red - every screen and every printed page in the AHS colours');
const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');

// ── the source, however a colour is written ──
{
  const files = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (!/fonts|icons|fixtures/.test(f)) walk(p); } else if (/\.(js|css|html)$/.test(f)) files.push(p); } };
  walk(path.join(REPO, 'public')); walk(path.join(REPO, 'routes'));
  const warm = (r, g, b) => { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; if (!d) return false; let h; if (M === r) h = ((g - b) / d + 6) % 6; else if (M === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; const l = (M + m) / 2, s = d / (1 - Math.abs(2 * l - 1)); return s > 0.2 && (h <= 50 || h >= 320); };
  const bad = [];
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8'), rel = path.relative(REPO, f);
    const add = (lit, r, g, b) => { if (warm(r, g, b)) bad.push(rel + ' ' + lit); };
    for (const m of s.matchAll(/#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?\b/g)) add(m[0], parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16));
    for (const m of s.matchAll(/hex\(\s*'([0-9a-fA-F]{6})'\s*\)/g)) add(m[0], parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16));
    for (const m of s.matchAll(/(?:\[\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\]|(?:rgba?|Color)\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3}))/g)) { const v = m[1] !== undefined ? [m[1], m[2], m[3]] : [m[4], m[5], m[6]]; add(m[0], +v[0], +v[1], +v[2]); }
    for (const m of s.matchAll(/rgb\(\s*(\d+)\/255\s*,\s*(\d+)\/255\s*,\s*(\d+)\/255\s*\)/g)) add(m[0], +m[1], +m[2], +m[3]);
    for (const m of s.matchAll(/rgb\(\s*(0?\.\d+|0|1)\s*,\s*(0?\.\d+|0|1)\s*,\s*(0?\.\d+|0|1)\s*\)/g)) add(m[0], +m[1] * 255, +m[2] * 255, +m[3] * 255);
    for (const m of s.matchAll(/(?:color|background|background-color|border(?:-[a-z]+)?|fill|stroke|outline)\s*[:=]\s*["']?(red|crimson|firebrick|tomato|orangered|darkred|orange|coral|salmon|indianred)\b/g)) bad.push(rel + ' ' + m[0]);
    const scrubbed = s.replace(/'❌':'x'/g, '');
    for (const m of scrubbed.matchAll(/[\u{1F534}\u{1F7E0}\u{1F7E5}\u{1F7E7}\u{274C}\u{26D4}\u{1F6AB}\u{1F6D1}\u{1F6A8}\u{1F525}\u{1F6A9}\u{1F53A}\u{1F53B}\u{1F9EF}\u{1F692}]/gu)) bad.push(rel + ' ' + m[0]);
  }
  R.ok(!bad.length, 'no warm colour in the source, as a hex, a triple, a name or an emoji' + (bad.length ? ': ' + bad.slice(0, 12).join(' | ') + (bad.length > 12 ? ' and ' + (bad.length - 12) + ' more' : '') : ''));
}

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const act = (id, desc, n, extra) => Object.assign({ id, desc, owner: 'Ann Reed', due: day(n), status: 'Not started', priority: 'High' }, extra || {});
const STATE = () => ({
  riskProfile: [
    { id: 'c', activity: 'A critical risk', hazard: 'x', likelihood: '5', severity: '5', targetL: '2', targetS: '2', trend: 'Increasing', flag: true, macro: 'fire', impacts: { people: 5, money: 4, legal: 3 }, actions: [act('c1', 'Overdue critical action', -20), act('c2', 'Due this week', 3), Object.assign(act('c3', 'A control', 0), { hideFromPlan: true })] },
    { id: 'h', activity: 'A high risk', hazard: 'x', likelihood: '4', severity: '3', targetL: '2', targetS: '2', trend: 'Increasing', macro: 'height', actions: [act('h1', 'Overdue high action', -5)] },
    { id: 'm', activity: 'A medium risk', hazard: 'x', likelihood: '3', severity: '2', macro: 'people', actions: [act('m1', 'No date', 0, { due: '' })] },
    { id: 'l', activity: 'A low risk', hazard: 'x', likelihood: '1', severity: '2', targetL: '1', targetS: '2', actions: [act('l1', 'Done', -2, { status: 'Complete' })] },
    { id: 'u', activity: 'An unrated risk', actions: [] },
  ],
  actionPlan: [{ id: 'f1', desc: 'Late plan action', owner: 'Ann Reed', due: day(-30), status: 'Not started', source: 'Assurance' }],
  company: { tradingName: 'Testing Client Ltd', slt: [], personnel: [] },
});
const { browser, page, errors } = await openApp({ width: 1366, height: 900 });
const scan = () => page.evaluate(async () => {
  const warm = c => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c); if (!m) return false; let r = +m[1] / 255, g = +m[2] / 255, b = +m[3] / 255; const a = m[4] === undefined ? 1 : +m[4]; if (a <= 0.03) return false; const M = Math.max(r, g, b), n = Math.min(r, g, b), d = M - n; if (!d) return false; let h; if (M === r) h = ((g - b) / d + 6) % 6; else if (M === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; const l = (M + n) / 2, s = d / (1 - Math.abs(2 * l - 1)); return s > 0.2 && (h <= 50 || h >= 320); };
  const PROPS = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'fill', 'stroke', 'accentColor'];
  const tabs = [...document.querySelectorAll('[id^="tab-"]')].map(e => e.id.slice(4)); const out = {}, seen = [];
  const look = (root, key) => { [root, ...root.querySelectorAll('*')].forEach(e => { if (['SCRIPT', 'STYLE'].includes(e.tagName)) return; const cs = getComputedStyle(e); for (const p of PROPS) { const v = cs[p]; if (p === 'color' || (v && v !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(v))) { if (p !== 'color' && /border/.test(p) && parseFloat(cs[p.replace('Color', 'Width')]) === 0) continue; if (p === 'outlineColor' && cs.outlineStyle === 'none') continue; if (warm(v)) (out[key] = out[key] || []).push(e.tagName.toLowerCase() + '.' + String(e.className && e.className.baseVal === undefined ? e.className : '').slice(0, 30) + ' ' + p + ' ' + v + ' "' + (e.textContent || '').trim().slice(0, 24) + '"'); } } const bi = cs.backgroundImage; if (bi && bi !== 'none') (bi.match(/rgba?\([^)]*\)/g) || []).forEach(c => { if (warm(c)) (out[key] = out[key] || []).push(e.tagName.toLowerCase() + ' gradient ' + c); }); }); };
  for (const t of tabs) { try { if (document.querySelector('[data-tab="' + t + '"]')) { switchTab(t); await new Promise(r => setTimeout(r, 30)); } const el = document.getElementById('tab-' + t); if (el) { look(el, t); seen.push(t); } } catch (e) { out[t] = ['THROW ' + e.message]; } }
  look(document.querySelector('.sidebar') || document.body, 'sidebar');
  return { out, n: seen.length };
});
const report = (label, res) => { const keys = Object.keys(res.out); R.ok(res.n > 20 && !keys.length, label + ' (' + res.n + ' tabs)' + (keys.length ? ': ' + keys.map(k => k + ' x' + res.out[k].length + ' e.g. ' + res.out[k][0]).slice(0, 6).join(' || ') : '')); };

// ── every tab, drawn: the consultant ──
await seed(page, STATE(), 'cockpit'); await wait(page, 300);
report('no tab shows a warm colour, risks in every band and everything overdue', await scan());
// ── the older screens by name ──
{
  const t = await page.evaluate(() => { switchTab('cockpit'); const K = document.getElementById('tab-cockpit'); const od = [...K.querySelectorAll('*')].find(e => /^\d+$/.test((e.textContent || '').trim()) && /actions? overdue/i.test((e.parentElement || {}).textContent || '')); switchTab('execplan'); return { odColour: od ? getComputedStyle(od).color : '', band: _RISK_PRIO_COLOR.Critical, low: _RISK_PRIO_COLOR.Low, rag: RAG_COLOR.red, ladder: _LADDER_BAND.Critical }; });
  R.ok(t.odColour === 'rgb(31, 41, 55)', 'the cockpit\'s "actions overdue" figure is in ink: ' + t.odColour);
  R.ok(t.band === t.ladder && t.rag === t.ladder && t.low === '#3E9DAF', 'the risk bands and overdue marks read the ladder\'s palette');
}
// ── the words follow: nothing on any screen tells you something is red ──
{
  const t = await page.evaluate(async () => { const hits = []; for (const e of document.querySelectorAll('[id^="tab-"]')) { try { if (!document.querySelector('[data-tab="' + e.id.slice(4) + '"]')) continue; switchTab(e.id.slice(4)); await new Promise(r => setTimeout(r, 20)); const w = (document.getElementById(e.id).innerText || '').match(/[^.\n]{0,50}\b(in red|turns red|turn red|become red|red,? amber|amber or red|traffic.light|RAG)\b[^.\n]{0,30}/); if (w) hits.push(e.id + ': ' + w[0]); } catch (x) {} } return hits; });
  R.ok(!t.length, 'no screen names a colour it no longer shows' + (t.length ? ': ' + t.join(' | ') : ''));
}
// ── the client's view, then the dark theme ──
await page.evaluate(() => { if (typeof applyViewMode === 'function') { _viewMode = 'management'; applyViewMode(); } }); await wait(page, 200);
report('nor in the client\'s view', await scan());
await page.evaluate(() => { _viewMode = 'consultant'; applyViewMode(); document.documentElement.setAttribute('data-theme', 'dark'); }); await wait(page, 200);
report('nor in the dark theme', await scan());
{
  const t = await page.evaluate(() => { switchTab('execplan'); const e = document.querySelector('[style*="color:#1F2937"]'); return e ? getComputedStyle(e).color : 'none'; });
  R.ok(t === 'none' || t !== 'rgb(31, 41, 55)', 'and the ink does not go dark on dark: ' + t);
}
await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); });

// ── the sheet, drawn, and on paper ──
{
  await seed(page, STATE(), 'cockpit'); await wait(page, 200);
  const t = await page.evaluate(async () => {
    const warm = c => { const r = c.red, g = c.green, b = c.blue, M = Math.max(r, g, b), n = Math.min(r, g, b), d = M - n; if (!d) return false; let h; if (M === r) h = ((g - b) / d + 6) % 6; else if (M === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; const l = (M + n) / 2, s = d / (1 - Math.abs(2 * l - 1)); return s > 0.2 && (h <= 50 || h >= 320); };
    const bad = [], P = PDFLib.PDFPage.prototype, keep = {}; let drawn = 0;
    for (const k of ['drawText', 'drawRectangle', 'drawLine', 'drawSvgPath', 'drawCircle', 'drawEllipse']) { keep[k] = P[k]; P[k] = function (a, b) { const o = b || a || {}; for (const c of [o.color, o.borderColor]) if (c && c.type === 'RGB') { drawn++; if (warm(c)) bad.push(k + ' ' + JSON.stringify(c)); } return keep[k].call(this, a, b); }; }
    const out = {}; try { switchTab('execplan'); await buildActionPlanPDF(); out.plan = true; } catch (e) { out.plan = e.message; }
        for (const k in keep) P[k] = keep[k];
    return { bad, drawn, out };
  });
  R.ok(t.out.plan === true && t.drawn > 20 && !t.bad.length, 'the plan on paper draws no warm colour (' + t.drawn + ' marks)' + (t.bad.length ? ': ' + t.bad.slice(0, 4).join(' | ') : ''));
}
await R.done(browser, errors);
