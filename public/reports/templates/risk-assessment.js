// Risk assessment report - the full register through the shared engine.
// Proves the engine is template-agnostic: no engine changes were needed.
import { deriveBoard, countPhrase, TIER_COLOURS, docFor } from '../derive.js';
import { tierWord, dualBar } from '../blocks.js';
import { packRows } from '../engine.js';
import { residualOf, targetOf, tierFor, bandsFrom, producerOf } from '../derive.js';
import { controlsTextOf, riskRefOf } from '../app-contract.js';

export function buildRiskAssessment(state, opts = {}) {
  const D = deriveBoard(state, opts);
  const bands = bandsFrom(state);
  const co = D.company;
  const org = (opts.tenant && opts.tenant.name) || co.tradingName || co.legalName || 'Client';
  const today = (opts.today ? new Date(opts.today) : new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const format = opts.format || 'signal';
  // Document control from the app's register (the Risk Profile row).
  const dc = docFor(state, 'riskProfile', { clientName: (opts.tenant && opts.tenant.name) || '', today: opts.today });
  const fmtDC = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const ref = ((opts.meta && opts.meta.ref) || (dc.omit ? '' : dc.ref));
  const mast = { type: 'masthead', org, refCode: ref, issued: dc.omit ? today : fmtDC(dc.issued), review: dc.omit ? '' : fmtDC(dc.nextReview) };

  const rows = (Array.isArray(state.riskProfile) ? state.riskProfile : []).map(r => {
    const res = residualOf(r), tgt = targetOf(r);
    return {
      ref: riskRefOf(r),
      name: String(r.activity || r.hazard || 'Unnamed risk'),
      assoc: String(r.assocRisk || ''),
      residual: res, projected: tgt,
      tier: res ? tierFor(res.score, bands) : null,
      controls: controlsTextOf(r).slice(0, 140),
    };
  }).sort((a, b) => ((b.residual && b.residual.score) || 0) - ((a.residual && a.residual.score) || 0));

  const cols = [
    { header: 'Ref', w: '7%' },
    { header: 'Risk title', w: '20%' },
    { header: 'Associated risk', w: '16%' },
    { header: 'Score - now → after controls (of 25)', w: '21%' },
    { header: 'Band', w: '10%' },
    { header: 'Controls', w: '26%' },
  ];
  const rowFor = r => ([
    r.ref, r.name, r.assoc,
    { html: dualBar({ residual: r.residual, projected: r.projected, tier: r.tier }) },
    { html: tierWord(r.tier) },
    r.controls,
  ]);

  // Packed by estimated height, not a row count: a worked client's rows are
  // twice the height of a fixture's, and twelve of them ran 109px past the
  // page edge. Caught by the 'worked' fixture added 2026-09-28.
  const ln = (t, per) => Math.max(1, Math.ceil(String(t || '').length / per));
  // the Ref column narrowed the rest, so a line holds fewer characters now
  const rowWeight = (r) => 9 + Math.max(2, ln(r.name, 27), ln(r.assoc, 22), ln(r.controls, 35)) * 14;
  const slices = packRows(rows, rowWeight, 620, 840);
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
          { value: D.complete.clear + ' / ' + D.complete.total, label: 'Assessment checks clear' },
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
        ...(i === slices.length - 1 && !dc.omit ? [{ type: 'textBlock', cls: 'r-stamp',
          body: 'Version ' + dc.version + ' · ref ' + dc.ref
            + (dc.author ? (' · prepared by ' + dc.author) : '')
            + (dc.approverName ? (' · approved by ' + dc.approverName + (dc.approverRole ? (', ' + dc.approverRole) : '')) : '')
            + ' · issued ' + fmtDC(dc.issued)
            + (dc.nextReview ? (' · next review ' + fmtDC(dc.nextReview)) : '') + '.' }] : []),
      ],
    })),
  ];

  return { meta: { title: 'Risk Assessment', org, ref, producer: producerOf(state), format }, pages };
}
