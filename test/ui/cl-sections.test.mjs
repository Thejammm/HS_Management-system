// ══════════════════════════════════════════════════════════════
//  Constructionline sections - the portal mirror in the Accreditation tab.
//  Accreditation engine step 1 (spec 13 October 2026): one line per portal
//  question, Building Safety Act last, the tracker's columns and colours;
//  a CHAS client sees exactly what it saw before.
//  Run: node test/ui/cl-sections.test.mjs
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Constructionline sections - the portal mirror');
const { browser, page, errors } = await openApp({ width: 1500 });

// a designer test client, as EDL in October 2026
await seed(page, { company: { tradingName: 'Test Designer Ltd', shortName: 'TDL' }, accred: { roles: ['designer'], schemes: { cl: { on: true } }, answers: {},
  cl: { valid: { 'Health and Safety': '2026-08-05', 'Once For All Health & Safety - (SSIP)': '2026-09-26', 'Insurances': '2027-03-24' } } } }, 'cas');
{
  const t = await page.evaluate(() => {
    const sec = document.getElementById('aclSections');
    const heads = [...sec.querySelectorAll('.acl-bname')].map(x => x.textContent.trim());
    const first = sec.querySelector('.acl-block');
    const th = [...first.querySelectorAll('thead th')].map(x => x.textContent.trim());
    const row = [...first.querySelectorAll('tbody tr')].find(tr => /Question 1\.1\)/.test(tr.textContent));
    const cells = row ? [...row.children].map(td => td.textContent.trim()) : [];
    const exp = row ? [...row.querySelectorAll('.acl-exp')].map(td => td.className) : [];
    const ins = [...sec.querySelectorAll('.acl-block')].find(b => /^Insurances/.test(b.querySelector('.acl-bname').textContent));
    return { heads, th, cells, exp, insOpen: ins.classList.contains('open'), insPill: ins.querySelector('.acl-pill').className,
      counts: [...sec.querySelectorAll('.acl-counts span')].map(x => x.textContent) };
  });
  R.ok(t.heads[0].startsWith('Health and Safety and Once For All Health & Safety'), 'the designer view opens with Health and Safety, the SSIP set riding on it: ' + t.heads[0]);
  const firstBsa = t.heads.findIndex(h => /^Building Safety Act/.test(h));
  R.ok(firstBsa > 0 && t.heads.slice(firstBsa).every(h => /^Building Safety Act/.test(h)), 'the Building Safety Act sections are last');
  R.ok(t.th.join('|') === 'No|Constructionline question|Expected evidence|Action|Status|H&S ref|Valid until|SSIP ref|SSIP valid until|Done', 'the tracker columns: ' + t.th.join('|'));
  R.ok(t.cells.includes('3455') && t.cells.includes('2906'), 'HS-01 carries its H&S REF 3455 and SSIP REF 2906');
  R.ok(t.exp.every(c => /acl-red/.test(c)), 'expired H&S and SSIP dates show pastel red');
  R.ok(!t.insOpen && /acl-green/.test(t.insPill), 'a section in date for more than 90 days is green and folded away');
  R.ok(t.counts[0] === 'TDL to do' && t.counts[1] === 'AHS Ltd to do', 'the counts name the client by its short name, as the tracker does');
}
{
  // record a status, an action, a done date and a valid until date: they stay put
  const t = await page.evaluate(() => {
    const sec = document.getElementById('aclSections');
    const row = [...sec.querySelector('.acl-block').querySelectorAll('tbody tr')].find(tr => /Question 1\.2\)/.test(tr.textContent));
    const sel = row.querySelector('select.acl-st'); sel.value = 'covered'; sel.dispatchEvent(new Event('change'));
    const row2 = [...document.getElementById('aclSections').querySelector('.acl-block').querySelectorAll('tbody tr')].find(tr => /Question 1\.2\)/.test(tr.textContent));
    const ta = row2.querySelectorAll('textarea')[1]; ta.value = 'Covered in item 1.'; ta.dispatchEvent(new Event('input'));
    const d = row2.querySelector('input.acl-donein'); d.value = '2026-10-12'; d.dispatchEvent(new Event('change'));
    setAclValid('Building Safety Act - Building Safety', '2026-12-01');
    const key = Object.keys(S.accred.cl.rows)[0];
    const bsa = [...document.querySelectorAll('#aclSections .acl-block')].find(b => b.querySelector('.acl-bname').textContent.startsWith('Building Safety Act - Building Safety'));
    return { key, row: S.accred.cl.rows[key], valid: S.accred.cl.valid['Building Safety Act - Building Safety'], bsaPill: bsa.querySelector('.acl-pill').className,
      done: document.querySelectorAll('#aclSections .acl-counts b')[3].textContent };
  });
  R.ok(t.row.st === 'covered' && t.row.act === 'Covered in item 1.' && t.row.done === '2026-10-12', 'status, action and done are recorded against the line: ' + JSON.stringify(t.row));
  R.ok(t.valid === '2026-12-01' && /acl-amber/.test(t.bsaPill), 'a valid until date within 90 days turns the section amber');
  R.ok(t.done === '1', 'the done line is counted as ticked done');
}
// a contractor test client, as ECL
await seed(page, { company: { tradingName: 'Test Contractor Ltd', shortName: 'TCL' }, accred: { roles: ['contractor'], schemes: { cl: { on: true } }, answers: {}, cl: { valid: { Insurances: '2026-10-22' } } } }, 'cas');
{
  const t = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('#aclSections .acl-bname')].map(x => x.textContent.trim());
    const ins = [...document.querySelectorAll('#aclSections .acl-block')].find(b => /^Insurances/.test(b.querySelector('.acl-bname').textContent));
    const ssip = [...document.querySelectorAll('#aclSections .acl-block')].find(b => /^Once For All Health & Safety/.test(b.querySelector('.acl-bname').textContent));
    const q6 = [...ssip.querySelectorAll('tbody tr')].find(tr => /Question 6\)/.test(tr.textContent));
    return { heads, ins: ins.querySelector('.acl-pill').className, q6: q6 ? [...q6.children].map(td => td.textContent.trim()) : [],
      set: [...document.querySelectorAll('#aclSections .acj-seg .acj-btn')].map(b => b.textContent + ':' + b.getAttribute('aria-pressed')).join(' ') };
  });
  R.ok(t.set === 'Designer:false Contractor:true', 'the contractor question set follows from the role');
  R.ok(t.heads.includes('Health and Safety and Health and Safety Third Party / Exemption certificates'), 'the contractor Health and Safety section sits inside the Third Party section, as in the ECL tracker');
  R.ok(/acl-amber/.test(t.ins), 'insurances valid until 22 October is amber');
  R.ok(t.q6.includes('2845') && /HS-15 · SSIP Q6/.test(t.q6[1]), 'SSIP Q6 is the CAS question HS-15, REF 2845 in the SSIP column');
}
// a CHAS client: no Constructionline, so nothing new appears
await seed(page, { company: { tradingName: 'Chas Only Ltd' }, accred: { roles: ['contractor'], schemes: {}, answers: {} }, cas: { status: { '71': 'evidenced' } } }, 'cas');
{
  const t = await page.evaluate(() => ({ sec: !!document.getElementById('aclSections'), journey: !!document.getElementById('accredJourney').innerHTML, legacy: !!document.getElementById('casLegacy') }));
  R.ok(!t.sec && t.journey && t.legacy, 'without Constructionline there is no section view; the journey and the CAS assessment are as before');
}
await R.done(browser, errors);
