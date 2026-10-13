// ══════════════════════════════════════════════════════════════
//  Evidence register in the Documents tab - accreditation engine step 3.
//  A site inspection over 11 months old shows as needing replacement
//  against SSIP Q6; documents and records are tagged to CAS questions.
//  Run: node test/ui/evidence-register.test.mjs
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Evidence register - dated, tagged, flagged');
const { browser, page, errors } = await openApp();
await seed(page, { company: { tradingName: 'Test Contractor Ltd', shortName: 'TCL' },
  documents: [{ id: 'd1', name: '01 Health and Safety Policy', dated: '2026-09-01' }],
  siteInspections: [{ id: 'v1', kind: 'Site inspection', site: 'Riverside Depot', actual: '2025-10-01', outcome: 'Satisfactory', by: 'Simon Archer' }],
  policySignoff: { policies: [{ id: 'p1', title: 'Working at height', type: 'Toolbox talk', delivered: '2026-09-20' }], staff: [], signed: {}, log: [], logMigrated: true },
  accred: { roles: ['contractor'], schemes: { cl: { on: true } }, answers: {} } }, 'documents');
{
  const t = await page.evaluate(() => {
    const card = document.querySelector('#evidenceRegister .ev-card');
    const row = [...card.querySelectorAll('tbody tr')].find(tr => /Riverside Depot/.test(tr.textContent));
    return { has: !!card, row: row ? row.innerText : '', cls: row ? row.className : '', text: card.innerText };
  });
  R.ok(t.has, 'the Documents tab has the evidence register');
  R.ok(/HS-15 \(SSIP Q6\)/.test(t.row) && /Older than 11 months: replace it/i.test(t.row) && /ev-stale/.test(t.cls), 'the site inspection from October 2025 needs replacing against SSIP Q6');
  R.ok(/2845/.test(t.row), 'with the Constructionline REF it answers (2845)');
  R.ok(/Questions whose newest evidence is older than 11 months \(\d+\)[\s\S]*HS-15 \(SSIP Q6\)/i.test(t.text), 'SSIP Q6 is listed among the questions whose newest evidence is too old');
  R.ok(/Working at height/.test(t.text) && /HS-17 \(SSIP Q7\.4\)/.test(t.text), 'the toolbox talk is tagged to consultation, SSIP Q7.4, by itself');
  R.ok(/Questions with no evidence \((\d+)\)/i.test(t.text), 'questions with no evidence are listed');
}
{
  // tag a document through its own form
  const t = await page.evaluate(() => {
    openDocModal('d1');
    document.getElementById('docSource').value = 'AHS Ltd';
    ['HS-02', 'HS-03'].forEach(id => { document.querySelector('input[data-ev="docQ"][value="' + id + '"]').checked = true; });
    saveDocument('d1');
    const d = S.documents.find(x => x.id === 'd1');
    const row = [...document.querySelectorAll('#evidenceRegister tbody tr')].find(tr => /01 Health and Safety Policy/.test(tr.textContent));
    return { qids: d.qids, source: d.source, row: row ? row.innerText : '' };
  });
  R.ok(t.qids.join() === 'HS-02,HS-03' && t.source === 'AHS Ltd', 'the document form saves its questions and source');
  R.ok(/HS-02 \(SSIP Q1\.2\)/.test(t.row) && /AHS Ltd/.test(t.row), 'and the register shows them');
}
{
  // change the questions on a record another tab made; a filter narrows the list
  const t = await page.evaluate(() => {
    openEvTags('toolbox:p1');
    document.querySelector('input[data-ev="evT"][value="BS-11"]').checked = true;
    saveEvTags('toolbox:p1');
    setEvFilter('stale');
    const shown = [...document.querySelectorAll('#evidenceRegister tbody tr')].map(tr => tr.querySelector('b').textContent);
    setEvFilter('stale');
    return { tags: S.evidenceTags['toolbox:p1'], shown };
  });
  R.ok(t.tags.qids.join() === 'HS-17,BS-11', 'a toolbox talk can be tagged to another question too');
  R.ok(t.shown.length === 1 && /Riverside Depot/.test(t.shown[0]), 'the older-than-11-months filter shows only the site inspection');
}
{
  // the Accreditation journey sees the register
  const t = await page.evaluate(() => { const s = AccredCore.statusOf(S, AccredCore.byId('HS-17'), _acjToday()); return s.k + '|' + s.why; });
  R.ok(t === 'evidenced|From the evidence register', 'consultation (HS-17) is evidenced by the toolbox talk on the Accreditation tab: ' + t);
}
await R.done(browser, errors);
