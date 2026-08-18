// Report registry — the contract the format picker reads. One entry per
// report type; each format is a skin over the same content (the DoD rule:
// switching format changes the skin, not the content).
//
// The consultant's per-tenant choice persists in the state blob under
// state.reportPrefs[reportId].format via the existing /api/state save path —
// use getReportFormat/setReportFormat, no new storage.
import { buildBoardReport } from './board-report.js';
import { buildRiskAssessment } from './risk-assessment.js';

export const REPORTS = {
  'board-report': {
    id: 'board-report',
    title: 'Health & Safety Board Report',
    formats: [
      { id: 'signal', title: 'Signal — data-forward, 4 pages', default: true },
      { id: 'brief',  title: 'Brief — editorial board paper, 4 pages' },
    ],
    build: (state, opts) => buildBoardReport(state, opts),
  },
  'risk-assessment': {
    id: 'risk-assessment',
    title: 'Risk Assessment',
    formats: [
      { id: 'signal', title: 'Signal — data-forward', default: true },
      { id: 'brief',  title: 'Brief — editorial' },
    ],
    build: (state, opts) => buildRiskAssessment(state, opts),
  },
  // audit and action-plan port next — add entries here; the engine needs no changes.
};

export function defaultFormat(reportId) {
  const r = REPORTS[reportId];
  if (!r) return 'signal';
  const d = r.formats.find(f => f.default) || r.formats[0];
  return d ? d.id : 'signal';
}

export function getReportFormat(state, reportId) {
  const p = state && state.reportPrefs && state.reportPrefs[reportId];
  const r = REPORTS[reportId];
  if (p && p.format && r && r.formats.some(f => f.id === p.format)) return p.format;
  return defaultFormat(reportId);
}

// Mutates the state blob (caller saves via the app's normal save path).
export function setReportFormat(state, reportId, format) {
  if (!state.reportPrefs || typeof state.reportPrefs !== 'object') state.reportPrefs = {};
  state.reportPrefs[reportId] = Object.assign({}, state.reportPrefs[reportId], { format });
  return state;
}

export function buildReport(state, reportId, opts = {}) {
  const r = REPORTS[reportId];
  if (!r) throw new Error('Unknown report: ' + reportId);
  const format = opts.format || getReportFormat(state, reportId);
  return r.build(state, Object.assign({}, opts, { format }));
}
