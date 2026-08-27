// Board report template - Signal (data-forward) and Brief (editorial) formats.
// Both build the SAME content; format changes the skin class only.
import { deriveBoard, deriveBoardExtras, noneOrCount, countPhrase, hasHave, TIER_COLOURS, HOLD_STATES, HOLD_ORDER, docFor, producerOf } from '../derive.js';
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
  { id: 'position',       label: 'Position & decisions (headline, KPIs, decisions required)', locked: true },
  { id: 'reactive',       label: 'Accidents, incidents & near misses', hsg: 'Reactive monitoring · incident data · investigation reports' },
  { id: 'active',         label: 'Active monitoring - inspections, audits & figures', hsg: 'Active monitoring · inspection reports' },
  { id: 'training',       label: 'Training record', hsg: 'Training record' },
  { id: 'workers',        label: 'Issues raised by workers', hsg: 'Worker consultation & involvement' },
  { id: 'statutory',      label: 'Checks required by law', hsg: 'Statutory checks (e.g. lifting equipment)' },
  { id: 'legal',          label: 'Legal compliance - duties assessed, met and not in place', hsg: 'Compliance with legal requirements' },
  { id: 'accreditation',  label: 'Accreditation readiness (Common Assessment Standard)', hsg: 'Assurance against external standards' },
  { id: 'cdm',            label: 'CDM assurance - design reviews & CDM audits', hsg: 'Active monitoring · construction dutyholders' },
  { id: 'environmental',  label: 'Environmental events', hsg: 'Environmental incidents & investigations' },
  { id: 'wins',           label: 'Successes this period', hsg: 'Celebrate and promote successes' },
  { id: 'sinceLast',      label: 'Movement since the baseline', hsg: 'Closing the loop' },
  { id: 'topFive',        label: 'Top 5 priorities for next month', hsg: 'What we agreed to do next' },
  { id: 'register',       label: 'Fatal & major-harm register', hsg: 'Risk assessments' },
  { id: 'interpretation', label: 'The picture explained (matrix, risk bands, control ladder)' },
  { id: 'maturity',       label: 'H&S control maturity, consultant judgement, directors’ duty, sign-off', locked: true },
];
export function boardHidden(state) {
  const p = state && state.reportPrefs && state.reportPrefs['board-report'];
  const h = (p && p.hidden && typeof p.hidden === 'object') ? p.hidden : {};
  const out = {};
  BOARD_SECTIONS.forEach(s => { out[s.id] = !s.locked && !!h[s.id]; });
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

  const page1 = {
    label: 'Position', cover: format === 'signal', blocks: [
      { type: 'coverBlock', org, title: 'H&S Board Report', period, refCode: ref, issued: today },
      { type: 'titleBlock', kicker: 'Health & safety board report · ' + period, headline: D.headline, standfirst: D.standfirst },
      { type: 'kpiStrip', tiles: kpis },
      { type: 'decisionsPanel', title: 'Decisions required', items: decisions },
      expBars,
      { type: 'soWhat', text: verdictLine },
    ],
  };

  // ── HSG65 review pages - what the leadership meeting reviews, from the
  //    live system. Sections toggle per client; empty pages drop out. ──
  const X = deriveBoardExtras(state, opts);
  const hide = boardHidden(state);
  const fmtD = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
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

  const envAll = (Array.isArray(state.incidents) ? state.incidents : []).filter(i => i && i.type === 'Environmental');
  const env = { total: envAll.length, open: envAll.filter(i => i.status === 'Open').length,
    latest: envAll.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 5) };

  const monBlocks = [];
  if (!hide.reactive) {
    monBlocks.push({ type: 'kpiStrip', tiles: [
      { value: String(X.incRecent.length), label: 'Events in 90 days', tone: X.incRecent.length ? 'warn' : 'ok' },
      { value: String(X.incOpen), label: 'Investigations open', tone: X.incOpen ? 'warn' : 'ok' },
      { value: String(X.incRiddor), label: 'RIDDOR reportable', note: 'all time', tone: X.incRiddor ? 'bad' : 'ok' },
      { value: String(X.incNoCause), label: 'No cause recorded', note: 'of this period’s events', tone: X.incNoCause ? 'warn' : 'ok' },
    ] });
    monBlocks.push(X.incRecent.length
      ? { type: 'dataTable',
          cols: [ { header: 'Date', w: '12%' }, { header: 'Type', w: '15%' }, { header: 'What happened', w: '49%' }, { header: 'Status', w: '24%' } ],
          rows: X.incRecent.slice(0, 6).map(i => [ fmtD(i.date), i.type || '-', String(i.what || '(not recorded)').slice(0, 110), (i.status === 'Open' ? 'Open - under investigation' : (i.status || 'Closed')) ]),
          footnote: X.incRecent.length > 6 ? ('Showing the latest 6 of ' + X.incRecent.length + ' events this period; the full record is the incident register.') : 'Full detail and investigations live on the incident register.' }
      : { type: 'textBlock', title: 'Reactive monitoring', body: 'No accidents, incidents or near misses were recorded in the period. Confirm that reflects reality rather than under-reporting - a healthy system still records near misses.' });
  }
  if (!hide.active) {
    monBlocks.push({ type: 'textBlock', title: 'Active monitoring - checking before things go wrong', body:
      noneOrCount(X.siteDone, 'process-assurance visit (site inspections, architectural reviews, CDM audits) has been completed', 'process-assurance visits (site inspections, architectural reviews, CDM audits) have been completed') + '. '
      + noneOrCount(X.siteOverdue, 'planned visit is overdue', 'planned visits are overdue') + '. '
      + (X.inspTotal ? countPhrase(X.inspTotal, 'workplace inspection is', 'workplace inspections are') + ' on file from the linked inspection app. ' : '')
      + (X.monthsSaved.length ? 'Monthly performance figures are saved for ' + countPhrase(X.monthsSaved.length, 'month', 'months') + ' (latest ' + X.monthsSaved[X.monthsSaved.length - 1] + ').' : 'No monthly performance figures have been saved yet.') });
  }
  const monitoringPage = (monBlocks.length && !(hide.reactive && hide.active)) ? {
    label: 'This period', section: 'monitoring', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · what went wrong, and the checking that finds trouble early',
        headline: X.incRecent.length ? (countPhrase(X.incRecent.length, 'event', 'events') + ' in 90 days; ' + noneOrCount(X.incOpen, 'investigation open', 'investigations open', 'no') + '.') : 'A quiet period - no recorded events in 90 days.',
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
  if (!hide.workers) {
    peopleBlocks.push({ type: 'textBlock', title: 'Issues raised by workers', body:
      (X.brRecent.length
        ? countPhrase(X.brRecent.length, 'briefing was', 'briefings were') + ' recorded in the period, ' + noneOrCount(X.brFb.length, 'with something raised back by the workforce', 'with something raised back by the workforce', 'none') + '. '
          + (X.brFb.length ? ('Latest: ' + X.brFb.slice(0, 2).map(b => '“' + String(b.feedback).slice(0, 90) + '”').join(' · ')) : 'Two-way evidence is thin - briefings are being held but nothing coming back is being captured.')
        : 'No briefings were recorded this period. Communication should run both ways - daily starts and toolbox talks belong on the record with what the workforce raised.') });
  }
  if (!hide.statutory) {
    peopleBlocks.push({ type: 'textBlock', title: 'Checks required by law', body:
      (X.statTotal
        ? countPhrase(X.statTotal, 'statutory check is', 'statutory checks are') + ' tracked (thorough examinations, servicing and similar). ' + noneOrCount(X.statOverdue, 'is overdue', 'are overdue', 'None') + '; ' + noneOrCount(X.statDueSoon, 'falls due within 60 days', 'fall due within 60 days', 'none') + '.'
        : 'No statutory checks are tracked yet. If the business has lifting equipment, pressure systems, LEV or similar, their thorough-examination dates belong on the statutory tracker.') });
  }
  const peoplePage = (peopleBlocks.length) ? {
    label: 'People & compliance', section: 'people', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · training, workers & statutory checks',
        headline: X.trnExpired.length ? (countPhrase(X.trnExpired.length, 'training course has', 'training courses have') + ' expired.') : 'Competence, consultation and the legal checks.',
        standfirst: 'The people side of the review: whether the workforce is trained and in date, whether the conversation runs both ways, and whether the checks the law requires are happening on time.' },
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
  }
  if (!hide.accreditation) {
    compBlocks.push({ type: 'textBlock', title: 'Accreditation readiness (Common Assessment Standard)', body:
      cas.assessed
        ? (countPhrase(cas.assessed, 'criterion has', 'criteria have') + ' been assessed: ' + cas.ready + ' green, ' + cas.partial + ' amber, ' + cas.gap + ' red' + (cas.na ? (', ' + cas.na + ' not applicable') : '') + (casPct != null ? ('. ' + casPct + '% of the assessable criteria assessed so far are green') : '') + '. The criterion-by-criterion mapping and its evidence live on the Accreditation tab.')
        : 'Accreditation readiness has not been assessed yet. The Accreditation tab maps the business against the Common Assessment Standard criterion by criterion - the route to SSIP and principal-contractor approval.' });
  }
  const compliancePage = compBlocks.length ? { label: 'Compliance', section: 'compliance', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · the legal position and external standards',
        headline: legal.notInPlace.length ? (countPhrase(legal.notInPlace.length, 'legal duty is', 'legal duties are') + ' not in place.')
          : legal.gaps.length ? (countPhrase(legal.gaps.length, 'duty line needs', 'duty lines need') + ' strengthening.')
          : legal.assessed ? 'Every assessed duty is in place and adequate.'
          : 'Legal compliance and accreditation readiness.',
        standfirst: 'Whether the duties the law places on the business are in place and adequate - and how the business currently reads against the accreditation standard its clients ask for.' },
      ...compBlocks,
    ] } : null;

  const oversightBlocks = [];
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
  if (!hide.environmental) {
    oversightBlocks.push({ type: 'textBlock', title: 'Environmental events', body:
      env.total
        ? (countPhrase(env.total, 'environmental event is', 'environmental events are') + ' on the incident register' + (env.open ? (', ' + countPhrase(env.open, 'investigation still open', 'investigations still open')) : ', none open') + '.')
        : 'No environmental events are recorded. Spills, discharges and waste incidents belong on the incident register under the Environmental type - a clean record should reflect reality, not under-reporting.' });
    if (env.latest.length) oversightBlocks.push({ type: 'dataTable',
      cols: [ { header: 'Date', w: '14%' }, { header: 'What happened', w: '52%' }, { header: 'Where', w: '18%' }, { header: 'Status', w: '16%' } ],
      rows: env.latest.map(i => [ fmtD(i.date), String(i.what || '(not recorded)').slice(0, 100), i.where || '-', (i.status === 'Open' ? 'Open - under investigation' : (i.status || 'Closed')) ]) });
  }
  const oversightPage = oversightBlocks.length ? { label: 'CDM & environment', section: 'oversight', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · construction dutyholding and environmental performance',
        headline: cdm.overdue ? (countPhrase(cdm.overdue, 'CDM oversight activity is', 'CDM oversight activities are') + ' overdue.')
          : env.open ? (countPhrase(env.open, 'environmental investigation is', 'environmental investigations are') + ' open.')
          : 'CDM oversight and environmental events.',
        standfirst: 'The construction side of the duty - design reviews and CDM audits happening to plan - and any environmental events with their investigations.' },
      ...oversightBlocks,
    ] } : null;

  const progBlocks = [];
  if (!hide.wins) {
    progBlocks.push(X.wins.length
      ? { type: 'dataTable',
          cols: [ { header: 'Closed off', w: '44%' }, { header: 'From', w: '22%' }, { header: 'Owner', w: '17%' }, { header: 'When', w: '17%' } ],
          rows: X.wins.slice(0, 10).map(w => [ String(w.desc).slice(0, 80) + (w.accepted ? ' (risk accepted)' : ''), String(w.source || '-').slice(0, 40), w.owner || '-', fmtD(w.when) ]),
          footnote: (X.wins.length > 10 ? ('Showing the latest 10 of ' + X.wins.length + ' closed this period. ') : '') + 'Every source counts here - risk actions, management-system actions and the plan itself. Delivered work stays on the plan as evidence, and a review is also the moment to give credit for what was closed off.' }
      : { type: 'textBlock', title: 'Successes this period', body: 'Nothing was delivered in the period. If work is being done but not being closed off on the plan, the record undersells the business.' });
  }
  if (!hide.topFive) {
    const t5 = X.top5 || [], last = X.top5Last || [];
    const mLabel = (m) => { try { return new Date(m + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); } catch (e) { return m; } };
    const closed = (a) => a.status === 'Complete' || a.status === 'Accepted';
    // How last month's five actually went - the half the client feels.
    if (last.length) {
      const doneN = last.filter(closed).length;
      progBlocks.push({ type: 'dataTable', title: 'Last month\'s five: ' + doneN + ' of ' + last.length + ' delivered',
        cols: [ { header: 'Agreed for ' + mLabel(X.t5Prev), w: '46%' }, { header: 'Owner', w: '18%' }, { header: 'By', w: '16%' }, { header: 'Outcome', w: '20%' } ],
        rows: last.map(a => [ String(a.desc).slice(0, 80), a.owner || 'no owner', a.due ? fmtD(a.due) : 'no date',
          closed(a) ? (a.status === 'Accepted' ? 'Risk accepted' : ('Delivered' + (a.resolvedDate ? (' ' + fmtD(a.resolvedDate)) : ''))) : (a.due && a.due < (opts.today || new Date().toISOString().slice(0, 10)) ? 'Overdue' : 'Still open') ]),
        footnote: doneN === last.length ? 'Every priority agreed last month was closed out.' : 'Anything not closed stays on the plan and is considered again for this month.' });
    }
    // The five for next month.
    progBlocks.push(t5.length
      ? { type: 'dataTable', title: 'Top 5 priorities for ' + mLabel(X.t5Month),
          cols: [ { header: 'What we will do', w: '46%' }, { header: 'From', w: '18%' }, { header: 'Owner', w: '18%' }, { header: 'By', w: '18%' } ],
          rows: t5.map(a => [ String(a.desc).slice(0, 80), String(a.sourceLabel || a.source || '-').slice(0, 34), a.owner || 'to be named', a.due ? fmtD(a.due) : 'to be dated' ]),
          footnote: 'Chosen by the consultant from the full execution plan after this month\'s review, on what removes the most risk soonest. Each one is owned and dated in Compass, and its progress is visible to the client on the execution plan. Next month\'s report opens with what happened to these five.' }
      : { type: 'textBlock', title: 'Top 5 priorities for ' + mLabel(X.t5Month),
          body: 'Not yet agreed. The consultant reviews the execution plan after the monthly meeting and marks the five actions that remove the most risk soonest; they are listed here, owned and dated, and checked off in next month\'s report.' });
  }
  if (!hide.sinceLast && X.baseline && X.baseline.metrics) {
    const b = X.baseline.metrics; const mv = (a, c) => (a == null || c == null) ? '-' : (c > a ? ('up ' + (c - a)) : c < a ? ('down ' + (a - c)) : 'no change');
    progBlocks.push({ type: 'dataTable',
      cols: [ { header: 'Measure', w: '40%' }, { header: 'Baseline ' + fmtD(X.baseline.date), w: '20%' }, { header: 'Now', w: '20%' }, { header: 'Movement', w: '20%' } ],
      rows: [
        [ 'Risks assured', String(b.held ?? '-'), String(D.holdS.held), (b.held != null) ? ((D.holdS.held > b.held) ? ('up ' + (D.holdS.held - b.held)) : (D.holdS.held < b.held) ? ('down ' + (b.held - D.holdS.held)) : 'no change') : '-' ],
        [ 'Need attention first', String(b.ruleBreaches ?? '-'), String(D.holdS.breaches.length), (b.ruleBreaches != null) ? ((D.holdS.breaches.length < b.ruleBreaches) ? ('down ' + (b.ruleBreaches - D.holdS.breaches.length)) : (D.holdS.breaches.length > b.ruleBreaches) ? ('up ' + (D.holdS.breaches.length - b.ruleBreaches)) : 'no change') : '-' ],
        [ 'High + critical risks', String(b.highCrit ?? '-'), String(D.highPlus), mv(b.highCrit, D.highPlus) ],
        [ 'Open actions', String(b.openActions ?? '-'), String(D.openActions), mv(b.openActions, D.openActions) ],
        [ 'Overdue actions', String(b.overdueActions ?? '-'), String(D.overdue), mv(b.overdueActions, D.overdue) ],
      ],
      footnote: 'Baseline = the first audit snapshot (“where they started”). The consultant records a snapshot at each audit visit.' });
  }
  const progressPage = progBlocks.length ? {
    label: 'Progress', section: 'progress', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Leadership review · closing the loop',
        headline: (function () {
          const done = X.wins.filter(w => !w.accepted).length, acc = X.wins.length - X.wins.filter(w => !w.accepted).length;
          const parts = [];
          if (done) parts.push(countPhrase(done, 'action delivered', 'actions delivered'));
          if (acc) parts.push(countPhrase(acc, 'risk formally accepted', 'risks formally accepted'));
          return parts.length ? (parts.join(' and ') + ' - the plan is being delivered.') : 'Progress against the plan.';
        })(),
        standfirst: 'What the business delivered this period, and how far it has moved since the baseline. The outcomes of this review become what is planned next - that closes the loop.' },
      ...progBlocks,
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

  // ── Page 3: the picture explained - plain sentences, no double negatives
  //    ("No open actions have no named owner" is banned; say the good state
  //    positively and the gap as a count). ──
  const zeros = [];
  zeros.push(D.noOwner ? countPhrase(D.noOwner, 'open action has', 'open actions have') + ' nobody named to do ' + (D.noOwner === 1 ? 'it' : 'them') + '.' : 'Every open action has someone named to do it.');
  zeros.push(D.noDate ? countPhrase(D.noDate, 'open action has', 'open actions have') + ' no target date.' : 'Every open action has a target date.');
  zeros.push(D.unrated ? countPhrase(D.unrated, 'recorded risk is', 'recorded risks are') + ' not yet scored.' : 'Every recorded risk is scored.');

  const page3 = {
    label: 'The picture explained', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'The picture explained', headline: 'Where the risk sits and how well it is controlled' },
      { type: 'matrix5x5', counts: D.matrix, bands: D.bands, caption: 'Where every rated risk sits now, with controls in place (likelihood across, severity up; the number is how many risks sit in that square). Each square is coloured by its risk band: red Critical, orange High, amber Medium, green Low.' },
      { type: 'distributionBars', title: 'How many risks sit in each band (with controls in place)', items: ['Critical', 'High', 'Medium', 'Low'].map(t => ({ label: t, n: D.byTier[t], colour: TIER_COLOURS[t] })) },
      { type: 'hierarchyStrip', title: 'How the risks are controlled - strongest measures first', items: D.hierarchy, total: D.hierTotal, protectDown: D.protectDown },
      { type: 'textBlock', title: 'Loose ends', body: zeros.join(' ') },
      { type: 'textBlock', title: 'Consultant commentary', body: (opts.meta && opts.meta.commentary) || 'Reserved for the consultant’s reading of this period.', cls: 'r-commentary' },
    ],
  };

  // ── Page 4: H&S control maturity, consultant judgement, duty, sign-off ──
  // Facts, not scores: each risk sits in one of four states graded on what is
  // recorded; the rule (HSG65 proportionality) is printed in full; the six
  // HSG65 areas carry the consultant's judgement in words.
  const judRows = judgementRows(state);
  const holdRows = HOLD_ORDER.map(k => [HOLD_STATES[k].level + ' · ' + HOLD_STATES[k].label, String(D.holdS[k]), HOLD_STATES[k].desc]);
  const page4 = {
    label: 'Control maturity', blocks: [
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

  const pages = [page1, ...attentionPages];
  if (monitoringPage) pages.push(monitoringPage);
  if (peoplePage) pages.push(peoplePage);
  if (compliancePage) pages.push(compliancePage);
  if (oversightPage) pages.push(oversightPage);
  if (progressPage) pages.push(progressPage);
  if (!hide.register) pages.push(...registerPages);
  if (!hide.interpretation) pages.push(page3);
  pages.push(page4);

  return {
    meta: { title: 'Health & Safety Board Report', org, ref, producer: producerOf(state), format, period },
    pages,
  };
}
