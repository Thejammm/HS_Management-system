// ══════════════════════════════════════════════════════════════
//  Service package and calendar - accreditation engine step 5. A client
//  on Standard gets monthly inspections and toolbox talks scheduled on the
//  Monthly tab; completing one files a tagged record in the evidence
//  register. Prices are left for AHS Ltd to enter.
//  Run: node test/ui/service-calendar.test.mjs
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Service package and calendar');
const { browser, page, errors } = await openApp();
await seed(page, { company: { tradingName: 'Test Contractor Ltd', shortName: 'TCL' }, accred: { roles: ['contractor'], schemes: { cl: { on: true } }, answers: {} } }, 'company');
{
  const t = await page.evaluate(() => {
    applyViewMode();
    const hidden = document.querySelector('.tab-btn[data-tab="monthly"]').style.display === 'none';
    const card = document.getElementById('coPkgCard');
    [...card.querySelectorAll('.fs-btn')].find(b => b.textContent === 'Standard').click();
    return { hidden, shown: document.querySelector('.tab-btn[data-tab="monthly"]').style.display !== 'none', pkg: S.accred.package };
  });
  R.ok(t.hidden, 'without a package or linked inspections the Monthly tab stays hidden, as before');
  R.ok(t.pkg.id === 'standard' && /^\d{4}-\d{2}$/.test(t.pkg.start), 'choosing Standard in Company setup sets the package and the start month');
  R.ok(t.shown, 'and the Monthly tab appears');
}
{
  const t = await page.evaluate(() => {
    S.accred.package.start = '2026-11'; switchTab('monthly');
    const lines = [...document.querySelectorAll('#serviceCalendar .svc-line .svc-lt b')].map(b => b.textContent);
    const prices = [...document.querySelectorAll('#serviceCalendar .svc-price')].map(i => i.value);
    return { c1: lines.filter(x => x === 'C1').length, c2: lines.filter(x => x === 'C2').length, d1: lines.filter(x => x === 'D1').length, prices,
      head: document.querySelector('#serviceCalendar .card-band h3').textContent };
  });
  R.ok(/Standard package/.test(t.head), 'the Monthly tab shows the Standard service calendar');
  R.ok(t.c1 === 12 && t.c2 === 12, 'twelve monthly site inspections and twelve toolbox talks are scheduled: ' + t.c1 + ', ' + t.c2);
  R.ok(t.d1 === 0, 'designer services are left out for a contractor');
  R.ok(t.prices.length > 0 && t.prices.every(v => v === ''), 'every price is blank until AHS Ltd enters one');
}
{
  // enter a price: the yearly value follows without rebuilding the box
  const t = await page.evaluate(() => {
    document.querySelector('#serviceCalendar .svc-pk').open = true;
    const inp = [...document.querySelectorAll('#serviceCalendar .svc-price')][4];   // C1
    inp.focus(); inp.value = '300'; inp.dispatchEvent(new Event('input'));
    return { same: document.activeElement === inp, stored: S.accred.package.prices.C1, yearly: document.getElementById('svcY-C1').textContent, total: document.getElementById('svcTotals').innerText };
  });
  R.ok(t.stored === '300' && t.same, 'the price is stored as typed, the cursor stays put');
  R.ok(t.yearly === '£3,600.00' && /£3,600\.00/.test(t.total), 'the yearly value and the package total follow: ' + t.yearly);
}
{
  // complete the first site inspection: it lands in the evidence register, tagged
  const t = await page.evaluate(() => {
    const x = AccredCore.serviceSchedule(S, _acjToday()).find(y => y.code === 'C1');
    const k = x.key.replace(/[^A-Za-z0-9]/g, '');
    document.getElementById('svcD-' + k).value = '2026-11-20';
    document.getElementById('svcT-' + k).value = 'Site inspection report, Genesis';
    markServiceDone(x.key);
    const done = [...document.querySelectorAll('#serviceCalendar .svc-line')].find(l => /Site inspection report, Genesis/.test(l.textContent));
    switchTab('documents');
    const row = [...document.querySelectorAll('#evidenceRegister tbody tr')].find(tr => /Site inspection report, Genesis/.test(tr.textContent));
    return { done: done ? done.innerText : '', row: row ? row.innerText : '', log: S.accred.serviceLog.length };
  });
  R.ok(t.log === 1 && /Done 20 Nov 2026/.test(t.done) && /Filed in the evidence register against HS-15 \(SSIP Q6\), HS-11 \(SSIP Q3\.3\)/.test(t.done), 'marking it done says where it was filed');
  R.ok(/HS-15 \(SSIP Q6\)/.test(t.row) && /AHS Ltd service C1/.test(t.row) && /20 Nov 2026/.test(t.row), 'the evidence register holds it, dated and tagged to SSIP Q6');
}
await R.done(browser, errors);
