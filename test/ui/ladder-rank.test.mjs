// ══════════════════════════════════════════════════════════════
//  The risk ladder ranks each band by the current (residual) rating, highest
//  first, and outlines operational risks (Simon, 2026-10-07: "fire seems to be
//  near the bottom but it's one of the most risky things this business does" -
//  each band held its risks in the order they were added to the register).
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Risk ladder - ranked by current rating, operational risks outlined');
const { browser, page, errors } = await openApp();

const r = (id, activity, l, s, extra) => Object.assign({ id, activity, likelihood: String(l), severity: String(s), actions: [] }, extra || {});
// register order deliberately NOT the risk order: fire is added last
await seed(page, { company: { legalName: 'Fineline Group Ltd' }, riskProfile: [
  r('m1', 'Display screen equipment', 3, 2),           // 6, severity 2
  r('m2', 'Manual handling of survey kit', 2, 3),      // 6, severity 3
  r('m3', 'Contractor management', 2, 4),              // 8
  r('o1', 'Loss of the key client contract', 3, 3, { mode: 'ops' }),   // 9, operational
  r('h1', 'Driving for work', 3, 4),                   // 12
  r('c1', 'Asbestos on intrusive surveys', 4, 4),      // 16
  r('f1', 'Fire breaking out at the studio', 4, 5),    // 20 - added last
] }, 'cockpit');
await wait(page, 600);

const t = await page.evaluate(() => {
  const bands = [...document.querySelectorAll('.ckl-band')].map(b => ({ n: b.querySelector('.ckl-band-n').textContent,
    rows: [...b.querySelectorAll('.ckl-line')].map(l => ({ name: l.querySelector('.ckl-title').textContent, score: +l.querySelector('.ckl-score').textContent,
      ops: l.classList.contains('ckl-ops'), tag: !!l.querySelector('.ckl-opstag'), out: getComputedStyle(l).outlineStyle })) }));
  const panel = document.querySelector('.ckl');
  return { bands, overflow: panel.scrollWidth > panel.clientWidth + 1, cols: [...document.querySelectorAll('.ckl-cols span')].map(s => s.textContent) };
});
const band = n => (t.bands.find(b => b.n === n) || { rows: [] }).rows;
const crit = band('CRITICAL'), med = band('MEDIUM');
R.ok(crit.length === 2 && /^Fire/.test(crit[0].name) && crit[0].score === 20, 'fire, added last, heads Critical on its rating of 20 (' + crit.map(x => x.score + ' ' + x.name).join(' | ') + ')');
R.ok(t.bands.every(b => b.rows.every((x, i) => !i || b.rows[i - 1].score >= x.score)), 'every band runs highest current rating first');
R.ok(med.length === 4 && med.map(x => x.score).join() === '9,8,6,6' && /Manual handling/.test(med[2].name), 'an equal rating goes to the worse severity - manual handling (severity 3) before display screens (severity 2): ' + med.map(x => x.score + ' ' + x.name).join(' | '));
const ops = med.find(x => /key client/.test(x.name)), hs = med.find(x => /Contractor/.test(x.name));
R.ok(ops && ops.ops && ops.tag && ops.out === 'dashed', 'an operational risk is outlined (dashed) and tagged Operational');
R.ok(hs && !hs.ops && !hs.tag && hs.out !== 'dashed', 'a health and safety risk is not');
R.ok(t.cols.join('|') === 'Ref|Risk|Score|Top 5|Sheet', 'the columns are labelled: ' + t.cols.join(' | '));
R.ok(!t.overflow, 'the ladder never scrolls sideways');

// narrow: no sideways scroll, the title still there
await page.setViewport({ width: 400, height: 900 });
await wait(page, 300);
const n = await page.evaluate(() => { const p = document.querySelector('.ckl'); const l = p.querySelector('.ckl-line'); return { overflow: p.scrollWidth > p.clientWidth + 1, title: l.querySelector('.ckl-main').getBoundingClientRect().width, size: parseFloat(getComputedStyle(l.querySelector('.ckl-title')).fontSize) }; });
R.ok(!n.overflow && n.title > 200 && n.size >= 13, 'on a phone the ladder fits, each title keeps its full width and size (' + Math.round(n.title) + 'px, ' + n.size + 'px)');

await R.done(browser, errors);
