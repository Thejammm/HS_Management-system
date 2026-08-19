// ══════════════════════════════════════════════════════════════
// APP CONTRACT - the definitions the app itself uses, mirrored for the
// report layer so a report can never count differently from a screen.
// GENERATED from the app's own PROF_LIBRARY
// (scripts/check-app-report-consistency.mjs asserts they still match the
// live app on every run - edit the app, run the check, regenerate here).
// ══════════════════════════════════════════════════════════════

// The six HSG65 areas the consultant judges in words (Weak / Adequate /
// Strong, stored in state.profiler.judgement). Item detail retained to match
// the app's PROF_LIBRARY verbatim.
export const MATURITY_DOMAINS = [
  {
    "id": "leadership",
    "name": "Leadership & Governance",
    "items": [
      {
        "id": "l_policy",
        "crit": false
      },
      {
        "id": "l_accountability",
        "crit": true
      },
      {
        "id": "l_competence",
        "crit": false
      },
      {
        "id": "l_consultation",
        "crit": false
      },
      {
        "id": "l_stopwork",
        "crit": false
      }
    ]
  },
  {
    "id": "contractor",
    "name": "Contractor & Supply Chain",
    "items": [
      {
        "id": "ct_selection",
        "crit": true
      },
      {
        "id": "ct_control",
        "crit": false
      },
      {
        "id": "ct_info",
        "crit": false
      }
    ]
  },
  {
    "id": "ohealth",
    "name": "Occupational Health",
    "items": [
      {
        "id": "oh_surveillance",
        "crit": true
      },
      {
        "id": "oh_strategy",
        "crit": false
      },
      {
        "id": "oh_wellbeing",
        "crit": false
      }
    ]
  },
  {
    "id": "opcontrol",
    "name": "Operational Control",
    "items": [
      {
        "id": "op_ras",
        "crit": true
      },
      {
        "id": "op_sso",
        "crit": false
      },
      {
        "id": "op_training",
        "crit": false
      },
      {
        "id": "op_equip",
        "crit": false
      },
      {
        "id": "op_ppe",
        "crit": false
      }
    ]
  },
  {
    "id": "assurance",
    "name": "Assurance & Monitoring",
    "items": [
      {
        "id": "as_inspection",
        "crit": true
      },
      {
        "id": "as_audit",
        "crit": false
      },
      {
        "id": "as_indicators",
        "crit": false
      },
      {
        "id": "as_investigation",
        "crit": false
      }
    ]
  },
  {
    "id": "resilience",
    "name": "Business Resilience",
    "items": [
      {
        "id": "r_bcp",
        "crit": false
      },
      {
        "id": "r_data",
        "crit": false
      },
      {
        "id": "r_insurance",
        "crit": false
      }
    ]
  }
];

// ── Fatal potential (SIF) - verbatim port of the app's _riskSif ──
// Explicit boolean override wins; otherwise the credible worst case across
// inherent, residual and target severity: 4-5 = could kill or seriously
// injure. NOT "severity 5 only".
export function sifOf(r) {
  if (r && (r.sif === true || r.sif === false)) return r.sif;
  const s = Math.max(parseInt(r && r.inherentS, 10) || 0, parseInt(r && r.severity, 10) || 0, parseInt(r && r.targetS, 10) || 0);
  return s >= 4;
}

// ── Control status - verbatim port of the app's _riskControlStatus ──
export function controlStatusOf(r) {
  const hasControls = !!(r && r.controls && String(r.controls).trim());
  const strong = r && (r.controlLevel === 'remove' || r.controlLevel === 'prevent');
  if (!hasControls && !(r && r.controlLevel)) return 'None';
  if (hasControls && strong) return 'In place';
  return 'Partial';
}

// ── Category normalisation - verbatim port of the app's _hazardType (applied
//    by the app's migrateLoadedState; the report normalises the same way so a
//    legacy/imported category can never split the counts) ──
export const HAZARD_TYPES = ['Physical','Chemical','Biological','Electrical','Ergonomic','Psychosocial','Fire','Environmental','Legal / Regulatory','Business continuity'];
export function hazardTypeOf(category, hazardText) {
  const t = ((hazardText || '') + ' ' + (category || '')).toLowerCase();
  if (/manual handling|musculoskeletal|display screen|\bdse\b|moving or handling people|patient-handling|posture|repetitive/.test(t)) return 'Ergonomic';
  if (HAZARD_TYPES.includes(category)) return category;
  const m = { 'Work at height': 'Physical', 'Work equipment': 'Physical', 'Driving for work': 'Physical', 'Chemical / Hazardous substances': 'Chemical', 'Contractor / Supply chain': 'Legal / Regulatory' };
  if (m[category]) return m[category];
  if (category === 'Health (occupational)') {
    if (/dust|fume|substance|extraction|medicine|cytotoxic|vapour|respiratory|asthma|copd|silica/.test(t)) return 'Chemical';
    if (/noise|vibration|radiation|hearing/.test(t)) return 'Physical';
    if (/cold|thermal|heat/.test(t)) return 'Environmental';
    return 'Ergonomic';
  }
  return 'Physical';
}

// ══════════════════════════════════════════════════════════════
// RISK CONTROL STATUS - verbatim port of the app's hold model (the
// replacement for the 0-5 maturity number). Grades each risk by recorded
// facts; the company measure is a count and the HSG65 proportionality is
// a rule. Must stay identical to the app's _riskHold/_holdBreach/
// _holdSummary - the consistency check diffs them.
// ══════════════════════════════════════════════════════════════
export const HOLD_STATES = {
  held:     { k: 'held',     label: 'Held',         colour: '#16A34A', desc: 'Controls recorded, and the plan delivered and signed off - or the risk formally accepted.' },
  working:  { k: 'working',  label: 'Being worked', colour: '#F59E0B', desc: 'Controls recorded and every gap has an owned, dated action - all on time.' },
  slipping: { k: 'slipping', label: 'Slipping',     colour: '#EA580C', desc: 'The plan is overdue, or actions are missing an owner or a date.' },
  notheld:  { k: 'notheld',  label: 'Not held',     colour: '#DC2626', desc: 'No controls recorded, no plan and no formal acceptance, or the risk is not yet scored.' },
};
export const HOLD_ORDER = ['held', 'working', 'slipping', 'notheld'];

function actionStatusOf(a) {
  if (!a) return 'Not started';
  if (a.status === 'Complete') return 'Complete';
  if (a.status === 'Accepted') return 'Accepted';
  return a.status || 'Not started';
}
// Port of the app's _riskPlanState (kind only - the copy lives in the app).
export function planStateOf(r) {
  const acts = ((r && r.actions) || []).filter(a => a && !a.deleted && (a.desc || a.owner || a.due));
  if (!acts.length) return 'none';
  const open = acts.filter(a => { const st = actionStatusOf(a); return st !== 'Complete' && st !== 'Accepted'; });
  if (open.length) return 'open';
  if (acts.every(a => actionStatusOf(a) === 'Accepted')) return 'accepted';
  return 'managed';
}
const intScore = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null; };
export function holdOf(r, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const l = intScore(r && r.likelihood), sv = intScore(r && r.severity);
  const rated = !!(l && sv);
  const plan = planStateOf(r);
  const controls = controlStatusOf(r) !== 'None';
  const reasons = [];
  if (!rated) reasons.push('not yet scored');
  if (!controls) reasons.push('no controls recorded');
  if (plan === 'none' && rated && controls) reasons.push('no plan and not accepted');
  if (!rated || !controls || plan === 'none')
    return Object.assign({}, HOLD_STATES.notheld, { reasons: reasons.length ? reasons : ['no plan and not accepted'] });
  if (plan === 'accepted') return Object.assign({}, HOLD_STATES.held, { reasons: ['formally accepted with the current controls'], accepted: true });
  if (plan === 'managed' && r.reviewed) return Object.assign({}, HOLD_STATES.held, { reasons: ['plan delivered and signed off'] });
  const acts = ((r.actions) || []).filter(a => a && !a.deleted && (a.desc || a.owner || a.due));
  const open = acts.filter(a => { const st = actionStatusOf(a); return st !== 'Complete' && st !== 'Accepted'; });
  const overdue = open.filter(a => a.due && a.due < today).length;
  const unowned = open.filter(a => !(a.owner && String(a.owner).trim())).length;
  const undated = open.filter(a => !a.due).length;
  if (overdue || unowned || undated) {
    if (overdue) reasons.push(overdue + ' action' + (overdue !== 1 ? 's' : '') + ' overdue');
    if (unowned) reasons.push(unowned + ' action' + (unowned !== 1 ? 's' : '') + ' without an owner');
    if (undated) reasons.push(undated + ' action' + (undated !== 1 ? 's' : '') + ' without a date');
    return Object.assign({}, HOLD_STATES.slipping, { reasons });
  }
  if (plan === 'managed' && !r.reviewed) return Object.assign({}, HOLD_STATES.working, { reasons: ['delivered - awaiting sign-off'] });
  return Object.assign({}, HOLD_STATES.working, { reasons: [open.length + ' action' + (open.length !== 1 ? 's' : '') + ' on time'] });
}
export function holdBreachOf(band, hold) {
  if (band === 'Critical' || band === 'High') {
    if (hold.k === 'slipping' || hold.k === 'notheld') return band + ' risk is ' + hold.label.toLowerCase();
    if (hold.k === 'held' && hold.accepted) return band + ' risk is run on acceptance alone';
  } else if (band === 'Medium') {
    if (hold.k === 'notheld') return 'Medium risk is not held';
  }
  return null;
}
// bandOfRisk needs the tier function; the caller passes it in to avoid a
// circular import (derive.js owns tierFor/bands).
export function holdSummaryOf(state, tierOfRisk, opts = {}) {
  const risks = (state && Array.isArray(state.riskProfile)) ? state.riskProfile : [];
  const rows = risks.map(r => {
    const band = tierOfRisk(r);
    const hold = holdOf(r, opts);
    return { id: r.id, name: String(r.activity || r.hazard || 'Unnamed risk'), band, hold, breach: holdBreachOf(band, hold) };
  });
  const count = k => rows.filter(x => x.hold.k === k).length;
  const held = count('held'), working = count('working'), slipping = count('slipping'), notheld = count('notheld');
  const breaches = rows.filter(x => x.breach);
  const total = rows.length;
  let pillT, pillC, verdict;
  if (!total) { pillT = 'no risks recorded'; pillC = '#8b949a'; verdict = 'Add the risks to the profile to see the position.'; }
  else if (breaches.length) {
    pillT = breaches.length + ' need' + (breaches.length !== 1 ? '' : 's') + ' attention first'; pillC = '#DC2626';
    const names = breaches.slice(0, 2).map(b => b.name + ' (' + (b.hold.reasons[0] || b.breach) + ')');
    verdict = held + ' of ' + total + ' risk' + (total !== 1 ? 's' : '') + ' properly held. ' + breaches.length + ' need' + (breaches.length !== 1 ? '' : 's') + ' attention first: ' + names.join('; ') + (breaches.length > 2 ? ('; and ' + (breaches.length - 2) + ' more.') : '.');
  }
  else if (held === total) { pillT = 'all risks held'; pillC = '#0f6f5c'; verdict = 'All ' + total + ' risk' + (total !== 1 ? 's are' : ' is') + ' properly held - controls recorded, plans delivered and signed off, or formally accepted.'; }
  else {
    pillT = 'working to plan'; pillC = '#c2740a';
    verdict = held + ' of ' + total + ' risk' + (total !== 1 ? 's' : '') + ' properly held; ' + (working + slipping) + ' being worked' + (slipping ? (' (' + slipping + ' slipping)') : '') + (notheld ? ('; ' + notheld + ' not held') : '') + '. Nothing needs attention first - every Critical and High risk is held or being worked on time.';
  }
  return { rows, total, held, working, slipping, notheld, breaches, pillT, pillC, verdict };
}
