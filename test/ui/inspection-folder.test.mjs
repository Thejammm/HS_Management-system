// ══════════════════════════════════════════════════════════════
//  Inspection reports on the Documents tab. Simon, 2026-09-29: "add a new
//  section below the risk assessment register ... exactly the same as what
//  the risk assessment index to folder does but for what inspections are in
//  the client folder ... the tiles should read a summary of the inspection".
//
//  The fixture is a real report the Workplace Inspection app produced
//  (test/fixtures/wis-inspection-report.pdf, one checklist inspection with
//  11 issues, 1 resolved) - so the reader is proved against that app's
//  actual layout, not a guess at it. The PDF reader loads from cdnjs.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { openApp, seed, wait, reporter } from './harness.mjs';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const PDF_B64 = fs.readFileSync(path.join(here, '..', 'fixtures', 'wis-inspection-report.pdf')).toString('base64');
const R = reporter('Inspection reports folder - read for their summary');
const { browser, page, errors } = await openApp();

await seed(page, { company: { legalName: 'Easy Travel Service' }, inspRegister: [], inspFolder: { path: '', lastSync: '' } }, 'documents');
await wait(page, 300);

// ── the section is there, below the RA register ──
{
  const t = await page.evaluate(() => {
    const tab = document.getElementById('tab-documents');
    const ra = document.getElementById('raRegisterContainer'), tools = document.getElementById('insrTools'), list = document.getElementById('insrContainer');
    const order = ra && tools && list && (ra.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING) && (tools.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { inTab: !!(tab && tools && tab.contains(tools)), order: !!order, empty: (list && list.innerText) || '' };
  });
  R.ok(t.inTab && t.order, 'Inspection reports sits on the Documents tab, below the risk assessment register');
  R.ok(/Drag the client's inspection reports folder/.test(t.empty), 'and says how to fill it when empty');
}

// ── a folder with one real report, a Word file and a PDF that is not a report ──
{
  const t = await page.evaluate(async (b64) => {
    const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const report = new File([bytes], 'Weekly garage walkround 22-09-26.pdf', { type: 'application/pdf', lastModified: Date.parse('2026-09-22T10:00:00Z') });
    const word = new File(['not really a word file'], 'Toolbox talk notes.docx', { lastModified: Date.parse('2026-09-10T10:00:00Z') });
    const other = new File([new window.jspdf.jsPDF().text('A letter about something else', 20, 20).output('arraybuffer')], 'Letter.pdf', { type: 'application/pdf', lastModified: Date.parse('2026-09-01T10:00:00Z') });
    const BS = String.fromCharCode(92);
    document.getElementById('insrFolderPath').value = 'S:' + BS + 'Clients' + BS + 'Easy Travel' + BS + 'Inspections';
    const t0 = performance.now();
    await _insrSyncFiles([
      { name: report.name, rel: '2026' + BS + report.name, mtime: report.lastModified, file: report },
      { name: word.name, rel: word.name, mtime: word.lastModified, file: word },
      { name: other.name, rel: other.name, mtime: other.lastModified, file: other },
      { name: 'Thumbs.db', rel: 'Thumbs.db', mtime: 0, file: null } ], true);
    const ms = Math.round(performance.now() - t0);
    const L = _insrState();
    const rep = L.find(e => e.file === report.name) || {}, w = L.find(e => e.file === word.name) || {}, o = L.find(e => e.file === other.name) || {};
    const tile = (document.getElementById('insr-' + rep.id) || {}).innerText || '';
    const order = [...document.querySelectorAll('#insrContainer .insr-card')].map(c => c.id);
    return { ms, n: L.length, rep: { read: rep.read, loc: rep.location, s: rep.summary }, w: { read: w.read, note: w.note }, o: { read: o.read, note: o.note },
      tile, cls: (document.getElementById('insr-' + rep.id) || {}).className || '', badge: document.getElementById('insrBadge').textContent,
      note: document.getElementById('insrSyncNote').textContent, first: order[0] === 'insr-' + rep.id };
  }, PDF_B64);
  const s = t.rep.s || {};
  R.ok(t.n === 3, 'the report, the Word file and the other PDF are indexed; Thumbs.db is skipped (' + t.n + ', ' + t.ms + ' ms)');
  R.ok(t.rep.read === 'ok' && s.title === 'Weekly garage walkround', 'the Inspection app\'s report is read - its own title: ' + s.title);
  R.ok(s.verdict === 'IMPROVEMENT REQUIRED — ISSUES IDENTIFIED' && s.verdictKey === 'warn', 'its verdict, and the colour that goes with it (' + s.verdictKey + ')');
  R.ok(JSON.stringify(s.counts) === JSON.stringify({ passed: 69, rectified: 8, issues: 11, resolved: 1, open: 10, overdue: 0 }), 'its counts, exactly as printed: ' + JSON.stringify(s.counts));
  R.ok(/^11 issues were identified during this period\. 1 has been resolved\. 10 actions remain outstanding\./.test(s.statement || ''), 'and the report\'s own summary, in its own words');
  R.ok(s.inspector === 'Gareth Hughes' && s.ref === 'GI-0922' && s.freq === 'Weekly' && s.period === '22 Sept 2026', 'who inspected it, the reference, how often, and when');
  R.ok(s.location === 'Main garage - Unit 4' && s.status === 'FINAL' && s.issued === '29 September 2026', 'the site, that it is final, and when it was issued');
  R.ok(t.rep.loc === 'S:\\Clients\\Easy Travel\\Inspections\\2026\\Weekly garage walkround 22-09-26.pdf', 'its location is the folder path plus where it sits in the folder');
  R.ok(/IMPROVEMENT REQUIRED/.test(t.tile) && /11\s*issues raised/.test(t.tile) && /10\s*open/.test(t.tile) && /10 actions remain outstanding/.test(t.tile) && /Gareth Hughes/.test(t.tile) && /Final/i.test(t.tile),
    'the tile reads the summary: verdict, counts, the report\'s own statement, the inspector');
  R.ok(/insr-c-warn/.test(t.cls), 'coloured by the verdict - amber for improvement required');
  R.ok(t.w.read === 'listed' && /listed by name/.test(t.w.note), 'a Word file is listed by name, not read');
  R.ok(t.o.read === 'other' && /Not a Workplace Inspection app report/.test(t.o.note), 'a PDF that is not a report says so, and is listed by its file name');
  R.ok(/3 files · 10 open actions/.test(t.badge), 'the section header totals the open actions, counting files as the note under it does (' + t.badge + ')');
  R.ok(/Last indexed \d{4}-\d{2}-\d{2} · 3 files · 1 read/.test(t.note), 'and when it was last indexed (' + t.note + ')');
  R.ok(t.first, 'newest report first');
}

// ── dragged again: unchanged reports are not re-read; a missing one is flagged, never removed ──
{
  const t = await page.evaluate(async (b64) => {
    let reads = 0; const orig = window._insrReadSummary;
    window._insrReadSummary = async (f) => { reads++; return orig(f); };
    const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const report = new File([bytes], 'Weekly garage walkround 22-09-26.pdf', { type: 'application/pdf', lastModified: Date.parse('2026-09-22T10:00:00Z') });
    const BS = String.fromCharCode(92);
    await _insrSyncFiles([{ name: report.name, rel: '2026' + BS + report.name, mtime: report.lastModified, file: report }], true);
    const L = _insrState();
    const out = { reads, n: L.length, missing: L.filter(e => e.missing).map(e => e.file).sort(), keptSummary: !!(L.find(e => e.file === report.name) || {}).summary };
    window._insrReadSummary = orig;
    return out;
  }, PDF_B64);
  R.ok(t.reads === 0 && t.keptSummary, 'dragging the folder again does not re-read a report that has not changed');
  R.ok(t.n === 3 && t.missing.join('|') === 'Letter.pdf|Toolbox talk notes.docx', 'files no longer in the folder are flagged, not removed (' + t.missing.join(', ') + ')');
}

// ── offline: the reader cannot load - the report is listed, and read on the next drag ──
{
  const t = await page.evaluate(async (b64) => {
    S.inspRegister = [];
    const orig = window._loadPdfReader;
    window._loadPdfReader = () => Promise.reject(new Error('offline'));
    const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const f = new File([bytes], 'Weekly garage walkround 22-09-26.pdf', { type: 'application/pdf', lastModified: Date.parse('2026-09-22T10:00:00Z') });
    await _insrSyncFiles([{ name: f.name, rel: f.name, mtime: f.lastModified, file: f }], false);
    const a = Object.assign({}, _insrState()[0]);
    window._loadPdfReader = orig;
    await _insrSyncFiles([{ name: f.name, rel: f.name, mtime: f.lastModified, file: f }], false);
    const b = _insrState()[0];
    return { aRead: a.read, aNote: a.note, aTile: (document.getElementById('insr-' + b.id) ? true : false), bRead: b.read, bTitle: b.summary && b.summary.title, n: _insrState().length };
  }, PDF_B64);
  R.ok(t.aRead === 'unread' && /could not load \(offline\?\)/.test(t.aNote), 'offline, the report is still listed, and says why it was not read');
  R.ok(t.bRead === 'ok' && t.bTitle === 'Weekly garage walkround' && t.n === 1, 'and the next drag reads it - one entry, not two');
}

// ── the other verdicts, and a period report of several inspections ──
{
  const t = await page.evaluate(() => {
    const p1 = (verdict, n) => ['AC', 'AHS Compliance Consulting', 'DRAFT — FOR REVIEW', 'Monthly garage report', 'Inspection Report', 'CLIENT / BUSINESS', 'Easy Travel', 'LOCATION', 'Garage',
      'REPORTING PERIOD', '1 Sept 2026 – 30 Sept 2026', 'INSPECTIONS CONDUCTED', String(n), 'PREPARED BY', 'AHS', 'DATE ISSUED', '1 October 2026', verdict,
      String(n), 'INSPECTIONS', '40', 'ITEMS PASSED', '0', 'RECTIFIED ON SITE', '3', 'ISSUES RAISED', '3', 'RESOLVED', '0', 'OPEN ACTIONS', '0', 'OVERDUE'];
    const p2 = ['Compliance Statement', '3 issues were identified during this period.', 'LEGAL CONTEXT', 'Inspection Record', 'Weekly walkround', '8 Sept 2026 · Weekly · Gareth Hughes · Ref: W1'];
    const good = _insrParse([p1('SATISFACTORY — MANAGEMENT PROCESS WORKING WELL', 4), p2]);
    const bad = _insrParse([p1('UNSATISFACTORY — IMMEDIATE ACTION REQUIRED', 1), p2]);
    return { good: good.verdictKey, bad: bad.verdictKey, draft: good.status, multi: { n: good.inspections, inspector: good.inspector, ref: good.ref },
      single: { inspector: bad.inspector, ref: bad.ref }, key: _insrDateKey(good.period), none: _insrParse([['Some other PDF'], []]) };
  });
  R.ok(t.good === 'good' && t.bad === 'bad', 'satisfactory reads green, unsatisfactory reads red');
  R.ok(t.draft === 'DRAFT', 'a draft says it is a draft');
  R.ok(t.multi.n === 4 && t.multi.inspector === '' && t.single.inspector === 'Gareth Hughes', 'a period report of several inspections names no single inspector; a single inspection does');
  R.ok(t.key === '2026-09-01', 'a period sorts by its first date (' + t.key + ')');
  R.ok(t.none === null, 'anything that is not an Inspection app report is not guessed at');
}

await R.done(browser, errors);
