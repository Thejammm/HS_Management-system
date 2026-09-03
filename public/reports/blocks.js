// Reusable report blocks. Every template composes pages from these; each is a
// pure function returning an HTML string (renderable in Node for snapshot
// tests - no DOM access here). Styling lives in report.css.
import { TIER_COLOURS, tierFor, DEFAULT_BANDS } from './derive.js';

export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function tierWord(tier) {
  if (!tier) return '<span class="r-tier r-tier-none">Not rated</span>';
  const c = TIER_COLOURS[tier] || '#b7b7ba';
  return `<span class="r-tier"><i style="background:${c}"></i>${esc(tier)}</span>`;
}

export function masthead({ org, refCode, issued, review, logoText }) {
  return `<header class="r-masthead">
    <div class="r-mast-org">${esc(logoText || org || '')}</div>
    <div class="r-mast-meta">
      ${refCode ? `<span>Ref ${esc(refCode)}</span>` : ''}
      ${issued ? `<span>Issued ${esc(issued)}</span>` : ''}
      ${review ? `<span>Review ${esc(review)}</span>` : ''}
    </div>
  </header>`;
}

export function titleBlock({ kicker, headline, standfirst }) {
  return `<div class="r-titleblock">
    ${kicker ? `<div class="r-kicker">${esc(kicker)}</div>` : ''}
    <h1 class="r-headline">${esc(headline)}</h1>
    ${standfirst ? `<p class="r-standfirst">${esc(standfirst)}</p>` : ''}
  </div>`;
}

// tiles: [{ value, label, tone: 'bad'|'warn'|'ok'|'muted'|undefined, note }]
export function kpiStrip({ tiles }) {
  return `<div class="r-kpis" style="--kpi-n:${tiles.length}">` + tiles.map(t => `
    <div class="r-kpi${t.tone ? ' r-kpi-' + t.tone : ''}">
      <div class="r-kpi-val">${esc(t.value)}</div>
      <div class="r-kpi-lab">${esc(t.label)}</div>
      ${t.note ? `<div class="r-kpi-note">${esc(t.note)}</div>` : ''}
    </div>`).join('') + `</div>`;
}

// Framed panel with "+" registration marks at the corners.
export function framedPanel(title, innerHtml, cls = '') {
  return `<div class="r-frame ${cls}">
    <i class="r-reg r-reg-tl"></i><i class="r-reg r-reg-tr"></i><i class="r-reg r-reg-bl"></i><i class="r-reg r-reg-br"></i>
    ${title ? `<div class="r-frame-title">${esc(title)}</div>` : ''}
    ${innerHtml}
  </div>`;
}

// items: [{ n, text, rationale }]
export function decisionsPanel({ title, items }) {
  const inner = `<ol class="r-decisions">` + items.map(d => `
    <li><span class="r-dec-text">${esc(d.text)}</span>${d.rationale ? `<span class="r-dec-why">${esc(d.rationale)}</span>` : ''}</li>`).join('') + `</ol>`;
  return framedPanel(title || 'Decisions required', inner, 'r-frame-decisions');
}

// A cell is a plain string, or an object in one of two shapes:
//   {html}                     - trusted markup, inserted as-is
//   {text, color:[r,g,b], bold} - escaped text, styled
// The styled shape is the one the report sections reach for when a value has
// to carry a verdict as well as a number - an overdue date in red, a missing
// dutyholder in red, a RIDDOR report date in green. It was being dropped on
// the floor and printing "[object Object]" in the finished PDF, so it is
// handled here rather than at each of the call sites.
export function cellHTML(cell) {
  if (cell && typeof cell === 'object' && 'html' in cell) return cell.html;
  if (cell && typeof cell === 'object' && 'text' in cell) {
    const st = [];
    const col = cell.color || cell.colour;
    if (Array.isArray(col) && col.length === 3 && col.every(n => typeof n === 'number' && isFinite(n))) {
      st.push('color:rgb(' + col.map(n => Math.max(0, Math.min(255, Math.round(n)))).join(',') + ')');
    } else if (typeof col === 'string' && col) {
      st.push('color:' + esc(col));
    }
    if (cell.bold) st.push('font-weight:700');
    const inner = esc(cell.text);
    return st.length ? `<span style="${st.join(';')}">${inner}</span>` : inner;
  }
  return esc(cell);
}

// cols: [{header, w?, align?}], rows: [[cell]] - see cellHTML for cell shapes
export function dataTable({ title, cols, rows, footnote }) {
  const head = '<tr>' + cols.map(c => `<th${c.align ? ` class="r-al-${c.align}"` : ''}${c.w ? ` style="width:${c.w}"` : ''}>${esc(c.header)}</th>`).join('') + '</tr>';
  const body = rows.map(r => '<tr>' + r.map((cell, i) => {
    const c = cols[i] || {};
    return `<td${c.align ? ` class="r-al-${c.align}"` : ''}>${cellHTML(cell)}</td>`;
  }).join('') + '</tr>').join('');
  return (title ? `<div class="r-block-title">${esc(title)}</div>` : '') +
    `<table class="r-table"><thead>${head}</thead><tbody>${body}</tbody></table>` +
    (footnote ? `<div class="r-footnote">${esc(footnote)}</div>` : '');
}

// Inherent → projected, two thin bars in line: the risk as it stands (solid,
// band colour) above where it is projected to sit once the planned controls
// are actioned (hatched, because it has not been earned yet). Numbers
// alongside. A projection is a plan, so it never renders as solid.
export function dualBar({ residual, projected, tier }) {
  const colour = tier ? (TIER_COLOURS[tier] || '#b7b7ba') : '#b7b7ba';
  const w = s => Math.max(3, Math.min(100, ((s && s.score) || 0) / 25 * 100));
  return `<span class="r-wasnow">
    <span class="r-wn-row"><i class="r-wn-lab">inherent</i><i class="r-wn-track">${residual ? `<i class="r-wn-fill" style="width:${w(residual)}%;background:${colour}"></i>` : ''}</i><b class="r-wn-val">${residual ? residual.score : '-'}</b></span>
    <span class="r-wn-row"><i class="r-wn-lab">projected</i><i class="r-wn-track">${projected ? `<i class="r-wn-fill r-wn-ghost" style="width:${w(projected)}%"></i>` : ''}</i><b class="r-wn-val">${projected ? projected.score : '-'}</b></span>
  </span>`;
}

// The board register's score cell, matching the app's own strip
// (inherent → projected): the score as it stands, the score the plan is
// working towards, and how much of the plan is delivered. Forward-looking on
// Simon's instruction - the board wants "how are we doing", not history.
export function planBar({ residual, target, tier, targetTier, actsTotal, actsClosed }) {
  const w = s => Math.max(3, Math.min(100, ((s && s.score) || 0) / 25 * 100));
  const nowColour = tier ? (TIER_COLOURS[tier] || '#b7b7ba') : '#b7b7ba';
  const tgtColour = targetTier ? (TIER_COLOURS[targetTier] || '#b7b7ba') : '#b7b7ba';
  const nowRow = `<span class="r-wn-row"><i class="r-wn-lab">inherent</i><i class="r-wn-track">${residual ? `<i class="r-wn-fill" style="width:${w(residual)}%;background:${nowColour}"></i>` : ''}</i><b class="r-wn-val">${residual ? residual.score : '-'}</b></span>`;
  const planRow = target
    ? `<span class="r-wn-row"><i class="r-wn-lab">projected</i><i class="r-wn-track"><i class="r-wn-fill r-wn-plan" style="width:${w(target)}%;background:${tgtColour}"></i></i><b class="r-wn-val">${target.score}</b></span>`
    : `<span class="r-wn-row"><i class="r-wn-lab">projected</i><i class="r-wn-none">no target score set</i></span>`;
  const prog = actsTotal
    ? `<span class="r-wn-prog">${actsClosed} of ${actsTotal} action${actsTotal !== 1 ? 's' : ''} done</span>`
    : `<span class="r-wn-prog r-wn-prog-none">no actions planned yet</span>`;
  return `<span class="r-wasnow">${nowRow}${planRow}${prog}</span>`;
}

// counts: { "l|s": n } keyed by likelihood|severity, residual only.
// Every square is bordered in its band colour (the tenant's own bands), and
// an occupied square is filled with it - the grid itself shows how serious
// each position is, exactly as the app's cockpit matrix does.
export function matrix5x5({ counts, caption, bands }) {
  const b = bands || DEFAULT_BANDS;
  let rows = '';
  for (let sev = 5; sev >= 1; sev--) {
    rows += `<tr><th class="r-mx-ax">${sev}</th>`;
    for (let lik = 1; lik <= 5; lik++) {
      const n = counts[lik + '|' + sev] || 0;
      const col = TIER_COLOURS[tierFor(lik * sev, b)] || '#b7b7ba';
      rows += n
        ? `<td class="r-mx-cell r-mx-full" style="border-color:${col};background:${col}"><b>${n}</b></td>`
        : `<td class="r-mx-cell" style="border-color:${col}"></td>`;
    }
    rows += '</tr>';
  }
  const axis = `<tr><th class="r-mx-corner"></th>${[1, 2, 3, 4, 5].map(l => `<th class="r-mx-ax">${l}</th>`).join('')}</tr>`;
  return `<div class="r-matrix"><div class="r-mx-ylab">Severity</div>
    <table class="r-mx"><tbody>${rows}${axis}</tbody></table>
    <div class="r-mx-xlab">Likelihood</div>
    ${caption ? `<div class="r-footnote">${esc(caption)}</div>` : ''}</div>`;
}

// rows: [{label, value, max, text, colour?, marker?:{at,label}}] - bars where
// EACH row keeps its own real scale and shows its own exact figure. Built to
// replace the "×5 so they share an axis" trick, which printed a bar reading 4
// beside a sentence reading 0.7 (Simon: any small number that doesn't match
// up ruins the whole app). A marker draws the needed level on the track.
export function gapBars({ title, rows, footnote }) {
  return `<div class="r-gap">${title ? `<div class="r-block-title">${esc(title)}</div>` : ''}` +
    rows.map(r => {
      const pct = (r.max > 0 && Number.isFinite(r.value)) ? Math.min(100, Math.max(0, r.value / r.max * 100)) : 0;
      const mk = (r.marker && Number.isFinite(r.marker.at) && r.max > 0)
        ? `<i class="r-gap-mark" style="left:${Math.min(100, Math.max(0, r.marker.at / r.max * 100))}%"></i>` : '';
      const mkLab = (r.marker && r.marker.label)
        ? `<span class="r-gap-marklab" style="left:${Math.min(94, Math.max(3, r.marker.at / r.max * 100))}%">${esc(r.marker.label)}</span>` : '';
      return `<div class="r-gap-row">
        <span class="r-gap-lab">${esc(r.label)}</span>
        <span class="r-gap-track">${Number.isFinite(r.value) ? `<i class="r-gap-fill" style="width:${pct}%;${r.colour ? `background:${r.colour}` : ''}"></i>` : ''}${mk}${mkLab}</span>
        <span class="r-gap-val">${esc(r.text)}</span>
      </div>`;
    }).join('') +
    (footnote ? `<div class="r-footnote">${esc(footnote)}</div>` : '') + `</div>`;
}

// items: [{label, n, colour?}] - horizontal distribution bars with counts.
export function distributionBars({ items, title }) {
  const max = Math.max(1, ...items.map(i => i.n));
  return `<div class="r-dist">${title ? `<div class="r-block-title">${esc(title)}</div>` : ''}` +
    items.map(i => `<div class="r-dist-row">
      <span class="r-dist-lab">${esc(i.label)}</span>
      <span class="r-dist-track"><i style="width:${Math.round(i.n / max * 100)}%;${i.colour ? `background:${i.colour}` : ''}"></i></span>
      <span class="r-dist-n">${i.n}</span>
    </div>`).join('') + `</div>`;
}

// Hierarchy of control strip - the Protect-and-below share made unmissable.
export function hierarchyStrip({ items, total, protectDown, title }) {
  const seg = items.filter(i => i.n > 0).map(i =>
    `<i class="r-hier-seg" style="flex:${i.n}" title="${esc(i.label)}"><b>${esc(i.label)}</b> ${i.n}</i>`).join('');
  const pct = total ? Math.round(protectDown / total * 100) : 0;
  return `<div class="r-hier">${title ? `<div class="r-block-title">${esc(title)}</div>` : ''}
    ${total ? `<div class="r-hier-strip">${seg}</div>` : `<div class="r-footnote">No control levels recorded yet.</div>`}
    ${total ? `<div class="r-hier-callout">${pct}% of controlled risks rely on Protect, PPE or Admin measures - the weakest rungs of the hierarchy.</div>` : ''}
  </div>`;
}

// Inverted statement panel (the s.37 duty).
export function statementPanel({ title, body, cite }) {
  return `<div class="r-statement">
    ${title ? `<div class="r-statement-title">${esc(title)}</div>` : ''}
    <div class="r-statement-body">${esc(body)}</div>
    ${cite ? `<div class="r-statement-cite">${esc(cite)}</div>` : ''}
  </div>`;
}

export function tagList({ title, tags }) {
  return `<div class="r-tags">${title ? `<div class="r-block-title">${esc(title)}</div>` : ''}
    <div class="r-tag-row">${tags.length ? tags.map(t => `<span class="r-tag">${esc(t)}</span>`).join('') : '<span class="r-footnote">None recorded.</span>'}</div></div>`;
}

// 5-step maturity scale per domain; value ≤ flagAt shows the CRITICAL GAP flag.
export function stepScale({ rows, flagAt = 1.5, title }) {
  return `<div class="r-steps">${title ? `<div class="r-block-title">${esc(title)}</div>` : ''}` +
    rows.map(r => {
      const v = r.value;
      const cells = [1, 2, 3, 4, 5].map(n => {
        const fill = v != null && v >= n - 0.25;
        const part = !fill && v != null && v > n - 1;
        return `<i class="r-step${fill ? ' on' : part ? ' part' : ''}"></i>`;
      }).join('');
      const flag = (v != null && v <= flagAt) ? '<b class="r-step-flag">CRITICAL GAP</b>' : '';
      return `<div class="r-step-row"><span class="r-step-lab">${esc(r.label)}</span>
        <span class="r-step-track">${cells}</span>
        <span class="r-step-val">${v == null ? 'not scored' : v.toFixed(1)}</span>${flag}</div>`;
    }).join('') + `</div>`;
}

export function signoffGrid({ cells }) {
  const inner = `<div class="r-signoff">` + cells.map(c => `
    <div class="r-so-cell"><div class="r-so-lab">${esc(c.label)}</div><div class="r-so-line">${esc(c.value || '')}</div></div>`).join('') + `</div>`;
  return framedPanel('Sign-off', inner, 'r-frame-signoff');
}

// Inverted one-line interpretation callout.
export function soWhat({ text }) {
  return `<div class="r-sowhat">${esc(text)}</div>`;
}

// The practice mark: concentric rings and a needle, drawn in the current text
// colour so it reads on the dark cover as well as on a white page.
const PRACTICE_MARK = '<svg class="r-foot-mark" viewBox="0 0 20 20" width="11" height="11" aria-hidden="true">'
  + '<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/>'
  + '<circle cx="10" cy="10" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/>'
  + '<line x1="10" y1="10" x2="16" y2="4.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

export function pageFooter({ ref, producer, page, pages }) {
  return `<footer class="r-pagefoot">
    <span class="r-foot-brand">${PRACTICE_MARK}${esc(producer || 'AHS Compliance Consulting')}</span>
    <span>${esc(ref || '')}</span>
    <span>Uncontrolled when printed</span>
    <span>Page ${page} of ${pages}</span>
  </footer>`;
}

export function textBlock({ title, body, cls }) {
  return `<div class="r-text ${cls || ''}">${title ? `<div class="r-block-title">${esc(title)}</div>` : ''}<p>${esc(body)}</p></div>`;
}

// Cover page body (dark field) - Signal format page furniture.
export function coverBlock({ org, title, period, refCode, issued }) {
  return `<div class="r-cover">
    <div class="r-cover-org">${esc(org)}</div>
    <div class="r-cover-title">${esc(title)}</div>
    <div class="r-cover-meta">${esc([period, refCode, issued].filter(Boolean).join(' · '))}</div>
  </div>`;
}

// ── The director's risk picture (the cockpit's Board zone on paper) ──
// Lead figure beside one proportional strip: red / amber / green, always
// summing to the total - nothing to mis-add.
export function splitStrip({ lead, segments, notes }) {
  const total = segments.reduce((a, s) => a + s.n, 0);
  const segs = segments.filter(s => s.n > 0).map(s =>
    `<i class="r-split-seg" style="flex:${s.n};background:${s.colour}"><b>${s.n}</b>&nbsp;${esc(s.label)}</i>`).join('');
  return `<div class="r-split">
    <div class="r-split-lead"><div class="r-split-num">${esc(lead.value)}</div><div class="r-split-lab">${esc(lead.label)}</div></div>
    <div class="r-split-body">${total ? `<div class="r-split-bar">${segs}</div>` : '<div class="r-footnote">No risks recorded yet.</div>'}
      ${notes && notes.length ? `<div class="r-split-notes">${notes.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}</div>
  </div>`;
}

// The company journey: started -> now (fill, band colour) -> blue target
// line -> fully controlled, with the counts and the improvement loop beneath.
export function journeyStrip({ fillPct, tgtPct, colour, counts, loop, note }) {
  const line = (tgtPct == null) ? '' :
    `<i class="r-jny-line" style="left:${tgtPct}%"></i><span class="r-jny-flag" style="left:${tgtPct}%;transform:translateX(-${tgtPct > 75 ? 100 : tgtPct < 15 ? 0 : 50}%)">TARGET - the controls you have set</span>`;
  return `<div class="r-jny${tgtPct == null ? '' : ' r-jny-flagged'}">
    <div class="r-jny-track"><i class="r-jny-fill" style="width:${Math.max(2, fillPct || 0)}%;background:${colour}"></i>${line}</div>
    <div class="r-jny-labs"><span>where you started</span><span style="color:${colour};font-weight:700">where you are now</span><span>fully controlled</span></div>
    <div class="r-jny-counts">${counts.map(c => `<span><b${c.colour ? ` style="color:${c.colour}"` : ''}>${esc(c.value)}</b> ${esc(c.label)}</span>`).join('')}</div>
    ${note ? `<div class="r-footnote">${esc(note)}</div>` : ''}
    ${loop ? `<div class="r-jny-loop">${esc(loop)}</div>` : ''}
  </div>`;
}

// Named risks on the Critical-to-Low scale; the dot carries the controls
// judgement (red none / amber partly / green in place), a tick = at target.
export function riskLadder({ rungs, unrated }) {
  const rows = rungs.map(r => `<div class="r-lad-row">
      <span class="r-lad-frame"><i class="r-lad-rail" style="background:${r.colour}55"></i><i class="r-lad-rail r-lad-rail2" style="background:${r.colour}55"></i><i class="r-lad-bar" style="background:${r.colour}"></i></span>
      <span class="r-lad-label"><b style="color:${r.colour}">${esc(String(r.band).toUpperCase())}</b><i class="r-lad-range"> · score ${esc(r.range || '')}</i><span class="r-lad-sub">${esc(r.sub || '')}</span></span>
      <span class="r-lad-chips">${r.chips.length ? r.chips.map(c => `<span class="r-lad-chip${c.dot === '#DC2626' ? ' r-lad-unc' : ''}"><i style="background:${c.dot}"></i>${esc(c.name)}${c.tick ? ' &#10003;' : ''}</span>`).join('') : '<span class="r-footnote">none at this level</span>'}</span>
      <span class="r-lad-n">${r.chips.length ? (r.chips.length + ' risk' + (r.chips.length !== 1 ? 's' : '')) : ''}</span>
    </div>`).join('');
  const key = `<div class="r-lad-key"><span><i style="background:#DC2626"></i>uncontrolled</span><span><i style="background:#F59E0B"></i>partly controlled</span><span><i style="background:#16A34A"></i>controlled</span><span>&#10003; = at its planned target</span></div>`;
  return `<div class="r-lad">${rows || '<div class="r-footnote">No rated risks yet.</div>'}
    ${unrated && unrated.length ? `<div class="r-footnote">${unrated.length} risk${unrated.length !== 1 ? 's' : ''} not yet rated - ${unrated.map(esc).join(', ')}</div>` : ''}
    ${key}</div>`;
}

// Two ranked lists side by side (top five by size, and the chosen five);
// the purple dot marks a risk on both.
export function twinPanels({ left, right, footnote }) {
  const panel = (p) => `<div class="r-twin-panel"><div class="r-twin-title">${esc(p.title)}</div>
    ${p.rows.length ? p.rows.map((r, i) => `<div class="r-twin-row">
      <b class="r-twin-rank">${i + 1}</b>
      <i class="r-twin-both"${r.both ? '' : ' style="visibility:hidden"'}>&#9679;</i>
      <span class="r-twin-name">${esc(r.name)}</span>
      <span class="r-twin-band" style="background:${r.bandColour}">${esc(r.band)}</span>
      <span class="r-twin-word">${esc(r.word)}</span>
    </div>`).join('') : `<div class="r-footnote">${esc(p.empty || 'Nothing yet.')}</div>`}</div>`;
  return `<div class="r-twin">${panel(left)}${panel(right)}</div>${footnote ? `<div class="r-footnote">${esc(footnote)}</div>` : ''}`;
}

const BLOCKS = {
  masthead, titleBlock, kpiStrip, decisionsPanel, dataTable, dualBar, planBar, gapBars, matrix5x5,
  distributionBars, hierarchyStrip, statementPanel, tagList, stepScale,
  signoffGrid, soWhat, pageFooter, textBlock, coverBlock,
  splitStrip, journeyStrip, riskLadder, twinPanels,
};

// Render one block descriptor {type, ...props} to HTML.
export function renderBlock(b) {
  const fn = BLOCKS[b.type];
  if (!fn) return `<div class="r-footnote">[unknown block: ${esc(b.type)}]</div>`;
  return fn(b);
}
