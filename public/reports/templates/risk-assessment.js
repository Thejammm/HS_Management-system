// Risk assessment report - the full register through the shared engine.
// Proves the engine is template-agnostic: no engine changes were needed.
import { deriveBoard, countPhrase, TIER_COLOURS } from '../derive.js';
import { tierWord, dualBar } from '../blocks.js';
import { paginateRows } from '../engine.js';
import { residualOf, inherentOf, tierFor, bandsFrom } from '../derive.js';

export function buildRiskAssessment(state, opts = {}) {
  const D = deriveBoard(state, opts);
  const bands = bandsFrom(state);
  const co = D.company;
  const org = (opts.tenant && opts.tenant.name) || co.tradingName || co.legalName || 'Client';
  const today = (opts.today ? new Date(opts.today) : new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const ref = ((opts.meta && opts.meta.ref) || ('RA-' + new Date().toISOString().slice(0, 7)));
  const format = opts.format || 'signal';
  const mast = { type: 'masthead', org, refCode: ref, issued: today };

  const rows = (Array.isArray(state.riskProfile) ? state.riskProfile : []).map(r => {
    const res = residualOf(r), inh = inherentOf(r);
    return {
      name: String(r.activity || r.hazard || 'Unnamed risk'),
      hazard: String(r.hazard || ''),
      inherent: inh, residual: res,
      tier: res ? tierFor(res.score, bands) : null,
      controls: String(r.controls || '').slice(0, 140),
    };
  }).sort((a, b) => ((b.residual && b.residual.score) || 0) - ((a.residual && a.residual.score) || 0));

  const cols = [
    { header: 'Activity', w: '22%' },
    { header: 'Hazard', w: '18%' },
    { header: 'Score - was → now (of 25)', w: '22%' },
    { header: 'Band', w: '10%' },
    { header: 'Controls', w: '28%' },
  ];
  const rowFor = r => ([
    r.name, r.hazard,
    { html: dualBar({ inherent: r.inherent, residual: r.residual, tier: r.tier }) },
    { html: tierWord(r.tier) },
    r.controls,
  ]);

  const slices = paginateRows(rows, 12, 15);
  const pages = [
    {
      label: 'Summary', cover: format === 'signal', blocks: [
        { type: 'coverBlock', org, title: 'Risk Assessment', period: opts.period || '', refCode: ref, issued: today },
        { type: 'titleBlock', kicker: 'Organisation risk assessment', headline: D.empty ? 'The profile is not yet rated.' : countPhrase(D.rated, 'significant risk', 'significant risks') + ' assessed and controlled', standfirst: D.standfirst },
        { type: 'kpiStrip', tiles: [
          { value: String(D.rated), label: 'Risks rated' },
          { value: String(D.byTier.Critical), label: 'Critical', tone: D.byTier.Critical ? 'bad' : 'ok' },
          { value: String(D.byTier.High), label: 'High', tone: D.byTier.High ? 'warn' : 'ok' },
          { value: String(D.fatal), label: 'Could kill or seriously injure', tone: D.fatal ? 'bad' : 'ok' },
          { value: D.completeness + '%', label: 'Assessment complete' },
        ] },
        { type: 'matrix5x5', counts: D.matrix, bands: D.bands, caption: 'Where each risk sits now, with controls in place (likelihood × severity). Each square is coloured by its risk band: red Critical, orange High, amber Medium, green Low.' },
      ],
    },
    ...slices.map((slice, i) => ({
      label: 'Register' + (slices.length > 1 ? ' ' + (i + 1) : ''),
      blocks: [
        mast,
        { type: 'titleBlock', kicker: 'Register · part ' + (i + 1) + ' of ' + slices.length, headline: i === 0 ? 'The register' : 'Register, continued' },
        rows.length
          ? { type: 'dataTable', cols, rows: slice.map(rowFor), footnote: i === slices.length - 1 ? 'Assessed under MHSWR 1999 reg 3. Controls reduce likelihood, not severity.' : undefined }
          : { type: 'textBlock', body: 'No risks recorded yet.' },
      ],
    })),
  ];

  return { meta: { title: 'Risk Assessment', org, ref, format }, pages };
}
