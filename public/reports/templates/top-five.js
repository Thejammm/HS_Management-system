// Top 5 risks to deal with (Simon, 2026-10-01): the SLT asked him for "the
// top five risks that need to be dealt with". The five are the ones chosen
// for the month - ticked on the cockpit's risk ladder or the execution plan's
// Top 5, one choosing mechanism. If fewer than five are chosen the list is
// topped up from the system's own ranking (needs attention first, then the
// next worst - the cockpit's "Highest-rated risks"), and every risk says
// which it is. A front page lists the five; each risk then has a page of its
// own: where it stands, why it is on the list, the controls, what will be
// done by whom and when, and what the SLT is asked to do.
import { deriveBoard, bandsFrom, tierFor, residualOf, targetOf, producerOf, countPhrase } from '../derive.js';
import { holdWorstFirst, riskRefOf, controlsListOf, sifOf, sifWordOf, top5MonthOf, docFor } from '../app-contract.js';
import { esc } from '../blocks.js';

// Which five, and what each one needs - one reading, shared by the report and
// the app's fillable response form (the app keeps a port, _top5Five /
// _top5Asks; test/ui/top5-response.test.mjs holds the two together).
export function topFiveOf(state, opts = {}) {
  const s = state || {};
  const D = opts._D || deriveBoard(s, opts);
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const month = top5MonthOf(today);
  // ── Which five ──
  const bands = bandsFrom(s);
  const risks = Array.isArray(s.riskProfile) ? s.riskProfile : [];
  const byId = {}; risks.forEach(r => { if (r) byId[r.id] = r; });
  const H = D.holdS;
  const chosenIds = new Set();
  risks.forEach(r => { if (r && (r.actions || []).some(a => a && !a.deleted && a.top5 === month)) chosenIds.add(r.id); });
  const chosen = H.rows.filter(z => chosenIds.has(z.id)).sort(holdWorstFirst).slice(0, 5);
  const ranked = H.breaches.concat(H.nextWorst).filter(z => !chosenIds.has(z.id));
  const five = chosen.map(z => ({ z, chosen: true })).concat(ranked.slice(0, 5 - chosen.length).map(z => ({ z, chosen: false })));

  // ── What each one needs ──
  const isOpen = a => a && !a.deleted && !a.hideFromPlan && String(a.desc || '').trim() && a.status !== 'Complete' && a.status !== 'Accepted';
  const late = a => !!(a.due && a.due < today);
  const X = five.map((f, i) => {
    const r = byId[f.z.id] || {};
    const now = residualOf(r), tgt = targetOf(r);
    const open = (r.actions || []).filter(isOpen)
      .sort((a, b) => (late(b) - late(a)) || String(a.due || '9999').localeCompare(String(b.due || '9999')));
    const next = open.find(a => a.top5 === month) || open[0] || null;
    const hold = f.z.hold || { level: 1, label: 'Uncontrolled', reasons: [] };
    const why = f.z.breach
      ? (f.z.breach.charAt(0).toUpperCase() + f.z.breach.slice(1) + ((hold.reasons || []).length ? (' - ' + hold.reasons.join('; ')) : '') + '.')
      : (hold.label + ((hold.reasons || []).length ? (' - ' + hold.reasons.join('; ')) : '') + '.');
    const asks = [];
    if (!open.length) asks.push('Agree what will be done - nothing is planned on this risk yet.');
    else {
      const unowned = open.filter(a => !String(a.owner || '').trim()).length, undated = open.filter(a => !a.due).length, over = open.filter(late).length;
      if (unowned) asks.push('Name an owner for ' + (unowned === 1 ? 'the action that has none.' : ('the ' + unowned + ' actions that have none.')));
      if (over) asks.push('Re-date or resource the ' + countPhrase(over, 'overdue action', 'overdue actions') + '.');
      if (undated) asks.push('Put a date on ' + (undated === 1 ? 'the action that has none.' : ('the ' + undated + ' actions that have none.')));
    }
    if (!tgt && now) asks.push('Agree the residual target this risk is being brought down to.');
    if (!asks.length) asks.push('Note the progress, and confirm the time and money to finish the plan.');
    return { i, chosen: f.chosen, r, ref: riskRefOf(r), name: f.z.name, now, tgt,
      nowTier: now ? tierFor(now.score, bands) : null, tgtTier: tgt ? tierFor(tgt.score, bands) : null,
      hold, breach: f.z.breach, why, open, next, overdue: open.filter(late).length, controls: controlsListOf(r), sif: sifOf(r), sifWord: sifWordOf(r), asks: asks.slice(0, 3) };
  });
  return { X, month, late };
}

export function buildTopFive(state, opts = {}) {
  const s = state || {};
  const D = deriveBoard(s, opts);
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const cut = (t, n) => { t = String(t == null ? '' : t); return t.length > n ? (t.slice(0, n - 1) + '…') : t; };
  const co = D.company || {};
  const org = (opts.tenant && opts.tenant.name) || co.tradingName || co.legalName || 'Client';
  const format = opts.format || 'signal';
  const period = opts.period || new Date(today + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const month = top5MonthOf(today);
  const mLabel = new Date(month + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const dc = docFor(s, 'topFive', { clientName: (opts.tenant && opts.tenant.name) || '', today: opts.today });
  const ref = (opts.meta && opts.meta.ref) || (dc.omit ? '' : dc.ref);
  const mast = { type: 'masthead', org, refCode: ref, issued: dc.omit ? fmtD(today) : fmtD(dc.issued), review: dc.omit ? '' : fmtD(dc.nextReview) };

  const T = topFiveOf(s, Object.assign({}, opts, { _D: D }));
  const X = T.X, late = T.late;

  // ── Front page ──
  const nChosen = X.filter(x => x.chosen).length;
  const standfirst = !X.length ? 'Add the risks to the profile and rate them; this report names the five to deal with first.'
    : nChosen === X.length ? ('The ' + (X.length === 5 ? 'five' : X.length) + ' chosen as the priorities for ' + mLabel + ', worst first.')
    : nChosen ? (nChosen + ' chosen as the priorities for ' + mLabel + ', topped up to ' + X.length + ' from the system’s own ranking - needs attention first, then the next worst.')
    : ('None has been chosen for ' + mLabel + ' yet, so these are the ' + (X.length === 5 ? 'five' : X.length) + ' the system ranks worst - needs attention first, then the next worst. Tick them on the cockpit’s risk ladder to make them the agreed list.');
  const bandCell = x => (x.now ? (x.nowTier + ' ' + x.now.score) : 'Not rated') + (x.tgt ? (' → ' + x.tgtTier + ' ' + x.tgt.score) : ' → no target');
  const nextCell = x => x.next
    ? { text: cut(x.next.desc, 70) + ' - ' + (x.next.owner || 'no owner') + ', ' + (x.next.due ? fmtD(x.next.due) : 'no date'), color: late(x.next) ? [197, 32, 32] : undefined }
    : { text: 'Nothing planned', color: [180, 110, 10], bold: true };
  const riskCell = x => ({ html: (x.ref ? ('<b>' + esc(x.ref) + '</b> ') : '') + esc(cut(x.name, 80))
    + '<br><span style="font-size:8.5px;opacity:.75;">' + (x.chosen ? ('chosen for ' + esc(mLabel)) : 'system ranking') + '</span>' });
  const openN = X.reduce((n, x) => n + x.open.length, 0), overN = X.reduce((n, x) => n + x.overdue, 0);
  const uncN = X.filter(x => x.hold.k === 'notheld').length, sifN = X.filter(x => x.sif).length;
  const front = { label: 'Top 5 risks', cover: format === 'signal', blocks: [
    { type: 'coverBlock', org, title: 'Top 5 Risks', period, refCode: ref, issued: fmtD(today) },
    { type: 'titleBlock', kicker: 'The risks to deal with first · ' + period,
      headline: X.length ? ('The ' + (X.length === 5 ? 'five' : X.length) + ' risk' + (X.length !== 1 ? 's' : '') + ' to deal with first.') : 'No risks are recorded yet.', standfirst },
    ...(X.length ? [
      { type: 'kpiStrip', tiles: [
        { value: String(uncN), label: 'Uncontrolled', tone: uncN ? 'bad' : 'ok' },
        { value: String(sifN), label: 'Could kill or seriously injure', tone: sifN ? 'bad' : 'ok' },
        { value: String(openN), label: 'Actions open on them' },
        { value: String(overN), label: 'Of those, overdue', tone: overN ? 'warn' : 'ok' } ] },
      { type: 'dataTable', title: 'The list',
        cols: [ { header: 'No.', w: '6%' }, { header: 'Risk', w: '30%' }, { header: 'Now → target', w: '17%' }, { header: 'Why it is on the list', w: '25%' }, { header: 'Next action', w: '22%' } ],
        rows: X.map(x => [ String(x.i + 1), riskCell(x), bandCell(x), cut(x.why, 120), nextCell(x) ]),
        footnote: 'Scores are likelihood × severity out of 25, with the controls in place now; the target is where the plan brings it. Each risk has a page of its own after this one.' },
    ] : []),
    { type: 'textBlock', body: (dc.omit ? '' : ('Version ' + dc.version + ' · ref ' + dc.ref + ' · ')) + 'generated from the live profile on ' + fmtD(today) + '.', cls: 'r-stamp' },
  ] };

  // ── A page per risk ──
  const pages = X.map(x => {
    const r = x.r;
    const tierTone = t => (t === 'Critical' || t === 'High') ? 'bad' : (t === 'Medium' ? 'warn' : (t ? 'ok' : 'muted'));
    return { label: (x.i + 1) + '. ' + cut(x.name, 60), blocks: [ mast,
      { type: 'titleBlock', kicker: 'Risk ' + (x.i + 1) + ' of ' + X.length + (x.ref ? (' · ' + x.ref) : '') + ' · ' + (x.chosen ? ('chosen for ' + mLabel) : 'system ranking') + (x.sif ? (' · ' + x.sifWord) : ''),
        headline: cut(x.name, 90), standfirst: r.assocRisk ? cut('What could happen: ' + r.assocRisk, 240) : undefined },
      { type: 'kpiStrip', tiles: [
        { value: x.now ? String(x.now.score) : '-', label: 'Score now', note: x.nowTier || 'not rated', tone: tierTone(x.nowTier) },
        { value: x.tgt ? String(x.tgt.score) : '-', label: 'Residual target', note: x.tgtTier || 'not set', tone: x.tgt ? tierTone(x.tgtTier) : 'warn' },
        { value: (x.hold.level || 1) + '/4', label: 'H&S control maturity', note: x.hold.label, tone: x.breach ? 'bad' : undefined },
        { value: String(x.open.length), label: 'Actions open', note: x.overdue ? (x.overdue + ' overdue') : 'none overdue', tone: x.overdue ? 'warn' : undefined } ] },
      { type: 'textBlock', title: 'Why it is on the list', body: x.why },
      x.controls.length
        ? { type: 'dataTable', title: 'Controls in place', cols: [ { header: 'Control', w: '100%' } ], rows: x.controls.slice(0, 6).map(c => [ cut(c, 160) ]),
            footnote: x.controls.length > 6 ? ('6 of ' + x.controls.length + ' - the full list is on the risk in Compass.') : undefined }
        : { type: 'textBlock', title: 'Controls in place', body: 'No controls are recorded on this risk yet.' },
      x.open.length
        ? { type: 'dataTable', title: 'What will be done',
            cols: [ { header: 'Action', w: '50%' }, { header: 'Who', w: '18%' }, { header: 'By when', w: '16%' }, { header: 'Status', w: '16%' } ],
            rows: x.open.slice(0, 6).map(a => [ (a.top5 === month ? '★ ' : '') + cut(a.desc, 110),
              String(a.owner || '').trim() ? cut(a.owner, 30) : { text: 'no owner', color: [180, 110, 10] },
              a.due ? { text: fmtD(a.due), bold: true, color: late(a) ? [197, 32, 32] : [55, 55, 55] } : { text: 'no date', color: [180, 110, 10] },
              late(a) ? { text: 'Overdue', bold: true, color: [197, 32, 32] } : (a.status || 'Not started') ]),
            footnote: (x.open.some(a => a.top5 === month) ? ('★ this month’s Top 5 action. ') : '') + (x.open.length > 6 ? ('The 6 most pressing of ' + x.open.length + '.') : '') || undefined }
        : { type: 'textBlock', title: 'What will be done', body: 'Nothing is planned on this risk yet.' },
      { type: 'decisionsPanel', title: 'Asked of the SLT', items: x.asks.map(t => ({ text: t })) },
      { type: 'notesLines', title: 'SLT comments', lines: 3 },
    ] };
  });

  return {
    meta: { title: 'Top 5 Risks', org, ref, producer: producerOf(s), format, period },
    pages: [ front ].concat(pages),
  };
}
