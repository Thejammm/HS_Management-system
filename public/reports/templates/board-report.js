// Board report template - Signal (data-forward) and Brief (editorial) formats.
// Both build the SAME content; format changes the skin class only.
import { deriveBoard, deriveBoardExtras, noneOrCount, countPhrase, hasHave, TIER_COLOURS, HOLD_STATES, HOLD_ORDER, docFor, producerOf , trainingRowsOf } from '../derive.js';
import { esc, tierWord, planBar } from '../blocks.js';
import { paginateRows } from '../engine.js';

// The report's sections, defaulted to what HSG65 says a leadership review
// draws on (Reviewing performance, p55): active + reactive monitoring,
// accident/incident/near-miss data, training records, inspection and
// investigation reports, risk assessments, issues raised by workers, and
// checks required by law - plus HSG65's own instruction to celebrate
// successes and close the loop. Per-client choice lives in
// state.reportPrefs['board-report'].hidden (locked sections always print).
export const BOARD_SECTIONS = [
  { id: 'position',       label: 'Executive summary', locked: true, hsg: 'Headline, movement since the baseline, decisions required' },
  { id: 'dashboard',      label: 'H&S dashboard', hsg: 'The live picture - tiles, matrix, bands, control ladder' },
  { id: 'accidents',      label: 'Accidents', hsg: 'Reactive monitoring · incident data' },
  { id: 'nearmiss',       label: 'Near misses', hsg: 'Reactive monitoring · leading indicator' },
  { id: 'riddor',         label: 'RIDDOR', hsg: 'Statutory reporting' },
  { id: 'inspections',    label: 'Inspection performance', hsg: 'Active monitoring · inspection reports' },
  { id: 'audits',         label: 'Audit performance', hsg: 'Active monitoring · audit of the system' },
  { id: 'outstanding',    label: 'Outstanding actions', hsg: 'What is owed and by when' },
  { id: 'highrisk',       label: 'High-risk actions', hsg: 'Actions on the biggest risks + the fatal & major-harm register' },
  { id: 'training',       label: 'Training', hsg: 'The matrix - what is held and in date' },
  { id: 'competence',     label: 'Competence', hsg: 'Where each person stands against the matrix' },
  { id: 'legal',          label: 'Legal compliance', hsg: 'Duties assessed, met and not in place + checks required by law' },
  { id: 'memberships',    label: 'Accreditation and memberships', hsg: 'What is held, and when it expires' },
  { id: 'objectives',     label: 'Objectives', hsg: 'The measures the business set itself - target vs current' },
  { id: 'supply',         label: 'Subcontractor performance', hsg: 'Competence of others working under your control' },
  { id: 'ohealth',        label: 'Occupational health', hsg: 'Surveillance and outcomes' },
  { id: 'topFive',        label: 'Top 5', hsg: 'The five priorities agreed in the meeting' },
  { id: 'environmental',  label: 'Environmental', hsg: 'Environmental events & investigations' },
  { id: 'cdm',            label: 'CDM', hsg: 'Design reviews & CDM audits' },
  { id: 'bsafety',        label: 'Building Safety', hsg: 'Higher-risk buildings & gateways' },
  { id: 'accreditation',  label: 'Accreditation readiness', hsg: 'The Common Assessment Standard journey' },
  { id: 'completed',      label: 'Actions completed', hsg: 'Everything closed off, dated - accepted risks included' },
  { id: 'decisions',      label: 'Management decisions', hsg: 'The results of the board meeting, checked next time' },
  { id: 'maturity',       label: 'Sign-off - control maturity, consultant judgement, directors’ duty', locked: true },
];
// Sections that used to be one. A client who switched the bundled section off
// keeps that choice across the split rather than having three new sections
// appear in their next report unannounced.
const LEGACY_SPLIT = { reactive: ['accidents', 'nearmiss', 'riddor'], active: ['inspections', 'audits'],
  wins: ['completed'], interpretation: ['dashboard'] };
export function boardHidden(state) {
  const p = state && state.reportPrefs && state.reportPrefs['board-report'];
  const h = (p && p.hidden && typeof p.hidden === 'object') ? p.hidden : {};
  const inherited = {};
  Object.keys(LEGACY_SPLIT).forEach(old => { if (h[old]) LEGACY_SPLIT[old].forEach(id => { inherited[id] = true; }); });
  const out = {};
  BOARD_SECTIONS.forEach(s => { out[s.id] = !s.locked && (!!h[s.id] || (h[s.id] === undefined && !!inherited[s.id])); });
  return out;
}

import { MATURITY_DOMAINS } from '../app-contract.js';
// The consultant's judgement of the six HSG65 areas - words, never numbers.
function judgementRows(state) {
  const j = (state && state.profiler && state.profiler.judgement) || {};
  const words = { weak: 'Weak', developing: 'Developing', adequate: 'Adequate', strong: 'Strong' };
  return MATURITY_DOMAINS
    .map(d => ({ label: d.name, j: j[d.id] || {} }))
    .filter(x => x.j.level)
    .map(x => ({ label: x.label, level: words[x.j.level] || x.j.level, note: String(x.j.note || '') }));
}

export function buildBoardReport(state, opts = {}) {
  const D = deriveBoard(state, opts);
  const X = deriveBoardExtras(state, opts);
  const hide = boardHidden(state);
  // Retired ids that folded into other sections keep the choice a client
  // already made: workers lives inside the dashboard, statutory inside Legal
  // compliance, the register inside High-risk actions.
  const rawHide = (state && state.reportPrefs && state.reportPrefs['board-report'] && state.reportPrefs['board-report'].hidden) || {};
  const foldHide = { workers: !!rawHide.workers, statutory: !!rawHide.statutory, register: !!rawHide.register };
  const fmtD = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const co = D.company;
  const org = (opts.tenant && opts.tenant.name) || co.tradingName || co.legalName || 'Client';
  const period = (opts.period) || new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const today = (opts.today ? new Date(opts.today) : new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const format = opts.format || 'signal';

  // Document control: this report's own row from the app's register
  // (Reports tab), falling back to the org defaults - reference, version,
  // prepared-by, approver, issue date, next review. Same resolution as the
  // in-app PDFs (_docFor), via the contract.
  const dc = docFor(state, 'boardReport', { clientName: (opts.tenant && opts.tenant.name) || '', today: opts.today });
  const fmtDC = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const ref = ((opts.meta && opts.meta.ref) || (dc.omit ? '' : dc.ref));

  const mast = { type: 'masthead', org, refCode: ref, issued: dc.omit ? today : fmtDC(dc.issued), review: dc.omit ? '' : fmtDC(dc.nextReview) };

  // ── Page 1: Position ──
  // Every label must say what the number is in plain words - no term a
  // reader has to ask about (Simon: "if it's the amount of risks that sit in
  // High then just say it").
  const kpis = [
    { value: D.maxSev ? String(D.maxSev) + '/5' : '-', label: 'Worst possible harm', note: D.highestHarm, tone: D.maxSev >= 5 ? 'bad' : D.maxSev >= 4 ? 'warn' : undefined },
    { value: String(D.fatal), label: 'Could kill or seriously injure', tone: D.fatal ? 'bad' : 'ok' },
    { value: String(D.fatalUncontrolled), label: 'Of those, no controls recorded', tone: D.fatalUncontrolled ? 'bad' : 'ok' },
    // The positive half: work CLOSED OUT. A risk counts when every planned
    // action on it is complete; formal acceptances are stated as a caveat,
    // never counted as done. (Replaced the High-or-Critical tile - that
    // repeats what the band bars and register already show.)
    (function () {
      const total = D.holdS.total;
      const rest = total - D.planDone - D.planAccepted;
      const bits = [];
      if (rest) bits.push(countPhrase(rest, 'risk still in delivery', 'risks still in delivery'));
      if (D.planAccepted) bits.push(countPhrase(D.planAccepted, 'risk formally accepted, not counted as done', 'risks formally accepted, not counted as done'));
      const note = bits.length ? bits.join(' · ') : (total ? 'every planned action closed' : 'no risks recorded');
      return { value: D.planDone + '/' + total, label: 'Risks fully actioned', note,
               tone: total && (D.planDone + D.planAccepted === total) ? 'ok' : undefined };
    })(),
    { value: D.holdS.held + '/' + D.holdS.total, label: 'Risks assured', note: D.holdS.breaches.length ? (D.holdS.breaches.length + ' need' + (D.holdS.breaches.length !== 1 ? '' : 's') + ' attention first') : 'nothing needs attention', tone: D.holdS.breaches.length ? 'bad' : (D.holdS.total && D.holdS.held === D.holdS.total ? 'ok' : undefined) },
    { value: String(D.overdue), label: 'Actions overdue', tone: D.overdue ? 'warn' : 'ok' },
  ];

  const decisions = [];
  if (D.fatalUncontrolled) decisions.push({ text: 'Direct that the ' + countPhrase(D.fatalUncontrolled, 'risk that could kill or seriously injure and has', 'risks that could kill or seriously injure and have') + ' no recorded controls get controls recorded this quarter.', rationale: 'A could-kill risk with no recorded controls is the first thing an inspector or prosecutor will ask about.' });
  if (D.overdue) decisions.push({ text: 'Reset owners and dates on the ' + countPhrase(D.overdue, 'overdue action', 'overdue actions') + '.', rationale: 'Overdue actions with no intervention become evidence of a plan the organisation does not follow.' });
  // Numbers only on the front page - the named list gets its own page so ten
  // of them can never crowd the position (Simon).
  if (D.holdS.breaches.length) { decisions.push({ text: 'Direct that the ' + countPhrase(D.holdS.breaches.length, 'risk needing attention first', 'risks needing attention first') + ' ' + (D.holdS.breaches.length === 1 ? 'is' : 'are') + ' dealt with this month. The named list follows this page.', rationale: 'The response must match the size of the risk: Critical and High risks assured or managed - never assured on acceptance alone; Medium risks never left uncontrolled.' }); }
  if (!decisions.length) decisions.push({ text: D.empty ? 'Commission completion of the risk profile before the next board cycle.' : 'Note the position and maintain the current programme.', rationale: D.empty ? 'No decision can be soundly made from an incomplete profile.' : 'No exception requires a board decision this period.' });

  // Where the risks stand - real counts in the four factual states. The
  // front-page verdict carries COUNTS ONLY; the named list lives on its own
  // page so it can never crowd the position.
  const expBars = {
    type: 'distributionBars', title: 'H&S control maturity of the ' + D.holdS.total + ' risk' + (D.holdS.total !== 1 ? 's' : ''),
    items: HOLD_ORDER.map(k => ({ label: HOLD_STATES[k].level + ' · ' + HOLD_STATES[k].label, n: D.holdS[k], colour: HOLD_STATES[k].colour })),
  };
  const verdictLine = D.holdS.breaches.length
    ? (D.holdS.held + ' of ' + D.holdS.total + ' risk' + (D.holdS.total !== 1 ? 's' : '') + ' assured. ' + D.holdS.breaches.length + ' need' + (D.holdS.breaches.length !== 1 ? '' : 's') + ' attention first - the named list has its own page.')
    : D.holdS.verdict;

  // ── The attention page(s): every risk needing attention first, named with
  //    the reason. Prints only when there is something to act on. ──
  const attentionPages = [];
  if (D.holdS.breaches.length) {
    const slices = paginateRows(D.holdS.breaches, 12, 16);
    slices.forEach((slice, i) => attentionPages.push({
      label: 'Attention', blocks: [
        mast,
        ...(i === 0 ? [{ type: 'titleBlock', kicker: 'Needs attention first',
          headline: D.holdS.breaches.length + ' risk' + (D.holdS.breaches.length !== 1 ? 's need' : ' needs') + ' attention first.',
          standfirst: 'The response must match the size of the risk. These are the risks where it currently does not - each named, with its H&S control maturity and the reason. Deal with these before anything else on the plan.' }] : []),
        { type: 'dataTable', title: slices.length > 1 ? ('Needs attention first - part ' + (i + 1) + ' of ' + slices.length) : undefined,
          cols: [ { header: 'Risk', w: '32%' }, { header: 'Band', w: '12%' }, { header: 'Maturity', w: '16%' }, { header: 'Why', w: '40%' } ],
          rows: slice.map(b => [ b.name, b.band || '-', b.hold.level + ' · ' + b.hold.label, (b.hold.reasons && b.hold.reasons.join('; ')) || b.breach ]),
          footnote: i === slices.length - 1 ? 'Also flagged with a ! on the front-page matrix and named in the register.' : undefined },
      ],
    }));
  }

  // Movement since the baseline lives on the executive summary now - where a
  // board actually reads direction of travel.
  const moveBlock = (X.baseline && X.baseline.metrics) ? (function () {
    const b = X.baseline.metrics; const mv = (a, c) => (a == null || c == null) ? '-' : (c > a ? ('up ' + (c - a)) : c < a ? ('down ' + (a - c)) : 'no change');
    return { type: 'dataTable', title: 'Movement since the baseline',
      cols: [ { header: 'Measure', w: '40%' }, { header: 'Baseline ' + fmtD(X.baseline.date), w: '20%' }, { header: 'Now', w: '20%' }, { header: 'Movement', w: '20%' } ],
      rows: [
        [ 'Risks assured', String(b.held ?? '-'), String(D.holdS.held), (b.held != null) ? ((D.holdS.held > b.held) ? ('up ' + (D.holdS.held - b.held)) : (D.holdS.held < b.held) ? ('down ' + (b.held - D.holdS.held)) : 'no change') : '-' ],
        [ 'Need attention first', String(b.ruleBreaches ?? '-'), String(D.holdS.breaches.length), (b.ruleBreaches != null) ? ((D.holdS.breaches.length < b.ruleBreaches) ? ('down ' + (b.ruleBreaches - D.holdS.breaches.length)) : (D.holdS.breaches.length > b.ruleBreaches) ? ('up ' + (D.holdS.breaches.length - b.ruleBreaches)) : 'no change') : '-' ],
        [ 'High + critical risks', String(b.highCrit ?? '-'), String(D.highPlus), mv(b.highCrit, D.highPlus) ],
        [ 'Open actions', String(b.openActions ?? '-'), String(D.openActions), mv(b.openActions, D.openActions) ],
        [ 'Overdue actions', String(b.overdueActions ?? '-'), String(D.overdue), mv(b.overdueActions, D.overdue) ],
      ],
      footnote: 'Baseline = the first audit snapshot ("where they started"). The consultant records a snapshot at each audit visit.' };
  })() : null;

  const page1 = {
    label: 'Executive summary', cover: format === 'signal', blocks: [
      { type: 'coverBlock', org, title: 'H&S Board Report', period, refCode: ref, issued: today },
      { type: 'titleBlock', kicker: 'Health & safety board report · ' + period, headline: D.headline, standfirst: D.standfirst },
      { type: 'decisionsPanel', title: 'Decisions required', items: decisions },
      ...(moveBlock ? [moveBlock] : []),
      { type: 'soWhat', text: verdictLine },
    ],
  };

  // ── The H&S dashboard - the live picture on one page. Everything the old
  //    front-page tiles and "picture explained" back page carried, together
  //    where a reader can take it in at once. ──
  const zeros = [];
  zeros.push(D.noOwner ? countPhrase(D.noOwner, 'open action has', 'open actions have') + ' nobody named to do ' + (D.noOwner === 1 ? 'it' : 'them') + '.' : 'Every open action has someone named to do it.');
  zeros.push(D.noDate ? countPhrase(D.noDate, 'open action has', 'open actions have') + ' no target date.' : 'Every open action has a target date.');
  zeros.push(D.unrated ? countPhrase(D.unrated, 'recorded risk is', 'recorded risks are') + ' not yet scored.' : 'Every recorded risk is scored.');
  const dashboardPage = !hide.dashboard ? {
    label: 'Dashboard', section: 'dashboard', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'H&S dashboard', headline: 'The live picture, on one page.',
        standfirst: 'Every number here is derived from the live system as it stands today - the risk profile, the plan and the registers. Nothing is keyed in for the report.' },
      { type: 'kpiStrip', tiles: kpis },
      { type: 'matrix5x5', counts: D.matrix, bands: D.bands, caption: 'Where every rated risk sits now, with controls in place (likelihood across, severity up; the number is how many risks sit in that square). Each square is coloured by its risk band: red Critical, orange High, amber Medium, green Low.' },
      { type: 'distributionBars', title: 'How many risks sit in each band (with controls in place)', items: ['Critical', 'High', 'Medium', 'Low'].map(t => ({ label: t, n: D.byTier[t], colour: TIER_COLOURS[t] })) },
      expBars,
      { type: 'hierarchyStrip', title: 'How the risks are controlled - strongest measures first', items: D.hierarchy, total: D.hierTotal, protectDown: D.protectDown },
      ...(!foldHide.workers ? [{ type: 'textBlock', title: 'Issues raised by workers', body:
        (X.brRecent.length
          ? countPhrase(X.brRecent.length, 'briefing was', 'briefings were') + ' recorded in the period, ' + noneOrCount(X.brFb.length, 'with something raised back by the workforce', 'with something raised back by the workforce', 'none') + '. '
            + (X.brFb.length ? ('Latest: ' + X.brFb.slice(0, 2).map(b => '“' + String(b.feedback).slice(0, 90) + '”').join(' · ')) : 'Two-way evidence is thin - briefings are being held but nothing coming back is being captured.')
          : 'No briefings were recorded this period. Communication should run both ways - daily starts and toolbox talks belong on the record with what the workforce raised.') }] : []),
      { type: 'textBlock', title: 'Loose ends', body: zeros.join(' ') },
      { type: 'textBlock', title: 'Consultant commentary', body: (opts.meta && opts.meta.commentary) || 'Reserved for the consultant’s reading of this period.', cls: 'r-commentary' },
    ],
  } : null;

  // ── The review pages - what the leadership meeting reviews, from the
  //    live system. Sections toggle per client; empty pages drop out. ──
  const hsgFoot = { type: 'textBlock', body: 'A leadership review draws on: active and reactive monitoring, accident, incident and near-miss data, training records, inspection and investigation reports, risk assessments, issues raised by workers, and checks required by law. Each section above reports one of them from the live system. Period covered: the 90 days to ' + today + '.', cls: 'r-stamp' };

  // ── Legal compliance, accreditation, CDM oversight and environmental
  //    events - each computed here from the raw records (facts in, metrics
  //    calculated; nothing stored). ──
  const reqSections = Array.isArray(state.requirements) ? state.requirements : [];
  const legal = { assessed: 0, met: 0, notInPlace: [], gaps: [] };
  reqSections.forEach(sec => (sec.items || []).forEach(it => {
    if (!(it && (it.present || it.adequate || it.reviewed))) return;
    legal.assessed++;
    if (it.present === 'Yes' && it.adequate === 'Yes') { legal.met++; return; }
    const row = { duty: sec.heading || 'Legal duty', line: String(it.requirement || '').slice(0, 90), cite: sec.citation || '', due: it.dueDate || '', nip: it.present === 'No' };
    if (row.nip) legal.notInPlace.push(row); else legal.gaps.push(row);
  }));

  const casStatus = (state.cas && state.cas.status && typeof state.cas.status === 'object') ? state.cas.status : {};
  const cas = { ready: 0, partial: 0, gap: 0, na: 0, assessed: 0 };
  Object.keys(casStatus).forEach(k => { const v = (casStatus[k] || {}).v;
    if (v === 'ready') cas.ready++; else if (v === 'partial') cas.partial++; else if (v === 'gap') cas.gap++; else if (v === 'na') cas.na++; else return; cas.assessed++; });
  const casAssessable = cas.assessed - cas.na;
  const casPct = casAssessable > 0 ? Math.round(cas.ready / casAssessable * 100) : null;

  const CDM_KINDS = ['CDM audit', 'Design review', 'Architectural review'];
  const cdmAll = (Array.isArray(state.siteInspections) ? state.siteInspections : []).filter(v => CDM_KINDS.includes(v.kind));
  const todayIso = (opts.today || new Date().toISOString().slice(0, 10));
  const cdm = {
    total: cdmAll.length,
    done: cdmAll.filter(v => v.actual && v.outcome !== 'Not done').length,
    overdue: cdmAll.filter(v => !v.actual && v.planned && v.planned < todayIso).length,
    latest: cdmAll.filter(v => v.actual).sort((a, b) => String(b.actual).localeCompare(String(a.actual))).slice(0, 6),
  };

  const decAll = Array.isArray(state.decisions) ? state.decisions.slice() : [];
  const decOpenOf = d => d && (d.status === 'Agreed' || d.status === 'In progress');
  const dec = {
    total: decAll.length,
    open: decAll.filter(decOpenOf).length,
    overdue: decAll.filter(d => decOpenOf(d) && d.due && d.due < todayIso).length,
    delivered: decAll.filter(d => d.status === 'Delivered').length,
    decided: decAll.filter(d => d.status !== 'Superseded' && d.status !== 'Not pursued').length,
    recent: decAll.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8),
  };
  dec.pct = dec.decided ? Math.round(dec.delivered / dec.decided * 100) : null;
  // Supply chain: dates decide everything, so nothing is stored as a score.
  const supAll = Array.isArray(state.supplyChain) ? state.supplyChain : [];
  const expiredOn = d => !!d && d < todayIso;
  const soonIso = (function () { const s = new Date(todayIso + 'T12:00:00'); s.setDate(s.getDate() + 60); return s.toISOString().slice(0, 10); })();
  const gapsOf = p => {
    const g = [];
    if (!p.elciExpiry) g.push('EL insurance not recorded'); else if (expiredOn(p.elciExpiry)) g.push('EL insurance expired');
    if (!p.pliExpiry) g.push('PL insurance not recorded'); else if (expiredOn(p.pliExpiry)) g.push('PL insurance expired');
    if (!p.policy) g.push('H&S policy not seen');
    if (!p.rams) g.push('RAMS not reviewed');
    if (!p.competence) g.push('competence not evidenced');
    if (!p.refs) g.push('references not taken');
    if (expiredOn(p.reviewDate)) g.push('review overdue');
    return g;
  };
  // Building safety. The higher-risk test is DERIVED from the physical facts,
  // exactly as the app derives it - nobody stores the answer, so the report
  // and the register can never drift apart.
  const bsAll = Array.isArray(state.buildingSafety) ? state.buildingSafety : [];
  const bsScope = b => {
    const anyFact = ['height18', 'storeys7', 'units2', 'careHome', 'hospital'].some(k => b[k]);
    if (!anyFact && !b.scopeChecked) return 'unknown';
    const tall = !!(b.height18 || b.storeys7);
    if (tall && b.units2) return 'yes';
    if (tall && (b.careHome || b.hospital)) return 'yes';
    return 'no';
  };
  const bsGapsOf = b => {
    const g = [];
    if (bsScope(b) !== 'yes') return g;
    if (!b.duty || b.duty === 'No dutyholder role') g.push('no dutyholder role recorded');
    if (!b.goldenThread) g.push('golden thread not in place');
    if (!b.competence) g.push('competence not declared');
    if (!b.changeCtrl) g.push('no change control');
    if (!b.morRoute) g.push('no occurrence reporting route');
    if (b.stage === 'Completed / occupied' && !b.handover) g.push('fire safety information not handed over');
    return g;
  };
  const bsWaitOf = b => {
    const pairs = [['g3Sub', 'g3Dec', 'Gateway 3'], ['g2Sub', 'g2Dec', 'Gateway 2']];
    for (const [s, d, nm] of pairs) {
      if (b[s] && !b[d]) {
        const days = Math.round((new Date(todayIso + 'T12:00:00').getTime() - new Date(b[s] + 'T12:00:00').getTime()) / 86400000);
        return { gate: nm, since: b[s], weeks: Math.floor((days < 0 ? 0 : days) / 7) };
      }
    }
    return null;
  };
  const bsEv = [];
  bsAll.forEach(b => (Array.isArray(b.events) ? b.events : []).forEach(e => bsEv.push({ b, e })));
  const bsIn = bsAll.filter(b => bsScope(b) === 'yes');
  const bs = {
    total: bsAll.length,
    inScope: bsIn.length,
    list: bsIn,
    notInScope: bsAll.filter(b => bsScope(b) === 'no').length,
    unknown: bsAll.filter(b => bsScope(b) === 'unknown').length,
    awaiting: bsIn.filter(b => bsWaitOf(b)).length,
    gaps: bsIn.filter(b => bsGapsOf(b).length).length,
    mors: bsEv.filter(x => x.e.kind === 'Mandatory occurrence report'),
    changes: bsEv.filter(x => x.e.kind === 'Notifiable change').length,
    gapsOf: bsGapsOf, waitOf: bsWaitOf, scopeOf: bsScope,
  };
  const cut90 = (function () { const c = new Date(todayIso + 'T12:00:00'); c.setDate(c.getDate() - 90); return c.toISOString().slice(0, 10); })();
  const supEvents = [];
  supAll.forEach(p => (Array.isArray(p.events) ? p.events : []).forEach(e => { if ((e.date || '') >= cut90) supEvents.push({ p, e }); }));
  const sup = {
    total: supAll.length,
    approved: supAll.filter(p => p.status === 'Approved').length,
    suspended: supAll.filter(p => p.status === 'Suspended').length,
    insExpired: supAll.filter(p => expiredOn(p.elciExpiry) || expiredOn(p.pliExpiry)).length,
    insSoon: supAll.filter(p => (p.elciExpiry && !expiredOn(p.elciExpiry) && p.elciExpiry <= soonIso) || (p.pliExpiry && !expiredOn(p.pliExpiry) && p.pliExpiry <= soonIso)).length,
    incomplete: supAll.filter(p => gapsOf(p).length).length,
    concerns: supEvents.filter(x => ['Concern raised', 'Non-conformance', 'Incident'].includes(x.e.kind)),
    good: supEvents.filter(x => x.e.kind === 'Good performance').length,
    gapsOf,
  };
  // Health surveillance: dates and outcomes only - no clinical detail reaches
  // the report, and nothing is stored as a score.
  const ohAll = Array.isArray(state.healthSurveillance) ? state.healthSurveillance : [];
  const OH_ACT = ['Fit with restrictions', 'Referred', 'Not fit for the task', 'Declined by employee'];
  const ohSoonIso = (function () { const s = new Date(todayIso + 'T12:00:00'); s.setDate(s.getDate() + 60); return s.toISOString().slice(0, 10); })();
  const ohByType = {};
  ohAll.forEach(r => { const k = r.type || 'other'; (ohByType[k] = ohByType[k] || []).push(r); });
  const oh = {
    total: ohAll.length,
    people: new Set(ohAll.map(r => String(r.person || '').trim().toLowerCase()).filter(Boolean)).size,
    overdue: ohAll.filter(r => r.nextDue && r.nextDue < todayIso),
    soon: ohAll.filter(r => r.nextDue && r.nextDue >= todayIso && r.nextDue <= ohSoonIso).length,
    noDate: ohAll.filter(r => !r.nextDue).length,
    act: ohAll.filter(r => OH_ACT.includes(r.outcome)),
    byType: ohByType,
  };
  const ohIll = (Array.isArray(state.incidents) ? state.incidents : []).filter(i => i && i.type === 'Ill health').length;
  const envAll = (Array.isArray(state.incidents) ? state.incidents : []).filter(i => i && i.type === 'Environmental');
  const env = { total: envAll.length, open: envAll.filter(i => i.status === 'Open').length,
    latest: envAll.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 5) };

  // Reactive monitoring, split three ways so each can be switched off on its
  // own. Environmental and ill-health events have their own sections, so they
  // are not repeated here - nothing is counted twice.
  const ACCIDENT_TYPES = ['Injury', 'First aid', 'Property damage'];
  const incAcc = X.incRecent.filter(i => ACCIDENT_TYPES.includes(i.type));
  const incNear = X.incRecent.filter(i => i.type === 'Near miss');
  const incRid = (Array.isArray(state.incidents) ? state.incidents : []).filter(i => i && i.type === 'RIDDOR reportable')
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const incTable = (rows, note) => ({ type: 'dataTable',
    cols: [ { header: 'Date', w: '12%' }, { header: 'Type', w: '15%' }, { header: 'What happened', w: '49%' }, { header: 'Status', w: '24%' } ],
    rows: rows.slice(0, 6).map(i => [ fmtD(i.date), i.type || '-', String(i.what || '(not recorded)').slice(0, 110), (i.status === 'Open' ? 'Open - under investigation' : (i.status || 'Closed')) ]),
    footnote: (rows.length > 6 ? ('Showing the latest 6 of ' + rows.length + '. ') : '') + note });

  const monBlocks = [];
  if (!hide.accidents) {
    monBlocks.push({ type: 'kpiStrip', tiles: [
      { value: String(incAcc.length), label: 'Accidents in 90 days', tone: incAcc.length ? 'warn' : 'ok' },
      { value: String(X.incOpen), label: 'Investigations open', tone: X.incOpen ? 'warn' : 'ok' },
      { value: String(X.incNoCause), label: 'No cause recorded', note: 'of this period’s events', tone: X.incNoCause ? 'warn' : 'ok' },
    ] });
    monBlocks.push(incAcc.length
      ? incTable(incAcc, 'Full detail and investigations live on the incident register.')
      : { type: 'textBlock', title: 'Accidents and incidents', body: 'No accidents, first aid cases or damage events were recorded in the period.' });
  }
  if (!hide.nearmiss) {
    monBlocks.push(incNear.length
      ? incTable(incNear, 'Near misses are a leading indicator: they are the warnings that arrive before an injury does.')
      : { type: 'textBlock', title: 'Near misses', body: 'No near misses were recorded in the period. Confirm that reflects reality rather than under-reporting - a healthy system records more near misses than injuries, not fewer.' });
  }
  if (!hide.riddor) {
    monBlocks.push(incRid.length
      ? { type: 'dataTable', title: 'RIDDOR reportable events',
          cols: [ { header: 'Date', w: '13%' }, { header: 'What happened', w: '52%' }, { header: 'Reported', w: '17%' }, { header: 'Status', w: '18%' } ],
          rows: incRid.slice(0, 6).map(i => [ fmtD(i.date), String(i.what || '(not recorded)').slice(0, 110),
            { text: i.riddorDate ? fmtD(i.riddorDate) : 'not recorded', bold: true, color: i.riddorDate ? [22,120,60] : [197,32,32] },
            (i.status === 'Open' ? 'Open - under investigation' : (i.status || 'Closed')) ]),
          footnote: 'Reportable under RIDDOR 2013. The report date is the evidence the duty was discharged - an event without one needs checking.' }
      : { type: 'textBlock', title: 'RIDDOR reportable events', body: 'Nothing reportable under RIDDOR 2013 is recorded. Where a reportable event does occur the duty sits with the responsible person, and the date it was reported belongs on the incident register.' });
  }
  // Active monitoring, split between checking the work and auditing the system.
  const AUDIT_KINDS = ['Audit', 'Management audit', 'Management review', 'Compliance review'];
  const siteAll = Array.isArray(state.siteInspections) ? state.siteInspections : [];
  const audits = siteAll.filter(v => AUDIT_KINDS.includes(v.kind));
  const audDone = audits.filter(v => v.actual && v.outcome !== 'Not done').length;
  const audOverdue = audits.filter(v => !v.actual && v.planned && v.planned < todayIso && v.outcome !== 'Not done').length;
  if (!hide.inspections) {
    monBlocks.push({ type: 'textBlock', title: 'Inspection performance', body:
      noneOrCount(X.siteDone, 'process-assurance visit has been completed', 'process-assurance visits have been completed') + '. '
      + noneOrCount(X.siteOverdue, 'planned visit is overdue', 'planned visits are overdue') + '. '
      + (X.inspTotal ? countPhrase(X.inspTotal, 'workplace inspection is', 'workplace inspections are') + ' on file from the linked inspection app. ' : '')
      + (X.monthsSaved.length ? 'Monthly performance figures are saved for ' + countPhrase(X.monthsSaved.length, 'month', 'months') + ' (latest ' + X.monthsSaved[X.monthsSaved.length - 1] + ').' : 'No monthly performance figures have been saved yet.') });
  }
  if (!hide.audits) {
    monBlocks.push({ type: 'textBlock', title: 'Audit performance', body:
      audits.length
        ? (countPhrase(audits.length, 'audit or management review is', 'audits or management reviews are') + ' planned; '
           + noneOrCount(audDone, 'has been completed', 'have been completed', 'none') + '. '
           + noneOrCount(audOverdue, 'is overdue', 'are overdue', 'None') + '. '
           + 'Inspection checks the work; audit checks whether the system that governs the work is being followed.')
        : 'No audits or management reviews are planned. Inspection checks the work; audit checks whether the system that governs the work is being followed, and the two are not interchangeable.' });
  }
  const monitoringPage = monBlocks.length ? {
    label: 'This period', section: 'monitoring', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · what went wrong, and the checking that finds trouble early',
        headline: X.incRecent.length ? (countPhrase(incAcc.length, 'accident', 'accidents') + ' and ' + countPhrase(incNear.length, 'near miss', 'near misses') + ' in 90 days; ' + noneOrCount(X.incOpen, 'investigation open', 'investigations open', 'no') + '.') : 'A quiet period - no recorded events in 90 days.',
        standfirst: 'What went wrong (reactive) and what checking happened before anything went wrong (active). Both halves matter: a quiet incident record is only good news if the active checks are happening.' },
      ...monBlocks, hsgFoot,
    ],
  } : null;

  const peopleBlocks = [];
  if (!hide.training) {
    peopleBlocks.push({ type: 'kpiStrip', tiles: [
      { value: String(X.staffN), label: 'Staff on the matrix', tone: X.staffN ? undefined : 'muted' },
      { value: String(X.trnTotal), label: 'Training records' },
      { value: String(X.trnExpired.length), label: 'Expired', tone: X.trnExpired.length ? 'bad' : 'ok' },
      { value: String(X.trnSoon.length), label: 'Expiring ≤60 days', tone: X.trnSoon.length ? 'warn' : 'ok' },
    ] });
    if (X.trnExpired.length) peopleBlocks.push({ type: 'dataTable',
      cols: [ { header: 'Employee', w: '30%' }, { header: 'Course', w: '46%' }, { header: 'Expired', w: '24%' } ],
      rows: X.trnExpired.slice(0, 6).map(x => [ x.employee || '-', x.course || '-', fmtD(x.expiry) ]),
      footnote: 'Renewals are raised onto the execution plan from the training matrix.' });
    else if (X.trnTotal) peopleBlocks.push({ type: 'textBlock', title: 'Training record', body: 'Every recorded course is in date. Renewal dates are tracked and expiring courses raise actions automatically.' });
    else peopleBlocks.push({ type: 'textBlock', title: 'Training record', body: 'No training matrix has been loaded yet - the competence picture cannot be evidenced until it is.' });
  }
  if (!hide.competence) {
    // Where each person stands against the matrix as it exists. What each
    // ROLE ought to hold is not recorded anywhere yet, so this section says
    // what can be evidenced and names the gap in the method honestly.
    const byPerson = {};
    trainingRowsOf(state).forEach(r => {
      const k = String(r.employee || '').trim(); if (!k) return;
      const p = byPerson[k] = byPerson[k] || { held: 0, expired: 0, soon: 0, dated: 0 };
      p.held++;
      if (r.expiry) { p.dated++;
        if (r.expiry < todayIso) p.expired++;
        else { const s = new Date(todayIso + 'T12:00:00'); s.setDate(s.getDate() + 60); if (r.expiry <= s.toISOString().slice(0, 10)) p.soon++; }
      }
    });
    const people = Object.keys(byPerson).map(k => ({ name: k, ...byPerson[k] }))
      .sort((a, b) => (b.expired - a.expired) || (b.soon - a.soon) || a.name.localeCompare(b.name));
    peopleBlocks.push(people.length
      ? { type: 'dataTable', title: 'Competence - where each person stands',
          cols: [ { header: 'Person', w: '30%' }, { header: 'Courses held', w: '16%' }, { header: 'Expired', w: '16%' }, { header: 'Expiring ≤60 days', w: '18%' }, { header: 'Position', w: '20%' } ],
          rows: people.slice(0, 10).map(p => [ p.name, String(p.held),
            { text: String(p.expired), bold: !!p.expired, color: p.expired ? [197,32,32] : [110,110,110] },
            { text: String(p.soon), color: p.soon ? [180,110,10] : [110,110,110] },
            { text: p.expired ? 'lapsed' : (p.soon ? 'renewals due' : 'in date'), bold: true, color: p.expired ? [197,32,32] : (p.soon ? [180,110,10] : [22,128,60]) } ]),
          footnote: (people.length > 10 ? ('Showing the 10 most pressing of ' + people.length + '. ') : '')
            + 'This reads what each person holds and whether it is in date. What each role SHOULD hold is not yet recorded - until the role requirements are set down, the required-versus-held gap cannot be evidenced.' }
      : { type: 'textBlock', title: 'Competence', body: 'No training matrix has been loaded, so nobody’s competence position can be evidenced yet. Load the matrix first; the next step after that is recording what each role should hold, so the gap between required and held can be shown.' });
  }
  const partnerSupBlocks = [];
  const partnerOhBlocks = [];
  if (!hide.ohealth) {
    if (!oh.total) {
      partnerOhBlocks.push({ type: 'textBlock', title: 'Occupational health', body:
        'No health surveillance is recorded' + (ohIll ? (', though ' + countPhrase(ohIll, 'ill-health event is', 'ill-health events are') + ' on the incident register') : '') + '. '
        + 'Where noise, vibration, dust, fume or skin exposure is foreseeable, health surveillance is a legal duty and the register is what evidences it. Occupational ill health is the long-latency half of the picture: the harm arrives years after the exposure, and the claims arrive later still.' });
    } else {
      partnerOhBlocks.push({ type: 'kpiStrip', tiles: [
        { value: String(oh.people), label: 'Under surveillance', note: oh.total + ' record' + (oh.total !== 1 ? 's' : '') },
        { value: String(oh.overdue.length), label: 'Surveillance overdue', tone: oh.overdue.length ? 'bad' : 'ok', note: oh.soon ? (oh.soon + ' due within 60 days') : undefined },
        { value: String(oh.act.length), label: 'Outcomes to act on', tone: oh.act.length ? 'warn' : 'ok' },
        { value: String(ohIll), label: 'Ill-health events', note: 'on the incident register', tone: ohIll ? 'warn' : 'ok' },
      ] });
      const progRows = Object.keys(oh.byType).map(k => {
        const rs = oh.byType[k];
        const od = rs.filter(r => r.nextDue && r.nextDue < todayIso).length;
        const label = ({ audiometry:'Audiometry (hearing)', havs:'Hand-arm vibration (HAVS)', respiratory:'Respiratory / lung function', skin:'Skin / dermatitis', asbestos:'Asbestos medical', lead:'Lead medical', radiation:'Ionising radiation medical', nightworker:'Night worker assessment', safetycrit:'Safety-critical medical', dse:'DSE eye and eyesight test', other:'Other surveillance' })[k] || k;
        const driver = ({ audiometry:'Control of Noise at Work Regulations 2005', havs:'Control of Vibration at Work Regulations 2005', respiratory:'COSHH 2002', skin:'COSHH 2002', asbestos:'Control of Asbestos Regulations 2012', lead:'Control of Lead at Work Regulations 2002', radiation:'Ionising Radiations Regulations 2017', nightworker:'Working Time Regulations 1998', dse:'Health and Safety (Display Screen Equipment) Regulations 1992' })[k] || '';
        return [ label, String(rs.length), { text: String(od), color: od ? [197,32,32] : [110,110,110], bold: !!od }, { text: driver || '-', color: [110,110,110] } ];
      });
      partnerOhBlocks.push({ type: 'dataTable', title: 'Surveillance programmes running',
        cols: [ { header: 'Programme', w: '34%' }, { header: 'People', w: '12%' }, { header: 'Overdue', w: '12%' }, { header: 'Why it is required', w: '42%' } ],
        rows: progRows,
        footnote: 'Health surveillance is required where exposure is foreseeable. The register holds fitness outcomes and dates only - clinical detail stays with the provider.' });
      if (oh.act.length) partnerOhBlocks.push({ type: 'dataTable', title: 'Outcomes the business must act on',
        cols: [ { header: 'Role', w: '24%' }, { header: 'Programme', w: '26%' }, { header: 'Outcome', w: '22%' }, { header: 'What is required', w: '28%' } ],
        rows: oh.act.slice(0, 6).map(r => [ r.role || '(role not recorded)',
          ({ audiometry:'Audiometry', havs:'HAVS', respiratory:'Respiratory', skin:'Skin', asbestos:'Asbestos medical', lead:'Lead medical', radiation:'Radiation medical', nightworker:'Night worker', safetycrit:'Safety-critical', dse:'DSE eye test', other:'Other' })[r.type || 'other'] || '-',
          { text: r.outcome || '-', bold: true, color: (r.outcome === 'Not fit for the task' || r.outcome === 'Declined by employee') ? [197,32,32] : [180,110,10] },
          String(r.restrictions || 'to be determined').slice(0, 90) ]),
        footnote: 'Named by role, not by person: the board needs to know an adjustment is required, not who it concerns.' });
    }
  }
  const peoplePage = (peopleBlocks.length) ? {
    label: 'People', section: 'people', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · training and competence',
        headline: X.trnExpired.length ? (countPhrase(X.trnExpired.length, 'training course has', 'training courses have') + ' expired.') : 'Training and competence.',
        standfirst: 'Whether the workforce is trained, in date, and where each person stands against the matrix.' },
      ...peopleBlocks,
    ],
  } : null;

  const compBlocks = [];
  if (!hide.legal) {
    compBlocks.push({ type: 'kpiStrip', tiles: [
      { value: String(legal.assessed), label: 'Duty lines assessed', tone: legal.assessed ? undefined : 'muted' },
      { value: String(legal.met), label: 'Met - in place and adequate', tone: legal.met ? 'ok' : undefined },
      { value: String(legal.gaps.length), label: 'In place but not adequate', tone: legal.gaps.length ? 'warn' : 'ok' },
      { value: String(legal.notInPlace.length), label: 'Not in place', tone: legal.notInPlace.length ? 'bad' : 'ok' },
    ] });
    const legRows = legal.notInPlace.concat(legal.gaps).slice(0, 8);
    compBlocks.push(legRows.length
      ? { type: 'dataTable',
          cols: [ { header: 'Duty', w: '22%' }, { header: 'Requirement', w: '38%' }, { header: 'Status', w: '14%' }, { header: 'Legal anchor', w: '15%' }, { header: 'By', w: '11%' } ],
          rows: legRows.map(r => [ r.duty, r.line || '-', r.nip ? 'Not in place' : 'In place, not adequate', r.cite || '-', r.due ? fmtD(r.due) : '-' ]),
          footnote: ((legal.notInPlace.length + legal.gaps.length > 8) ? ('Showing 8 of ' + (legal.notInPlace.length + legal.gaps.length) + ' open duty lines. ') : '') + 'From the Legal duties assessment. Each legal anchor is the duty the line discharges; a line not in place is a duty not being discharged.' }
      : { type: 'textBlock', title: 'Legal compliance', body: legal.assessed ? 'Every assessed duty line is in place and adequate.' : 'The Legal duties assessment has not been started - the legal position cannot be evidenced until it is.' });
    // Checks required by law belong to the legal picture - folded in here.
    if (!foldHide.statutory) compBlocks.push({ type: 'textBlock', title: 'Checks required by law', body:
      (X.statTotal
        ? countPhrase(X.statTotal, 'statutory check is', 'statutory checks are') + ' tracked (thorough examinations, servicing and similar). ' + noneOrCount(X.statOverdue, 'is overdue', 'are overdue', 'None') + '; ' + noneOrCount(X.statDueSoon, 'falls due within 60 days', 'fall due within 60 days', 'none') + '.'
        : 'No statutory checks are tracked yet. If the business has lifting equipment, pressure systems, LEV or similar, their thorough-examination dates belong on the statutory tracker.') });
  }
  // Accreditations and memberships actually held - the certificates a PQQ
  // asks for. Dates decide everything; nothing stores a status.
  const memAll = Array.isArray(state.memberships) ? state.memberships : [];
  const memFlag = d => !d ? { t: 'no expiry recorded', c: [180,110,10] } : (d < todayIso ? { t: 'expired ' + fmtD(d), c: [197,32,32] } : (d <= soonIso ? { t: 'expires ' + fmtD(d), c: [180,110,10] } : { t: 'valid to ' + fmtD(d), c: [22,128,60] }));
  if (!hide.memberships) {
    compBlocks.push(memAll.length
      ? { type: 'dataTable', title: 'Accreditation and memberships held',
          cols: [ { header: 'Accreditation / membership', w: '34%' }, { header: 'Body / scheme', w: '24%' }, { header: 'Reference', w: '18%' }, { header: 'Standing', w: '24%' } ],
          rows: memAll.slice().sort((a, b) => String(a.expiry || '9999').localeCompare(String(b.expiry || '9999'))).map(m => {
            const f = memFlag(m.expiry);
            return [ m.name || '(unnamed)', m.body || '-', m.ref || '-', { text: f.t, bold: true, color: f.c } ];
          }),
          footnote: 'From the register on the Accreditation tab. An expired accreditation quoted on a tender is worse than none - renewal dates flag themselves here as they approach.' }
      : { type: 'textBlock', title: 'Accreditation and memberships', body: 'None recorded. SSIP certificates, CHAS, Constructionline, trade-body memberships and similar belong on the register on the Accreditation tab, with their expiry dates - they are what a PQQ asks to see.' });
  }
  // The measures the business set itself, target against current. Leading
  // indicators are effort in; lagging are outcomes out. No verdict is
  // derived - whether higher is better depends on the measure.
  if (!hide.objectives) {
    const objRows = [];
    (Array.isArray(state.riskAssurance && state.riskAssurance.leading) ? state.riskAssurance.leading : []).forEach(r => { if (String(r.metric || '').trim()) objRows.push([ String(r.metric).slice(0, 70), 'Leading', r.target || '-', r.current || '-', r.owner || '-' ]); });
    (Array.isArray(state.riskAssurance && state.riskAssurance.lagging) ? state.riskAssurance.lagging : []).forEach(r => { if (String(r.metric || '').trim()) objRows.push([ String(r.metric).slice(0, 70), 'Lagging', r.target || '-', r.current || '-', r.owner || '-' ]); });
    compBlocks.push(objRows.length
      ? { type: 'dataTable', title: 'Objectives - target against current',
          cols: [ { header: 'Measure', w: '38%' }, { header: 'Kind', w: '12%' }, { header: 'Target', w: '16%' }, { header: 'Current', w: '16%' }, { header: 'Owner', w: '18%' } ],
          rows: objRows.slice(0, 10),
          footnote: (objRows.length > 10 ? ('Showing 10 of ' + objRows.length + '. ') : '') + 'Set in Monitoring & assurance. Leading measures track the effort going in (inspections done, training current); lagging measures track what came out (accidents, days lost). The board reads the two against each other.' }
      : { type: 'textBlock', title: 'Objectives', body: 'No measures are set yet. Leading and lagging indicators with targets belong in Monitoring & assurance on the Assess tab - they are the objectives this section reads.' });
  }
  const compliancePage = compBlocks.length ? { label: 'Compliance', section: 'compliance', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · the legal position, credentials and objectives',
        headline: legal.notInPlace.length ? (countPhrase(legal.notInPlace.length, 'legal duty is', 'legal duties are') + ' not in place.')
          : legal.gaps.length ? (countPhrase(legal.gaps.length, 'duty line needs', 'duty lines need') + ' strengthening.')
          : legal.assessed ? 'Every assessed duty is in place and adequate.'
          : 'Legal compliance, credentials and objectives.',
        standfirst: 'Whether the duties the law places on the business are in place and adequate, the accreditations it holds and when they expire, and the measures it set itself.' },
      ...compBlocks,
    ] } : null;

  const oversightBlocks = [];
  if (!hide.environmental) {
    oversightBlocks.push({ type: 'textBlock', title: 'Environmental events', body:
      env.total
        ? (countPhrase(env.total, 'environmental event is', 'environmental events are') + ' on the incident register' + (env.open ? (', ' + countPhrase(env.open, 'investigation still open', 'investigations still open')) : ', none open') + '.')
        : 'No environmental events are recorded. Spills, discharges and waste incidents belong on the incident register under the Environmental type - a clean record should reflect reality, not under-reporting.' });
    if (env.latest.length) oversightBlocks.push({ type: 'dataTable',
      cols: [ { header: 'Date', w: '14%' }, { header: 'What happened', w: '52%' }, { header: 'Where', w: '18%' }, { header: 'Status', w: '16%' } ],
      rows: env.latest.map(i => [ fmtD(i.date), String(i.what || '(not recorded)').slice(0, 100), i.where || '-', (i.status === 'Open' ? 'Open - under investigation' : (i.status || 'Closed')) ]) });
  }
  if (!hide.cdm) {
    oversightBlocks.push({ type: 'textBlock', title: 'CDM assurance - design reviews and CDM audits', body:
      cdm.total
        ? (countPhrase(cdm.done, 'CDM oversight activity has', 'CDM oversight activities have') + ' been completed (design reviews, architectural reviews and CDM audits) of ' + cdm.total + ' planned. ' + noneOrCount(cdm.overdue, 'planned activity is overdue', 'planned activities are overdue', 'None') + '.')
        : 'No CDM oversight activities are recorded. Where the business designs or manages construction work, design reviews and CDM audits belong on the process-assurance plan.' });
    if (cdm.latest.length) oversightBlocks.push({ type: 'dataTable',
      cols: [ { header: 'Activity', w: '24%' }, { header: 'Site / project', w: '30%' }, { header: 'Done', w: '14%' }, { header: 'By', w: '14%' }, { header: 'Outcome', w: '18%' } ],
      rows: cdm.latest.map(v => [ v.kind, v.site || '-', fmtD(v.actual), v.by || '-', v.outcome || '-' ]),
      footnote: 'The latest completed CDM oversight, from the Process assurance register.' });
  }
  if (!hide.bsafety) {
    if (!bs.total) {
      // Nothing tested at all. That is a gap in itself, not a clean sheet.
      oversightBlocks.push({ type: 'textBlock', title: 'Building safety - higher-risk buildings', body:
        'No building or project has been put through the higher-risk test. The Building Safety Act 2022 applies to buildings of 18 metres or more, or 7 storeys or more, containing at least 2 residential units - and to tall care homes and hospitals while they are being designed and built. Where the business designs, builds or manages buildings, each job should be tested and the answer recorded, because not having considered it is no defence if a building turns out to be caught.' });
    } else if (!bs.inScope) {
      // The common case, and a genuine assurance statement: the test was
      // applied and came back negative. That is worth printing plainly.
      oversightBlocks.push({ type: 'textBlock', title: 'Building safety - higher-risk buildings', body:
        countPhrase(bs.total, 'building or project has', 'buildings or projects have') + ' been put through the higher-risk test and '
        + (bs.total === 1 ? 'it does not meet' : 'none of them meet') + ' the threshold. No gateway duties, golden thread duties or occurrence reporting duties under the Building Safety Act 2022 apply to the work in this period. The ordinary Building Regulations and CDM 2015 duties are unaffected and are reported separately.'
        + (bs.unknown ? (' ' + countPhrase(bs.unknown, 'record has', 'records have') + ' not yet been tested.') : '') });
    } else {
      oversightBlocks.push({ type: 'kpiStrip', tiles: [
        { value: String(bs.inScope), label: 'Higher-risk buildings', note: bs.total > bs.inScope ? ('of ' + bs.total + ' tested') : undefined },
        { value: String(bs.gaps), label: 'With duties outstanding', tone: bs.gaps ? 'bad' : 'ok' },
        { value: String(bs.awaiting), label: 'Awaiting a gateway', tone: bs.awaiting ? 'warn' : 'ok' },
        { value: String(bs.mors.length), label: 'Occurrence reports', tone: bs.mors.length ? 'warn' : 'ok', note: bs.changes ? (bs.changes + ' notifiable change' + (bs.changes === 1 ? '' : 's')) : undefined },
      ] });
      oversightBlocks.push({ type: 'dataTable', title: 'Higher-risk buildings and the role held',
        cols: [ { header: 'Building', w: '24%' }, { header: 'Role held', w: '19%' }, { header: 'Stage', w: '19%' }, { header: 'Outstanding', w: '38%' } ],
        rows: bs.list.slice(0, 8).map(b => {
          const g = bs.gapsOf(b); const w = bs.waitOf(b);
          return [ b.name || '(unnamed)',
            { text: b.duty || 'not recorded', color: b.duty ? [70, 70, 70] : [197, 32, 32] },
            (b.stage || 'not started') + (w ? (' \u00b7 ' + w.weeks + 'w') : ''),
            { text: g.length ? g.join('; ') : 'nothing outstanding', color: g.length ? [197, 32, 32] : [22, 128, 60] } ];
        }),
        footnote: (bs.inScope > 8 ? ('Showing 8 of ' + bs.inScope + '. ') : '')
          + 'Building work on a higher-risk building must not start until Gateway 2 is approved, and it must not be occupied until Gateway 3 is passed. A stage shown with a week count is sitting with the regulator awaiting that decision.' });
      if (bs.mors.length) oversightBlocks.push({ type: 'dataTable', title: 'Mandatory occurrence reports',
        cols: [ { header: 'Date', w: '14%' }, { header: 'Building', w: '26%' }, { header: 'What was reported', w: '60%' } ],
        rows: bs.mors.slice(0, 6).map(x => [ fmtD(x.e.date), x.b.name || '(unnamed)', String(x.e.note || '(not recorded)').slice(0, 110) ]),
        footnote: 'A safety occurrence on a higher-risk building has to be reported to the regulator. These are the reports made in the period.' });
    }
  }
  if (!hide.supply) {
    if (!sup.total) {
      partnerSupBlocks.push({ type: 'textBlock', title: 'Subcontractor performance', body: 'No subcontractors, sub-consultants or suppliers are on the register. Where others work under the organisation’s control, the checks made before engaging them - insurance, policy, method statements and competence - are the evidence that the duty to manage them is being discharged.' });
    } else {
      partnerSupBlocks.push({ type: 'kpiStrip', tiles: [
        { value: String(sup.total), label: 'On the register', note: sup.approved + ' approved' },
        { value: String(sup.insExpired), label: 'Insurance expired', tone: sup.insExpired ? 'bad' : 'ok', note: sup.insSoon ? (sup.insSoon + ' expiring soon') : undefined },
        { value: String(sup.incomplete), label: 'Checks outstanding', tone: sup.incomplete ? 'warn' : 'ok' },
        { value: String(sup.concerns.length), label: 'Concerns in 90 days', tone: sup.concerns.length ? 'warn' : 'ok', note: sup.good ? (sup.good + ' logged as good') : undefined },
      ] });
      const bad = supAll.filter(p => sup.gapsOf(p).length).slice(0, 6);
      if (bad.length) partnerSupBlocks.push({ type: 'dataTable',
        cols: [ { header: 'Partner', w: '26%' }, { header: 'Type', w: '16%' }, { header: 'Status', w: '14%' }, { header: 'What is outstanding', w: '44%' } ],
        rows: bad.map(p => [ p.name || '(unnamed)', p.type || '-', p.status || '-',
          { text: sup.gapsOf(p).join('; '), color: sup.gapsOf(p).some(g => g.indexOf('expired') >= 0) ? [197,32,32] : [110,110,110] } ]),
        footnote: (sup.incomplete > 6 ? ('Showing 6 of ' + sup.incomplete + ' with something outstanding. ') : '')
          + 'A partner with expired insurance should not be working under the organisation’s control until it is renewed.' });
      if (sup.concerns.length) partnerSupBlocks.push({ type: 'dataTable', title: 'Performance concerns in the period',
        cols: [ { header: 'Date', w: '13%' }, { header: 'Partner', w: '24%' }, { header: 'What happened', w: '45%' }, { header: 'Type', w: '18%' } ],
        rows: sup.concerns.slice(0, 6).map(x => [ fmtD(x.e.date), x.p.name || '(unnamed)', String(x.e.note || '(not recorded)').slice(0, 100), x.e.kind ]) });
    }
  }
  const partnersPage = (partnerSupBlocks.length + partnerOhBlocks.length) ? { label: 'Partners & health', section: 'partners', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · the people who work for the business, inside and out',
        headline: sup.insExpired ? (countPhrase(sup.insExpired, 'partner has', 'partners have') + ' expired insurance.')
          : oh.overdue.length ? (countPhrase(oh.overdue.length, 'health surveillance is', 'health surveillances are') + ' overdue.')
          : 'Subcontractor performance and occupational health.',
        standfirst: 'Who works under the organisation’s control and whether they were checked, and whether the workforce’s long-term health is being watched as the law requires.' },
      ...partnerSupBlocks,
      ...partnerOhBlocks,
    ] } : null;

  const oversightPage = oversightBlocks.length ? { label: 'Environment & CDM', section: 'oversight', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · environmental performance and construction dutyholding',
        headline: (!hide.bsafety && bs.gaps) ? (countPhrase(bs.gaps, 'higher-risk building has', 'higher-risk buildings have') + ' duties outstanding.')
          : cdm.overdue ? (countPhrase(cdm.overdue, 'CDM oversight activity is', 'CDM oversight activities are') + ' overdue.')
          : env.open ? (countPhrase(env.open, 'environmental investigation is', 'environmental investigations are') + ' open.')
          : 'CDM oversight and environmental events.',
        standfirst: 'The construction side of the duty - design reviews and CDM audits happening to plan, whether any building is caught by the Building Safety Act, and any environmental events with their investigations.' },
      ...oversightBlocks,
    ] } : null;

  const progBlocks = [];
  // Actions, split the way Simon reads them: everything owed, and the ones
  // sitting on the biggest risks.
  const actRow = x => [ String(x.a.desc || '(no description)').slice(0, 90), x.parent || x.source,
    x.a.owner || 'no owner',
    { text: x.a.due ? fmtD(x.a.due) : 'no date', bold: true, color: (x.a.due && x.a.due < todayIso) ? [197,32,32] : (x.a.due ? [110,110,110] : [180,110,10]) } ];
  const actCols = [ { header: 'Action', w: '42%' }, { header: 'From', w: '24%' }, { header: 'Owner', w: '17%' }, { header: 'By when', w: '17%' } ];
  const openRows = D.openActRows || [];
  if (!hide.outstanding) {
    progBlocks.push(openRows.length
      ? { type: 'dataTable', title: 'Outstanding actions - ' + openRows.length + ' open' + (D.overdue ? (', ' + D.overdue + ' overdue') : ''),
          cols: actCols, rows: openRows.slice(0, 10).map(actRow),
          footnote: (openRows.length > 10 ? ('Showing the 10 most pressing of ' + openRows.length + '. ') : '')
            + 'Overdue first, then by date. '
            + (D.noOwner ? (D.noOwner + ' ' + (D.noOwner === 1 ? 'has' : 'have') + ' nobody named; ') : '')
            + (D.noDate ? (D.noDate + ' ' + (D.noDate === 1 ? 'has' : 'have') + ' no target date; ') : '')
            + 'the full plan is the client execution plan.' }
      : { type: 'textBlock', title: 'Outstanding actions', body: 'Nothing is open on the plan. Every action raised has been completed or formally accepted.' });
  }
  if (!hide.highrisk) {
    const hi = openRows.filter(x => x.tier === 'Critical' || x.tier === 'High');
    progBlocks.push(hi.length
      ? { type: 'dataTable', title: 'High-risk actions - open on Critical and High risks',
          cols: [ { header: 'Action', w: '38%' }, { header: 'Risk', w: '24%' }, { header: 'Band', w: '10%' }, { header: 'Owner', w: '14%' }, { header: 'By when', w: '14%' } ],
          rows: hi.slice(0, 8).map(x => [ String(x.a.desc || '(no description)').slice(0, 80), x.parent || '-',
            { text: x.tier, bold: true, color: x.tier === 'Critical' ? [197,32,32] : [234,88,12] },
            x.a.owner || 'no owner',
            { text: x.a.due ? fmtD(x.a.due) : 'no date', bold: true, color: (x.a.due && x.a.due < todayIso) ? [197,32,32] : [110,110,110] } ]),
          footnote: (hi.length > 8 ? ('Showing 8 of ' + hi.length + '. ') : '') + 'These carry the most risk of anything on the plan; they are the ones to ask about first.' }
      : { type: 'textBlock', title: 'High-risk actions', body: openRows.length ? 'No open action sits on a Critical or High risk - the work outstanding is on the lower-rated risks.' : 'Nothing is open on the plan.' });
  }
  const delivBlocks = [];
  if (!hide.completed) {
    // The full history, not just the period: what was identified, when, and
    // when it was closed. Accepted risks are in the list and always labelled -
    // a conscious acceptance is a decision, never passed off as work done.
    const doneAll = X.allDone || [];
    delivBlocks.push(doneAll.length
      ? { type: 'dataTable', title: 'Actions completed - ' + doneAll.filter(w => !w.accepted).length + ' delivered, ' + doneAll.filter(w => w.accepted).length + ' risks accepted',
          cols: [ { header: 'Action', w: '38%' }, { header: 'From', w: '20%' }, { header: 'Identified', w: '14%' }, { header: 'Closed', w: '14%' }, { header: 'How', w: '14%' } ],
          rows: doneAll.slice(0, 12).map(w => [ String(w.desc).slice(0, 80), String(w.source || '-').slice(0, 36),
            w.created ? fmtD(w.created) : '-',
            w.when ? fmtD(w.when) : '-',
            { text: w.accepted ? 'Risk accepted' : 'Delivered', bold: true, color: w.accepted ? [180,110,10] : [22,128,60] } ]),
          footnote: (doneAll.length > 12 ? ('Showing the latest 12 of ' + doneAll.length + ' closed to date. ') : '')
            + 'Identified is when the action was raised; closed is when it was completed or the risk formally accepted. Delivered work stays on the plan as evidence.' }
      : { type: 'textBlock', title: 'Actions completed', body: 'Nothing has been closed off yet. If work is being done but not recorded as complete on the plan, the record undersells the business.' });
  }
  if (!hide.topFive) {
    const t5 = X.top5 || [], last = X.top5Last || [];
    const mLabel = (m) => { try { return new Date(m + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); } catch (e) { return m; } };
    const closed = (a) => a.status === 'Complete' || a.status === 'Accepted';
    // How last month's five actually went - the half the client feels.
    if (last.length) {
      const doneN = last.filter(closed).length;
      delivBlocks.push({ type: 'dataTable', title: 'Last month\'s five: ' + doneN + ' of ' + last.length + ' delivered',
        cols: [ { header: 'Agreed for ' + mLabel(X.t5Prev), w: '46%' }, { header: 'Owner', w: '18%' }, { header: 'By', w: '16%' }, { header: 'Outcome', w: '20%' } ],
        rows: last.map(a => [ String(a.desc).slice(0, 80), a.owner || 'no owner', a.due ? fmtD(a.due) : 'no date',
          closed(a) ? (a.status === 'Accepted' ? 'Risk accepted' : ('Delivered' + (a.resolvedDate ? (' ' + fmtD(a.resolvedDate)) : ''))) : (a.due && a.due < (opts.today || new Date().toISOString().slice(0, 10)) ? 'Overdue' : 'Still open') ]),
        footnote: doneN === last.length ? 'Every priority agreed last month was closed out.' : 'Anything not closed stays on the plan and is considered again for this month.' });
    }
    // The five for next month.
    delivBlocks.push(t5.length
      ? { type: 'dataTable', title: 'Top 5 priorities for ' + mLabel(X.t5Month),
          cols: [ { header: 'What we will do', w: '46%' }, { header: 'From', w: '18%' }, { header: 'Owner', w: '18%' }, { header: 'By', w: '18%' } ],
          rows: t5.map(a => [ String(a.desc).slice(0, 80), String(a.sourceLabel || a.source || '-').slice(0, 34), a.owner || 'to be named', a.due ? fmtD(a.due) : 'to be dated' ]),
          footnote: 'Chosen by the consultant from the full execution plan after this month\'s review, on what removes the most risk soonest. Each one is owned and dated in Compass, and its progress is visible to the client on the execution plan. Next month\'s report opens with what happened to these five.' }
      : { type: 'textBlock', title: 'Top 5 priorities for ' + mLabel(X.t5Month),
          body: 'Not yet agreed. The consultant reviews the execution plan after the monthly meeting and marks the five actions that remove the most risk soonest; they are listed here, owned and dated, and checked off in next month\'s report.' });
  }
  if (!hide.decisions) {
    // The standing question this report opens the loop with: what was decided
    // last time, and has it happened? Open decisions are the ask; delivered
    // ones are the credit. Both come from the decisions register.
    const decOpen = decAll.filter(decOpenOf).sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
    const decDone = decAll.filter(d => d.status === 'Delivered').sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!decAll.length) {
      delivBlocks.push({ type: 'textBlock', title: 'Management decisions', body: 'No decisions are recorded. The decisions this report recommends are only worth making if what was agreed is written down - the register is what the next report reads to say whether it happened.' });
    } else {
      delivBlocks.push(decOpen.length
        ? { type: 'dataTable', title: 'Decisions still open - has this happened?',
            cols: [ { header: 'Decided', w: '12%' }, { header: 'Decision', w: '40%' }, { header: 'Where', w: '16%' }, { header: 'Owner', w: '16%' }, { header: 'By when', w: '16%' } ],
            rows: decOpen.map(d => [ fmtD(d.date), String(d.decision || '(not recorded)').slice(0, 110), d.forum || '-', d.owner || 'no owner',
              { text: d.due ? fmtD(d.due) : 'no date', bold: true, color: (d.due && d.due < todayIso) ? [197,32,32] : [110,110,110] } ]),
            footnote: 'Each of these was agreed at an earlier meeting and is still open. The first item of business is to confirm whether it has happened, and to re-date or drop it if not.'
              + (dec.overdue ? (' ' + dec.overdue + ' ' + (dec.overdue !== 1 ? 'are' : 'is') + ' past the date given.') : '') }
        : { type: 'textBlock', title: 'Decisions still open', body: 'Nothing agreed at an earlier meeting is still outstanding - every decision taken has been delivered, superseded or consciously dropped.' });
      if (decDone.length) delivBlocks.push({ type: 'dataTable',
        title: 'Decisions delivered' + (dec.pct != null ? (' - ' + dec.delivered + ' of ' + dec.decided + ' carried out') : ''),
        cols: [ { header: 'Decided', w: '13%' }, { header: 'Decision', w: '45%' }, { header: 'Owner', w: '16%' }, { header: 'What happened', w: '26%' } ],
        rows: decDone.slice(0, 6).map(d => [ fmtD(d.date), String(d.decision || '(not recorded)').slice(0, 110), d.owner || '-', String(d.outcome || 'delivered').slice(0, 80) ]),
        footnote: (decDone.length > 6 ? ('Showing the latest 6 of ' + decDone.length + ' delivered. ') : '') + 'Decisions the business carried out. Superseded and not-pursued decisions are recorded on the register but are not counted as delivered.' });
    }
  }
  const actionsPage = progBlocks.length ? {
    label: 'Actions', section: 'actions', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · what is owed',
        headline: D.overdue ? (countPhrase(D.overdue, 'action is overdue.', 'actions are overdue.')) : 'The open actions, and the ones on the biggest risks.',
        standfirst: 'Everything open on the plan, overdue first - and separately, the actions sitting on the Critical and High risks, because those are the ones to ask about.' },
      ...progBlocks,
    ],
  } : null;
  const deliveryPage = delivBlocks.length ? {
    label: 'Delivery & decisions', section: 'delivery', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · closing the loop',
        headline: (function () {
          const done = X.wins.filter(w => !w.accepted).length, acc = X.wins.length - X.wins.filter(w => !w.accepted).length;
          const parts = [];
          if (done) parts.push(countPhrase(done, 'action delivered this period', 'actions delivered this period'));
          if (acc) parts.push(countPhrase(acc, 'risk formally accepted', 'risks formally accepted'));
          return parts.length ? (parts.join(' and ') + '.') : 'Delivery, decisions and the five for next month.';
        })(),
        standfirst: 'The meeting’s own page: what was completed, whether the last meeting’s decisions happened, and the five priorities agreed for next month. Next month’s report opens by checking this page.' },
      ...delivBlocks,
    ],
  } : null;

  // ── Accreditation readiness - its own page, framed as a journey with a
  //    next step, not a wall of criteria. ──
  const readinessPage = !hide.accreditation ? {
    label: 'Readiness', section: 'readiness', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Accreditation readiness · Common Assessment Standard',
        headline: !cas.assessed ? 'Not started yet - and that is a position, not a problem.'
          : (casPct != null && casPct >= 80) ? (casPct + '% of what has been assessed is ready.')
          : cas.gap ? (countPhrase(cas.gap, 'criterion needs', 'criteria need') + ' closing - close those first.')
          : 'Assessment under way.',
        standfirst: 'The Common Assessment Standard is the question set behind SSIP and principal-contractor approval. It is worked criterion by criterion on the Accreditation tab - this page is the running score, not the workload.' },
      ...(cas.assessed ? [
        { type: 'distributionBars', title: 'The ' + cas.assessed + ' criteria assessed so far', items: [
          { label: 'Ready - evidence in place', n: cas.ready, colour: '#16A34A' },
          { label: 'Partial - started, not finished', n: cas.partial, colour: '#F59E0B' },
          { label: 'Gap - nothing in place yet', n: cas.gap, colour: '#DC2626' },
          { label: 'Not applicable to this business', n: cas.na, colour: '#9CA3AF' },
        ] },
        { type: 'textBlock', title: 'The next step', body:
          cas.gap ? ('Close the ' + countPhrase(cas.gap, 'red criterion', 'red criteria') + ' before polishing anything amber - a single unanswered criterion holds the submission, a partial one only weakens it. Each red row on the Accreditation tab says what evidence it needs.')
            : cas.partial ? ('No gaps are open - finish the ' + countPhrase(cas.partial, 'amber criterion', 'amber criteria') + ' and the assessment is done.')
            : 'Everything assessed so far is ready or not applicable. Keep going through the remaining criteria on the Accreditation tab; the submission pack builds itself from what is recorded.' },
      ] : [
        { type: 'textBlock', title: 'How this works', body: 'The standard is tackled a few criteria at a time on the Accreditation tab - each one asks for something the business either already holds (the app maps its own records to the criteria) or needs to put in place. Most clients find far more is already in place than they expected. Start with the sections the app has already mapped evidence for; this page then tracks the score as it climbs.' },
      ]),
    ],
  } : null;

  // ── Page 2+: Register (spills beyond ~16 rows) ──
  const regCols = [
    { header: 'Activity / risk', w: '34%' },
    { header: 'Score - now → after the plan (of 25)', w: '30%' },
    { header: 'Band', w: '12%' },
    { header: 'Controls', w: '12%' },
    { header: 'Owner', w: '12%' },
  ];
  const rowFor = r => ([
    r.name + (r.fatal ? '  ⚑' : ''),
    { html: planBar({ residual: r.residual, target: r.target, tier: r.tier, targetTier: r.targetTier, actsTotal: r.actsTotal, actsClosed: r.actsClosed }) },
    { html: tierWord(r.tier) },
    r.control,
    r.owner || '-',
  ]);
  const slices = paginateRows(D.registerRows, 16, 20);
  const registerPages = slices.map((slice, i) => ({
    label: 'Register' + (slices.length > 1 ? ' ' + (i + 1) : ''),
    blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Fatal and major-harm register' + (slices.length > 1 ? (' · part ' + (i + 1) + ' of ' + slices.length) : ''), headline: i === 0 ? (D.registerRows.length ? countPhrase(D.registerRows.length, 'activity that can cause', 'activities that can cause') + ' serious harm' : 'No fatal or major-harm activities recorded') : 'Register, continued' },
      D.registerRows.length
        ? { type: 'dataTable', cols: regCols, rows: slice.map(rowFor), footnote: i === slices.length - 1 ? '"Plan" is the score the open actions are working towards (target likelihood × severity); the done-count shows how far the plan has been delivered. Controls reduce likelihood, not severity - a fatal-potential risk stays fatal-potential however well controlled. ⚑ fatal potential.' : undefined }
        : { type: 'textBlock', body: 'Nothing in the profile currently carries a worst-case severity of major injury or above. Confirm this reflects the work actually done, not gaps in the profile.' },
    ],
  }));

  // ── Page 4: H&S control maturity, consultant judgement, duty, sign-off ──
  // Facts, not scores: each risk sits in one of four states graded on what is
  // recorded; the rule (HSG65 proportionality) is printed in full; the six
  // HSG65 areas carry the consultant's judgement in words.
  const judRows = judgementRows(state);
  const holdRows = HOLD_ORDER.map(k => [HOLD_STATES[k].level + ' · ' + HOLD_STATES[k].label, String(D.holdS[k]), HOLD_STATES[k].desc]);
  const page4 = {
    label: 'Sign-off', blocks: [
      mast,
      { type: 'statementPanel', title: 'Directors’ duty', cite: 'Health and Safety at Work etc. Act 1974, s.37', body: 'Where an offence by the company is proved to have been committed with the consent, connivance or neglect of a director, manager or similar officer, that individual - as well as the company - is liable to prosecution. This report exists so the board can show it directed and reviewed the management of these risks.' },
      { type: 'tagList', title: 'The laws this risk profile brings into play', tags: D.duties },
      { type: 'dataTable', title: 'H&S control maturity - what each level means',
        cols: [ { header: 'Level', w: '18%' }, { header: 'Risks', w: '10%' }, { header: 'What it means', w: '72%' } ],
        rows: holdRows,
        footnote: 'Graded on recorded facts, not opinion. The response must match the size of the risk: Critical and High risks must be 4 · Assured or 3 · Managed on time, and never assured on acceptance alone; Medium risks must not be left 1 · Uncontrolled.' },
      judRows.length
        ? { type: 'dataTable', title: 'Consultant judgement - the six areas of the management system, in words',
            cols: [ { header: 'Area', w: '28%' }, { header: 'Judgement', w: '16%' }, { header: 'Consultant’s note', w: '56%' } ],
            rows: judRows.map(x => [ x.label, x.level, x.note || '-' ]) }
        : { type: 'textBlock', title: 'Consultant judgement - the six areas of the management system', body: 'Not yet judged. The consultant records a judgement in words (Weak, Adequate or Strong) against each of the six areas in the risk review.' },
      // Pre-filled from the document-control register; signature stays a
      // blank rule for the wet signature.
      { type: 'signoffGrid', cells: [
        { label: 'Prepared by', value: dc.omit ? '' : dc.author }, { label: 'Position', value: dc.omit ? '' : (dc.author ? 'Consultant' : '') }, { label: 'Signature' }, { label: 'Date', value: dc.omit ? '' : fmtDC(dc.issued) },
        { label: 'Received for the board', value: dc.omit ? '' : dc.approverName }, { label: 'Position', value: dc.omit ? '' : dc.approverRole }, { label: 'Signature' }, { label: 'Date' },
      ] },
      { type: 'textBlock', body: (dc.omit ? ('Generated from the live profile on ' + today + '.') : ('Version ' + dc.version + ' · ref ' + dc.ref + ' · generated from the live profile on ' + today + (dc.nextReview ? (' · next review ' + fmtDC(dc.nextReview)) : '') + '.')), cls: 'r-stamp' },
    ],
  };

  // The running order follows the picker: summary, dashboard, this period,
  // actions (with the register), people, compliance, partners, environment &
  // CDM, readiness, delivery, sign-off.
  const pages = [page1, ...attentionPages];
  if (dashboardPage) pages.push(dashboardPage);
  if (monitoringPage) pages.push(monitoringPage);
  if (actionsPage) pages.push(actionsPage);
  if (!hide.highrisk && !foldHide.register) pages.push(...registerPages);
  if (peoplePage) pages.push(peoplePage);
  if (compliancePage) pages.push(compliancePage);
  if (partnersPage) pages.push(partnersPage);
  if (oversightPage) pages.push(oversightPage);
  if (readinessPage) pages.push(readinessPage);
  if (deliveryPage) pages.push(deliveryPage);
  pages.push(page4);

  return {
    meta: { title: 'Health & Safety Board Report', org, ref, producer: producerOf(state), format, period },
    pages,
  };
}
