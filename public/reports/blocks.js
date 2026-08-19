// Reusable report blocks. Every template composes pages from these; each is a
// pure function returning an HTML string (renderable in Node for snapshot
// tests - no DOM access here). Styling lives in report.css.
import { TIER_COLOURS } from './derive.js';

export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function tierWord(tier) {
  if (!tier) return '<span class="r-tier r-tier-none">Not rated</span>';
  const c = TIER_COLOURS[tier] || '#749dc4';
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

// cols: [{header, w?, align?}], rows: [[cell html-safe strings or {html}]]
export function dataTable({ title, cols, rows, footnote }) {
  const head = '<tr>' + cols.map(c => `<th${c.align ? ` class="r-al-${c.align}"` : ''}${c.w ? ` style="width:${c.w}"` : ''}>${esc(c.header)}</th>`).join('') + '</tr>';
  const body = rows.map(r => '<tr>' + r.map((cell, i) => {
    const c = cols[i] || {};
    const html = (cell && typeof cell === 'object' && 'html' in cell) ? cell.html : esc(cell);
    return `<td${c.align ? ` class="r-al-${c.align}"` : ''}>${html}</td>`;
  }).join('') + '</tr>').join('');
  return (title ? `<div class="r-block-title">${esc(title)}</div>` : '') +
    `<table class="r-table"><thead>${head}</thead><tbody>${body}</tbody></table>` +
    (footnote ? `<div class="r-footnote">${esc(footnote)}</div>` : '');
}

// Was → now, two thin bars in line: what the score was before controls
// (hatched) above what it is with controls in place (solid, band colour),
// numbers alongside. Replaced the single overlaid ghost bar, which read
// as one confusing bar rather than a change.
export function dualBar({ inherent, residual, tier }) {
  const colour = tier ? (TIER_COLOURS[tier] || '#749dc4') : '#b7b7ba';
  const w = s => Math.max(3, Math.min(100, ((s && s.score) || 0) / 25 * 100));
  return `<span class="r-wasnow">
    <span class="r-wn-row"><i class="r-wn-lab">was</i><i class="r-wn-track">${inherent ? `<i class="r-wn-fill r-wn-ghost" style="width:${w(inherent)}%"></i>` : ''}</i><b class="r-wn-val">${inherent ? inherent.score : '-'}</b></span>
    <span class="r-wn-row"><i class="r-wn-lab">now</i><i class="r-wn-track">${residual ? `<i class="r-wn-fill" style="width:${w(residual)}%;background:${colour}"></i>` : ''}</i><b class="r-wn-val">${residual ? residual.score : '-'}</b></span>
  </span>`;
}

// The board register's score cell, matching the app's own strip
// (now → plan → projected): the score as it stands, the score the plan is
// working towards, and how much of the plan is delivered. Forward-looking on
// Simon's instruction - the board wants "how are we doing", not history.
export function planBar({ residual, target, tier, targetTier, actsTotal, actsClosed }) {
  const w = s => Math.max(3, Math.min(100, ((s && s.score) || 0) / 25 * 100));
  const nowColour = tier ? (TIER_COLOURS[tier] || '#749dc4') : '#b7b7ba';
  const tgtColour = targetTier ? (TIER_COLOURS[targetTier] || '#749dc4') : '#749dc4';
  const nowRow = `<span class="r-wn-row"><i class="r-wn-lab">now</i><i class="r-wn-track">${residual ? `<i class="r-wn-fill" style="width:${w(residual)}%;background:${nowColour}"></i>` : ''}</i><b class="r-wn-val">${residual ? residual.score : '-'}</b></span>`;
  const planRow = target
    ? `<span class="r-wn-row"><i class="r-wn-lab">plan</i><i class="r-wn-track"><i class="r-wn-fill r-wn-plan" style="width:${w(target)}%;background:${tgtColour}"></i></i><b class="r-wn-val">${target.score}</b></span>`
    : `<span class="r-wn-row"><i class="r-wn-lab">plan</i><i class="r-wn-none">no target score set</i></span>`;
  const prog = actsTotal
    ? `<span class="r-wn-prog">${actsClosed} of ${actsTotal} action${actsTotal !== 1 ? 's' : ''} done</span>`
    : `<span class="r-wn-prog r-wn-prog-none">no actions planned yet</span>`;
  return `<span class="r-wasnow">${nowRow}${planRow}${prog}</span>`;
}

// counts: { "l|s": n } keyed by likelihood|severity, residual only.
export function matrix5x5({ counts, caption }) {
  let rows = '';
  for (let sev = 5; sev >= 1; sev--) {
    rows += `<tr><th class="r-mx-ax">${sev}</th>`;
    for (let lik = 1; lik <= 5; lik++) {
      const n = counts[lik + '|' + sev] || 0;
      rows += n
        ? `<td class="r-mx-cell r-mx-full"><b>${n}</b></td>`
        : `<td class="r-mx-cell"></td>`;
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

export function pageFooter({ ref, page, pages }) {
  return `<footer class="r-pagefoot">
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

const BLOCKS = {
  masthead, titleBlock, kpiStrip, decisionsPanel, dataTable, dualBar, planBar, gapBars, matrix5x5,
  distributionBars, hierarchyStrip, statementPanel, tagList, stepScale,
  signoffGrid, soWhat, pageFooter, textBlock, coverBlock,
};

// Render one block descriptor {type, ...props} to HTML.
export function renderBlock(b) {
  const fn = BLOCKS[b.type];
  if (!fn) return `<div class="r-footnote">[unknown block: ${esc(b.type)}]</div>`;
  return fn(b);
}
