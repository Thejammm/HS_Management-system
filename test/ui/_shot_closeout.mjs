// Look at the close-out the way the consultant sees it: the modal on
// completion, and what it reads back on the plan afterwards.
import { openApp, seed, wait, RISKS } from './harness.mjs';

const OUT = process.argv[2] || '.';
const { browser, page, errors } = await openApp();

await seed(page, { company: { legalName: 'Testing Client Ltd', personnel: [] }, riskProfile: RISKS() }, 'execplan');
await wait(page, 600);

await page.evaluate(() => {
  const a = _execActions().find(x => x.desc.indexOf('Write the fire') === 0);
  updateExecAction(encodeURIComponent(JSON.stringify(a.ref)), 'status', 'Complete');
});
await wait(page, 700);
await (await page.$('#evidOverlay > div')).screenshot({ path: OUT + '/_co_modal.png' });
console.log('wrote _co_modal.png');

await page.evaluate(() => {
  const pick = (id, k) => { document.getElementById(id).checked = true; _embedToggle(k); };
  pick('_embDocOn', 'doc'); pick('_embRoutineOn', 'routine'); pick('_embOwnerOn', 'owner');
  document.getElementById('_embDocName').value = 'Fire evacuation procedure v1';
  document.getElementById('_embRtItem').value = 'Fire drill and alarm test';
  document.getElementById('_embRtFreq').value = '6-monthly'; _embedToggle('routine');
  document.getElementById('_embRtOwner').value = 'Dee Marsh';
  document.getElementById('_embOwName').value = 'Dee Marsh';
  document.getElementById('_embOwRole').value = 'Fire warden';
});
await wait(page, 350);
await (await page.$('#evidOverlay > div')).screenshot({ path: OUT + '/_co_filled.png' });
console.log('wrote _co_filled.png');

await page.evaluate(() => {
  document.querySelector('.evid-name').value = 'Fire drill record Sept 2026';
  _saveCloseOut();
  const a = _execActions().find(x => x.desc.indexOf('Write the fire') === 0);
  _execRowOpen = {}; _execRowOpen[encodeURIComponent(JSON.stringify(a.ref))] = true;
  setEpGroupBy('month'); renderExecPlan();
});
await wait(page, 700);
await (await page.$('#epDeliveredCard')).screenshot({ path: OUT + '/_co_plan.png' });
console.log('wrote _co_plan.png');
console.log(errors.length ? ('PAGE ERRORS: ' + errors.join(' | ')) : 'no page errors');
await browser.close();
