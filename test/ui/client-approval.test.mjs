// ══════════════════════════════════════════════════════════════
//  Client approve or query - accreditation engine step 4. AHS Ltd sends a
//  document for approval; the client approves and signs it or sends a
//  query; the query reaches Triage; every click is logged on the document.
//  Run: node test/ui/client-approval.test.mjs
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Client approval - approve and sign, or query, all logged');
const { browser, page, errors } = await openApp();
await seed(page, { company: { tradingName: 'Test Designer Ltd', shortName: 'TDL' },
  documents: [{ id: 'd1', name: '01 Health and Safety Policy', version: 'v1', dated: '2026-10-01', link: 'https://example.com/hs.pdf' },
              { id: 'd2', name: '36 Health and Safety Advice Record', version: 'v1', dated: '2026-10-05' }] }, 'signoff');
// as AHS Ltd (offline is the consultant): send both for approval
{
  const t = await page.evaluate(() => {
    sendDocForApproval('d1'); sendDocForApproval('d2');
    const card = document.querySelector('#clientApprovals .ap-card');
    return { text: card ? card.innerText : '', log: S.documents[0].approvalLog.map(e => e.action + '|' + e.role + '|' + e.version) };
  });
  R.ok(/Documents for TDL to approve/i.test(t.text) && /2 to do/i.test(t.text), 'the Sign-off tab lists the documents for the client to approve');
  R.ok(t.log.join() === 'sent|consultant|v1', 'sending is logged: ' + t.log.join());
}
// now as the client's login
await page.evaluate(() => { window.__realUser = Auth.user; Auth.user = () => ({ id: 'u7', name: 'Robert Smith', email: 'robert@tdl.example', role: 'client_user' }); _renderClientApprovals(); });
{
  const t = await page.evaluate(() => {
    approveDoc('d1');
    const q = document.getElementById('apQ-d2'); q.value = 'The advice record names the old office address.';
    queryDoc('d2');
    const d1 = S.documents.find(d => d.id === 'd1'), d2 = S.documents.find(d => d.id === 'd2');
    const card = document.querySelector('#clientApprovals .ap-card').innerText;
    return { a: d1.approvalLog.slice(-1)[0], q: d2.approvalLog.slice(-1)[0], card,
      s1: AccredCore.approvalOf(d1).status, s2: AccredCore.approvalOf(d2).status };
  });
  R.ok(t.a.action === 'approved' && t.a.by === 'Robert Smith' && t.a.role === 'client_user' && t.a.version === 'v1' && /^\d{4}-\d{2}-\d{2}T/.test(t.a.at), 'Approve and sign is logged with the date, the user and the version');
  R.ok(t.q.action === 'query' && t.q.text === 'The advice record names the old office address.' && t.q.by === 'Robert Smith', 'the query is logged with its words');
  R.ok(t.s1 === 'approved' && t.s2 === 'query', 'one approved, one with a query open');
  R.ok(/Approved and signed by Robert Smith for TDL/.test(t.card), 'the card says who approved, for the company');
}
await page.evaluate(() => { Auth.user = window.__realUser; });
// back as AHS Ltd: the query is in Triage; answer it
{
  const t = await page.evaluate(() => {
    switchTab('triage');
    const before = document.getElementById('triageQueries').innerText;
    const qid = S.documents.find(d => d.id === 'd2').approvalLog.find(e => e.action === 'query').id;
    document.getElementById('apA-' + qid).value = 'Corrected in v2, sent again.';
    answerDocQuery('d2', qid);
    const after = document.getElementById('triageQueries').innerText;
    return { before, after, last: S.documents.find(d => d.id === 'd2').approvalLog.slice(-1)[0] };
  });
  R.ok(/The advice record names the old office address/.test(t.before) && /36 Health and Safety Advice Record/.test(t.before), 'the query appears in Triage for AHS Ltd');
  R.ok(t.last.action === 'answered' && t.last.text === 'Corrected in v2, sent again.', 'the answer is logged against the query');
  R.ok(/No client queries waiting/.test(t.after), 'and the query leaves Triage');
}
{
  // the log shows on the document; a new version needs approving again
  const t = await page.evaluate(() => {
    switchTab('documents');
    const reg = [...document.querySelectorAll('#documentsContainer tbody tr')].find(tr => /01 Health and Safety Policy/.test(tr.textContent)).innerText;
    openDocModal('d1');
    const modal = document.querySelector('.modal-body, #modalBody, .modal') ? document.body.innerText : '';
    closeModal();
    const d1 = S.documents.find(d => d.id === 'd1'); d1.version = 'v2';
    return { reg, modal: /Client approval log[\s\S]*Approved and signed[\s\S]*Robert Smith/.test(modal), after: AccredCore.approvalOf(d1).label };
  });
  R.ok(/Approved and signed by Robert Smith/.test(t.reg), 'the document register shows the approval on the document');
  R.ok(t.modal, 'the document form shows the approval log');
  R.ok(t.after === 'New version to approve', 'a new version needs approving again');
}
{
  // employees never see the approval card
  const t = await page.evaluate(() => { setViewMode('employee'); switchTab('signoff'); const n = document.getElementById('clientApprovals').innerHTML.length; setViewMode('consultant'); return n; });
  R.ok(t === 0, 'the employee view has no approval card');
}
await R.done(browser, errors);
