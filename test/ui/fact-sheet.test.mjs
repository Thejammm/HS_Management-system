// ══════════════════════════════════════════════════════════════
//  Accreditation fact sheet in Company setup - accreditation engine step 2.
//  The facts held once; a change lists the portal sections and documents it
//  feeds; a fact that disagrees with an answer or date is listed.
//  Run: node test/ui/fact-sheet.test.mjs
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Accreditation fact sheet - facts held once');
const { browser, page, errors } = await openApp();
await seed(page, { company: { tradingName: 'Test Designer Ltd', shortName: 'TDL', address: '1 Example Street, Leeds, LS1 1AA', employees: '3', headBand: '1-4', paye: '3' },
  documents: [{ id: 'd1', name: '01 Health and Safety Policy', dated: '2026-10-01' }, { id: 'd2', name: '29 Organisation and Scope Statement' }, { id: 'd3', name: 'Training Matrix' }, { id: 'd4', name: 'Van checklist' }],
  accred: { roles: ['designer'], schemes: { cl: { on: true } }, answers: { 'HS-20': { decl: 'yes' } } } }, 'company');
{
  const t = await page.evaluate(() => {
    const card = document.getElementById('coFactCard');
    const labels = [...card.querySelectorAll('.co-field > label')].map(l => l.textContent.trim());
    const contact = [...document.querySelectorAll('#companyContainer .card')].find(c => /Contact/.test(c.querySelector('h3').textContent));
    return { labels, contactHasAddress: /address/i.test(contact.textContent), panels: document.getElementById('coFactPanels').innerText };
  });
  for (const l of ['Registered office', 'Head office', 'Directors', 'Person responsible for health and safety', 'Headcount band', 'Number on PAYE', 'Uses subcontractors', 'Works on higher-risk buildings', 'Duty holder roles', 'SSIP scheme', 'SSIP certificate start', 'SSIP certificate expiry'])
    R.ok(t.labels.includes(l), 'the fact sheet holds ' + l);
  R.ok(!t.contactHasAddress, 'the registered office is held once, on the fact sheet, not again under Contact');
  R.ok(!/Changed facts/.test(t.panels), 'nothing is listed as changed before anything changes');
}
{
  // change the headcount band: the sections and documents it feeds are listed
  const t = await page.evaluate(() => {
    [...document.querySelectorAll('#coFactCard .fs-btn')].find(b => b.textContent === '5 or more').click();
    return { text: document.getElementById('coFactPanels').innerText, band: S.company.headBand, log: S.company.factLog };
  });
  R.ok(t.band === '5+' && t.log && t.log.headBand && t.log.headBand.from === '1 to 4' && t.log.headBand.to === '5 or more', 'the change is remembered, from and to');
  R.ok(/Headcount band changed from "1 to 4" to "5 or more"/.test(t.text), 'the change is listed');
  R.ok(/Health and Safety and Once For All Health & Safety/.test(t.text) && /3374/.test(t.text), 'with the portal sections and REFs it feeds');
  R.ok(/01 Health and Safety Policy/.test(t.text) && /Training Matrix/.test(t.text) && !/Van checklist/.test(t.text), 'and the documents that carry it');
  R.ok(/headcount band is 5 or more but the number of employees is 3/i.test(t.text), 'the band now disagrees with the employees: listed as a warning');
}
{
  // change the address by typing: listed without rebuilding the field under the cursor
  const t = await page.evaluate(() => {
    const ta = [...document.querySelectorAll('#coFactCard textarea')][0];
    ta.focus(); ta.value = '1 New Street, Leeds, LS1 1AA'; ta.dispatchEvent(new Event('input'));
    return { same: document.activeElement === ta, text: document.getElementById('coFactPanels').innerText, addr: S.company.address };
  });
  R.ok(t.same && t.addr === '1 New Street, Leeds, LS1 1AA', 'typing the address keeps the cursor in the box');
  R.ok(/Registered office changed from "1 Example Street, Leeds, LS1 1AA" to "1 New Street, Leeds, LS1 1AA"/.test(t.text), 'the address change is listed');
  R.ok(/Registered Office/.test(t.text) && /301/.test(t.text) && /387/.test(t.text), 'with the Registered Office section and the address held in the H&S sections');
}
{
  // a fact filled in for the first time is not a change; a warning that agrees goes; Updated everywhere clears
  const t = await page.evaluate(() => {
    const before = Object.keys(S.company.factLog || {}).length;
    [...document.querySelectorAll('#coFactCard .fs-btn')].filter(b => b.closest('.co-field').querySelector('label').textContent === 'Uses subcontractors').find(b => b.textContent === 'Yes').click();
    const after = Object.keys(S.company.factLog || {}).length;
    clearFactChange('headBand');
    return { before, after, log: Object.keys(S.company.factLog || {}), text: document.getElementById('coFactPanels').innerText };
  });
  R.ok(t.before === t.after, 'filling in a fact for the first time is not listed as a change');
  R.ok(!/subcontractors/i.test(t.text.split('Changed facts')[0]), 'subcontractors Yes now agrees with HS-20 Yes: no warning');
  R.ok(t.log.join() === 'address', 'Updated everywhere takes the headcount off the list: ' + t.log.join());
}
{
  // the duty holder roles are the Accreditation roles, not a copy
  const t = await page.evaluate(() => {
    [...document.querySelectorAll('#coFactCard .fs-btn')].find(b => b.textContent === 'Principal Designer').click();
    const roles = S.accred.roles.slice();
    switchTab('cas');
    const pressed = [...document.querySelectorAll('#acjStage1 .acj-seg .acj-btn')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent);
    return { roles, pressed, warn: (document.querySelector('#aclSections .acl-warn') || {}).innerText || '' };
  });
  R.ok(t.roles.join() === 'designer,pd' && t.pressed.join() === 'Designer,Principal Designer', 'roles set on the fact sheet are the roles on the Accreditation tab');
  R.ok(/headcount band is 5 or more but the number of employees is 3/i.test(t.warn), 'the same warning shows above the Constructionline sections');
}
await R.done(browser, errors);
