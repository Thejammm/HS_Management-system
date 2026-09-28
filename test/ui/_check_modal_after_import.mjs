// After importing the questionnaire, what does Review / update answers show?
//   node test/ui/_check_modal_after_import.mjs "<filled pdf>"
import fs from 'node:fs';
import { openApp, wait } from './harness.mjs';

const bytes = Array.from(fs.readFileSync(process.argv[2]));
const { browser, page, errors } = await openApp();

const out = await page.evaluate(async (bytesArr) => {
  S.company = { legalName: 'Testing Client Ltd', employees: '9' };
  S.riskProfile = []; S.actionPlan = [];
  S.profiler = { exposure: {}, maturity: {}, discNotes: {}, sectors: {}, judgement: {} };
  const file = new File([new Uint8Array(bytesArr)], 'q.pdf', { type: 'application/pdf' });
  await _discImportFile(file);
  const p = _profState();
  const sectorsAfter = Object.keys(p.sectors || {}).filter(k => p.sectors[k] === true);
  const st = _discStats();
  // what the wizard would show, page by page
  _discShowAll = false; _discIdx = 0;
  const pages = _discPages().map(pg => pg.sector ? { page: 'sector gate' } : ({
    page: pg.d.name, shown: pg.items.length, hidden: pg.hidden,
    unanswered: pg.items.filter(it => p.exposure[it.id] !== true && p.exposure[it.id] !== false).length,
    ids: pg.items.map(it => it.id),
  }));
  return { sectorsAfter, stats: st,
    pre2000Visible: _discVisible('b_survey_pre2000'),
    pre2000Answered: p.exposure.b_survey_pre2000,
    pages,
    bank: _discDomains().reduce((a, d) => a + d.items.length, 0) };
}, bytes);

console.log('sectors carried by the import: ' + (out.sectorsAfter.length ? out.sectorsAfter.join(', ') : 'NONE'));
console.log('question bank: ' + out.bank + ' | the app now treats ' + out.stats.total + ' as fitting this business, ' + out.stats.answered + ' answered');
console.log('"survey/design pre-2000 buildings" visible in the app? ' + out.pre2000Visible + ' (answer held: ' + out.pre2000Answered + ')');
console.log('\nwizard pages:');
out.pages.forEach(pg => console.log(pg.page === 'sector gate' ? '  1. sector gate'
  : '  - ' + pg.page + ': ' + pg.shown + ' shown, ' + pg.unanswered + ' unanswered, ' + pg.hidden + ' hidden by the gate'));
console.log(errors.length ? ('PAGE ERRORS: ' + errors.join(' | ')) : '\nno page errors');
await browser.close();
