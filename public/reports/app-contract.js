// ══════════════════════════════════════════════════════════════
// APP CONTRACT — the definitions the app itself uses, mirrored for the
// report layer so a report can never count differently from a screen.
// GENERATED from the app's own PROF_LIBRARY / RISK_MATURITY_DOMAIN
// (scripts/check-app-report-consistency.mjs asserts they still match the
// live app on every run — edit the app, run the check, regenerate here).
// ══════════════════════════════════════════════════════════════

// Hazard category → the management-maturity domain that controls it.
export const RISK_MATURITY_DOMAIN = {
  "Physical": "opcontrol",
  "Chemical": "ohealth",
  "Biological": "ohealth",
  "Electrical": "opcontrol",
  "Ergonomic": "ohealth",
  "Psychosocial": "ohealth",
  "Fire": "opcontrol",
  "Environmental": "opcontrol",
  "Legal / Regulatory": "leadership",
  "Business continuity": "resilience"
};

// Maturity domains with their item ids ('crit' items scoring <=1 veto the
// domain: its average reads as 0, exactly as the app's _profMaturity does).
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

// ── Fatal potential (SIF) — verbatim port of the app's _riskSif ──
// Explicit boolean override wins; otherwise the credible worst case across
// inherent, residual and target severity: 4-5 = could kill or seriously
// injure. NOT "severity 5 only".
export function sifOf(r) {
  if (r && (r.sif === true || r.sif === false)) return r.sif;
  const s = Math.max(parseInt(r && r.inherentS, 10) || 0, parseInt(r && r.severity, 10) || 0, parseInt(r && r.targetS, 10) || 0);
  return s >= 4;
}

// ── Control status — verbatim port of the app's _riskControlStatus ──
export function controlStatusOf(r) {
  const hasControls = !!(r && r.controls && String(r.controls).trim());
  const strong = r && (r.controlLevel === 'remove' || r.controlLevel === 'prevent');
  if (!hasControls && !(r && r.controlLevel)) return 'None';
  if (hasControls && strong) return 'In place';
  return 'Partial';
}

// ── Per-domain maturity — verbatim port of the app's _profMaturity ──
export function domainMaturity(state, domId) {
  const dom = MATURITY_DOMAINS.find(d => d.id === domId);
  if (!dom) return { avg: null, critFail: false, scored: 0 };
  const m = (state && state.profiler && state.profiler.maturity) || {};
  const scored = dom.items.filter(it => m[it.id] !== undefined && m[it.id] !== '' && m[it.id] !== 'na');
  if (!scored.length) return { avg: null, critFail: false, scored: 0 };
  const vals = scored.map(it => +m[it.id]);
  const critFail = dom.items.some(it => it.crit && m[it.id] !== undefined && m[it.id] !== '' && m[it.id] !== 'na' && +m[it.id] <= 1);
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, critFail, scored: scored.length };
}

// ── Per-risk maturity — verbatim port of the app's _riskMaturityOf ──
export function riskMaturityOf(state, r) {
  const cat = hazardTypeOf(r && r.category, r && r.hazard);
  const dom = RISK_MATURITY_DOMAIN[cat];
  if (!dom) return null;
  const mt = domainMaturity(state, dom);
  if (mt.avg == null) return null;
  return mt.critFail ? 0 : mt.avg;
}

// ── Category normalisation — verbatim port of the app's _hazardType (applied
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
