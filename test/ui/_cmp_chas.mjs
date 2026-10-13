// one-off: the Accreditation tab for CHAS / SSIP-only clients, original app vs this branch
import { openApp, seed, wait } from './harness.mjs';
const cases = [
  { name: 'CHAS client with a CAS assessment', st: { company: { tradingName: 'Chas Ltd' }, accred: { roles: ['contractor'], schemes: { chas: { on: true } }, answers: {} }, cas: { status: { '71': 'evidenced', '72': 'gap' } } } },
  { name: 'SSIP-only client, no journey', st: { company: { tradingName: 'Ssip Ltd' }, cas: { status: { '86': 'evidenced' }, smallCompany: true } } },
  { name: 'client with nothing set', st: { company: { tradingName: 'Blank Ltd' } } }
];
const grab = async file => {
  const { browser, page, errors } = await openApp({ file }); const out = [];
  for (const c of cases) { await seed(page, c.st, 'cas'); await wait(page, 400); out.push(await page.evaluate(() => document.getElementById('tab-cas').innerHTML)); }
  await browser.close(); return { out, errors };
};
const a = await grab(process.env.OLD_APP);
const b = await grab(process.env.NEW_APP);
cases.forEach((c, i) => {
  const x = a.out[i], y = b.out[i];
  if (x === y) { console.log('SAME ' + c.name + ' (' + x.length + ' chars)'); return; }
  let k = 0; while (k < x.length && x[k] === y[k]) k++;
  let e = 0; while (e < x.length - k && x[x.length - 1 - e] === y[y.length - 1 - e]) e++;
  console.log('DIFFERENT ' + c.name);
  console.log('  OLD: ' + x.slice(Math.max(0, k - 120), x.length - e + 40).slice(0, 700));
  console.log('  NEW: ' + y.slice(Math.max(0, k - 120), y.length - e + 40).slice(0, 700));
});
console.log('page errors', a.errors, b.errors);
