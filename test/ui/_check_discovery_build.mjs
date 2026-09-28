// What the consultant gets after importing the questionnaire and pressing
// Build: how many themes land, and what they are.
//   node test/ui/_check_discovery_build.mjs "<path to the filled pdf>"
import fs from 'node:fs';
import { openApp, wait } from './harness.mjs';

const PDF = process.argv[2];
const bytes = Array.from(fs.readFileSync(PDF));
const { browser, page, errors } = await openApp();

const out = await page.evaluate(async (bytesArr) => {
  S.company = { legalName: 'Testing Client Ltd', employees: '9' };
  S.riskProfile = []; S.actionPlan = [];
  S.profiler = { exposure: {}, maturity: {}, discNotes: {}, sectors: {}, judgement: {} };
  const file = new File([new Uint8Array(bytesArr)], 'questionnaire.pdf', { type: 'application/pdf' });
  await _discImportFile(file);
  window.confirm = () => true;
  const before = S.riskProfile.length;
  buildProfileFromDiscovery();
  await new Promise(r => setTimeout(r, 600));
  const added = S.riskProfile.slice(before);
  return { added: added.length,
    names: added.map(r => r.activity).slice(0, 30),
    scored: added.filter(r => _riskScore(r).rating).length,
    withAssoc: added.filter(r => String(r.assocRisk || '').trim()).length,
    withControls: added.filter(r => (r.actions || []).some(a => a.hideFromPlan)).length,
    withPlan: added.filter(r => (r.actions || []).some(a => !a.hideFromPlan)).length,
    planRows: _execActions().length,
    macros: [...new Set(added.map(r => _macroName(_riskMacroOf(r))))].sort(),
    toast: (document.getElementById('toast') || {}).textContent || '' };
}, bytes);

console.log('After Build profile from discovery:');
console.log('  toast:     ' + out.toast);
console.log('  risks:     ' + out.added + ' added, ' + out.scored + ' pre-scored, ' + out.withAssoc + ' with an associated risk');
console.log('  content:   ' + out.withControls + ' carry high level controls, ' + out.withPlan + ' carry plan actions');
console.log('  plan:      ' + out.planRows + ' rows on the client execution plan');
console.log('  grouped:   ' + out.macros.join(' | '));
console.log('\n  themes:');
out.names.forEach(n => console.log('   - ' + n));
console.log(errors.length ? ('  PAGE ERRORS: ' + errors.join(' | ')) : '\n  no page errors');
await browser.close();
