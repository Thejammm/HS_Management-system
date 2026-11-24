// ══════════════════════════════════════════════════════════════
//  Pop-ups do not close under the user's hands (Simon, 2026-09-03; main
//  pop-up and sign-in box found still bare 2026-11-24).
//
//  Real mouse presses, not synthetic clicks: the fault only appears when the
//  browser turns a drag into a click on the backdrop.
//   - select text inside, let go outside: stays open
//   - press outside, let go inside: stays open
//   - a plain click outside, and a tap: closes
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import { openApp, seed, wait, reporter, APP } from './harness.mjs';

const R = reporter('Pop-ups - selecting text never closes the box');
const { browser, page, errors } = await openApp();

const shown = id => page.evaluate(i => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== 'none'; }, id);
// a point on the backdrop itself, and one on something selectable inside the box
const points = id => page.evaluate(i => {
  const ov = document.getElementById(i); let out = null, inn = null;
  for (let x = 6; x < innerWidth && !out; x += 20) for (let y = 6; y < innerHeight && !out; y += 20) if (document.elementFromPoint(x, y) === ov) out = { x, y };
  for (const s of ['input:not([type=checkbox]):not([type=radio]):not([disabled])', 'textarea', 'h2,h3,p,label,div'])
    for (const e of ov.querySelectorAll(s)) {
      if (inn) break; const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
      const q = { x: r.x + Math.min(r.width / 2, 60), y: r.y + r.height / 2 }, t = document.elementFromPoint(q.x, q.y);
      if (t && t !== ov && ov.contains(t)) inn = q;
    }
  return { inn, out };
}, id);
const drag = async (a, b) => {
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up(); await wait(page, 120);
};

await seed(page, { riskProfile: [{ id: 'r1', ref: 'R1', activity: 'Test risk', harm: 'x', chosen: true }] }, 'risk');
const BOXES = [
  ['modal', 'the main pop-up', `openModal('Test box','<input value="some typed text">','<button>OK</button>')`],
  ['loginModal', 'the sign-in box', `document.getElementById('loginModal').classList.add('open')`],
  ['drilldownBg', 'the drill-down', `document.getElementById('drilldownTitle').textContent='Drill down'; document.getElementById('drilldownBg').classList.add('open')`],
  ['riskAnalysisOverlay', 'the risk analysis', `openRiskAnalysis()`],
  ['riskModalOverlay', 'the risk window', `_riskOpenModal('r1')`],
  ['zzDyn', 'a box built on the fly with the shared guard', `(function(){ const o = document.createElement('div'); o.id = 'zzDyn';
     o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center';
     o.innerHTML = '<div style="background:#fff;padding:40px"><h3>Box</h3><input value="some text"></div>'; document.body.appendChild(o); _backdropClose(o, function(){ o.remove(); }); })()`],
];
for (const [id, name, open] of BOXES) {
  await page.evaluate(open); await wait(page, 250);
  const q = await points(id);
  if (!R.ok(await shown(id) && q.inn && q.out, name + ' opens')) continue;
  await drag(q.inn, q.out); R.ok(await shown(id), name + ': text selected past the edge, it stays open');
  if (!(await shown(id))) { await page.evaluate(open); await wait(page, 250); }
  await drag(q.out, q.inn); R.ok(await shown(id), name + ': pressed outside and let go inside, it stays open');
  if (!(await shown(id))) { await page.evaluate(open); await wait(page, 250); }
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.mouse.click(q.out.x, q.out.y); await wait(page, 150); R.ok(!(await shown(id)), name + ': a click outside still closes it');
  await page.evaluate(open); await wait(page, 250); const q2 = await points(id);
  await page.touchscreen.tap(q2.out.x, q2.out.y); await wait(page, 400); R.ok(!(await shown(id)), name + ': a tap outside closes it');
}
{
  // typed and not yet saved: still there after the drag
  await page.evaluate(`openModal('Test box','<input id="zzT">','<button>OK</button>')`); await wait(page, 250);
  await page.type('#zzT', 'typed and not saved'); const q = await points('modal'); await drag(q.inn, q.out);
  R.ok(await shown('modal') && await page.$eval('#zzT', e => e.value) === 'typed and not saved', 'what was typed survives the drag');
  await page.evaluate(() => closeModal());
}
{
  // and nobody writes a bare one again
  const src = fs.readFileSync(process.env.COMPASS_APP || APP, 'utf8').split(/\r?\n/);
  const bare = src.map((l, i) => [i + 1, l]).filter(([, l]) => /(?:event|ev|e)\.target\s*===?\s*(?:this|ov|m|lm|modal|overlay|bg|el|box|document\.getElementById\([^)]*\))/.test(l)
    && /click/i.test(l) && /close|remove\(\)|display/i.test(l) && !/_downSelf/.test(l) && !/^\s*\/\//.test(l));
  R.ok(!bare.length, 'no pop-up has a bare click-to-close backdrop' + (bare.length ? ' (lines ' + bare.map(b => b[0]).join(', ') + ')' : ''));
}
await R.done(browser, errors);
