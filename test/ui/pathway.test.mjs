// ══════════════════════════════════════════════════════════════
//  The risk pathway. Simon, 2026-09-28: "a simple way to see what's been
//  done or what hasn't ... the same wording from where the content comes
//  from so it can be tracked back ... the colour coding should reflect this
//  ... look at these at the end of a period and see the good work we have
//  done, and get a report from it."
//
//  These pin that every station carries the app's own words for the thing
//  (never a summary, never truncated), that the colour is the state of the
//  work and not the size of the risk, that the period lens counts what was
//  dated inside it, and that the report is built off the same derivation.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Risk pathway - six stations, in their own words');
const { browser, page, errors } = await openApp();

const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const LONG = 'Fit interlocked guards to the pillar drill and the bench grinder, and brief every operator on the new stop procedure before the night shift starts';

const RISKS = () => ([
  // r1: a risk mid-journey, with dated work inside the last 30 days
  { id: 'r1', activity: 'Machinery guarding in the workshop', hazard: 'Contact with moving parts', assocRisk: 'Amputation at the pillar drill',
    harm: 'Crush and amputation injuries to the hands', personsAtRisk: ['Fitters', 'Apprentices'], macroKey: 'plant', createdAt: day(60) + 'T09:00:00.000Z', createdBy: 'S Archer',
    likelihood: 3, severity: 4, targetL: 1, targetS: 4, controlLevel: 'prevent', controls: 'Guards fitted to the pillar drill; grinder awaiting a guard',
    scoreHistory: [{ at: day(10), l: 4, s: 4, note: 'before plan delivery' }],
    reviewDue: day(-300),
    actions: [
      { id: 'c1', desc: 'Fixed guard on the pillar drill, interlocked to the isolator', owner: 'M Kane', due: day(20), status: 'Complete', hideFromPlan: true, completedDate: day(5), completedBy: 'M Kane' },
      { id: 'c2', desc: 'Guard on the bench grinder', owner: 'M Kane', due: day(40), status: 'Not started', hideFromPlan: true },   // 40 days overdue
      { id: 'a1', desc: LONG, owner: 'D Ashworth', due: day(20), status: 'In progress' },                                            // 20 days overdue
      { id: 'a2', desc: 'Write the isolation procedure for the pillar drill', owner: 'S Archer', due: day(15), status: 'Complete', completedDate: day(3), completedBy: 'S Archer',
        embed: { at: day(3), by: 'S Archer', routine: { item: 'Weekly guard check on the pillar drill', frequency: 'Weekly', owner: 'M Kane', due: day(-4) } } } ] },
  // r2: never scored
  { id: 'r2', activity: 'Lone working at the yard gate', hazard: 'Violence', macroKey: 'plant', createdAt: day(2) + 'T09:00:00.000Z', createdBy: 'S Archer', actions: [] },
  // r3: signed off, but its review has lapsed
  { id: 'r3', activity: 'Fire evacuation from the mezzanine', hazard: 'Fire', macroKey: 'fire', createdAt: day(400) + 'T09:00:00.000Z', createdBy: 'S Archer',
    likelihood: 2, severity: 3, targetL: 2, targetS: 3, reviewed: true, reviewDue: day(30),
    reviewHistory: [{ at: day(395), by: 'S Archer', was: '', next: day(30) }],
    actions: [{ id: 'a3', desc: 'Second fire exit from the mezzanine', owner: 'S Archer', due: day(380), status: 'Complete', completedDate: day(390), completedBy: 'S Archer', embed: { at: day(390), by: 'S Archer', doc: { name: 'Fire evacuation plan', path: '\\\\fairbank\\HS\\fire.pdf' } } }] },
]);

await seed(page, { company: { legalName: 'Fairbank Fabrications Ltd' }, riskProfile: RISKS(), actionPlan: [] }, 'journey');
await wait(page, 400);

// ── every station carries the thing in its own words, and says where it lives ──
{
  const t = await page.evaluate(() => {
    const r = S.riskProfile.find(x => x.id === 'r1');
    const P = _pathwayOf(r);
    const st = Object.fromEntries(P.stations.map(s => [s.k, s]));
    const texts = (k) => st[k].lines.map(l => l.text);
    const homes = (k) => st[k].lines.map(l => l.home);
    return { keys: P.stations.map(s => s.k), states: P.stations.map(s => s.state),
      ident: texts('identified'), assessed: texts('assessed'), controls: texts('controls'), actions: texts('actions'), kept: texts('kept'), signed: texts('signed'),
      homes: homes('controls').concat(homes('actions'), homes('kept')),
      overall: P.overall, theme: P.themeName, ref: P.ref, summaries: P.stations.map(s => s.summary) };
  });
  R.ok(t.keys.join(',') === 'identified,assessed,controls,actions,kept,signed', 'six stations, in the order the management plan reads them');
  R.ok(t.ident[0] === 'Machinery guarding in the workshop' && t.ident.includes('Amputation at the pillar drill') && t.ident.includes('Crush and amputation injuries to the hands') && t.ident.includes('Fitters, Apprentices'),
    'Identified: the risk, the associated risk, the harm and who is at risk - as written');
  R.ok(t.assessed.some(x => /Likelihood 3 . Severity 4 = 12/.test(x)) && t.assessed.some(x => /Residual target 4/.test(x)) && t.assessed.some(x => /Score moved from 16 to 12/.test(x)),
    'Assessed: the score as L x S, the residual target, and every score movement');
  R.ok(t.controls.includes('Guards fitted to the pillar drill; grinder awaiting a guard') && t.controls.includes('Fixed guard on the pillar drill, interlocked to the isolator') && t.controls.includes('Guard on the bench grinder'),
    'Controls: the controls box and every control-table row, each in full');
  R.ok(t.actions.includes(LONG) && t.actions.includes('Write the isolation procedure for the pillar drill'),
    'Actions: every plan action in full - a ' + LONG.length + '-character action is not cut to 60');
  R.ok(t.kept.some(x => /^Routine: Weekly guard check on the pillar drill - weekly/.test(x)) && t.kept.some(x => /^Not recorded yet - "Fixed guard on the pillar drill/.test(x)),
    'Kept in place: what was filed at close-out, in the close-out\'s own sentence - and what was not');
  R.ok(t.homes.includes('Risk profile · Control table') && t.homes.includes('Client execution plan') && t.homes.includes('Assurance records'),
    'and every line says where it lives, so it can be tracked back');
  R.ok(t.theme === 'Plant, equipment & machinery' || /plant|machinery/i.test(t.theme), 'the theme it sits under is named (' + t.theme + ')');
  R.ok(/^[A-Z]-\d{3}$/.test(t.ref), 'with its reference (' + t.ref + ')');
}
// ── the colour is the state of the work, not the size of the risk ──
{
  const t = await page.evaluate(() => {
    const P1 = _pathwayOf(S.riskProfile.find(x => x.id === 'r1'));
    const P2 = _pathwayOf(S.riskProfile.find(x => x.id === 'r2'));
    const P3 = _pathwayOf(S.riskProfile.find(x => x.id === 'r3'));
    return { s1: P1.stations.map(s => s.state), o1: P1.overall, s2: P2.stations.map(s => s.state), o2: P2.overall, s3: P3.stations.map(s => s.state), o3: P3.overall };
  });
  R.ok(t.s1[2] === 'late' && t.s1[3] === 'late', 'r1: a control overdue and an action overdue read red on those stations');
  R.ok(t.o1.state === 'late' && /Needs attention/.test(t.o1.label), 'so the whole risk reads Needs attention, whatever its band');
  R.ok(t.s2[1] === 'open' && t.o2.state === 'late' && /not yet scored/.test(t.o2.reason), 'r2: an unscored risk is not left quiet - it needs attention first, and says why');
  R.ok(t.s3[5] === 'late' && /review is overdue/.test(t.o3.label) === false && t.o3.state === 'late', 'r3: signed off, but a lapsed review turns Signed off red - kept reviewed is part of signed off');
}
// ── the period lens counts what was dated inside it ──
{
  const t = await page.evaluate(() => {
    const paths = S.riskProfile.map(_pathwayOf);
    const d30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const d400 = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
    const d1 = new Date(Date.now() - 1 * 864e5).toISOString().slice(0, 10);
    return { m30: _pathwayPeriodStats(paths, d30), m400: _pathwayPeriodStats(paths, d400), m1: _pathwayPeriodStats(paths, d1) };
  });
  R.ok(t.m30.controls === 1 && t.m30.actions === 1 && t.m30.kept === 1 && t.m30.scored === 1 && t.m30.found === 1,
    'last 30 days: 1 control in place, 1 action closed, 1 thing filed, 1 score moved, 1 risk identified');
  R.ok(t.m30.risks === 2 && t.m30.signed === 0, 'across 2 risks, and no sign-off - the fire review was a year ago');
  R.ok(t.m400.signed === 1 && t.m400.kept === 2 && t.m400.found === 3, 'widen to 400 days and the fire work comes in');
  R.ok(t.m1.total === 0, 'and yesterday alone has nothing');
}
// ── what the screen shows ──
{
  const t = await page.evaluate((LONG) => {
    _pathwayDays = 30; _journeyFilter = 'all'; renderRiskJourney();
    const root = document.getElementById('journeyRoot');
    const txt = root.innerText;
    const cards = root.querySelectorAll('details.pw-card').length;
    const strips = root.querySelectorAll('.pw-strip').length;
    const nodes = root.querySelectorAll('.pw-strip .pw-node').length;
    pathwayToggleAll(true);
    const open = [...root.querySelectorAll('details.pw-card')].every(d => d.open);
    const recent = root.querySelectorAll('.pw-line.pw-recent').length;
    const long = root.innerText.indexOf(LONG) >= 0;   // read after expanding - a closed card's body is not in innerText
    setJourneyFilter('late');
    const lateOnly = document.getElementById('journeyRoot').querySelectorAll('details.pw-card').length;
    setJourneyFilter('late');   // pressing the same tile again clears the filter
    const back = document.getElementById('journeyRoot').querySelectorAll('details.pw-card').length;
    return { txt, cards, strips, nodes, open, recent, long, lateOnly, back };
  }, LONG);
  R.ok(t.cards === 3 && t.strips === 3 && t.nodes === 18, 'three risks, each with a six-station strip');
  R.ok(/Identified/i.test(t.txt) && /Kept in place/i.test(t.txt) && /Signed off/i.test(t.txt), 'the stations are labelled on the strip (innerText carries the CSS uppercase)');
  R.ok(/In the last 30 days:/.test(t.txt) && /1 action closed/.test(t.txt) && /1 control put in place/.test(t.txt), 'the period line says what was done: ' + (t.txt.match(/In the last 30 days:[^\n]*/) || [''])[0]);
  R.ok(t.open && t.long, 'expand all opens every card, and the long action is there in full');
  R.ok(t.recent >= 4, 'dated lines from this period are marked (' + t.recent + ')');
  R.ok(/Machinery guarding in the workshop/.test(t.txt) && /Fire evacuation from the mezzanine/.test(t.txt), 'each risk is headed by its own title');
  R.ok(t.lateOnly === 3 && t.back === 3, 'the Needs attention tile filters, and pressing it again clears (' + t.lateOnly + ' / ' + t.back + ')');
}
// ── the report comes off the same derivation ──
{
  const t = await page.evaluate(() => {
    // this jsPDF build copies its methods onto each instance from jsPDF.API, so that is where save is caught
    const P = window.jspdf.jsPDF.API, orig = P.save; const names = []; P.save = function (nm) { names.push(nm); return this; };
    let err = ''; try { downloadPathwayReport(); } catch (e) { err = String(e); }
    P.save = orig;
    const tile = (typeof REPORT_DOCS !== 'undefined') && REPORT_DOCS.some(x => x.key === 'riskPathway');
    return { names, err, tile, src: String(downloadPathwayReport).indexOf('_pathwayOf') >= 0 && String(downloadPathwayReport).indexOf('_pathwayPeriodStats') >= 0 };
  });
  R.ok(!t.err && /^risk-pathway-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.pdf$/.test(t.names[0] || ''), 'the pathway report builds and is named for what it is (' + (t.names[0] || t.err) + ')');
  R.ok(t.src && t.tile, 'and it reads _pathwayOf and the period figures - the same derivation as the screen - with a controlled-document row');
}

await R.done(browser, errors);
