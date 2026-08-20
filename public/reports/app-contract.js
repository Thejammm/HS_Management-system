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
// H&S CONTROL MATURITY - verbatim port of the app's model. Grades each risk
// by recorded facts onto the 4 to 1 scale (Assured, Managed, Vulnerable,
// Uncontrolled); the company measure is a count and HSG65 proportionality is
// a rule. Must stay identical to the app's _riskHold/_holdBreach/
// _holdSummary - the consistency check diffs them.
// ══════════════════════════════════════════════════════════════
export const HOLD_STATES = {
  held:     { k: 'held',     level: 4, label: 'Assured',      sub: 'Established & effective',      colour: '#16A34A', desc: 'Established and effective: controls recorded, and the plan delivered and signed off - or the risk formally accepted.' },
  working:  { k: 'working',  level: 3, label: 'Managed',      sub: 'Established with gaps',        colour: '#F59E0B', desc: 'Established with gaps: controls recorded and every gap has an owned, dated action - all on time.' },
  slipping: { k: 'slipping', level: 2, label: 'Vulnerable',   sub: 'Deteriorating / at risk',      colour: '#EA580C', desc: 'Deteriorating: the plan is overdue, or actions are missing an owner or a date.' },
  notheld:  { k: 'notheld',  level: 1, label: 'Uncontrolled', sub: 'Not established / ineffective', colour: '#DC2626', desc: 'Not established: no controls recorded, no plan and no formal acceptance, or the risk is not yet scored.' },
};
// "4 · Assured" - the level and the word together, for compact labels.
export function hsLevel(k){ const st = HOLD_STATES[k]; return st ? (st.level + ' · ' + st.label) : ''; }
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
    if (hold.k === 'notheld') return 'Medium risk is ' + hold.label.toLowerCase();
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
    verdict = held + ' of ' + total + ' risk' + (total !== 1 ? 's' : '') + ' assured. ' + breaches.length + ' need' + (breaches.length !== 1 ? '' : 's') + ' attention first: ' + names.join('; ') + (breaches.length > 2 ? ('; and ' + (breaches.length - 2) + ' more.') : '.');
  }
  else if (held === total) { pillT = 'all risks assured'; pillC = '#0f6f5c'; verdict = 'All ' + total + ' risk' + (total !== 1 ? 's are' : ' is') + ' assured - controls recorded, plans delivered and signed off, or formally accepted.'; }
  else {
    pillT = 'working to plan'; pillC = '#c2740a';
    verdict = held + ' of ' + total + ' risk' + (total !== 1 ? 's' : '') + ' assured; ' + working + ' managed' + (slipping ? ('; ' + slipping + ' vulnerable') : '') + (notheld ? ('; ' + notheld + ' uncontrolled') : '') + '. Nothing needs attention first - every Critical and High risk is assured or managed on time.';
  }
  return { rows, total, held, working, slipping, notheld, breaches, pillT, pillC, verdict };
}

// ══════════════════════════════════════════════════════════════
// DOCUMENT CONTROL - verbatim port of the app's _docFor / _autoDocRef /
// _docClientCode. Every generated report is a controlled document: its own
// register row (state.docControl.docs[key]) falling back to the org
// defaults, with auto reference, issue date and next review when blank.
// The app's version prefers the client display name for the reference code;
// the server passes it via opts.clientName (the tenant name).
// ══════════════════════════════════════════════════════════════
export const REPORT_DOC_CODES = {
  companyProfile: 'CP', policySignoff: 'PSO', boardReport: 'BR', riskProfile: 'RP',
  actionPlan: 'AP', executionPlan: 'EP', completedActions: 'CA', actionArchive: 'AA',
  managementSystem: 'MS', raRegister: 'RAR', riskAcceptance: 'RAC', audit: 'AUD',
  siteInspections: 'SIT', feedback: 'CR', cas: 'CAS', acp: 'ACP', policy: 'POL',
  incidents: 'INC', consultation: 'CCR', trainingMatrix: 'TCR', assuranceMonthly: 'MAR',
};
export function docFor(state, key, opts = {}) {
  const s = state || {};
  const dcAll = (s.docControl && typeof s.docControl === 'object') ? s.docControl : {};
  const def = dcAll.defaults || {};
  const d = (dcAll.docs && dcAll.docs[key]) || {};
  const code = REPORT_DOC_CODES[key] || 'DOC';
  const version = (d.version && String(d.version).trim()) || '1.0';
  const author = (d.author || def.author || '').trim();
  const approverName = (d.approverName || def.approverName || '').trim();
  const approverRole = (d.approverRole || def.approverRole || '').trim();
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const issued = (d.issued && String(d.issued).trim()) || today;
  let nextReview = (d.nextReview && String(d.nextReview).trim()) || '';
  if (!nextReview) {
    const m = parseInt(def.reviewMonths, 10) || 12;
    const nx = new Date(issued + 'T12:00:00');
    if (!isNaN(nx)) { nx.setMonth(nx.getMonth() + m); nextReview = nx.toISOString().slice(0, 10); }
  }
  // Same precedence as the app's _cockpitClientName: the client/tenant name
  // (the server passes it), then the branding name, then the placeholder.
  const clientName = opts.clientName || (s.branding && s.branding.name) || 'Your organisation';
  const clientCode = (String(clientName).replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()) || 'AHS';
  const pfx = (def.refPrefix && String(def.refPrefix).trim()) ? String(def.refPrefix).trim() : ('AHS-' + clientCode);
  const ref = (d.ref && String(d.ref).trim()) || (pfx + '-' + code + '-v' + String(version));
  return { ref, version, author, approverName, approverRole, issued, nextReview, omit: !!d.omit };
}

// ── Training rows - verbatim port of the app's _trainingRows over the v2
//    people store (S.trainingData), with the same in-memory migration of the
//    legacy flat S.training list the app performs (_trainingData). Pure:
//    never writes the state. Active people only; only date cells carry an
//    expiry. Rows: { employee, course, completed, expiry }. ──
export function trainingRowsOf(state) {
  const s = state || {};
  let people;
  if (s.trainingData && typeof s.trainingData === 'object' && Array.isArray(s.trainingData.people)) {
    people = s.trainingData.people;
  } else {
    people = []; const seen = {};
    (Array.isArray(s.training) ? s.training : []).forEach(r => {
      const key = (r.employee || '').toLowerCase(); if (!key) return;
      let p = seen[key]; if (!p) { p = { group: 'staff', status: 'active', lastName: '', firstName: r.employee || '', cells: {} }; seen[key] = p; people.push(p); }
      if (r.course) p.cells[r.course] = { type: r.expiry ? 'date' : 'empty', v: r.expiry || '' };
    });
  }
  const out = [];
  people.forEach(p => {
    if (!p || p.status === 'left') return;
    const nm = (((p.firstName || '') + ' ' + (p.lastName || '')).replace(/\s+/g, ' ').trim()) || String(p.lastName || '');
    Object.keys(p.cells || {}).forEach(course => {
      const c = p.cells[course]; if (!c || c.type === 'empty' || c.v === '' || c.v == null) return;
      out.push({ employee: nm, course, completed: '', expiry: (c.type === 'date' ? (c.v || '') : '') });
    });
  });
  return out;
}
