// Report data derivation - the single place report numbers come from.
// Pure functions over the tenant state blob; nothing here touches the DOM,
// nothing is stored back. Unit-tested in test/reports.test.js.
//
// HOUSE RULE (Simon): a report may NEVER count differently from the screens.
// Every definition the app also computes lives in app-contract.js (generated
// from the app itself) and scripts/check-app-report-consistency.mjs diffs the
// two implementations on a seeded edge-case state - run it before deploying
// anything that touches either side.
import { sifOf, worstSeverityOf, controlStatusOf, MATURITY_DOMAINS, HOLD_STATES, HOLD_ORDER, holdOf, holdSummaryOf, planStateOf, docFor, trainingRowsOf, top5Of, top5MonthOf, top5PrevMonthOf } from './app-contract.js';
export { sifOf, worstSeverityOf, controlStatusOf, MATURITY_DOMAINS, HOLD_STATES, HOLD_ORDER, holdOf, holdSummaryOf, planStateOf, docFor, trainingRowsOf, top5Of, top5MonthOf, top5PrevMonthOf };

// ── Tier banding ──
// The app's bands are tenant-tunable (state.riskConfig.bands). The report must
// agree with the app screens, so bands come from state with the app's own
// defaults as fallback (med 5 / high 10 / crit 16 - NOT a second hardcoded
// axis; see the front-end's RISK_BANDS_DEF).
export const DEFAULT_BANDS = { med: 5, high: 10, crit: 16 };

export function bandsFrom(state) {
  const b = (state && state.riskConfig && state.riskConfig.bands) || {};
  return {
    med:  Number.isFinite(+b.med)  && +b.med  > 0 ? +b.med  : DEFAULT_BANDS.med,
    high: Number.isFinite(+b.high) && +b.high > 0 ? +b.high : DEFAULT_BANDS.high,
    crit: Number.isFinite(+b.crit) && +b.crit > 0 ? +b.crit : DEFAULT_BANDS.crit,
  };
}

export function tierFor(score, bands = DEFAULT_BANDS) {
  if (!Number.isFinite(score) || score <= 0) return null;
  if (score >= bands.crit) return 'Critical';
  if (score >= bands.high) return 'High';
  if (score >= bands.med)  return 'Medium';
  return 'Low';
}

// The SAME band colours the app shows on screen (_RISK_PRIO_COLOR) - red,
// orange, amber, green. The report used to carry its own editorial palette
// (blue Low); a director comparing screen and paper saw two colour languages.
export const TIER_COLOURS = { Critical: '#DC2626', High: '#EA580C', Medium: '#F59E0B', Low: '#16A34A' };
export const TIER_ORDER = ['Critical', 'High', 'Medium', 'Low'];

// ── Scores ──
const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null; };

// The six HSG65 areas and the five business-impact dimensions, as the app
// names them (MATURITY_ORDER and RISK_IMPACT_DIMS). Fixed lists on both sides.
const HSG65_AREAS = ['leadership', 'contractor', 'ohealth', 'opcontrol', 'assurance', 'resilience'];
const IMPACT_DIMS = ['people', 'financial', 'legal', 'reputational', 'operational'];

// Mirrors the app's _complScored / _complTally: ten yes/no checks, counted.
// Each returns true when the check is CLEAR. Keep the order and the wording of
// the checks in step with the app, or the drill-down and the paper diverge.
export function completenessOf(s, risks, openActs) {
  const co = s.company || {};
  const filled = k => !!(co[k] && String(co[k]).trim());
  const judged = ((s.profiler || {}).judgement) || {};
  const as = s.riskAssurance || {};
  let reqPend = 0;
  (Array.isArray(s.requirements) ? s.requirements : []).forEach(sec =>
    (sec.items || []).forEach(it => { if (!it.reviewed) reqPend++; }));
  const checks = [
    filled('legalName') && filled('employees') && filled('elciInsurer'),
    !risks.some(r => !(parseInt(r.likelihood, 10) && parseInt(r.severity, 10))),
    !risks.some(r => !r.reviewed),
    !risks.some(r => !r.controlLevel),
    !risks.some(r => !IMPACT_DIMS.some(k => parseInt((r.impacts || {})[k], 10) > 0)),
    !HSG65_AREAS.some(id => !((judged[id] || {}).level)),
    !openActs.some(a => !(a.owner && String(a.owner).trim())),
    !openActs.some(a => !a.due),
    reqPend === 0,
    ['leading', 'lagging', 'assurance'].some(k => Array.isArray(as[k]) && as[k].length),
  ];
  return { clear: checks.filter(Boolean).length, total: checks.length };
}

export function residualOf(risk) {
  const l = int(risk && risk.likelihood), s = int(risk && risk.severity);
  return (l && s) ? { l, s, score: l * s } : null;
}
// The practice that produced the report, from the branding settings - the same
// field the app's own PDF footer reads, so paper and screen name it alike.
export function producerOf(state) {
  const b = (state && state.branding) || {};
  const n = String(b.producer == null ? '' : b.producer).trim();
  return n || 'AHS Compliance Consulting';
}
export function targetOf(risk) {
  const l = int(risk && risk.targetL), s = int(risk && risk.targetS);
  return (l && s) ? { l, s, score: l * s } : null;
}

// ── Zero-safe copy ──
// Every sentence that interpolates a count goes through one of these, so the
// "No have no named owner" class of bug cannot be written.
export function noneOrCount(n, singular, plural, noneWord = 'No') {
  const p = plural || (singular + 's');
  if (!n) return noneWord + ' ' + p;
  if (n === 1) return '1 ' + singular;
  return n + ' ' + p;
}
export function countPhrase(n, singular, plural) {
  const p = plural || (singular + 's');
  return n === 1 ? '1 ' + singular : n + ' ' + p;
}
export function isAre(n) { return n === 1 ? 'is' : 'are'; }
export function hasHave(n) { return n === 1 ? 'has' : 'have'; }

// ── Register selection and rollups ──
const HARM_LADDER = ['-', 'Insignificant', 'Minor injury', 'Moderate injury', 'Major injury', 'Fatality / permanent disability'];

// Control status comes from the contract (the app's own logic); the report
// only maps the 'None' state to its display wording.
function controlState(risk) {
  const s = controlStatusOf(risk);
  return s === 'None' ? 'None recorded' : s;
}

function ownerOf(risk) {
  const a = ((risk && risk.actions) || []).find(x => x && x.owner && String(x.owner).trim());
  return a ? String(a.owner).trim() : '';
}

// The hierarchy-of-control ladder as the app records it (controlLevel).
const HIERARCHY = [
  { key: 'remove',  label: 'Eliminate' },
  { key: 'prevent', label: 'Prevent'   },
  { key: 'protect', label: 'Protect'   },
  { key: 'ppe',     label: 'PPE'       },
  { key: 'admin',   label: 'Admin'     },
];

// ── HSG65 review pack ──
// HSG65 (Reviewing performance, p55) lists what a leadership review draws on:
// active monitoring, reactive monitoring, accident/incident/near-miss data,
// training records, inspection reports, investigation reports, risk
// assessments, issues raised by workers, and checks required by law. This
// derives each from the live state so the board report can carry them.
export function deriveBoardExtras(state, opts = {}) {
  const s = state || {};
  const today = (opts.today || new Date().toISOString().slice(0, 10));
  const daysAgo = (d) => { const t = new Date(today + 'T12:00:00'); t.setDate(t.getDate() - d); return t.toISOString().slice(0, 10); };
  const daysOn = (d) => { const t = new Date(today + 'T12:00:00'); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
  const p90 = daysAgo(90), soon = daysOn(60);

  // Reactive monitoring - incidents in the period + investigation state.
  const inc = Array.isArray(s.incidents) ? s.incidents : [];
  const incRecent = inc.filter(i => (i.date || '') >= p90)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const incOpen = inc.filter(i => i.status === 'Open').length;
  const incRiddor = inc.filter(i => i.type === 'RIDDOR reportable').length;
  const incNoCause = incRecent.filter(i => !String(i.immediateCause || '').trim() && !String(i.rootCause || '').trim()).length;

  // Active monitoring - planned oversight and figure-keeping.
  // Same reading as the app's visit status: an outcome of 'Not done' is never
  // a completion, whatever else is recorded.
  const site = Array.isArray(s.siteInspections) ? s.siteInspections : [];
  const siteDone = site.filter(r => r.actual && r.outcome !== 'Not done').length;
  const siteOverdue = site.filter(r => !r.actual && r.planned && r.planned < today && r.outcome !== 'Not done').length;
  const inspections = Array.isArray(s.inspections) ? s.inspections : [];
  const months = (s.monitoring && s.monitoring.months) || {};
  const monthsSaved = Object.keys(months).filter(k => months[k] && months[k].enteredAt).sort();

  // Training record - the SAME flat rows the app derives from its v2
  // people store (legacy flat lists migrate identically), via the contract.
  const trn = trainingRowsOf(s);
  const trag = (expiry) => { if (!expiry) return 'grey'; if (expiry < today) return 'red'; return expiry <= soon ? 'amber' : 'green'; };
  const trnExpired = trn.filter(x => trag(x.expiry) === 'red');
  const trnSoon = trn.filter(x => trag(x.expiry) === 'amber');
  const staffN = [...new Set(trn.map(x => x.employee).filter(Boolean))].length;

  // Issues raised by workers - the two-way briefing record.
  const br = (s.consultation && Array.isArray(s.consultation.briefings)) ? s.consultation.briefings : [];
  const brRecent = br.filter(b => (b.date || '') >= p90)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const brFb = brRecent.filter(b => String(b.feedback || '').trim());

  // Checks required by law - the statutory tracker.
  // Blank rows are never counted - exactly as the app's statutory counter
  // (_regCounts) requires a named item.
  const regSecs = (s.monitoring && Array.isArray(s.monitoring.regSections)) ? s.monitoring.regSections : [];
  const statItems = regSecs.flatMap(sec => Array.isArray(sec.items) ? sec.items : []).filter(it => it && it.item && String(it.item).trim());
  const statOverdue = statItems.filter(it => it && it.dueDate && it.dueDate < today).length;
  const statDueSoon = statItems.filter(it => it && it.dueDate && it.dueDate >= today && it.dueDate <= soon).length;

  // Successes - HSG65: "reviewing also gives you the opportunity to celebrate
  // and promote your health and safety successes."
  // Mirrors the app's execution-plan aggregator (_execActions) exactly: the
  // SAME three sources (risk actions, management-system item actions, the
  // free plan) with the SAME exclusions (deleted, hideFromPlan = removed to
  // the consultant's holding area, blank stubs). Complete AND Accepted count
  // as closed off - Accepted rows are labelled, never passed off as done.
  const wins = [];
  const winPush = (a, src) => {
    const done = a.status === 'Complete' ? (a.completedDate || '') : (a.acceptDate || '');
    if (done === '' || done >= p90) wins.push({ desc: String(a.desc || '(action)'), when: done, owner: String(a.owner || ''), accepted: a.status === 'Accepted', source: src });
  };
  (Array.isArray(s.riskProfile) ? s.riskProfile : []).forEach(r => ((r.actions) || []).forEach(a => {
    if (!a || a.deleted || a.hideFromPlan) return;
    if (!(a.desc || a.owner || a.due)) return;
    if (a.status === 'Complete' || a.status === 'Accepted') winPush(a, String(r.activity || r.hazard || 'Risk profile'));
  }));
  (Array.isArray(s.requirements) ? s.requirements : []).forEach(sec => (Array.isArray(sec.items) ? sec.items : []).forEach(it => {
    // Legacy single-action shape, read exactly as the app migrates it.
    const acts = Array.isArray(it.actions) ? it.actions
      : ((it.action && String(it.action).trim()) ? [{ desc: String(it.action).trim(), owner: it.actionOwner || '', status: it.actionStatus || 'Not started', completedDate: it.completedDate || '', acceptDate: it.acceptDate || '' }] : []);
    acts.forEach(a => {
      if (!a || a.deleted || a.hideFromPlan) return;
      if (!(a.desc && String(a.desc).trim())) return;
      if (a.status === 'Complete' || a.status === 'Accepted') winPush(a, String(sec.heading || 'Legal duties'));
    });
  }));
  (Array.isArray(s.actionPlan) ? s.actionPlan : []).forEach(a => {
    if (!a || a.deleted || a.hideFromPlan) return;
    if (!(a.desc || a.owner || a.due)) return;
    if (a.status === 'Complete' || a.status === 'Accepted') winPush(a, String(a.sourceLabel || a.source || 'Action plan'));
  });
  wins.sort((a, b) => String(b.when).localeCompare(String(a.when)));

  // The consultant's five priorities for this month, and how last month's
  // five actually went - the loop the client feels.
  const t5Month = top5MonthOf(today);
  const t5Prev = top5PrevMonthOf(t5Month);
  const top5 = top5Of(s, t5Month);
  const top5Last = top5Of(s, t5Prev);

  // Closing the loop - movement since the audit baseline (if snapshots exist).
  const snaps = Array.isArray(s.auditSnapshots) ? s.auditSnapshots : [];
  const baseline = snaps.length ? snaps[0] : null;

  return {
    incTotal: inc.length, incRecent, incOpen, incRiddor, incNoCause,
    siteTotal: site.length, siteDone, siteOverdue, inspTotal: inspections.length,
    monthsSaved,
    trnTotal: trn.length, trnExpired, trnSoon, staffN,
    brTotal: br.length, brRecent, brFb,
    statTotal: statItems.length, statOverdue, statDueSoon,
    wins, baseline, periodFrom: p90,
    top5, top5Last, t5Month, t5Prev,
  };
}

export function deriveBoard(state, opts = {}) {
  const s = state || {};
  const bands = bandsFrom(s);
  const risks = Array.isArray(s.riskProfile) ? s.riskProfile : [];
  const co = s.company || {};

  const scored = risks.map(r => ({ r, res: residualOf(r) }));
  const rated = scored.filter(x => x.res);
  const unrated = scored.length - rated.length;

  // Matrix cell counts strictly from residual likelihood × severity.
  const matrix = {};
  rated.forEach(x => { const k = x.res.l + '|' + x.res.s; matrix[k] = (matrix[k] || 0) + 1; });

  const byTier = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  rated.forEach(x => { const t = tierFor(x.res.score, bands); if (t) byTier[t]++; });

  // Fatal potential: the app's _riskSif via the contract - explicit boolean
  // override wins, else credible worst case (the risk's own OR its projected
  // severity) of 4-5. The old "severity 5 only" version disagreed with the
  // cockpit by exactly the class of risk Simon caught (a severity-4 SIF).
  const isFatal = x => sifOf(x.r);
  const fatal = scored.filter(isFatal);
  const fatalUncontrolled = fatal.filter(x => controlStatusOf(x.r) === 'None');
  const highPlus = byTier.Critical + byTier.High;
  // Plan delivery, the positive half of the story: a risk counts as CLOSED
  // when every planned action on it is complete (the app's plan state
  // 'managed'); a risk formally accepted is its own caveat, never lumped in.
  // Same action-status rules as the app via the contract's planStateOf.
  const planStates = risks.map(r => planStateOf(r));
  const planDone = planStates.filter(p => p === 'managed').length;
  const planAccepted = planStates.filter(p => p === 'accepted').length;

  // Actions across ALL sources, exactly as the execution plan aggregates them
  // (risk-profile actions + management-system item actions + plan-added) -
  // the board pack may never disagree with the plan (UAT finding #9).
  const acts = [];
  // hideFromPlan matches _execActions: an action the consultant has taken off
  // the plan is off it on paper too, or the two counts drift apart.
  // actRows carries the same actions WITH their parent, so a section can name
  // what an action belongs to and pick out the ones on the biggest risks.
  const actRows = [];
  const pushAct = a => { if (a && !a.deleted && !a.hideFromPlan && (a.desc || a.owner || a.due)) acts.push(a); };
  const pushRow = (a, source, parent, tier) => { if (a && !a.deleted && !a.hideFromPlan && (a.desc || a.owner || a.due)) actRows.push({ a, source, parent: parent || '', tier: tier || null }); };
  risks.forEach(r => { const res = residualOf(r); const tier = res ? tierFor(res.score, bands) : null;
    ((r.actions) || []).forEach(a => { pushAct(a); pushRow(a, 'Risk profile', r.activity || r.hazard || 'Risk', tier); }); });
  (Array.isArray(s.requirements) ? s.requirements : []).forEach(sec => (sec.items || []).forEach(it => (it.actions || []).forEach(a => { pushAct(a); pushRow(a, 'Legal duties', sec.heading || 'Legal duty', null); })));
  (Array.isArray(s.actionPlan) ? s.actionPlan : []).forEach(a => { pushAct(a); pushRow(a, 'Plan', '', null); });
  const today = (opts.today || new Date().toISOString().slice(0, 10));
  const openActs = acts.filter(a => a.status !== 'Complete' && a.status !== 'Accepted');
  const overdue = openActs.filter(a => a.due && a.due < today);
  const noOwner = openActs.filter(a => !(a.owner && String(a.owner).trim()));
  const noDate = openActs.filter(a => !a.due);

  // Risk control status: the app's hold model via the contract - each risk
  // graded by recorded facts, the company measure a count, HSG65
  // proportionality a rule. Replaces the abstract 0-5 maturity number.
  const holdS = holdSummaryOf(s, (r) => { const res = residualOf(r); return res ? tierFor(res.score, bands) : null; },
    { today: opts.today, ratingOf: (r) => { const res = residualOf(r); return res ? res.score : 0; } });

  // Exposure score for the bars: mean residual score of rated risks (0-25).
  const meanScore = rated.length ? rated.reduce((a, x) => a + x.res.score, 0) / rated.length : null;
  const profileTier = meanScore != null ? tierFor(Math.max(1, Math.round(meanScore)), bands) : null;

  // Hierarchy of control shares (of risks with a recorded level).
  const hierarchy = HIERARCHY.map(h => ({ ...h, n: risks.filter(r => r.controlLevel === h.key).length }));
  const hierTotal = hierarchy.reduce((a, h) => a + h.n, 0);
  const protectDown = hierarchy.filter(h => h.key !== 'remove' && h.key !== 'prevent')
    .reduce((a, h) => a + h.n, 0);

  // Register rows: the fatal/major-harm activities - the SAME test the app
  // and the fatal count use, not a second severity rule alongside it.
  const registerRows = scored
    .filter(x => sifOf(x.r))
    .sort((a, b) => ((b.res && b.res.score) || 0) - ((a.res && a.res.score) || 0))
    .map(x => {
      const racts = ((x.r.actions) || []).filter(a => a && !a.deleted && (a.desc || a.owner || a.due));
      return {
        name: String(x.r.activity || x.r.hazard || 'Unnamed risk'),
        residual: x.res, target: targetOf(x.r),
        tier: x.res ? tierFor(x.res.score, bands) : null,
        targetTier: (function(){ const t = targetOf(x.r); return t ? tierFor(t.score, bands) : null; })(),
        control: controlState(x.r),
        owner: ownerOf(x.r),
        fatal: isFatal(x),
        actsTotal: racts.length,
        actsClosed: racts.filter(a => a.status === 'Complete' || a.status === 'Accepted').length,
      };
    });

  // Highest credible harm from the severity ladder.
  const maxSev = Math.max(0, ...scored.map(x => worstSeverityOf(x.r)));

  // Legal citations, deduped, from duty fields the profile carries.
  const duties = [...new Set(risks.map(r => String(r.duty || '').trim()).filter(Boolean)
    .flatMap(d => d.split(/;|·/).map(t => t.trim()).filter(Boolean)))];

  // Headline: state the finding, zero-safe at every arm.
  let headline, standfirst;
  if (!rated.length) {
    headline = 'The risk profile is not yet complete enough to report a position.';
    standfirst = countPhrase(risks.length, 'risk theme is', 'risk themes are') +
      ' recorded but ' + (rated.length ? countPhrase(unrated, 'is', 'are') : 'none are') +
      ' fully rated. Complete likelihood and severity scoring before this report is relied on.';
  } else if (fatal.length) {
    headline = countPhrase(fatal.length, 'risk', 'risks') + ' can still kill or maim someone with our controls in place.';
    standfirst = 'Of ' + countPhrase(rated.length, 'rated risk', 'rated risks') + ', ' +
      noneOrCount(highPlus, 'still sits', 'still sit', 'none') + ' High or Critical with controls in place, and ' +
      noneOrCount(fatalUncontrolled.length, 'fatal-potential risk has', 'fatal-potential risks have', 'no') +
      ' no recorded controls. ' + holdS.held + ' of ' + holdS.total + ' risk' + (holdS.total !== 1 ? 's are' : ' is') + ' assured' + (holdS.breaches.length ? (' - ' + holdS.breaches.length + ' need' + (holdS.breaches.length !== 1 ? '' : 's') + ' attention first.') : '.');
  } else {
    headline = noneOrCount(highPlus, 'risk still sits', 'risks still sit', 'No') + ' High or Critical with controls in place.';
    standfirst = countPhrase(rated.length, 'risk is', 'risks are') + ' rated. ' +
      holdS.held + ' of ' + holdS.total + ' risk' + (holdS.total !== 1 ? 's are' : ' is') + ' assured' + (holdS.breaches.length ? (' - ' + holdS.breaches.length + ' need' + (holdS.breaches.length !== 1 ? '' : 's') + ' attention first.') : '.');
  }

  return {
    bands, risks, rated: rated.length, unrated, matrix, byTier,
    fatal: fatal.length, fatalUncontrolled: fatalUncontrolled.length,
    highPlus, planDone, planAccepted, openActions: openActs.length, overdue: overdue.length,
    noOwner: noOwner.length, noDate: noDate.length,
    // Open actions as rows, overdue first then by date - the outstanding and
    // high-risk sections read these rather than counting again.
    openActRows: actRows.filter(x => x.a.status !== 'Complete' && x.a.status !== 'Accepted')
      .sort((x, y) => {
        const ox = (x.a.due && x.a.due < today) ? 0 : 1, oy = (y.a.due && y.a.due < today) ? 0 : 1;
        return ox - oy || String(x.a.due || '9999').localeCompare(String(y.a.due || '9999'));
      }),
    holdS, meanScore, profileTier, hierarchy, hierTotal, protectDown,
    registerRows, maxSev, highestHarm: HARM_LADDER[maxSev] || '-',
    duties, headline, standfirst,
    // Assessment completeness - the app's _complScored, check for check and in
    // the same order. Ten plain yes/no questions about data that is either
    // recorded or not, counted rather than averaged, so the figure is a tally
    // of facts and not a grade. Every one reads the saved state only, which is
    // what lets paper and screen produce the same answer.
    complete: completenessOf(s, risks, openActs),
    company: co, empty: !rated.length,
  };
}
