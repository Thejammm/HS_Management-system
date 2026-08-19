// Board report template — Signal (data-forward) and Brief (editorial) formats.
// Both build the SAME content; format changes the skin class only.
import { deriveBoard, deriveBoardExtras, noneOrCount, countPhrase, hasHave, TIER_COLOURS, HOLD_STATES, HOLD_ORDER } from '../derive.js';
import { esc, tierWord, planBar } from '../blocks.js';
import { paginateRows } from '../engine.js';

// The report's sections, defaulted to what HSG65 says a leadership review
// draws on (Reviewing performance, p55): active + reactive monitoring,
// accident/incident/near-miss data, training records, inspection and
// investigation reports, risk assessments, issues raised by workers, and
// checks required by law — plus HSG65's own instruction to celebrate
// successes and close the loop. Per-client choice lives in
// state.reportPrefs['board-report'].hidden (locked sections always print).
export const BOARD_SECTIONS = [
  { id: 'position',       label: 'Position & decisions (headline, KPIs, decisions required)', locked: true },
  { id: 'reactive',       label: 'Accidents, incidents & near misses', hsg: 'Reactive monitoring · incident data · investigation reports' },
  { id: 'active',         label: 'Active monitoring — inspections, audits & figures', hsg: 'Active monitoring · inspection reports' },
  { id: 'training',       label: 'Training record', hsg: 'Training record' },
  { id: 'workers',        label: 'Issues raised by workers', hsg: 'Worker consultation & involvement' },
  { id: 'statutory',      label: 'Checks required by law', hsg: 'Statutory checks (e.g. lifting equipment)' },
  { id: 'wins',           label: 'Successes this period', hsg: 'HSG65: celebrate and promote successes' },
  { id: 'sinceLast',      label: 'Movement since the baseline', hsg: 'Closing the loop' },
  { id: 'register',       label: 'Fatal & major-harm register', hsg: 'Risk assessments' },
  { id: 'interpretation', label: 'The picture explained (matrix, risk bands, control ladder)' },
  { id: 'maturity',       label: 'Risk control status, consultant judgement, directors’ duty, sign-off', locked: true },
];
export function boardHidden(state) {
  const p = state && state.reportPrefs && state.reportPrefs['board-report'];
  const h = (p && p.hidden && typeof p.hidden === 'object') ? p.hidden : {};
  const out = {};
  BOARD_SECTIONS.forEach(s => { out[s.id] = !s.locked && !!h[s.id]; });
  return out;
}

import { MATURITY_DOMAINS } from '../app-contract.js';
// The consultant's judgement of the six HSG65 areas — words, never numbers.
function judgementRows(state) {
  const j = (state && state.profiler && state.profiler.judgement) || {};
  const words = { weak: 'Weak', adequate: 'Adequate', strong: 'Strong' };
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
  const ref = ((opts.meta && opts.meta.ref) || ('BR-' + new Date().toISOString().slice(0, 7)));
  const format = opts.format || 'signal';

  const mast = { type: 'masthead', org, refCode: ref, issued: today, review: (opts.meta && opts.meta.review) || '' };

  // ── Page 1: Position ──
  // Every label must say what the number is in plain words — no term a
  // reader has to ask about (Simon: "if it's the amount of risks that sit in
  // High then just say it").
  const kpis = [
    { value: D.maxSev ? String(D.maxSev) + '/5' : '—', label: 'Worst possible harm', note: D.highestHarm, tone: D.maxSev >= 5 ? 'bad' : D.maxSev >= 4 ? 'warn' : undefined },
    { value: String(D.fatal), label: 'Could kill or seriously injure', tone: D.fatal ? 'bad' : 'ok' },
    { value: String(D.fatalUncontrolled), label: 'Of those, no controls recorded', tone: D.fatalUncontrolled ? 'bad' : 'ok' },
    // The positive half: work CLOSED OUT. A risk counts when every planned
    // action on it is complete; formal acceptances are stated as a caveat,
    // never counted as done. (Replaced the High-or-Critical tile — that
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
    { value: D.holdS.held + '/' + D.holdS.total, label: 'Risks properly held', note: D.holdS.breaches.length ? (D.holdS.breaches.length + ' need' + (D.holdS.breaches.length !== 1 ? '' : 's') + ' attention first') : 'nothing needs attention', tone: D.holdS.breaches.length ? 'bad' : (D.holdS.total && D.holdS.held === D.holdS.total ? 'ok' : undefined) },
    { value: String(D.overdue), label: 'Actions overdue', tone: D.overdue ? 'warn' : 'ok' },
  ];

  const decisions = [];
  if (D.fatalUncontrolled) decisions.push({ text: 'Direct that the ' + countPhrase(D.fatalUncontrolled, 'risk that could kill or seriously injure and has', 'risks that could kill or seriously injure and have') + ' no recorded controls get controls recorded this quarter.', rationale: 'A could-kill risk with no recorded controls is the first thing an inspector or prosecutor will ask about.' });
  if (D.overdue) decisions.push({ text: 'Reset owners and dates on the ' + countPhrase(D.overdue, 'overdue action', 'overdue actions') + '.', rationale: 'Overdue actions with no intervention become evidence of a plan the organisation does not follow.' });
  if (D.holdS.breaches.length) { const b = D.holdS.breaches[0]; decisions.push({ text: 'Direct that the ' + countPhrase(D.holdS.breaches.length, 'risk needing attention first', 'risks needing attention first') + ' ' + (D.holdS.breaches.length === 1 ? 'is' : 'are') + ' dealt with this month, starting with "' + b.name + '" (' + (b.hold.reasons[0] || b.breach) + ').', rationale: 'HSG65: the response must match the size of the risk - Critical and High risks held or being worked, never run on acceptance alone; Medium risks never left not held.' }); }
  if (!decisions.length) decisions.push({ text: D.empty ? 'Commission completion of the risk profile before the next board cycle.' : 'Note the position and maintain the current programme.', rationale: D.empty ? 'No decision can be soundly made from an incomplete profile.' : 'No exception requires a board decision this period.' });

  // Where the risks stand — real counts in the four factual states, plus the
  // rule verdict in the app's exact words. No scales, no transforms.
  const expBars = {
    type: 'distributionBars', title: 'Where the ' + D.holdS.total + ' risk' + (D.holdS.total !== 1 ? 's' : '') + ' stand',
    items: HOLD_ORDER.map(k => ({ label: HOLD_STATES[k].label, n: D.holdS[k], colour: HOLD_STATES[k].colour })),
  };
  const verdictLine = D.holdS.verdict;

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

  // ── HSG65 review pages — what the leadership meeting reviews, from the
  //    live system. Sections toggle per client; empty pages drop out. ──
  const X = deriveBoardExtras(state, opts);
  const hide = boardHidden(state);
  const fmtD = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const hsgFoot = { type: 'textBlock', body: 'HSG65 (Reviewing performance) lists what a leadership review draws on: active and reactive monitoring, accident/incident/near-miss data, training records, inspection and investigation reports, risk assessments, issues raised by workers, and checks required by law. Each section above reports one of them from the live system. Period covered: the 90 days to ' + today + '.', cls: 'r-stamp' };

  const monBlocks = [];
  if (!hide.reactive) {
    monBlocks.push({ type: 'kpiStrip', tiles: [
      { value: String(X.incRecent.length), label: 'Events in 90 days', tone: X.incRecent.length ? 'warn' : 'ok' },
      { value: String(X.incOpen), label: 'Investigations open', tone: X.incOpen ? 'warn' : 'ok' },
      { value: String(X.incRiddor), label: 'RIDDOR reportable', tone: X.incRiddor ? 'bad' : 'ok' },
      { value: String(X.incNoCause), label: 'No cause recorded', note: 'of this period’s events', tone: X.incNoCause ? 'warn' : 'ok' },
    ] });
    monBlocks.push(X.incRecent.length
      ? { type: 'dataTable',
          cols: [ { header: 'Date', w: '12%' }, { header: 'Type', w: '15%' }, { header: 'What happened', w: '49%' }, { header: 'Status', w: '24%' } ],
          rows: X.incRecent.slice(0, 6).map(i => [ fmtD(i.date), i.type || '—', String(i.what || '(not recorded)').slice(0, 110), (i.status === 'Open' ? 'Open — under investigation' : (i.status || 'Closed')) ]),
          footnote: X.incRecent.length > 6 ? ('Showing the latest 6 of ' + X.incRecent.length + ' events this period; the full record is the incident register.') : 'Full detail and investigations live on the incident register.' }
      : { type: 'textBlock', title: 'Reactive monitoring', body: 'No accidents, incidents or near misses were recorded in the period. Confirm that reflects reality rather than under-reporting — a healthy system still records near misses.' });
  }
  if (!hide.active) {
    monBlocks.push({ type: 'textBlock', title: 'Active monitoring — checking before things go wrong', body:
      noneOrCount(X.siteDone, 'process-assurance visit (site inspections, architectural reviews, CDM audits) has been completed', 'process-assurance visits (site inspections, architectural reviews, CDM audits) have been completed') + '. '
      + noneOrCount(X.siteOverdue, 'planned visit is overdue', 'planned visits are overdue') + '. '
      + (X.inspTotal ? countPhrase(X.inspTotal, 'workplace inspection is', 'workplace inspections are') + ' on file from the linked inspection app. ' : '')
      + (X.monthsSaved.length ? 'Monthly performance figures are saved for ' + countPhrase(X.monthsSaved.length, 'month', 'months') + ' (latest ' + X.monthsSaved[X.monthsSaved.length - 1] + ').' : 'No monthly performance figures have been saved yet.') });
  }
  const monitoringPage = (monBlocks.length && !(hide.reactive && hide.active)) ? {
    label: 'This period', section: 'monitoring', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'HSG65 review pack · what went wrong, and the checking that finds trouble early',
        headline: X.incRecent.length ? (countPhrase(X.incRecent.length, 'event', 'events') + ' in 90 days; ' + noneOrCount(X.incOpen, 'investigation open', 'investigations open', 'no') + '.') : 'A quiet period — no recorded events in 90 days.',
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
      rows: X.trnExpired.slice(0, 6).map(x => [ x.employee || '—', x.course || '—', fmtD(x.expiry) ]),
      footnote: 'Renewals are raised onto the execution plan from the training matrix.' });
    else if (X.trnTotal) peopleBlocks.push({ type: 'textBlock', title: 'Training record', body: 'Every recorded course is in date. Renewal dates are tracked and expiring courses raise actions automatically.' });
    else peopleBlocks.push({ type: 'textBlock', title: 'Training record', body: 'No training matrix has been loaded yet — the competence picture cannot be evidenced until it is.' });
  }
  if (!hide.workers) {
    peopleBlocks.push({ type: 'textBlock', title: 'Issues raised by workers', body:
      (X.brRecent.length
        ? countPhrase(X.brRecent.length, 'briefing was', 'briefings were') + ' recorded in the period, ' + noneOrCount(X.brFb.length, 'with something raised back by the workforce', 'with something raised back by the workforce', 'none') + '. '
          + (X.brFb.length ? ('Latest: ' + X.brFb.slice(0, 2).map(b => '“' + String(b.feedback).slice(0, 90) + '”').join(' · ')) : 'Two-way evidence is thin — briefings are being held but nothing coming back is being captured.')
        : 'No briefings were recorded this period. HSG65 expects communication to run both ways — daily starts and toolbox talks belong on the record with what the workforce raised.') });
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
      { type: 'titleBlock', kicker: 'HSG65 review pack · training, workers & statutory checks',
        headline: X.trnExpired.length ? (countPhrase(X.trnExpired.length, 'training course has', 'training courses have') + ' expired.') : 'Competence, consultation and the legal checks.',
        standfirst: 'The people side of the review: whether the workforce is trained and in date, whether the conversation runs both ways, and whether the checks the law requires are happening on time.' },
      ...peopleBlocks,
    ],
  } : null;

  const progBlocks = [];
  if (!hide.wins) {
    progBlocks.push(X.wins.length
      ? { type: 'dataTable',
          cols: [ { header: 'Delivered', w: '58%' }, { header: 'Owner', w: '22%' }, { header: 'When', w: '20%' } ],
          rows: X.wins.slice(0, 8).map(w => [ String(w.desc).slice(0, 95), w.owner || '—', fmtD(w.when) ]),
          footnote: 'HSG65: “Reviewing also gives you the opportunity to celebrate and promote your health and safety successes.” Delivered work stays on the plan as evidence.' }
      : { type: 'textBlock', title: 'Successes this period', body: 'Nothing was delivered in the period. If work is being done but not being closed off on the plan, the record undersells the business.' });
  }
  if (!hide.sinceLast && X.baseline && X.baseline.metrics) {
    const b = X.baseline.metrics; const mv = (a, c) => (a == null || c == null) ? '—' : (c > a ? ('up ' + (c - a)) : c < a ? ('down ' + (a - c)) : 'no change');
    progBlocks.push({ type: 'dataTable',
      cols: [ { header: 'Measure', w: '40%' }, { header: 'Baseline ' + fmtD(X.baseline.date), w: '20%' }, { header: 'Now', w: '20%' }, { header: 'Movement', w: '20%' } ],
      rows: [
        [ 'Risks properly held', String(b.held ?? '—'), String(D.holdS.held), (b.held != null) ? ((D.holdS.held > b.held) ? ('up ' + (D.holdS.held - b.held)) : (D.holdS.held < b.held) ? ('down ' + (b.held - D.holdS.held)) : 'no change') : '—' ],
        [ 'Need attention first', String(b.ruleBreaches ?? '—'), String(D.holdS.breaches.length), (b.ruleBreaches != null) ? ((D.holdS.breaches.length < b.ruleBreaches) ? ('down ' + (b.ruleBreaches - D.holdS.breaches.length)) : (D.holdS.breaches.length > b.ruleBreaches) ? ('up ' + (D.holdS.breaches.length - b.ruleBreaches)) : 'no change') : '—' ],
        [ 'High + critical risks', String(b.highCrit ?? '—'), String(D.highPlus), mv(b.highCrit, D.highPlus) ],
        [ 'Open actions', String(b.openActions ?? '—'), String(D.openActions), mv(b.openActions, D.openActions) ],
        [ 'Overdue actions', String(b.overdueActions ?? '—'), String(D.overdue), mv(b.overdueActions, D.overdue) ],
      ],
      footnote: 'Baseline = the first audit snapshot (“where they started”). The consultant records a snapshot at each audit visit.' });
  }
  const progressPage = progBlocks.length ? {
    label: 'Progress', section: 'progress', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'HSG65 review pack · closing the loop',
        headline: X.wins.length ? (countPhrase(X.wins.length, 'action delivered', 'actions delivered') + ' — the plan is being worked.') : 'Progress against the plan.',
        standfirst: 'What the business delivered this period, and how far it has moved since the baseline. The outcomes of this review become what is planned next — that is the loop HSG65 wants closed.' },
      ...progBlocks,
    ],
  } : null;

  // ── Page 2+: Register (spills beyond ~16 rows) ──
  const regCols = [
    { header: 'Activity / risk', w: '34%' },
    { header: 'Score — now → after the plan (of 25)', w: '30%' },
    { header: 'Band', w: '12%' },
    { header: 'Controls', w: '12%' },
    { header: 'Owner', w: '12%' },
  ];
  const rowFor = r => ([
    r.name + (r.fatal ? '  ⚑' : ''),
    { html: planBar({ residual: r.residual, target: r.target, tier: r.tier, targetTier: r.targetTier, actsTotal: r.actsTotal, actsClosed: r.actsClosed }) },
    { html: tierWord(r.tier) },
    r.control,
    r.owner || '—',
  ]);
  const slices = paginateRows(D.registerRows, 16, 20);
  const registerPages = slices.map((slice, i) => ({
    label: 'Register' + (slices.length > 1 ? ' ' + (i + 1) : ''),
    blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Fatal and major-harm register' + (slices.length > 1 ? (' · part ' + (i + 1) + ' of ' + slices.length) : ''), headline: i === 0 ? (D.registerRows.length ? countPhrase(D.registerRows.length, 'activity that can cause', 'activities that can cause') + ' serious harm' : 'No fatal or major-harm activities recorded') : 'Register, continued' },
      D.registerRows.length
        ? { type: 'dataTable', cols: regCols, rows: slice.map(rowFor), footnote: i === slices.length - 1 ? '"Plan" is the score the open actions are working towards (target likelihood × severity); the done-count shows how far the plan has been delivered. Controls reduce likelihood, not severity — a fatal-potential risk stays fatal-potential however well controlled. ⚑ fatal potential.' : undefined }
        : { type: 'textBlock', body: 'Nothing in the profile currently carries a worst-case severity of major injury or above. Confirm this reflects the work actually done, not gaps in the profile.' },
    ],
  }));

  // ── Page 3: the picture explained — plain sentences, no double negatives
  //    ("No open actions have no named owner" is banned; say the good state
  //    positively and the gap as a count). ──
  const zeros = [];
  zeros.push(D.noOwner ? countPhrase(D.noOwner, 'open action has', 'open actions have') + ' nobody named to do ' + (D.noOwner === 1 ? 'it' : 'them') + '.' : 'Every open action has someone named to do it.');
  zeros.push(D.noDate ? countPhrase(D.noDate, 'open action has', 'open actions have') + ' no target date.' : 'Every open action has a target date.');
  zeros.push(D.unrated ? countPhrase(D.unrated, 'recorded risk is', 'recorded risks are') + ' not yet scored.' : 'Every recorded risk is scored.');

  const page3 = {
    label: 'The picture explained', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'The picture explained', headline: 'Where the risk sits and how it is held' },
      { type: 'matrix5x5', counts: D.matrix, caption: 'Where every rated risk sits now, with controls in place (likelihood across, severity up; the number is how many risks sit in that square).' },
      { type: 'distributionBars', title: 'How many risks sit in each band (with controls in place)', items: ['Critical', 'High', 'Medium', 'Low'].map(t => ({ label: t, n: D.byTier[t], colour: TIER_COLOURS[t] })) },
      { type: 'hierarchyStrip', title: 'How the risks are controlled — strongest measures first', items: D.hierarchy, total: D.hierTotal, protectDown: D.protectDown },
      { type: 'textBlock', title: 'Loose ends', body: zeros.join(' ') },
      { type: 'textBlock', title: 'Consultant commentary', body: (opts.meta && opts.meta.commentary) || 'Reserved for the consultant’s reading of this period.', cls: 'r-commentary' },
    ],
  };

  // ── Page 4: Risk control status, consultant judgement, duty, sign-off ──
  // Facts, not scores: each risk sits in one of four states graded on what is
  // recorded; the rule (HSG65 proportionality) is printed in full; the six
  // HSG65 areas carry the consultant's judgement in words.
  const judRows = judgementRows(state);
  const holdRows = HOLD_ORDER.map(k => [HOLD_STATES[k].label, String(D.holdS[k]), HOLD_STATES[k].desc]);
  const page4 = {
    label: 'Risk control status', blocks: [
      mast,
      { type: 'statementPanel', title: 'Directors’ duty', cite: 'Health and Safety at Work etc. Act 1974, s.37', body: 'Where an offence by the company is proved to have been committed with the consent, connivance or neglect of a director, manager or similar officer, that individual — as well as the company — is liable to prosecution. This report exists so the board can show it directed and reviewed the management of these risks.' },
      { type: 'tagList', title: 'The laws this risk profile brings into play', tags: D.duties },
      { type: 'dataTable', title: 'Risk control status — what each state means',
        cols: [ { header: 'State', w: '18%' }, { header: 'Risks', w: '10%' }, { header: 'What it means', w: '72%' } ],
        rows: holdRows,
        footnote: 'Graded on recorded facts, not opinion. HSG65 expects the response to match the size of the risk: Critical and High risks must be held or being worked on time, and never run on acceptance alone; Medium risks must not be left not held.' },
      D.holdS.breaches.length
        ? { type: 'dataTable', title: 'Needs attention first — for board direction',
            cols: [ { header: 'Risk', w: '34%' }, { header: 'Band', w: '12%' }, { header: 'State', w: '16%' }, { header: 'Why', w: '38%' } ],
            rows: D.holdS.breaches.map(b => [ b.name, b.band || '—', b.hold.label, (b.hold.reasons && b.hold.reasons.join('; ')) || b.breach ]) }
        : { type: 'textBlock', title: 'Needs attention first', body: 'None. Every Critical and High risk is held or being worked on time, and no Medium risk is left not held.' },
      judRows.length
        ? { type: 'dataTable', title: 'Consultant judgement — the six HSG65 areas, in words',
            cols: [ { header: 'Area', w: '28%' }, { header: 'Judgement', w: '16%' }, { header: 'Consultant’s note', w: '56%' } ],
            rows: judRows.map(x => [ x.label, x.level, x.note || '—' ]) }
        : { type: 'textBlock', title: 'Consultant judgement — the six HSG65 areas', body: 'Not yet judged. The consultant records a judgement in words (Weak, Adequate or Strong) against each of the six HSG65 areas in the risk review.' },
      { type: 'signoffGrid', cells: [
        { label: 'Prepared by' }, { label: 'Position' }, { label: 'Signature' }, { label: 'Date' },
        { label: 'Received for the board' }, { label: 'Position' }, { label: 'Signature' }, { label: 'Date' },
      ] },
      { type: 'textBlock', body: 'Version ' + ((opts.meta && opts.meta.version) || '1.0') + ' · generated from the live profile on ' + today + '.', cls: 'r-stamp' },
    ],
  };

  const pages = [page1];
  if (monitoringPage) pages.push(monitoringPage);
  if (peoplePage) pages.push(peoplePage);
  if (progressPage) pages.push(progressPage);
  if (!hide.register) pages.push(...registerPages);
  if (!hide.interpretation) pages.push(page3);
  pages.push(page4);

  return {
    meta: { title: 'Health & Safety Board Report', org, ref, format, period },
    pages,
  };
}
