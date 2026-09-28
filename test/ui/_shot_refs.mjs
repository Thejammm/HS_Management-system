// The risk reference on screen: the register's Ref column, and that it holds
// still when the register re-sorts.
import { openApp, seed, wait, RISKS } from './harness.mjs';

const OUT = process.argv[2] || '.';
const { browser, page, errors } = await openApp();

await seed(page, { company: { legalName: 'Testing Client Ltd' }, riskProfile: RISKS() }, 'risk');
await page.evaluate(() => { _riskRefsEnsure(); const s = document.getElementById('wfRegister'); if (s) s.open = true; _macroExpandAll(true); });
await wait(page, 600);

const before = await page.evaluate(() => S.riskProfile.map(r => r.ref + ' = ' + (r.activity || '').slice(0, 34)));
console.log('assigned in the order they became risks:');
before.forEach(x => console.log('  ' + x));

// re-score the bottom risk to Critical: the register re-sorts, the refs do not
const after = await page.evaluate(() => {
  const r = S.riskProfile.find(x => x.id === 'v4');
  r.likelihood = '5'; r.severity = '5';
  _macroExpandAll(true);
  return { onScreen: [...document.querySelectorAll('#rpTbody tr.rpt-row')].map(tr => tr.cells[1].textContent.trim() + '  ' + tr.cells[2].textContent.trim().slice(0, 30)),
    stillR004: (S.riskProfile.find(x => x.id === 'v4') || {}).ref };
});
await wait(page, 400);
console.log('\nafter re-scoring v4 to Critical, the register re-sorted:');
after.onScreen.forEach(x => console.log('  ' + x));
console.log('\nv4 still carries ' + after.stillR004);

const el = await page.$('#riskProfileTable') || await page.$('.rpt') || await page.$('#rpTbody');
if (el) { await el.screenshot({ path: OUT + '/_ref_register.png' }); console.log('wrote _ref_register.png'); }
console.log(errors.length ? ('PAGE ERRORS: ' + errors.join(' | ')) : 'no page errors');
await browser.close();
