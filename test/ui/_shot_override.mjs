// The score gate as a challenge: what it asks, and what it leaves on the risk.
import { openApp, seed, wait, RISKS } from './harness.mjs';

const OUT = process.argv[2] || '.';
const { browser, page, errors } = await openApp();

await seed(page, { riskProfile: RISKS() }, 'risk');
await page.evaluate(() => { _riskOpenModal('v1'); });
await wait(page, 500);
await page.evaluate(() => { _riskDetailTab('rating'); });
await wait(page, 500);

// what the challenge actually says
const asked = await page.evaluate(() => {
  const r = S.riskProfile.find(x => x.id === 'v1');
  r.targetL = '2'; r.targetS = '3';
  let msg = '';
  const real = window.confirm;
  window.confirm = (m) => { msg = String(m); return true; };
  const sel = document.querySelector('#rpBody .rt-current select');
  sel.value = '1'; sel.dispatchEvent(new Event('change'));
  window.confirm = real;
  return msg;
});
console.log('the challenge reads:\n  ' + asked.split('\n').join('\n  '));

await wait(page, 700);
await page.evaluate(() => { _riskDetailTab('rating'); });
await wait(page, 600);
const el = await page.$('#rpBody');
if (el) { await el.screenshot({ path: OUT + '/_ovr_rating.png' }); console.log('wrote _ovr_rating.png'); }
const rec = await page.evaluate(() => JSON.stringify((S.riskProfile.find(x => x.id === 'v1') || {}).scoreOverride || null));
console.log('recorded on the risk: ' + rec);
console.log(errors.length ? ('PAGE ERRORS: ' + errors.join(' | ')) : 'no page errors');
await browser.close();
