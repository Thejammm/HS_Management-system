// ══════════════════════════════════════════════════════════════
// HEALTH & SAFETY MANAGEMENT PLAN - the one document that carries the whole
// journey: what this business faces, what was done about it, how far that got
// it, and how it is kept that way. Laid out in the clause order an auditor
// reads in, so it can be handed over and followed without explanation.
//
//   1 Context      what the business does and what it carries
//   2 Leadership   who is answerable, and for what
//   3 Planning     what we found
//   4 Operation    how each risk is managed  ← the heart of it
//   5 Support      competence, communication, documents
//   6 Checking     the routines, the inspections, the reviews
//   7 Improvement  the plan from here
//   8 Declaration  document control and sign-off
//
// Nothing here is typed for the report: every line is the app's own record,
// through the shared contract, so the plan and the screens can never disagree.
// ══════════════════════════════════════════════════════════════
import { countPhrase, noneOrCount, docFor, producerOf, TIER_COLOURS } from '../derive.js';
import { tierWord } from '../blocks.js';
import { packRows } from '../engine.js';
import { deriveManagementPlan, fmtD } from '../plan-derive.js';

// Section 4 packs by estimated card height, not by a row count: a fully
// worked risk is three times the height of a bare one. The budget is what is
// left of the page after that page's other blocks (the first also carries the
// section title and the intro line). Proved by the overflow check.
const PAGE_FIRST = 820;    // measured: 846px left on the first section-4 page
const PAGE_CONT = 870;     // and 886px on a continuation
const PAGE_TAIL = 100;     // the last one also carries the closing line and the footnote

export function buildManagementPlan(state, opts = {}) {
  const P = deriveManagementPlan(state, opts);
  const D = P.D;
  const co = P.company;
  const org = (opts.tenant && opts.tenant.name) || co.tradingName || co.legalName || 'Client';
  const format = opts.format || 'signal';
  const today = (opts.today ? new Date(opts.today + 'T12:00:00') : new Date())
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const dc = docFor(state, 'managementPlan', { clientName: (opts.tenant && opts.tenant.name) || '', today: opts.today });
  const ref = ((opts.meta && opts.meta.ref) || (dc.omit ? '' : dc.ref));
  const mast = { type: 'masthead', org, refCode: ref, issued: dc.omit ? today : fmtD(dc.issued), review: dc.omit ? '' : fmtD(dc.nextReview) };
  const sec = (n, title) => ({ type: 'titleBlock', kicker: 'Section ' + n, headline: title });
  const none = (t) => ({ type: 'textBlock', body: t });

  // ── 1 · Context ──────────────────────────────────────────────
  const themeRows = P.themes.map(t => ([
    t.letter,
    t.name,
    String(t.rows.length),
    { html: tierWord(t.worst) },
    t.controlled + ' of ' + t.rows.length,
    t.fatal ? String(t.fatal) : '-',
  ]));
  const page1 = {
    label: 'Context', blocks: [
      mast,
      sec(1, 'What this business does, and what it carries'),
      { type: 'statementPanel', title: 'Scope of this plan',
        body: (P.scope || ('The health and safety arrangements of ' + org + '.'))
          + ' This plan covers every risk on the risk profile, the legal duties assessed against it, the controls in place, and the routines that keep them in place.',
        cite: 'HSWA 1974 s.2 and s.3 · MHSWR 1999 reg 3' },
      { type: 'kpiStrip', tiles: [
        { value: String(P.rows.length), label: 'Risks on the profile' },
        { value: String(P.themes.length), label: 'Risk themes carried' },
        { value: String(D.rated), label: 'Rated' },
        { value: String(D.fatal), label: 'Could kill or seriously injure', tone: D.fatal ? 'bad' : 'ok' },
        { value: P.controlled + ' of ' + P.rows.length, label: 'Controlled as far as reasonably practicable', tone: (P.rows.length && P.controlled === P.rows.length) ? 'ok' : '' },
      ] },
      themeRows.length
        ? { type: 'dataTable', title: 'The risk themes this business carries',
            cols: [{ header: 'Section', w: '9%' }, { header: 'Theme', w: '33%' }, { header: 'Risks', w: '9%' },
                   { header: 'Worst band', w: '15%' }, { header: 'Controlled', w: '18%' }, { header: 'Flagged', w: '16%' }],
            rows: themeRows,
            footnote: 'A theme is a high level category of risk; every action in this plan belongs to one of them, and each has its own lettered section in part 4 - the same letter that starts every risk reference in it. Flagged means the worst credible outcome is death or serious injury - or, for a business risk, damage the business would struggle to recover from.' }
        : none('No risks recorded yet. The risk profile is built first; this plan then reports it.'),
      { type: 'soWhat', text: P.rows.length
        ? (countPhrase(P.themes.length, 'risk theme is', 'risk themes are') + ' carried by this business, and '
           + noneOrCount(D.fatal, 'risk', 'risks', 'no') + ' can still kill or seriously injure someone with the controls that are in place.')
        : 'The risk profile is not yet built, so this plan reports a position that does not exist yet.' },
    ],
  };

  // ── 2 · Leadership ───────────────────────────────────────────
  const pol = P.policy || {};
  const peopleRows = P.people.map(p => ([String(p.name || '-'), String(p.role || '-'), String(p.contact || '-')]));
  const page2 = {
    label: 'Leadership', blocks: [
      mast,
      sec(2, 'Who is answerable, and for what'),
      { type: 'statementPanel', title: 'Health and safety policy',
        body: pol.signedDate
          ? ('The policy is signed and in force, signed ' + fmtD(pol.signedDate) + (pol.signedBy ? (' by ' + pol.signedBy) : '') + '. It states the commitment, the organisation and the arrangements, and is reviewed with this plan.')
          : 'The policy statement is not yet signed. Until it is, the commitment behind these arrangements is not formally on the record.',
        cite: 'HSWA 1974 s.2(3) - a written policy where five or more are employed' },
      peopleRows.length
        ? { type: 'dataTable', title: 'Named responsibilities',
            cols: [{ header: 'Name', w: '34%' }, { header: 'Role', w: '40%' }, { header: 'Contact', w: '26%' }],
            rows: peopleRows,
            footnote: 'Responsibilities recorded against a person. A control with no name against it is nobody\'s job.' }
        : none('No named responsibilities are recorded yet. Every control needs someone answerable for it.'),
      { type: 'kpiStrip', tiles: [
        { value: String(P.people.length), label: 'Named responsibilities' },
        { value: pol.signedDate ? 'Signed' : 'Not signed', label: 'Policy status', tone: pol.signedDate ? 'ok' : 'warn' },
        { value: String(P.sign.staff), label: 'Employees on the sign-off register' },
        { value: String(P.sign.rows.length), label: 'Policies and procedures issued' },
      ] },
    ],
  };

  // ── 3 · Planning ─────────────────────────────────────────────
  const dutyRows = P.duties.sections.map(d => ([
    d.heading, String(d.items), String(d.assessed),
    d.gaps ? { text: String(d.gaps), colour: '#DC2626', bold: true } : '0',
    String(d.compliant),
  ]));
  const page3 = {
    label: 'Planning', blocks: [
      mast,
      sec(3, 'What we found'),
      { type: 'textBlock', body: 'Every risk is rated on likelihood against severity, both as it would be without controls and as it stands with them. The matrix below is where the risks sit now, with the controls in place.' },
      { type: 'matrix5x5', counts: D.matrix, bands: D.bands,
        caption: 'Where each risk sits now, with controls in place (likelihood x severity). Red Critical, orange High, amber Medium, green Low.' },
      { type: 'kpiStrip', tiles: [
        { value: String(D.byTier.Critical), label: 'Critical', tone: D.byTier.Critical ? 'bad' : 'ok' },
        { value: String(D.byTier.High), label: 'High', tone: D.byTier.High ? 'warn' : 'ok' },
        { value: String(D.byTier.Medium), label: 'Medium' },
        { value: String(D.byTier.Low), label: 'Low', tone: 'ok' },
        { value: String(D.unrated), label: 'Not yet rated', tone: D.unrated ? 'warn' : 'ok' },
      ] },
      dutyRows.length
        ? { type: 'dataTable', title: 'Legal duties assessed',
            cols: [{ header: 'Duty area', w: '44%' }, { header: 'Lines', w: '12%' }, { header: 'Assessed', w: '14%' },
                   { header: 'Gaps', w: '14%' }, { header: 'Compliant', w: '16%' }],
            rows: dutyRows,
            footnote: 'Each gap becomes a risk on the profile and an action on the plan - it is not left as a note.' }
        : none('The legal duties assessment has not been started. It is the check that the arrangements meet what the law actually requires.'),
    ],
  };

  // ── 4 · Operation: how each risk is managed ──────────────────
  // Nothing here is trimmed to fit. A management plan is read once and kept, so
  // the detail IS the point (Simon: "dont worry about keeping it short ... it
  // ends up as long as it ends up"). The only caps sit a long way past anything
  // a consultant writes, and exist so one card can never be taller than the
  // page that has to hold it.
  const CAP_CONTROLS = 16, CAP_CONTROL_LEN = 320, CAP_PROOF = 10, CAP_PROOF_LEN = 220;
  const cut = (t, max) => {
    t = String(t || '').trim();
    return t.length <= max ? t : (t.slice(0, max).replace(/\s+\S*$/, '') + '...');
  };
  const keptNote = (r) => {
    if (r.actsDone) return 'The work was delivered, but nothing is recorded that keeps it in place - so today it rests on people remembering.';
    if (r.actsOpen) return r.actsOpen + ' action' + (r.actsOpen !== 1 ? 's are' : ' is') + ' still to be delivered on this risk. Once ' + (r.actsOpen !== 1 ? 'they are' : 'it is') + ' closed out, what keeps it in place is recorded here.';
    return 'Nothing further is planned: the controls above are what holds this risk.';
  };
  // One line per piece of evidence - the things a reader can go and look at.
  const proofList = (r) => {
    const out = [];
    r.evidence.slice(0, CAP_PROOF).forEach(e => out.push(cut(e, CAP_PROOF_LEN)));
    r.policies.forEach(p => out.push('Issued and signed for: ' + cut(p, CAP_PROOF_LEN)));
    if (r.reviewed) out.push('Reviewed and signed off by the consultant');
    if (r.reviewDue) out.push('Next review due ' + fmtD(r.reviewDue) + (r.reviewOverdue ? ' - overdue' : ''));
    if (r.control === 'In place') out.push('Recorded as controlled as far as is reasonably practicable');
    return out.slice(0, CAP_PROOF + 4);
  };
  // The score, in three honest numbers. "As found" is the score before the plan
  // moved it (the app's own first recorded score); where it is the same as now,
  // the risk has not been re-scored yet, and the plan says so rather than
  // drawing a movement that never happened.
  const n = (x) => (x && x.score) ? String(x.score) : '-';
  const atTarget = (r) => !!(r.target && r.residual && r.residual.score <= r.target.score);
  const scoreHtml = (r) => {
    const col = r.tier ? (TIER_COLOURS[r.tier] || '') : '';
    return 'as found <b>' + n(r.inherent) + '</b> &rarr; now <b'
      + (col ? (' style="color:' + col + '"') : '') + '>' + n(r.residual) + '</b>'
      + (r.target ? (atTarget(r) ? ' &rarr; <b>at its planned target</b>' : (' &rarr; target <b>' + n(r.target) + '</b>')) : '');
  };
  // ...and what those numbers mean, for a reader who does not work in this
  // every day. Five outcomes, each a plain sentence.
  const standsSay = (r) => {
    if (!r.residual) return 'This risk has not been scored yet, so there is no position to report.';
    const now = r.residual.score, band = (r.tier || 'unrated').toLowerCase();
    const moved = r.inherent && r.inherent.score > now;
    const lead = moved
      ? ('Left alone this would sit at ' + r.inherent.score + ' out of 25. With the controls below in place it sits at ' + now + ' - ' + band + '.')
      : ('With the controls below in place it sits at ' + now + ' out of 25 - ' + band + '.');
    if (!r.target) return lead + ' No target has been agreed for it yet.';
    if (atTarget(r)) return lead + ' That is the level the plan was written to reach, so this risk is being carried as low as is reasonably practicable.';
    return lead + ' The plan is written to bring it down to ' + r.target.score + '.';
  };
  // One card per risk, laid out as rows. The theme rides on the card, the way
  // it does on the execution plan, so both read in the same order.
  const opCard = (x) => {
    const r = x.r;
    return { theme: x.theme, t: x.t, ref: r.ref, name: r.name, assoc: r.assoc, tier: r.tier,
      sif: r.fatal, sifWord: r.sifWord, scoreHtml: scoreHtml(r), stands: standsSay(r),
      controls: (r.controlsList || []).slice(0, CAP_CONTROLS).map(t => cut(t, CAP_CONTROL_LEN)),
      kept: r.kept.map(l => ({ label: l.label, text: l.text })),
      keptNote: keptNote(r), keptWarn: !!r.actsDone, proof: proofList(r) };
  };
  // How tall a card will be, roughly, in px. Every row is full width behind a
  // 108px label gutter, so one measure serves them all. Calibrated against
  // rendered cards - see test/ui/_cal_plan.mjs.
  const PER = 108;                    // characters per line in the value column
  const LH = 15;                      // one line of 10px/1.5 text
  const lineCount = (t, per) => Math.max(1, Math.ceil(String(t || '').length / (per || PER)));
  const rowH = (lines) => 6 + Math.max(2, lines) * LH;
  const cardWeight = (c) => {
    let h = 29 + 16 + lineCount(c.name, 74) * 17 + 6;
    if (c.band) h += 44;            // the lettered section band above it
    if (c.assoc) h += rowH(lineCount(c.assoc));
    h += rowH(1 + lineCount(c.stands));
    h += rowH(c.controls.length ? c.controls.reduce((t, x) => t + lineCount(x, 100), 0) : 1);
    h += rowH(c.kept.length ? c.kept.reduce((t, k) => t + lineCount(k.text, 92), 0) : lineCount(c.keptNote));
    h += rowH(c.proof.length ? c.proof.reduce((t, x) => t + lineCount(x, 100), 0) : 1);
    return Math.round(h);
  };

  // Flatten theme by theme, worst theme first, so the register reads in the
  // same order as the risk register and the execution plan.
  const flat = [];
  P.themes.forEach(t => t.rows.forEach((r, i) => {
    const c = opCard({ theme: t.name, t: t, r: r });
    if (i === 0) c.band = { letter: t.letter, name: t.name, meta: t.meta };   // the section starts here
    flat.push(c);
  }));
  // Every page may gain a band at the top (either its own or a 'continued'
  // one), so the continuation budget keeps room for one.
  const slices = packRows(flat, cardWeight, PAGE_FIRST, PAGE_CONT - 44);
  // The packer cannot know which page ends up last, and that one also carries
  // the closing line and the footnote - so if the tail no longer fits, the
  // final card moves to a page of its own rather than into the footer.
  const weighs = (sl) => sl.reduce((a, c) => a + cardWeight(c), 0);
  while (slices.length > 1 && slices[slices.length - 1].length > 1
    && weighs(slices[slices.length - 1]) > PAGE_CONT - PAGE_TAIL) {
    slices.push([slices[slices.length - 1].pop()]);
  }
  // A theme that carries over a page break gets its band again at the top of
  // the next page, marked continued, so no page opens on an unheaded card.
  const banded = (slice) => slice.map((c, i) => {
    if (i > 0 || c.band) return c;
    const t = c.t;
    return t ? Object.assign({}, c, { band: { letter: t.letter, name: t.name, meta: t.meta + ' \u00b7 continued' } }) : c;
  });
  const themeTables = (slice, last) => ([{ type: 'planRisk', rows: banded(slice),
    footnote: last ? 'A risk reference is its theme letter and its own number - the number is given once and never reused, so it always means the same risk. "As found" is the score before the plan moved it; where it matches "now", the risk has not been re-scored yet. "Target" is where the plan is written to reach. Scores are likelihood multiplied by severity, each judged from 1 to 5, so 25 is the worst case and 1 the least.' : undefined }]);
  const opPages = P.rows.length ? slices.map((slice, i) => ({
    label: 'Managed' + (slices.length > 1 ? ' ' + (i + 1) : ''),
    blocks: [
      mast,
      i === 0 ? sec(4, 'How each risk is managed') : { type: 'titleBlock', kicker: 'Section 4 · continued', headline: 'How each risk is managed' },
      ...(i === 0 ? [{ type: 'textBlock', body: 'One card per risk, in theme order, worst theme first. Each card runs top to bottom: what could happen, where the risk stands today, everything being done about it, what keeps it that way now the work is done, and what you can go and look at to check. Nothing is shortened - the detail is the point.' }] : []),
      ...themeTables(slice, i === slices.length - 1),
      ...(i === slices.length - 1 ? [{ type: 'soWhat', text: P.heldActs
        ? (P.heldActs + ' of ' + P.closedActs + ' completed action' + (P.closedActs !== 1 ? 's have' : ' has') + ' something recorded that keeps the control in place - a document, a routine, a briefing or a named person.')
        : (P.closedActs
            ? (P.closedActs + ' action' + (P.closedActs !== 1 ? 's have' : ' has') + ' been delivered, but nothing is yet recorded that keeps any of them in place.')
            : 'No actions have been delivered yet, so nothing is yet being held in place by this plan.') }] : []),
    ],
  })) : [{ label: 'Managed', blocks: [mast, sec(4, 'How each risk is managed'),
      none('There are no risks on the profile yet, so there is nothing to manage in this section.')] }];

  // ── 5 · Support ──────────────────────────────────────────────
  const signRows = P.sign.rows.slice(0, 12).map(p => ([
    p.title, p.type, p.version || '-', p.delivered ? fmtD(p.delivered) : '-',
    p.of ? (p.signed + ' of ' + p.of) : '-',
  ]));
  const briefRows = P.briefs.slice(0, 8).map(b => ([b.title, b.date ? fmtD(b.date) : '-', b.presenter || '-', b.of ? (b.signed + ' of ' + b.of) : '-']));
  const page5 = {
    label: 'Support', blocks: [
      mast,
      sec(5, 'Competence, communication and documents'),
      { type: 'kpiStrip', tiles: [
        { value: String(P.docs.length), label: 'Documents on the register' },
        { value: String(P.sign.rows.length), label: 'Policies and procedures issued' },
        { value: String(P.briefs.length), label: 'Briefings delivered' },
        { value: String(P.sign.signedTotal), label: 'Signatures held' },
      ] },
      signRows.length
        ? { type: 'dataTable', title: 'Issued, and signed for',
            cols: [{ header: 'Document', w: '38%' }, { header: 'Type', w: '16%' }, { header: 'Version', w: '12%' },
                   { header: 'Issued', w: '16%' }, { header: 'Signed', w: '18%' }],
            rows: signRows, footnote: P.sign.rows.length > 12 ? ('Showing 12 of ' + P.sign.rows.length + '. The full register is in the app.') : undefined }
        : none('Nothing is on the sign-off register yet. A procedure nobody has signed for is a procedure nobody has been told about.'),
      briefRows.length
        ? { type: 'dataTable', title: 'Briefings delivered',
            cols: [{ header: 'Talk', w: '42%' }, { header: 'Date', w: '16%' }, { header: 'Given by', w: '22%' }, { header: 'Signed', w: '20%' }],
            rows: briefRows }
        : none('No briefings are recorded yet.'),
      { type: 'tagList', title: 'Documents held', tags: P.docs.slice(0, 22).map(d => String(d.name)) },
    ],
  };

  // ── 6 · Checking it works ────────────────────────────────────
  const routineRows = P.routines.slice(0, 14).map(r => ([
    r.item, r.frequency || '-', r.owner || r.area || '-',
    r.last ? fmtD(r.last) : '-',
    r.due ? { text: fmtD(r.due), colour: (r.due < P.today ? '#DC2626' : undefined), bold: r.due < P.today } : '-',
  ]));
  const page6 = {
    label: 'Checking', blocks: [
      mast,
      sec(6, 'How we know it is still working'),
      { type: 'textBlock', body: 'A control that nobody checks is a control that quietly stops. These are the checks this business runs, at the frequency it runs them. Each one puts itself back on the plan when it falls due.' },
      { type: 'kpiStrip', tiles: [
        { value: String(P.routines.length), label: 'Routines on the register' },
        { value: String(P.routines.filter(r => r.due && r.due < P.today).length), label: 'Overdue', tone: P.routines.filter(r => r.due && r.due < P.today).length ? 'bad' : 'ok' },
        { value: P.insp.done + ' of ' + P.insp.planned, label: 'Oversight visits done' },
        { value: String(P.reviewOverdue), label: 'Risk reviews overdue', tone: P.reviewOverdue ? 'warn' : 'ok' },
      ] },
      routineRows.length
        ? { type: 'dataTable', title: 'The checks that keep it in place',
            cols: [{ header: 'What is checked', w: '36%' }, { header: 'How often', w: '16%' }, { header: 'Who', w: '18%' },
                   { header: 'Last done', w: '15%' }, { header: 'Next due', w: '15%' }],
            rows: routineRows,
            footnote: P.routines.length > 14 ? ('Showing 14 of ' + P.routines.length + '. The full register is in the app.') : 'Statutory examinations and the ongoing controls raised when an action was closed out.' }
        : none('No recurring checks are recorded yet. Until there are, nothing in this plan is scheduled to be looked at again.'),
      P.insp.rows.length
        ? { type: 'dataTable', title: 'Oversight visits',
            cols: [{ header: 'Visit', w: '40%' }, { header: 'Planned', w: '20%' }, { header: 'Actual', w: '20%' }, { header: 'Outcome', w: '20%' }],
            rows: P.insp.rows.map(v => ([v.what, v.planned ? fmtD(v.planned) : '-', v.actual ? fmtD(v.actual) : '-', v.outcome || '-'])) }
        : none('No oversight visits are planned yet.'),
    ],
  };

  // ── 7 · Improvement ──────────────────────────────────────────
  const openRows = P.acts.filter(x => x.a.status !== 'Complete' && x.a.status !== 'Accepted')
    .sort((a, b) => String(a.a.due || '9999').localeCompare(String(b.a.due || '9999')))
    .slice(0, 12)                      // 12, not 14: the overflow check caught a long-name page running past the edge
    .map(x => ([
      String(x.a.desc || '(no description)'),
      x.label || x.source,
      String(x.a.owner || '-'),
      x.a.due ? { text: fmtD(x.a.due), colour: (x.a.due < P.today ? '#DC2626' : undefined), bold: x.a.due < P.today } : 'no date',
    ]));
  const page7 = {
    label: 'Improvement', blocks: [
      mast,
      sec(7, 'The plan from here'),
      { type: 'kpiStrip', tiles: [
        { value: String(P.openActs), label: 'Open actions' },
        { value: String(P.overdueActs), label: 'Overdue', tone: P.overdueActs ? 'bad' : 'ok' },
        { value: String(P.closedActs), label: 'Delivered', tone: P.closedActs ? 'ok' : '' },
        { value: P.heldActs + ' of ' + P.closedActs, label: 'Delivered and held', tone: (P.closedActs && P.heldActs === P.closedActs) ? 'ok' : 'warn' },
      ] },
      openRows.length
        ? { type: 'dataTable', title: 'What is still to do',
            cols: [{ header: 'Action', w: '44%' }, { header: 'Where it came from', w: '24%' }, { header: 'Owner', w: '16%' }, { header: 'Target', w: '16%' }],
            rows: openRows,
            footnote: P.openActs > 12 ? ('Showing the 12 soonest of ' + P.openActs + '. The full plan is the client execution plan.') : 'The full plan, with its activity trail, is the client execution plan.' }
        : none('Nothing is outstanding on the plan.'),
      { type: 'statementPanel', title: 'How this plan is kept alive',
        body: 'Each action is owned and dated. When one is completed the evidence is linked to its risk, and what keeps it in place is recorded against it - a document, a routine, a briefing, or a named person. A routine goes on the assurance register and puts itself back on the plan when it falls due, so the control keeps asking for attention rather than relying on memory.' },
    ],
  };

  // ── 8 · Declaration ──────────────────────────────────────────
  const page8 = {
    label: 'Declaration', blocks: [
      mast,
      sec(8, 'Declaration and document control'),
      { type: 'statementPanel', title: 'Declaration',
        body: 'This plan records the health and safety risks ' + org + ' faces, how each has been evaluated, the controls in place, and the arrangements by which those controls are kept in place. It is a live record: it is produced from the management system rather than written separately, and it changes when the system does.',
        cite: 'MHSWR 1999 reg 5 - arrangements for the effective planning, organisation, control, monitoring and review of preventive and protective measures' },
      { type: 'signoffGrid', cells: [
        { label: 'Prepared by', value: dc.author || producerOf(state) || '' },
        { label: 'Date', value: fmtD(dc.issued) },
        { label: 'Approved by (for ' + org + ')', value: dc.approverName || '' },
        { label: 'Position', value: dc.approverRole || '' },
        { label: 'Signature', value: '' },
        { label: 'Date', value: '' },
      ] },
      ...(dc.omit ? [] : [{ type: 'textBlock', cls: 'r-stamp',
        body: 'Version ' + dc.version + ' · ref ' + dc.ref
          + (dc.author ? (' · prepared by ' + dc.author) : '')
          + ' · issued ' + fmtD(dc.issued)
          + (dc.nextReview ? (' · next review ' + fmtD(dc.nextReview)) : '') + '.' }]),
      { type: 'textBlock', body: 'Reviewed at least annually, and whenever the business, its work or its risks change. Uncontrolled when printed.' },
    ],
  };

  const pages = [];
  if (format === 'signal') {
    pages.push({ label: 'Cover', cover: true, blocks: [
      { type: 'coverBlock', org, title: 'Health & Safety Management Plan', period: opts.period || '', refCode: ref, issued: today },
      { type: 'titleBlock', kicker: 'The whole journey, in one document',
        headline: P.empty ? 'The risk profile is not yet built.' : 'What we face, what we did, and how we keep it that way',
        standfirst: P.empty
          ? 'Build the risk profile first: this plan reports it rather than replacing it.'
          : (countPhrase(P.rows.length, 'risk is', 'risks are') + ' assessed across '
             + countPhrase(P.themes.length, 'theme', 'themes') + '. '
             + P.controlled + ' ' + (P.controlled === 1 ? 'is' : 'are') + ' controlled as far as reasonably practicable, '
             + P.closedActs + ' action' + (P.closedActs !== 1 ? 's' : '') + ' delivered, and '
             + P.heldActs + ' of those ' + (P.heldActs === 1 ? 'has' : 'have') + ' a recorded arrangement keeping ' + (P.heldActs === 1 ? 'it' : 'them') + ' in place.') },
    ] });
  }
  pages.push(page1, page2, page3, ...opPages, page5, page6, page7, page8);

  return { meta: { title: 'Health & Safety Management Plan', org, ref, producer: producerOf(state), format }, pages };
}
