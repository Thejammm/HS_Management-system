// Board report template — Signal (data-forward) and Brief (editorial) formats.
// Both build the SAME content; format changes the skin class only.
import { deriveBoard, noneOrCount, countPhrase, hasHave, TIER_COLOURS } from '../derive.js';
import { esc, tierWord, dualBar } from '../blocks.js';
import { paginateRows } from '../engine.js';

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
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const ref = ((opts.meta && opts.meta.ref) || ('BR-' + new Date().toISOString().slice(0, 7)));
  const format = opts.format || 'signal';

  const mast = { type: 'masthead', org, refCode: ref, issued: today, review: (opts.meta && opts.meta.review) || '' };

  // ── Page 1: Position ──
  const kpis = [
    { value: D.maxSev ? String(D.maxSev) + '/5' : '—', label: 'Highest credible harm', note: D.highestHarm, tone: D.maxSev >= 5 ? 'bad' : D.maxSev >= 4 ? 'warn' : undefined },
    { value: String(D.fatal), label: 'Fatal-potential risks', tone: D.fatal ? 'bad' : 'ok' },
    { value: String(D.fatalUncontrolled), label: 'Uncontrolled fatal-potential', tone: D.fatalUncontrolled ? 'bad' : 'ok' },
    { value: String(D.highPlus), label: 'High or above (residual)', tone: D.highPlus ? 'warn' : 'ok' },
    { value: String(D.overdue), label: 'Actions overdue', tone: D.overdue ? 'warn' : 'ok' },
    { value: D.completeness + '%', label: 'Profile completeness', tone: D.completeness < 60 ? 'warn' : undefined },
  ];

  const decisions = [];
  if (D.fatalUncontrolled) decisions.push({ text: 'Direct that the ' + countPhrase(D.fatalUncontrolled, 'uncontrolled fatal-potential risk', 'uncontrolled fatal-potential risks') + ' receive recorded controls this quarter.', rationale: 'Fatal-potential exposure with no recorded controls is the first thing an inspector or prosecutor will ask about.' });
  if (D.overdue) decisions.push({ text: 'Reset owners and dates on the ' + countPhrase(D.overdue, 'overdue action', 'overdue actions') + '.', rationale: 'Overdue actions with no intervention become evidence of a plan the organisation does not follow.' });
  if (D.maturityAvg != null && D.maturityAvg < 3) decisions.push({ text: 'Fund the management-system improvements needed to lift maturity from ' + D.maturityAvg.toFixed(1) + ' toward 3.0.', rationale: 'The risk profile currently outweighs the management system carrying it.' });
  if (!decisions.length) decisions.push({ text: D.empty ? 'Commission completion of the risk profile before the next board cycle.' : 'Note the position and maintain the current programme.', rationale: D.empty ? 'No decision can be soundly made from an incomplete profile.' : 'No exception requires a board decision this period.' });

  const expBars = {
    type: 'distributionBars', title: 'Exposure vs management maturity',
    items: [
      { label: 'Exposure', n: D.meanScore != null ? Math.round(D.meanScore) : 0, colour: D.profileTier ? TIER_COLOURS[D.profileTier] : undefined },
      { label: 'Maturity ×5', n: D.maturityAvg != null ? Math.round(D.maturityAvg * 5) : 0 },
    ],
  };
  const verdictLine = D.empty
    ? 'No verdict — the profile is not yet rated.'
    : (D.meanScore != null && D.maturityAvg != null)
      ? ('Mean residual score ' + D.meanScore.toFixed(1) + ' of 25 against maturity ' + D.maturityAvg.toFixed(1) + ' of 5' + (D.maturityAvg < 3 && D.highPlus ? ' — the profile currently outweighs the system managing it.' : ' — broadly matched.'))
      : 'Maturity not yet scored — the exposure side of this comparison stands alone.';

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

  // ── Page 2+: Register (spills beyond ~16 rows) ──
  const regCols = [
    { header: 'Activity / risk', w: '34%' },
    { header: 'Inherent → residual', w: '30%' },
    { header: 'Tier', w: '12%' },
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
      { type: 'matrix5x5', counts: D.matrix, caption: 'Residual position of every rated risk (likelihood × severity).' },
      { type: 'distributionBars', title: 'Risks by tier (residual)', items: ['Critical', 'High', 'Medium', 'Low'].map(t => ({ label: t, n: D.byTier[t], colour: TIER_COLOURS[t] })) },
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

  return {
    meta: { title: 'Health & Safety Board Report', org, ref, format, period },
    pages: [page1, ...registerPages, page3, page4],
  };
}
