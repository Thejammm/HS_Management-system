// ══════════════════════════════════════════════════════════════
// MANAGEMENT PLAN derivation - the whole journey in one object.
//
// The board report answers "how are we doing this period". This answers the
// auditor's question instead: what does this business face, what did you do
// about it, and how do you keep doing it? Every figure here comes from the
// same contract the screens use, so the plan can never say something the app
// does not (house rule: a report may never count differently from a screen).
// ══════════════════════════════════════════════════════════════
import { deriveBoard, bandsFrom, tierFor, residualOf, targetOf, inherentOf } from './derive.js';
import { macroOf, macroKeyOf, macroLetterOf, riskRefOf, controlsTextOf, controlsListOf, controlStatusOf, holdOf, sifOf, sifWordOf, reviewDueOf, embedLinesOf, embedIsSet, HOLD_STATES } from './app-contract.js';

const str = (v) => String(v == null ? '' : v).trim();
const live = (a) => a && !a.deleted && !a.hideFromPlan && (a.desc || a.owner || a.due);
const isClosed = (a) => a && (a.status === 'Complete' || a.status === 'Accepted');
export const fmtD = (s) => {
  if (!s) return '';
  try { return new Date(s + (String(s).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (e) { return str(s); }
};

// Every non-inspection action with where it came from - the same three sources
// and the same guards as the app's _execActions (the consistency check diffs
// the totals, so this can never drift into counting a different plan).
export function planActionsOf(state) {
  const s = state || {};
  const risks = Array.isArray(s.riskProfile) ? s.riskProfile : [];
  const out = [];
  risks.forEach(r => ((r.actions) || []).forEach(a => {
    if (live(a)) out.push({ a, source: 'Risk profile', label: str(r.activity || r.hazard) || 'Risk', risk: r });
  }));
  (Array.isArray(s.requirements) ? s.requirements : []).forEach(sec =>
    ((sec.items) || []).forEach(it => ((it.actions) || []).forEach(a => {
      if (live(a) && str(a.desc)) out.push({ a, source: 'Legal duties', label: str(sec.heading) || 'Legal duty', risk: null });
    })));
  (Array.isArray(s.actionPlan) ? s.actionPlan : []).forEach(a => {
    if (!live(a)) return;
    const rk = risks.find(r => r.id === a.riskId) || null;
    out.push({ a, source: str(a.source) || (rk ? 'Risk profile' : 'Added directly'),
      label: str(a.sourceLabel) || (rk ? str(rk.activity || rk.hazard) : ''), risk: rk });
  });
  return out;
}

// The ongoing controls and statutory checks the business runs - the assurance
// register, which is where a close-out files a routine.
export function routinesOf(state) {
  const secs = (state && state.monitoring && Array.isArray(state.monitoring.regSections)) ? state.monitoring.regSections : [];
  const out = [];
  secs.forEach(sec => (sec.items || []).forEach(it => {
    if (!str(it.item)) return;
    out.push({ section: str(sec.name) || 'Assurance', item: str(it.item), area: str(it.area),
      frequency: str(it.frequency), due: str(it.dueDate), last: str(it.resultDate), result: str(it.result),
      owner: (str(it.notes).match(/Owner:\s*([^.]+)\./) || [])[1] || '' });
  }));
  return out.sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
}

export function signoffOf(state) {
  const p = (state && state.policySignoff) || {};
  const policies = Array.isArray(p.policies) ? p.policies : [];
  const staff = Array.isArray(p.staff) ? p.staff : [];
  const signed = (p.signed && typeof p.signed === 'object') ? p.signed : {};
  const rows = policies.filter(x => str(x.title)).map(x => {
    const n = staff.filter(st => signed[st.id + '|' + x.id]).length;
    return { id: x.id, title: str(x.title), type: str(x.type) || 'Policy', version: str(x.version),
      delivered: str(x.delivered), riskIds: Array.isArray(x.riskIds) ? x.riskIds : [], signed: n, of: staff.length };
  });
  return { rows, staff: staff.length, signedTotal: rows.reduce((a, r) => a + r.signed, 0) };
}

export function briefingsOf(state) {
  const d = (state && state.toolbox && Array.isArray(state.toolbox.deliveries)) ? state.toolbox.deliveries : [];
  return d.filter(x => str(x.title)).map(x => ({ title: str(x.title), date: str(x.date), presenter: str(x.presenter),
    signed: (x.attendees || []).filter(p => p.signed).length, of: (x.attendees || []).length }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function dutiesOf(state) {
  const secs = Array.isArray(state && state.requirements) ? state.requirements : [];
  let assessed = 0, gaps = 0, compliant = 0, total = 0;
  const sections = secs.map(sec => {
    const items = (sec.items || []).filter(it => str(it.requirement));
    let g = 0, c = 0, a = 0;
    items.forEach(it => {
      const present = str(it.present), adequate = str(it.adequate);
      if (present || adequate) a++;
      if (it.reviewed) c++;
      else if (/^(no|partial)/i.test(present) || /^(no|partial)/i.test(adequate)) g++;
    });
    total += items.length; assessed += a; gaps += g; compliant += c;
    return { heading: str(sec.heading) || 'Legal duties', items: items.length, assessed: a, gaps: g, compliant: c };
  });
  return { sections, total, assessed, gaps, compliant };
}

export function inspectionsOf(state) {
  const v = Array.isArray(state && state.siteInspections) ? state.siteInspections : [];
  const done = v.filter(x => x.actual && x.outcome !== 'Not done').length;
  return { planned: v.length, done, rows: v.slice(0, 12).map(x => ({ what: str(x.type || x.title) || 'Visit',
    planned: str(x.planned), actual: str(x.actual), outcome: str(x.outcome) })) };
}

// One row per risk - the journey the auditor is asked to follow: what it is,
// how bad it was, what was done, where it sits now, how it is held, and the
// proof behind it.
function riskRowOf(r, state, bands, acts, sign, opts) {
  const inh = inherentOf(r), res = residualOf(r), tgt = targetOf(r);
  const tier = res ? tierFor(res.score, bands) : null;
  const mine = acts.filter(x => x.risk && x.risk.id === r.id);
  const done = mine.filter(x => isClosed(x.a));
  const open = mine.filter(x => !isClosed(x.a));
  const kept = [];
  done.forEach(x => embedLinesOf(x.a).forEach(l => kept.push(l)));
  const evidence = (Array.isArray(r.linked) ? r.linked : []).map(l => str(l.ref || l.url)).filter(Boolean);
  const policies = sign.rows.filter(p => p.riskIds.indexOf(r.id) >= 0).map(p => p.title);
  const hold = holdOf(r, { today: opts.today });
  return {
    id: r.id, ref: riskRefOf(r), themeKey: macroKeyOf(r),
    name: str(r.activity || r.hazard) || 'Unnamed risk',
    assoc: str(r.assocRisk), area: str(r.area), theme: macroOf(r, state) || 'Not yet grouped',
    inherent: inh, residual: res, target: tgt, tier,
    targetTier: tgt ? tierFor(tgt.score, bands) : null,
    control: controlStatusOf(r), controls: controlsTextOf(r), controlsList: controlsListOf(r),
    hold: hold, holdWord: (HOLD_STATES[hold.k] ? HOLD_STATES[hold.k].label : ''),
    fatal: sifOf(r), sifWord: sifWordOf(r), reviewed: !!r.reviewed, reviewDue: str(r.reviewDue), reviewOverdue: reviewDueOf(r, opts),
    actsTotal: mine.length, actsDone: done.length, actsOpen: open.length,
    openRows: open.map(x => ({ desc: str(x.a.desc), owner: str(x.a.owner), due: str(x.a.due) })),
    kept, heldCount: done.filter(x => embedIsSet(x.a)).length,
    evidence, policies,
  };
}

export function deriveManagementPlan(state, opts = {}) {
  const s = state || {};
  const D = deriveBoard(s, opts);
  const bands = bandsFrom(s);
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const risks = Array.isArray(s.riskProfile) ? s.riskProfile : [];
  const acts = planActionsOf(s);
  const sign = signoffOf(s);

  const rows = risks.map(r => riskRowOf(r, s, bands, acts, sign, { today }));

  // Themes, in the register's own order: worst band first, then by name.
  const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const byTheme = new Map();
  rows.forEach(x => { if (!byTheme.has(x.theme)) byTheme.set(x.theme, []); byTheme.get(x.theme).push(x); });
  const themes = [...byTheme.entries()].map(([name, list]) => ({
    name, rows: list,
    worst: list.reduce((w, x) => ((rank[x.tier] || 0) > (rank[w] || 0)) ? x.tier : w, null),
    controlled: list.filter(x => x.control === 'In place').length,
    held: list.filter(x => x.hold && x.hold.k === 'held').length,
    fatal: list.filter(x => x.fatal).length,
  }));
  themes.forEach((t) => {
    // the letter the app gave this theme, not this theme's place in the list
    t.key = (t.rows[0] && t.rows[0].themeKey) || '';
    t.letter = macroLetterOf(s, t.key);
    t.meta = t.rows.length + ' risk' + (t.rows.length !== 1 ? 's' : '')
      + ' \u00b7 ' + t.controlled + ' controlled'
      + (t.fatal ? (' \u00b7 ' + t.fatal + ' flagged worst case') : '');
  });
  // The letter IS the order, so the plan reads A, B, C down the page and has
  // the same contents every issue (Simon, 2026-09-28). X - a risk with no
  // category yet - always comes last, whatever letters are in use above it.
  themes.sort((a, b) => {
    if ((a.letter === 'X') !== (b.letter === 'X')) return a.letter === 'X' ? 1 : -1;
    return a.letter.length - b.letter.length || a.letter.localeCompare(b.letter);
  });

  const closedActs = acts.filter(x => isClosed(x.a));
  const openActs = acts.filter(x => !isClosed(x.a));
  const heldActs = closedActs.filter(x => embedIsSet(x.a));
  const routines = routinesOf(s);
  const duties = dutiesOf(s);
  const insp = inspectionsOf(s);
  const briefs = briefingsOf(s);
  const docs = (Array.isArray(s.documents) ? s.documents : []).filter(d => str(d.name));
  const co = s.company || {};
  const people = (Array.isArray(co.personnel) ? co.personnel : []).filter(p => str(p.name) || str(p.role));
  const policy = s.policyDoc || {};

  // What the business is exposed to, in one sentence the client would say.
  const sectors = [str(co.sector)].filter(Boolean);
  const scope = [str(co.description), sectors.length ? ('Sector: ' + sectors.join(', ') + '.') : '',
    str(co.employees) ? (str(co.employees) + ' people.') : '',
    str(co.siteCount) ? (str(co.siteCount) + ' site(s).') : ''].filter(Boolean).join(' ');

  return {
    D, bands, today, company: co, scope, people, policy,
    rows, themes, acts,
    openActs: openActs.length, closedActs: closedActs.length, heldActs: heldActs.length,
    overdueActs: openActs.filter(x => x.a.due && x.a.due < today).length,
    routines, duties, insp, briefs, docs, sign,
    controlled: rows.filter(x => x.control === 'In place').length,
    reviewOverdue: rows.filter(x => x.reviewOverdue).length,
    keptLines: closedActs.flatMap(x => embedLinesOf(x.a)),
    empty: !rows.length,
  };
}
