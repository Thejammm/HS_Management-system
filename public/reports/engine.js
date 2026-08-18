// Report engine — renders a Report object to fixed A4 pages and drives the
// browser print flow. Templates never touch the DOM; this is the only file
// that does.
//
//   Report = { meta:{ title, ref, format }, pages:[ { label, blocks:[{type,…}] } ] }
//
import { renderBlock, pageFooter } from './blocks.js';

const CSS_ID = 'report-layer-css';

export function ensureCss(doc = document) {
  if (doc.getElementById(CSS_ID)) return;
  const l = doc.createElement('link');
  l.id = CSS_ID; l.rel = 'stylesheet'; l.href = '/reports/report.css';
  doc.head.appendChild(l);
}

// Pure: Report → HTML string (also used by the snapshot tests in Node).
export function reportHTML(report) {
  const fmt = (report.meta && report.meta.format) || 'signal';
  const pages = report.pages || [];
  const n = pages.length;
  const pageHtml = pages.map((p, i) => {
    const blocks = (p.blocks || []).map(renderBlock).join('\n');
    const foot = pageFooter({ ref: report.meta && report.meta.ref, page: i + 1, pages: n });
    return `<section class="r-page${p.cover ? ' r-page-cover' : ''}" data-label="${(p.label || '').replace(/"/g, '')}">
      <div class="r-page-body">${blocks}</div>${foot}</section>`;
  }).join('\n');
  return `<div class="r-root r-fmt-${fmt}">${pageHtml}</div>`;
}

// Split long register rows across pages. rowsPerFirst rows fit on the page that
// also carries the intro blocks; continuation pages take rowsPerCont. Returns
// an array of row-slices; the template turns each into its own page.
export function paginateRows(rows, rowsPerFirst, rowsPerCont) {
  if (!rows.length) return [[]];
  const out = [rows.slice(0, rowsPerFirst)];
  let i = rowsPerFirst;
  while (i < rows.length) { out.push(rows.slice(i, i + rowsPerCont)); i += rowsPerCont; }
  return out;
}

// Render into the page and open the print dialog. Cleans itself up afterwards.
export async function printReport(report, opts = {}) {
  ensureCss();
  const old = document.getElementById('reportRoot');
  if (old) old.remove();
  const mount = document.createElement('div');
  mount.id = 'reportRoot';
  mount.innerHTML = reportHTML(report);
  document.body.appendChild(mount.firstElementChild ? mount : mount);
  // The r-root div itself must be a direct child of body so the print rule
  // (body.printing-report > *:not(.r-root)) can isolate it.
  const root = mount.querySelector('.r-root') || mount.firstElementChild;
  document.body.appendChild(root);
  mount.remove();
  root.id = 'reportRoot';
  document.body.classList.add('printing-report');
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
  await new Promise(r => setTimeout(r, 60));   // one layout pass after fonts settle
  const cleanup = () => {
    document.body.classList.remove('printing-report');
    const el = document.getElementById('reportRoot');
    if (el && !opts.keepMounted) el.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  if (opts.noPrint) return root;               // preview/test mode
  window.print();
  return root;
}
