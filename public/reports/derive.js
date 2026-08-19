// Report data derivation — the single place report numbers come from.
// Pure functions over the tenant state blob; nothing here touches the DOM,
// nothing is stored back. Unit-tested in test/reports.test.js.
//
// HOUSE RULE (Simon): a report may NEVER count differently from the screens.
// Every definition the app also computes lives in app-contract.js (generated
// from the app itself) and scripts/check-app-report-consistency.mjs diffs the
// two implementations on a seeded edge-case state — run it before deploying
// anything that touches either side.
import { sifOf, controlStatusOf, MATURITY_DOMAINS, HOLD_STATES, HOLD_ORDER, holdOf, holdSummaryOf, planStateOf } from './app-contract.js';
export { sifOf, controlStatusOf, MATURITY_DOMAINS, HOLD_STATES, HOLD_ORDER, holdOf, holdSummaryOf, planStateOf };

// ── Tier banding ──
// The app's bands are tenant-tunable (state.riskConfig.bands). The report must
// agree with the app screens, so bands come from state with the app's own
// defaults as fallback (med 5 / high 10 / crit 16 — NOT a second hardcoded
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

export const TIER_COLOURS = { Critical: '#8c2f1e', High: '#c05621', Medium: '#d9a13b', Low: '#749dc4' };
export const TIER_ORDER = ['Critical', 'High', 'Medium', 'Low'];

// ── Scores ──
const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null; };

export function residualOf(risk) {
  const l = int(risk && risk.likelihood), s = int(risk && risk.severity);
  return (l && s) ? { l, s, score: l * s } : null;
}
export function inherentOf(risk) {
  const l = int(risk && risk.inherentL), s = int(risk && risk.inherentS);
  return (l && s) ? { l, s, score: l * s } : null;
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
const HARM_LADDER = ['—', 'Insignificant', 'Minor injury', 'Moderate injury', 'Major injury', 'Fatality / permanent disability'];

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

  // Reactive monitoring — incidents in the period + investigation state.
  const inc = Array.isArray(s.incidents) ? s.incidents : [];
  const incRecent = inc.filter(i => (i.date || '') >= p90)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const incOpen = inc.filter(i => i.status === 'Open').length;
  const incRiddor = inc.filter(i => i.type === 'RIDDOR reportable').length;
  const incNoCause = incRecent.filter(i => !String(i.immediateCause || '').trim() && !String(i.rootCause || '').trim()).length;

  // Active monitoring — planned oversight and figure-keeping.
  const site = Array.isArray(s.siteInspections) ? s.siteInspections : [];
  const siteDone = site.filter(r => r.actual).length;
  const siteOverdue = site.filter(r => !r.actual && r.planned && r.planned < today && r.outcome !== 'Not done').length;
  const inspections = Array.isArray(s.inspections) ? s.inspections : [];
  const months = (s.monitoring && s.monitoring.months) || {};
  const monthsSaved = Object.keys(months).filter(k => months[k] && months[k].enteredAt).sort();

  // Training record.
  const trn = Array.isArray(s.training) ? s.training : [];
  const trag = (expiry) => { if (!expiry) return 'grey'; if (expiry < today) return 'red'; return expiry <= soon ? 'amber' : 'green'; };
  const trnExpired = trn.filter(x => trag(x.expiry) === 'red');
  const trnSoon = trn.filter(x => trag(x.expiry) === 'amber');
  const staffN = [...new Set(trn.map(x => x.employee).filter(Boolean))].length;

  // Issues raised by workers — the two-way briefing record.
  const br = (s.consultation && Array.isArray(s.consultation.briefings)) ? s.consultation.briefings : [];
  const brRecent = br.filter(b => (b.date || '') >= p90)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const brFb = brRecent.filter(b => String(b.feedback || '').trim());

  // Checks required by law — the statutory tracker.
  const regSecs = (s.monitoring && Array.isArray(s.monitoring.regSections)) ? s.monitoring.regSections : [];
  const statItems = regSecs.flatMap(sec => Array.isArray(sec.items) ? sec.items : []);
  const statOverdue = statItems.filter(it => it && it.dueDate && it.dueDate < today).length;
  const statDueSoon = statItems.filter(it => it && it.dueDate && it.dueDate >= today && it.dueDate <= soon).length;

  // Successes — HSG65: "reviewing also gives you the opportunity to celebrate
  // and promote your health and safety successes."
  const wins = [];
  (Array.isArray(s.riskProfile) ? s.riskProfile : []).forEach(r => ((r.actions) || []).forEach(a => {
    if (!a || a.deleted) return;
    const done = a.status === 'Complete' ? (a.completedDate || '') : (a.status === 'Accepted' ? (a.acceptDate || '') : null);
    if (done !== null && (done === '' || done >= p90)) wins.push({ desc: String(a.desc || '(action)'), when: done, owner: String(a.owner || '') });
  }));
  (Array.isArray(s.actionPlan) ? s.actionPlan : []).forEach(a => {
    if (a && a.status === 'Complete' && ((a.completedDate || '') === '' || (a.completedDate || '') >= p90))
      wins.push({ desc: String(a.desc || '(action)'), when: a.completedDate || '', owner: String(a.owner || '') });
  });
  wins.sort((a, b) => String(b.when).localeCompare(String(a.when)));

  // Closing the loop — movement since the audit baseline (if snapshots exist).
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
  };
}

export function deriveBoard(state, opts = {}) {
  const s = state || {};
  const bands = bandsFrom(s);
  const risks = Array.isArray(s.riskProfile) ? s.riskProfile : [];
  const co = s.company || {};

  const scored = risks.map(r => ({ r, res: residualOf(r), inh: inherentOf(r) }));
  const rated = scored.filter(x => x.res);
  const unrated = scored.length - rated.length;

  // Matrix cell counts strictly from residual likelihood × severity.
  const matrix = {};
  rated.forEach(x => { const k = x.res.l + '|' + x.res.s; matrix[k] = (matrix[k] || 0) + 1; });

  const byTier = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  rated.forEach(x => { const t = tierFor(x.res.score, bands); if (t) byTier[t]++; });

  // Fatal potential: the app's _riskSif via the contract — explicit boolean
  // override wins, else credible worst case (inherent, residual OR target
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
  // (risk-profile actions + management-system item actions + plan-added) —
  // the board pack may never disagree with the plan (UAT finding #9).
  const acts = [];
  const pushAct = a => { if (a && !a.deleted && (a.desc || a.owner || a.due)) acts.push(a); };
  risks.forEach(r => ((r.actions) || []).forEach(pushAct));
  (Array.isArray(s.requirements) ? s.requirements : []).forEach(sec => (sec.items || []).forEach(it => (it.actions || []).forEach(pushAct)));
  (Array.isArray(s.actionPlan) ? s.actionPlan : []).forEach(pushAct);
  const today = (opts.today || new Date().toISOString().slice(0, 10));
  const openActs = acts.filter(a => a.status !== 'Complete' && a.status !== 'Accepted');
  const overdue = openActs.filter(a => a.due && a.due < today);
  const noOwner = openActs.filter(a => !(a.owner && String(a.owner).trim()));
  const noDate = openActs.filter(a => !a.due);

  // Risk control status: the app's hold model via the contract — each risk
  // graded by recorded facts, the company measure a count, HSG65
  // proportionality a rule. Replaces the abstract 0-5 maturity number.
  const holdS = holdSummaryOf(s, (r) => { const res = residualOf(r); return res ? tierFor(res.score, bands) : null; }, { today: opts.today });

  // Exposure score for the bars: mean residual score of rated risks (0–25).
  const meanScore = rated.length ? rated.reduce((a, x) => a + x.res.score, 0) / rated.length : null;
  const profileTier = meanScore != null ? tierFor(Math.max(1, Math.round(meanScore)), bands) : null;

  // Hierarchy of control shares (of risks with a recorded level).
  const hierarchy = HIERARCHY.map(h => ({ ...h, n: risks.filter(r => r.controlLevel === h.key).length }));
  const hierTotal = hierarchy.reduce((a, h) => a + h.n, 0);
  const protectDown = hierarchy.filter(h => h.key !== 'remove' && h.key !== 'prevent')
    .reduce((a, h) => a + h.n, 0);

  // Register rows: fatal/major-harm activities (worst-case severity >= 4).
  const registerRows = scored
    .filter(x => { const sev = Math.max((x.inh && x.inh.s) || 0, (x.res && x.res.s) || 0); return sev >= 4; })
    .sort((a, b) => ((b.res && b.res.score) || 0) - ((a.res && a.res.score) || 0))
    .map(x => {
      const racts = ((x.r.actions) || []).filter(a => a && !a.deleted && (a.desc || a.owner || a.due));
      return {
        name: String(x.r.activity || x.r.hazard || 'Unnamed risk'),
        inherent: x.inh, residual: x.res, target: targetOf(x.r),
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
  const maxSev = Math.max(0, ...scored.map(x => Math.max((x.inh && x.inh.s) || 0, (x.res && x.res.s) || 0)));

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
      ' no recorded controls. ' + holdS.held + ' of ' + holdS.total + ' risk' + (holdS.total !== 1 ? 's are' : ' is') + ' properly held' + (holdS.breaches.length ? (' - ' + holdS.breaches.length + ' rule breach' + (holdS.breaches.length !== 1 ? 'es' : '') + '.') : '.');
  } else {
    headline = noneOrCount(highPlus, 'risk still sits', 'risks still sit', 'No') + ' High or Critical with controls in place.';
    standfirst = countPhrase(rated.length, 'risk is', 'risks are') + ' rated. ' +
      holdS.held + ' of ' + holdS.total + ' risk' + (holdS.total !== 1 ? 's are' : ' is') + ' properly held' + (holdS.breaches.length ? (' - ' + holdS.breaches.length + ' rule breach' + (holdS.breaches.length !== 1 ? 'es' : '') + '.') : '.');
  }

  return {
    bands, risks, rated: rated.length, unrated, matrix, byTier,
    fatal: fatal.length, fatalUncontrolled: fatalUncontrolled.length,
    highPlus, planDone, planAccepted, openActions: openActs.length, overdue: overdue.length,
    noOwner: noOwner.length, noDate: noDate.length,
    holdS, meanScore, profileTier, hierarchy, hierTotal, protectDown,
    registerRows, maxSev, highestHarm: HARM_LADDER[maxSev] || '—',
    duties, headline, standfirst,
    // Assessment completeness, the app's own formula: rated risks +
    // monitoring populated, over risks + 1 (the 0-5 domain scoring is gone).
    completeness: (function () {
      const as = s.riskAssurance || {};
      const monPop = ['leading', 'lagging', 'assurance'].some(k => Array.isArray(as[k]) && as[k].length) ? 1 : 0;
      const tot = risks.length + 1;
      const filled = rated.length + monPop;
      return tot ? Math.round(filled / tot * 100) : 0;
    })(),
    company: co, empty: !rated.length,
  };
}
