// Look at the plan the way Simon will: theme view, month view, and one
// expanded row with the Work on this button.
import fs from 'node:fs';
import { openApp, seed, wait, RISKS } from './harness.mjs';

const OUT = process.argv[2] || '.';
const { browser, page, errors } = await openApp();

const PLAN = () => {
  const rs = RISKS();
  const by = (id) => rs.find(r => r.id === id);
  by('v1').actions.push({ id: 'v1a2', desc: 'Service the extinguishers and log the certificates', owner: 'Dee', due: '2027-03-01', status: 'Not started', priority: 'Medium' });
  by('v2').actions.push({ id: 'v2a1', desc: 'Buy a proper roof-edge system for the survey team', owner: 'Ash', due: '2027-02-01', status: 'In progress', priority: 'High' });
  by('v2').actions.push({ id: 'v2a2', desc: 'Brief the survey team on fragile roofs', owner: 'Ash', due: '2026-08-01', status: 'Complete', completedDate: '2026-08-02', completedBy: 'Ash' });
  by('v3').actions.push({ id: 'v3a1', desc: 'Write the driving-for-work policy', owner: 'Bev', due: '2026-07-01', status: 'Complete', completedDate: '2026-07-04', completedBy: 'Bev' });
  by('v4').actions.push({ id: 'v4a1', desc: 'Get the stores racking re-laid so nothing is lifted above shoulder height', owner: 'Dee', due: '2026-10-15', status: 'Not started', priority: 'Medium' });
  by('v5').actions.push({ id: 'v5a1', desc: 'Sign the second key customer', owner: 'Simon', due: '2026-01-31', status: 'Not started', priority: 'Critical' });
  return rs;
};

await seed(page, { company: { legalName: 'Testing Client Ltd' }, riskProfile: PLAN(), actionPlan: [
  { id: 'f1', desc: 'Renew the employers liability certificate', owner: 'Bev', due: '2027-01-31', status: 'Not started', source: 'Assurance' }] }, 'execplan');
await wait(page, 700);

const shoot = async (name, fn) => {
  if (fn) { await page.evaluate(fn); await wait(page, 600); }
  const el = await page.$('#epYearCard');
  await el.screenshot({ path: OUT + '/_ep_' + name + '.png' });
  console.log('wrote _ep_' + name + '.png');
};

await shoot('theme');
await shoot('month', () => setEpGroupBy('month'));
await shoot('open', () => {
  setEpGroupBy('theme');
  const a = _execActions().find(x => x.desc.indexOf('Buy a proper') === 0);
  _execRowOpen = {}; _execRowOpen[encodeURIComponent(JSON.stringify(a.ref))] = true;
  renderExecPlan();
});
console.log(errors.length ? ('PAGE ERRORS: ' + errors.join(' | ')) : 'no page errors');
await browser.close();
