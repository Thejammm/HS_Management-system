// Board report template — Signal (data-forward) and Brief (editorial) formats.
// Both build the SAME content; format changes the skin class only.
import { deriveBoard, deriveBoardExtras, noneOrCount, countPhrase, hasHave, TIER_COLOURS } from '../derive.js';
import { esc, tierWord, dualBar } from '../blocks.js';
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
  { id: 'interpretation', label: 'Interpretation (matrix, tiers, hierarchy of control)' },
  { id: 'maturity',       label: 'Exposure & maturity, directors’ duty, sign-off', locked: true },
];
export function boardHidden(state) {
  const p = state && state.reportPrefs && state.reportPrefs['board-report'];
  const h = (p && p.hidden && typeof p.hidden === 'object') ? p.hidden : {};
  const out = {};
  BOARD_SECTIONS.forEach(s => { out[s.id] = !s.locked && !!h[s.id]; });
  return out;
}

const MATURITY_DOMAIN_LABELS = {
  leadership: 'Leadership & Governance', contractor: 'Contractor & Supply Chain',
  ohealth: 'Occupational Health', opcontrol: 'Operational Control',
  assurance: 'Assurance & Monitoring', resilience: 'Business Resilience',
};

function maturityRows(state) {
  // Item ids in state.profiler.maturity are prefixed by domain conventions
  // (l_, c_, oh_/o_, op_, a_, r_) but the reliable grouping ships with the SPA
  // library; the report groups by known prefixes and falls back to one row.
  const m = (state.profiler && state.profiler.maturity) || {};
  const groups = { leadership: [], contractor: [], ohealth: [], opcontrol: [], assurance: [], resilience: [] };
  const prefix = [
    [/^l_/, 'leadership'], [/^c_/, 'contractor'], [/^oh?_/, 'ohealth'],
    [/^op_/, 'opcontrol'], [/^a_/, 'assurance'], [/^r_/, 'resilience'],
  ];
  let matched = 0, total = 0;
  Object.entries(m).forEach(([id, v]) => {
    if (v === '' || v === 'na' || v == null) return;
    const n = Number(v); if (!Number.isFinite(n)) return;
    total++;
    const hit = prefix.find(([re]) => re.test(id));
    if (hit) { groups[hit[1]].push(n); matched++; }
  });
  if (!total) return [];
  if (matched / total < 0.6) {
    const all = Object.values(m).filter(v => v !== '' && v !== 'na' && v != null).map(Number).filter(Number.isFinite);
    const avg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
    return [{ label: 'Management maturity (overall)', value: avg }];
  }
  return Object.entries(groups).filter(([, vals]) => vals.length).map(([k, vals]) => ({
    label: MATURITY_DOMAIN_LABELS[k] || k,
    value: vals.reduce((a, b) => a + b, 0) / vals.length,
  }));
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
  const kpis = [
    { value: D.maxSev ? String(D.maxSev) + '/5' : '—', label: 'Highest credible harm', note: D.highestHarm, tone: D.maxSev >= 5 ? 'bad' : D.maxSev >= 4 ? 'warn' : undefined },
    { value: String(D.fatal), label: 'Fatal-potential risks', tone: D.fatal ? 'bad' : 'ok' },
    { value: String(D.fatalUncontrolled), label: 'Uncontrolled fatal-potential', tone: D.fatalUncontrolled ? 'bad' : 'ok' },
    { value: String(D.highPlus), label: 'High or above (after controls)', tone: D.highPlus ? 'warn' : 'ok' },
    { value: String(D.overdue), label: 'Actions overdue', tone: D.overdue ? 'warn' : 'ok' },
    { value: D.completeness + '%', label: 'Profile completeness', tone: D.completeness < 60 ? 'warn' : undefined },
  ];

  const decisions = [];
  if (D.fatalUncontrolled) decisions.push({ text: 'Direct that the ' + countPhrase(D.fatalUncontrolled, 'uncontrolled fatal-potential risk', 'uncontrolled fatal-potential risks') + ' receive recorded controls this quarter.', rationale: 'Fatal-potential exposure with no recorded controls is the first thing an inspector or prosecutor will ask about.' });
  if (D.overdue) decisions.push({ text: 'Reset owners and dates on the ' + countPhrase(D.overdue, 'overdue action', 'overdue actions') + '.', rationale: 'Overdue actions with no intervention become evidence of a plan the organisation does not follow.' });
  if (D.maturityAvg != null && D.maturityAvg < 3) decisions.push({ text: 'Fund the management-system improvements needed to lift maturity from ' + D.maturityAvg.toFixed(1) + ' toward 3.0.', rationale: 'The risk profile currently outweighs the management system carrying it.' });
  if (!decisions.length) decisions.push({ text: D.empty ? 'Commission completion of the risk profile before the next board cycle.' : 'Note the position and maintain the current programme.', rationale: D.empty ? 'No decision can be soundly made from an incomplete profile.' : 'No exception requires a board decision this period.' });

  const expBars = {
    type: 'distributionBars', title: 'Risk vs management — on the same scale',
    items: [
      { label: 'Risk score (avg of 25)', n: D.meanScore != null ? Math.round(D.meanScore) : 0, colour: D.profileTier ? TIER_COLOURS[D.profileTier] : undefined },
      { label: 'Management (score × 5)', n: D.maturityAvg != null ? Math.round(D.maturityAvg * 5) : 0 },
    ],
  };
  const verdictLine = D.empty
    ? 'No verdict — the profile is not yet rated.'
    : (D.meanScore != null && D.maturityAvg != null)
      ? ('Risk: ' + D.meanScore.toFixed(1) + ' of 25. Management: ' + D.maturityAvg.toFixed(1) + ' of 5' + (D.maturityAvg < 3 && D.highPlus ? ' — the risk currently outweighs the management carrying it.' : ' — broadly matched.'))
      : 'Management maturity not yet scored — the risk side of this comparison stands alone.';

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
      { type: 'titleBlock', kicker: 'HSG65 review pack · reactive & active monitoring',
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
        [ 'Management maturity (of 5)', b.maturity == null ? '—' : Number(b.maturity).toFixed(1), D.maturityAvg == null ? '—' : D.maturityAvg.toFixed(1), (b.maturity != null && D.maturityAvg != null) ? (D.maturityAvg > b.maturity ? 'up ' + (D.maturityAvg - b.maturity).toFixed(1) : D.maturityAvg < b.maturity ? 'down ' + (b.maturity - D.maturityAvg).toFixed(1) : 'no change') : '—' ],
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
    { header: 'Score — was → now (of 25)', w: '30%' },
    { header: 'Band', w: '12%' },
    { header: 'Controls', w: '12%' },
    { header: 'Owner', w: '12%' },
  ];
  const rowFor = r => ([
    r.name + (r.fatal ? '  ⚑' : ''),
    { html: dualBar({ inherent: r.inherent, residual: r.residual, tier: r.tier }) },
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
        ? { type: 'dataTable', cols: regCols, rows: slice.map(rowFor), footnote: i === slices.length - 1 ? 'Controls reduce likelihood, not severity — a fatal-potential risk stays fatal-potential however well controlled. ⚑ fatal potential.' : undefined }
        : { type: 'textBlock', body: 'Nothing in the profile currently carries a worst-case severity of major injury or above. Confirm this reflects the work actually done, not gaps in the profile.' },
    ],
  }));

  // ── Page 3: Interpretation ──
  const zeros = [];
  zeros.push(noneOrCount(D.noOwner, 'open action has no named owner', 'open actions have no named owner') + '.');
  zeros.push(noneOrCount(D.noDate, 'open action has no target date', 'open actions have no target date') + '.');
  zeros.push(noneOrCount(D.unrated, 'recorded risk is not yet rated', 'recorded risks are not yet rated') + '.');

  const page3 = {
    label: 'Interpretation', blocks: [
      mast,
      { type: 'titleBlock', kicker: 'Interpretation', headline: 'Where the risk sits and how it is held' },
      { type: 'matrix5x5', counts: D.matrix, caption: 'Where every rated risk sits now, with controls in place (likelihood × severity).' },
      { type: 'distributionBars', title: 'Risks by band (after controls)', items: ['Critical', 'High', 'Medium', 'Low'].map(t => ({ label: t, n: D.byTier[t], colour: TIER_COLOURS[t] })) },
      { type: 'hierarchyStrip', title: 'Hierarchy of control', items: D.hierarchy, total: D.hierTotal, protectDown: D.protectDown },
      { type: 'textBlock', title: 'Exceptions', body: zeros.join(' ') },
      { type: 'textBlock', title: 'Consultant commentary', body: (opts.meta && opts.meta.commentary) || 'Reserved for the consultant’s reading of this period.', cls: 'r-commentary' },
    ],
  };

  // ── Page 4: Exposure & maturity, duty, sign-off ──
  const matRows = maturityRows(state);
  const page4 = {
    label: 'Exposure & maturity', blocks: [
      mast,
      { type: 'statementPanel', title: 'Directors’ duty', cite: 'Health and Safety at Work etc. Act 1974, s.37', body: 'Where an offence by the company is proved to have been committed with the consent, connivance or neglect of a director, manager or similar officer, that individual — as well as the company — is liable to prosecution. This report exists so the board can show it directed and reviewed the management of these risks.' },
      { type: 'tagList', title: 'Duties engaged by the profile', tags: D.duties },
      matRows.length
        ? { type: 'stepScale', title: 'Management maturity (HSG65 scale, 0–5)', rows: matRows, flagAt: 1.5 }
        : { type: 'textBlock', title: 'Management maturity', body: 'Not yet scored. Score the six maturity domains in the risk review to complete this picture.' },
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
