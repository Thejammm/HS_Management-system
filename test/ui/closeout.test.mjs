// ══════════════════════════════════════════════════════════════
//  Closing an action out: the evidence that it was done, and the one question
//  that turns a finished job into something the business keeps doing. Each of
//  the four answers has to reach the tab that already owns it - a note that
//  files nowhere is the thing this replaces.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter, RISKS } from './harness.mjs';

const R = reporter('Action close-out - what keeps it in place');
const { browser, page, errors } = await openApp();

await seed(page, { company: { legalName: 'Testing Client Ltd', personnel: [] }, riskProfile: RISKS(), actionPlan: [
  { id: 'f1', desc: 'Renew the employers liability certificate', owner: 'Bev', due: '2027-01-31', status: 'Not started', source: 'Assurance' }] }, 'execplan');
await wait(page, 500);

// ── completing an action opens the close-out, for any kind of action ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const a = _execActions().find(x => x.desc.indexOf('Write the fire') === 0);
    updateExecAction(encodeURIComponent(JSON.stringify(a.ref)), 'status', 'Complete');
    setTimeout(() => {
      const ov = document.getElementById('evidOverlay');
      const txt = ov ? ov.textContent.replace(/\s+/g, ' ') : '';
      res({ open: !!ov, txt,
        kinds: EMBED_KINDS.map(k => k.label),
        boxes: ov ? [...ov.querySelectorAll('.emb-h input')].length : 0,
        evidence: !!(ov && ov.querySelector('.evid-name')),
        hidden: ov ? [...ov.querySelectorAll('.emb-b')].every(b => b.style.display === 'none') : false });
    }, 500);
  }));
  R.ok(t.open && /close it out/i.test(t.txt), 'completing an action opens the close-out');
  R.ok(t.evidence && /What keeps this in place/i.test(t.txt), 'it asks for the evidence AND what keeps it in place, in one step');
  R.ok(t.boxes === 5 && t.kinds.length === 4, 'four ways to keep it, plus "nothing recurring" (' + t.kinds.join(', ') + ')');
  R.ok(t.hidden, 'nothing is ticked to start with, so no box claims anything the consultant did not say');
}

// ── all four answers file themselves where they belong ──
{
  const t = await page.evaluate(() => {
    const pick = (id) => { const e = document.getElementById(id); e.checked = true; _embedToggle(id.replace('_emb', '').replace('On', '').toLowerCase()); };
    const set = (id, v) => { document.getElementById(id).value = v; };
    pick('_embDocOn'); set('_embDocName', 'Fire evacuation procedure v1'); set('_embDocPath', 'S:\\HS\\fire-evac-v1.pdf');
    pick('_embRoutineOn'); set('_embRtItem', 'Fire drill and alarm test'); set('_embRtFreq', '6-monthly'); set('_embRtOwner', 'Dee'); set('_embRtDue', '2027-03-31');
    pick('_embBriefOn'); set('_embBrTitle', 'Fire evacuation procedure'); set('_embBrType', 'Procedure'); set('_embBrDate', '2026-09-28');
    pick('_embOwnerOn'); set('_embOwName', 'Dee Marsh'); set('_embOwRole', 'Fire warden');
    // one evidence row too, so the whole close-out is proved in one save
    document.querySelector('.evid-name').value = 'Fire drill record Sept 2026';
    _saveCloseOut();
    const risk = S.riskProfile.find(r => r.id === 'v1');
    const act = (risk.actions || []).find(x => x.id === 'v1a1');
    const reg = (S.monitoring.regSections || []).find(s => /ongoing controls/i.test(s.name || ''));
    const item = reg ? (reg.items || []).find(i => /Fire drill/.test(i.item)) : null;
    const pol = (S.policySignoff.policies || []).find(p => /Fire evacuation procedure/.test(p.title));
    return { closed: !document.getElementById('evidOverlay'),
      doc: (S.documents || []).some(d => /Fire evacuation procedure v1/.test(d.name)),
      regSection: !!reg, routine: item ? (item.item + ' | ' + item.frequency + ' | ' + item.dueDate) : '',
      routineOwner: item ? /Owner: Dee/.test(item.notes || '') : false,
      pol: pol ? (pol.type + ' | ' + (pol.riskIds || []).join(',')) : '',
      person: (S.company.personnel || []).some(p => p.name === 'Dee Marsh' && p.role === 'Fire warden'),
      evidence: (risk.linked || []).some(l => /Fire drill record/.test(l.ref) && l.actionId === 'v1a1'),
      onAction: !!(act && act.embed), kinds: act && act.embed ? Object.keys(act.embed).sort().join(',') : '' };
  });
  R.ok(t.closed && t.onAction, 'saving closes it and records what was agreed on the action itself');
  R.ok(t.doc, 'a document reaches the Documents register');
  R.ok(t.regSection && /Fire drill and alarm test \| 6-monthly \| 2027-03-31/.test(t.routine) && t.routineOwner,
    'a routine reaches the assurance register with its frequency, owner and next due (' + t.routine + ')');
  R.ok(/Procedure \| v1/.test(t.pol), 'a briefing reaches the sign-off register, tagged to the risk it came from (' + t.pol + ')');
  R.ok(t.person, 'a named person reaches the company personnel list');
  R.ok(t.evidence, 'and the evidence still files against the risk in the same save');
  R.ok(t.kinds === 'at,brief,by,doc,owner,routine', 'all four are kept on the action with who and when (' + t.kinds + ')');
}

// ── a routine is the one that re-raises itself, which is the whole point ──
{
  const t = await page.evaluate(() => {
    const reg = (S.monitoring.regSections || []).find(s => /ongoing controls/i.test(s.name || ''));
    const item = (reg.items || []).find(i => /Fire drill/.test(i.item));
    item.dueDate = '2026-09-01';                       // pretend it has fallen due
    const before = (S.actionPlan || []).length;
    raiseStatutoryDue();
    const raised = (S.actionPlan || []).filter(a => a.regKey === 'reg|' + item.id);
    return { before, raised: raised.length, desc: (raised[0] || {}).desc || '', src: (raised[0] || {}).source || '' };
  });
  R.ok(t.raised === 1 && /^Ongoing control due: Fire drill/.test(t.desc), 'once it falls due the routine puts itself back on the plan (' + t.desc + ')');
  R.ok(t.src === 'Assurance', 'as an assurance action, so the loop closes without anyone remembering');
}

// ── it reads back on the plan, in the client's words ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const a = _execActions().find(x => x.desc.indexOf('Write the fire') === 0);
    _execRowOpen = {}; _execRowOpen[encodeURIComponent(JSON.stringify(a.ref))] = true;
    renderExecPlan();
    setTimeout(() => {
      const kept = document.querySelector('#execPlanRoot .ep-kept');
      const band = document.querySelector('#epDeliveredCard .card-band');
      res({ kept: kept ? kept.textContent.replace(/\s+/g, ' ').trim() : '',
        none: !!(kept && kept.classList.contains('ep-kept-none')),
        btn: !!(kept && kept.querySelector('.ep-kept-btn')),
        held: band ? band.textContent.replace(/\s+/g, ' ') : '' });
    }, 500);
  }));
  R.ok(/How it is kept in place/.test(t.kept) && !t.none, 'the closed action shows what holds it, on the plan');
  R.ok(/Fire drill and alarm test - 6-monthly, Dee/.test(t.kept), 'in plain words: ' + t.kept.slice(30, 120));
  R.ok(t.btn, 'with a way to change it');
  R.ok(/1 of \d+ held/.test(t.held), 'and the Delivered card counts how much of the delivered work is held (' + t.held.slice(-14) + ')');
}

// ── an action with nothing recorded says so, rather than looking finished ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const a = _execActions().find(x => x.desc.indexOf('Renew the employers') === 0);
    const rk = encodeURIComponent(JSON.stringify(a.ref));
    updateExecAction(rk, 'status', 'Complete');
    setTimeout(() => {
      const ov = document.getElementById('evidOverlay');
      const hasEvidence = !!(ov && ov.querySelector('.evid-name'));
      _closeOutCancel();                                  // the consultant skips it
      _execRowOpen = {}; _execRowOpen[rk] = true; renderExecPlan();
      setTimeout(() => {
        const kept = document.querySelector('#execPlanRoot .ep-kept');
        res({ openedForFree: !!ov, hasEvidence,
          txt: kept ? kept.textContent.replace(/\s+/g, ' ').trim() : '',
          none: !!(kept && kept.classList.contains('ep-kept-none')),
          held: (document.querySelector('#epDeliveredCard .card-band') || {}).textContent || '' });
      }, 450);
    }, 500);
  }));
  R.ok(t.openedForFree && !t.hasEvidence, 'an action with no risk behind it still closes out, without asking for risk evidence');
  R.ok(t.none && /Not recorded yet/.test(t.txt), 'skipping leaves it honestly marked: ' + t.txt.slice(25, 110));
  R.ok(/1 of 2 held/.test(t.held.replace(/\s+/g, ' ')), 'and the count says so rather than rounding up');
}

// ── "nothing recurring" is a real answer, and reopening shows what was said ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const a = _execActions().find(x => x.desc.indexOf('Renew the employers') === 0);
    openCloseOut(encodeURIComponent(JSON.stringify(a.ref)));
    setTimeout(() => {
      document.getElementById('_embNoneOn').checked = true; _embedToggle('none');
      _saveCloseOut();
      const o = (S.actionPlan || []).find(x => x.id === 'f1');
      // reopen: it should come back saying what was recorded
      openCloseOut(encodeURIComponent(JSON.stringify(a.ref)));
      setTimeout(() => {
        const back = document.getElementById('_embNoneOn').checked;
        _closeOutCancel();
        res({ none: !!(o.embed && o.embed.none), by: !!(o.embed && o.embed.at), back,
          lines: _embedLines(o).map(l => l.label + ': ' + l.text).join(' | ') });
      }, 450);
    }, 450);
  }));
  R.ok(t.none && t.by, '"nothing recurring" is recorded as an answer, dated, not left blank');
  R.ok(/One-off/.test(t.lines), 'and it reads back as one: ' + t.lines);
  R.ok(t.back, 'reopening a closed-out action shows what was recorded, ready to change');
}

// ── unticking everything takes the record back off, rather than leaving a ghost ──
{
  const t = await page.evaluate(() => new Promise(res => {
    const a = _execActions().find(x => x.desc.indexOf('Renew the employers') === 0);
    openCloseOut(encodeURIComponent(JSON.stringify(a.ref)));
    setTimeout(() => {
      document.getElementById('_embNoneOn').checked = false; _embedToggle('none');
      _saveCloseOut();
      const o = (S.actionPlan || []).find(x => x.id === 'f1');
      res({ gone: !o.embed, stats: _embedStats() });
    }, 450);
  }));
  R.ok(t.gone, 'the form is the record: unticking everything removes it');
  R.ok(t.stats.done === 2 && t.stats.held === 1, 'the plan-wide count follows (' + t.stats.held + ' of ' + t.stats.done + ' held)');
}

await R.done(browser, errors);
