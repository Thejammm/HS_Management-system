// Builds the anonymised policy templates the submission pack drafts from.
//
//   node scripts/build-policy-templates.mjs
//
// The source documents are real client document sets, and what identifies
// those clients (names, addresses, numbers, trade words, where the files are)
// lives in a PRIVATE settings file outside this public repo:
//   POLICY_SOURCES=<path>  or  ../compass-private/policy-sources.json
// Nothing from that file is written here except the anonymised templates.
//
// For each source document:
//   - every identifier becomes a token, e.g. ⟦legalName⟧ or ⟦hsLead⟧, filled
//     from the client's fact sheet when a draft is made (a missing fact is
//     left highlighted for AHS Ltd to enter);
//   - the issue and review dates and the version become tokens;
//   - a paragraph written for the source client's trade, or carrying other
//     dates, or a he/she about a named person, is highlighted yellow with a
//     Word comment saying what to review;
//   - existing comments, pictures and logos, SharePoint data and document
//     properties are removed or blanked.
// Every finished template is scanned for anything that could identify a
// source client; one hit stops the build.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const need = createRequire(import.meta.url);
const JSZip = need('jszip');
const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const OUT = path.join(root, 'data', 'policy-templates');
const CFG = process.env.POLICY_SOURCES || path.join(root, '..', 'compass-private', 'policy-sources.json');
if (!fs.existsSync(CFG)) { console.error('X The private settings file is not here: ' + CFG); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));

const OPEN = '⟦', CLOSE = '⟧';
const tok = k => OPEN + k + CLOSE;
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const OTHER_DATE = new RegExp('\\b(?:' + MONTHS + '|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\\s+20\\d\\d\\b|\\b\\d{1,2}/\\d{1,2}/20\\d\\d\\b', 'i');
const PERSON_TOKENS = ['hsLead', 'hsLeadFirst', 'dpLead'];
const PRONOUN = /\b(he|she|his|her|him|hers)\b/i;
// 1 x 1 transparent PNG: pictures and logos are blanked, the layout stays
const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const dec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const enc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// identifier patterns for a source: [regex, replacement text]
function idPatterns(src) {
  const list = src.identifiers.map(([find, key]) => {
    const edge = c => /[A-Za-z0-9]/.test(c);
    const body = reEsc(find);
    const re = new RegExp((edge(find[0]) ? '(?<![A-Za-z0-9])' : '') + body + (edge(find[find.length - 1]) ? '(?![A-Za-z])' : ''), 'g');
    const rep = key.includes('{') ? key.replace(/\{(\w+)\}/g, (m, k) => tok(k)) : tok(key);
    return [re, rep];
  });
  list.push([new RegExp('(?<![A-Za-z0-9])' + reEsc(src.issueMonth) + '(?![0-9])', 'g'), tok('issueMonth')]);
  list.push([new RegExp('(?<![A-Za-z0-9])' + reEsc(src.reviewMonth) + '(?![0-9])', 'g'), tok('reviewMonth')]);
  if (src.issueDate) list.push([new RegExp('(?<![0-9/])' + reEsc(src.issueDate) + '(?![0-9])', 'g'), tok('issueDate')]);
  return list;
}

// ── one paragraph: replace identifiers across its text runs, decide review ──
function paraEdit(p, pats, src, prevText) {
  const nodes = []; const T = [];
  const reT = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g; let m, at = 0;
  while ((m = reT.exec(p))) { const text = dec(m[2]); nodes.push({ start: m.index, end: m.index + m[0].length, attrs: m[1] || '', text, a: at, b: at + text.length }); T.push(text); at += text.length; }
  const full = T.join('');
  if (!full) return { xml: p, text: '', review: null };
  // all matches, earlier patterns win an overlap
  const hits = [];
  pats.forEach(([re, rep], pri) => { re.lastIndex = 0; let h; while ((h = re.exec(full))) hits.push({ s: h.index, e: h.index + h[0].length, rep, pri }); });
  if (/^\s*\d+(\.\d+)?\s*$/.test(full) && /^\s*Version\s*$/i.test(prevText || '')) hits.push({ s: full.search(/\d/), e: full.replace(/\s+$/, '').length, rep: tok('version'), pri: -1 });
  hits.sort((x, y) => x.s - y.s || x.pri - y.pri);
  const keep = []; let last = -1;
  hits.forEach(h => { if (h.s >= last) { keep.push(h); last = h.e; } });
  let newFull = full;
  if (keep.length) {
    // rebuild each text node: a match lands whole in the node where it starts
    nodes.forEach(n => {
      let out = '', i = n.a;
      while (i < n.b) {
        const h = keep.find(k => i >= k.s && i < k.e);
        if (h) { if (i === h.s) out += h.rep; i = Math.min(h.e, n.b); continue; }
        const next = keep.filter(k => k.s > i).map(k => k.s).concat([n.b]).reduce((a, b) => Math.min(a, b));
        out += full.slice(i, next); i = next;
      }
      n.out = out;
    });
    let xml = '', cur = 0;
    nodes.forEach(n => {
      const attrs = (/^\s|\s$/.test(n.out) && !/xml:space/.test(n.attrs)) ? n.attrs + ' xml:space="preserve"' : n.attrs;
      xml += p.slice(cur, n.start) + '<w:t' + attrs + '>' + enc(n.out) + '</w:t>'; cur = n.end;
    });
    p = xml + p.slice(cur);
    newFull = nodes.map(n => n.out).join('');
  }
  // review: the source trade, other dates, a he/she about a named person
  const why = [];
  // whole words only (a plural allowed): "NSI" is not in "responsibilities"
  const trade = src.trade.filter(t => new RegExp('(?<![A-Za-z])' + reEsc(t.trim()) + '(?:s|es)?(?![A-Za-z])', 'i').test(newFull));
  if (trade.length) why.push('trade');
  if (OTHER_DATE.test(newFull.replace(new RegExp(OPEN + '[^' + CLOSE + ']*' + CLOSE, 'g'), ''))) why.push('dates');
  if (PERSON_TOKENS.some(k => newFull.includes(tok(k))) && PRONOUN.test(newFull)) why.push('pronoun');
  return { xml: p, text: newFull, review: why.length ? why : null };
}

// yellow highlight on every run of a paragraph, in the place Word expects it
const AFTER_HL = ['u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath', 'rPrChange'];
function highlightRuns(p) {
  return p.replace(/<w:r(\s[^>]*)?>([\s\S]*?)<\/w:r>/g, (all, attrs, inner) => {
    if (!/<w:t[\s>]/.test(inner)) return all;
    if (/^<w:rPr>/.test(inner)) {
      return '<w:r' + (attrs || '') + '>' + inner.replace(/^<w:rPr>([\s\S]*?)<\/w:rPr>/, (x, body) => {
        if (/<w:highlight /.test(body)) return '<w:rPr>' + body.replace(/<w:highlight w:val="[^"]*"\/>/, '<w:highlight w:val="yellow"/>') + '</w:rPr>';
        let idx = -1;
        AFTER_HL.forEach(t => { const i = body.search(new RegExp('<w:' + t + '[\\s/>]')); if (i >= 0 && (idx < 0 || i < idx)) idx = i; });
        return '<w:rPr>' + (idx < 0 ? body + '<w:highlight w:val="yellow"/>' : body.slice(0, idx) + '<w:highlight w:val="yellow"/>' + body.slice(idx)) + '</w:rPr>';
      }) + '</w:r>';
    }
    return '<w:r' + (attrs || '') + '><w:rPr><w:highlight w:val="yellow"/></w:rPr>' + inner + '</w:r>';
  });
}

const INNER_P = /<w:p\b(?:\s[^>]*)?>(?:(?!<w:p\b[\s>])[\s\S])*?<\/w:p>/g;
// one XML part: paragraphs edited, review paragraphs highlighted, and in the
// main document a comment around each run of review paragraphs
function processPart(xml, pats, src, withComments, comments) {
  xml = xml.replace(/<w:commentRangeStart [^>]*\/>|<w:commentRangeEnd [^>]*\/>/g, '')
    .replace(/<w:r(\s[^>]*)?>(?:(?!<\/w:r>)[\s\S])*?<w:commentReference [^>]*\/>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g, '');
  const paras = []; let m, prev = '';
  INNER_P.lastIndex = 0;
  while ((m = INNER_P.exec(xml))) {
    const e = paraEdit(m[0], pats, src, prev);
    paras.push({ start: m.index, end: m.index + m[0].length, e });
    if (e.text.trim()) prev = e.text;
  }
  // blocks of consecutive review paragraphs share one comment
  let out = '', cur = 0, open = null, reviewCount = 0;
  paras.forEach((p, i) => {
    let x = p.e.xml;
    if (p.e.review) {
      reviewCount++;
      x = highlightRuns(x);
      if (withComments) {
        const prevReview = i > 0 && paras[i - 1].e.review && open !== null && xml.slice(paras[i - 1].end, p.start).trim() === '';
        if (!prevReview) {
          open = { id: comments.length + 1, why: new Set() };
          comments.push(open);
          x = x.replace(/^(<w:p\b[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)/, '$1<w:commentRangeStart w:id="' + open.id + '"/>');
        }
        p.e.review.forEach(w => open.why.add(w));
        const nextReview = i + 1 < paras.length && paras[i + 1].e.review && xml.slice(p.end, paras[i + 1].start).trim() === '';
        if (!nextReview) { x = x.replace(/<\/w:p>$/, '<w:commentRangeEnd w:id="' + open.id + '"/><w:r><w:commentReference w:id="' + open.id + '"/></w:r></w:p>'); open = null; }
      }
    } else open = null;
    out += xml.slice(cur, p.start) + x; cur = p.end;
  });
  return { xml: out + xml.slice(cur), reviewCount };
}

function commentsXml(comments, src) {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const text = c => {
    const w = [...c.why], bits = [];
    if (w.includes('trade')) bits.push('This was written for ' + src.label + '. Check it fits ' + tok('specialism') + ' and rewrite it where it does not.');
    if (w.includes('dates')) bits.push('It carries dates from the original document: check or update them.');
    if (w.includes('pronoun')) bits.push('Check he, she or they matches the person named.');
    return 'AHS Ltd review: ' + bits.join(' ');
  };
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments ' + W + '>' + comments.map(c =>
    '<w:comment w:id="' + c.id + '" w:author="AHS Ltd" w:initials="AHS" w:date="2026-10-13T00:00:00Z"><w:p><w:r><w:t xml:space="preserve">' + enc(text(c)) + '</w:t></w:r></w:p></w:comment>').join('') + '</w:comments>';
}

async function buildOne(src, srcKey, [rel, number, title, roles, qids]) {
  const file = path.join(src.root, rel);
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  const pats = idPatterns(src);
  const comments = []; let review = 0;
  const names = Object.keys(z.files).filter(n => !z.files[n].dir);
  // drop: old comments and their companions, SharePoint data, sensitivity labels
  const drop = names.filter(n => /^word\/(comments|commentsExtended|commentsIds|commentsExtensible|people)\.xml$/.test(n) || /^customXml\//.test(n));
  drop.forEach(n => z.remove(n));
  for (const n of names.filter(n => !drop.includes(n))) {
    if (/^word\/media\//.test(n)) { z.file(n, BLANK_PNG); continue; }
    if (/^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(n)) {
      const r = processPart(await z.file(n).async('string'), pats, src, n === 'word/document.xml', comments);
      review += r.reviewCount; z.file(n, r.xml);
    }
  }
  if (comments.length) z.file('word/comments.xml', commentsXml(comments, src));
  // relationships: no old comments or customXml; one link to the new comments
  for (const n of Object.keys(z.files).filter(n => /\.rels$/.test(n) && !z.files[n].dir)) {
    let x = await z.file(n).async('string');
    x = x.replace(/<Relationship [^>]*Target="[^"]*(comments|commentsExtended|commentsIds|commentsExtensible|people)\.xml"[^>]*\/>/g, '')
      .replace(/<Relationship [^>]*Target="\.\.\/customXml\/[^"]*"[^>]*\/>/g, '');
    if (n === 'word/_rels/document.xml.rels' && comments.length)
      x = x.replace('</Relationships>', '<Relationship Id="rIdAhsComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>');
    for (const [re, rep] of pats) x = x.replace(re, rep);
    z.file(n, x);
  }
  let ct = await z.file('[Content_Types].xml').async('string');
  ct = ct.replace(/<Override [^>]*PartName="\/(word\/(comments|commentsExtended|commentsIds|commentsExtensible|people)\.xml|customXml\/[^"]*)"[^>]*\/>/g, '');
  if (comments.length) ct = ct.replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>');
  z.file('[Content_Types].xml', ct);
  // properties: AHS Ltd as author, the template title, nothing else
  z.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + enc(title) + '</dc:title><dc:creator>AHS Ltd</dc:creator><cp:lastModifiedBy>AHS Ltd</cp:lastModifiedBy></cp:coreProperties>');
  if (z.file('docProps/app.xml')) {
    let a = await z.file('docProps/app.xml').async('string');
    a = a.replace(/<Company>[\s\S]*?<\/Company>/, '<Company></Company>').replace(/<Manager>[\s\S]*?<\/Manager>/, '<Manager></Manager>').replace(/<Template>[\s\S]*?<\/Template>/, '<Template>Normal.dotm</Template>');
    z.file('docProps/app.xml', a);
  }
  if (z.file('docProps/custom.xml')) {
    let c = await z.file('docProps/custom.xml').async('string');
    const keep = []; c.replace(/<property [^>]*name="EffectiveDate"[^>]*>[\s\S]*?<\/property>/g, m => { keep.push(m.replace(/(<vt:\w+>)[\s\S]*?(<\/vt:\w+>)/, '$1' + tok('issueDate') + '$2')); });
    z.file('docProps/custom.xml', c.replace(/<Properties([^>]*)>[\s\S]*<\/Properties>/, '<Properties$1>' + keep.join('') + '</Properties>'));
  }
  const id = srcKey.toLowerCase() + '-' + slug(title);
  const buf = await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { id, buf, entry: { id, number, title, folder: rel.split('/')[0], roles: roles === 'both' ? ['designer', 'contractor'] : [roles], qids, review, comments: comments.length } };
}

// anything that could identify a source client, in any part of a template
async function residue(buf, words) {
  const z = await JSZip.loadAsync(buf), hits = [];
  for (const n of Object.keys(z.files).filter(n => !z.files[n].dir && /\.(xml|rels)$/.test(n))) {
    const raw = await z.file(n).async('string');
    const t = dec(raw.replace(/<[^>]+>/g, ''));
    words.forEach(w => { if (new RegExp('(?<![A-Za-z])' + reEsc(w) + '(?![a-z])', 'i').test(t + ' ' + raw)) hits.push(n + ': ' + w); });
    (t.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).filter(e => !/@(archerhs\.co\.uk|phishing\.gov\.uk|ico\.org\.uk)/i.test(e)).forEach(e => hits.push(n + ': email ' + e));
    (t.match(/\b07\d{3}\s?\d{3}\s?\d{3}\b/g) || []).filter(x => x.replace(/\s/g, '') !== '07487615747').forEach(x => hits.push(n + ': mobile ' + x));
  }
  return hits;
}

const residueWords = [].concat(...Object.values(cfg.sources).map(s => s.residue.concat(s.identifiers.map(i => i[0]).filter(w => w.length > 3))));
fs.mkdirSync(OUT, { recursive: true });
fs.readdirSync(OUT).filter(f => /\.docx$/.test(f)).forEach(f => fs.unlinkSync(path.join(OUT, f)));
const manifest = { built: '2026-10-13', note: 'Anonymised AHS Ltd policy templates. Tokens are filled from the client fact sheet by lib/policy-drafts.js.', templates: [] };
let bad = 0;
for (const [key, src] of Object.entries(cfg.sources)) {
  for (const d of src.docs) {
    const r = await buildOne(src, key, d);
    const hits = await residue(r.buf, residueWords);
    if (hits.length) { bad++; console.error('X ' + r.id + ' still identifies a source client:\n   ' + [...new Set(hits)].slice(0, 12).join('\n   ')); continue; }
    fs.writeFileSync(path.join(OUT, r.id + '.docx'), r.buf);
    manifest.templates.push(r.entry);
    console.log('  ' + r.id.padEnd(58) + ' review blocks ' + String(r.entry.comments).padStart(3) + ', paragraphs ' + r.entry.review);
  }
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log((bad ? 'X ' + bad + ' template(s) held back. ' : 'OK ') + manifest.templates.length + ' templates written to data/policy-templates/');
process.exit(bad ? 1 : 0);
