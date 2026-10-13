// ══════════════════════════════════════════════════════════════
//  Policy drafts - fills the anonymised AHS Ltd policy templates
//  (data/policy-templates, built by scripts/build-policy-templates.mjs) with
//  one client's facts. A fact the client has not given is left in the
//  document as a yellow "[Enter ...]" for AHS Ltd; paragraphs written for
//  another trade already carry a yellow highlight and a Word comment.
//  Server side only: the templates are AHS Ltd's, so they are never sent to
//  a browser as templates, only as a filled draft to a consultant.
// ══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const DIR = path.join(__dirname, '..', 'data', 'policy-templates');
const OPEN = '⟦', CLOSE = '⟧';
const TOKEN = new RegExp(OPEN + '(\\w+)' + CLOSE, 'g');

// What each gap asks for, in the words AHS Ltd reads in the draft.
const LABELS = {
  legalName: 'the registered company name', legalNameUpper: 'THE REGISTERED COMPANY NAME', short: 'the short name', address: 'the registered office address',
  companyNo: 'the company number', town: 'the town the company works from', hsLead: 'the name of the person responsible for health and safety',
  hsLeadFirst: 'the H&S lead\x27s first name', hsLeadShort: 'the H&S lead\x27s initial and surname', hsLeadRole: 'the H&S lead\x27s position', hsLeadPhone: 'the H&S lead\x27s phone number', hsLeadEmail: 'the H&S lead\x27s email',
  dpLead: 'the name of the person responsible for data protection', dpEmail: 'the data protection lead\x27s email', dpPhone: 'the data protection lead\x27s phone number',
  seniorStaff: 'the names and roles of the senior staff', tier1Clients: 'the main clients asking for these figures',
  issueMonth: 'the issue month', reviewMonth: 'the review month', issueDate: 'the issue date', version: 'the version', specialism: "the client's work"
};

let _manifest = null;
function manifest() {
  if (!_manifest) _manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  return _manifest;
}
function templatesFor(set) { return manifest().templates.filter(t => t.roles.includes(set)); }

const enc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// The values a draft is filled from: the client's facts, the date of issue.
function valuesFrom(facts, today) {
  const f = facts || {}, t = String(today || new Date().toISOString().slice(0, 10));
  const y = +t.slice(0, 4), m = +t.slice(5, 7), d = t.slice(8, 10);
  const one = s => String(s == null ? '' : s).replace(/\s*\n\s*/g, ', ').trim();
  const lead = one(f.hsLead), parts = lead.split(/\s+/).filter(Boolean);
  const address = one(f.address);
  const addrParts = address.split(',').map(s => s.trim()).filter(Boolean);
  const town = one(f.town) || (addrParts.length >= 2 ? addrParts[addrParts.length - 2].replace(/\s+[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, '') : '');
  const legal = one(f.legalName);
  return {
    legalName: legal, legalNameUpper: legal.toUpperCase(), short: one(f.shortName) || legal, address, companyNo: one(f.regNo), town,
    hsLead: lead, hsLeadFirst: parts[0] || '', hsLeadShort: parts.length > 1 ? parts[0][0] + ' ' + parts[parts.length - 1] : '', hsLeadRole: one(f.hsLeadRole),
    hsLeadPhone: one(f.hsLeadPhone), hsLeadEmail: one(f.hsLeadEmail), dpLead: one(f.dpLead), dpEmail: one(f.dpEmail), dpPhone: one(f.dpPhone),
    seniorStaff: '', tier1Clients: '',
    issueMonth: MONTHS[m - 1] + ' ' + y, reviewMonth: MONTHS[m - 1] + ' ' + (y + 1), issueDate: d + '/' + String(m).padStart(2, '0') + '/' + y, version: '1.0',
    specialism: one(f.description) || one(f.sector) || "this client's work"
  };
}
const gap = k => '[Enter ' + (LABELS[k] || k) + ']';

// One run holding a token: split it so only the gap is highlighted.
function fillRun(run, v, missing) {
  const m = /^<w:r(\s[^>]*)?>(<w:rPr>[\s\S]*?<\/w:rPr>)?(<w:t(?:\s[^>]*)?>)([\s\S]*?)<\/w:t><\/w:r>$/.exec(run);
  const fill = s => s.replace(TOKEN, (x, k) => { if (v[k]) return enc(v[k]); missing.add(k); return enc(gap(k)); });
  if (!m) {
    // a run with more than one text node: fill it, and highlight it whole if a fact is missing
    let miss = false;
    const out = run.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (x, a, t, b) => a + t.replace(TOKEN, (y, k) => { if (v[k]) return enc(v[k]); miss = true; missing.add(k); return enc(gap(k)); }) + b);
    return miss ? addHighlight(out) : out;
  }
  const [, attrs = '', rPr = '', , text] = m;
  const pieces = text.split(TOKEN);   // text, key, text, key, ...
  let out = '';
  pieces.forEach((p, i) => {
    if (i % 2 === 0) { if (p) out += '<w:r' + attrs + '>' + rPr + '<w:t xml:space="preserve">' + p + '</w:t></w:r>'; return; }
    if (v[p]) { out += '<w:r' + attrs + '>' + rPr + '<w:t xml:space="preserve">' + enc(v[p]) + '</w:t></w:r>'; return; }
    missing.add(p);
    out += addHighlight('<w:r' + attrs + '>' + rPr + '<w:t xml:space="preserve">' + enc(gap(p)) + '</w:t></w:r>');
  });
  return out;
}
const AFTER_HL = ['u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath', 'rPrChange'];
function addHighlight(run) {
  return run.replace(/<w:r(\s[^>]*)?>(<w:rPr>([\s\S]*?)<\/w:rPr>)?/, (all, attrs, rPrAll, body) => {
    if (!rPrAll) return '<w:r' + (attrs || '') + '><w:rPr><w:highlight w:val="yellow"/></w:rPr>';
    if (/<w:highlight /.test(body)) return '<w:r' + (attrs || '') + '><w:rPr>' + body.replace(/<w:highlight w:val="[^"]*"\/>/, '<w:highlight w:val="yellow"/>') + '</w:rPr>';
    let idx = -1;
    AFTER_HL.forEach(t => { const i = body.search(new RegExp('<w:' + t + '[\\s/>]')); if (i >= 0 && (idx < 0 || i < idx)) idx = i; });
    return '<w:r' + (attrs || '') + '><w:rPr>' + (idx < 0 ? body + '<w:highlight w:val="yellow"/>' : body.slice(0, idx) + '<w:highlight w:val="yellow"/>' + body.slice(idx)) + '</w:rPr>';
  });
}
function fillXml(xml, v, missing) {
  return xml.replace(/<w:r(\s[^>]*)?>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g, run => run.includes(OPEN) ? fillRun(run, v, missing) : run)
    .replace(TOKEN, (x, k) => { if (v[k]) return enc(v[k]); missing.add(k); return enc(gap(k)); });   // anything left outside a run
}

// One draft: the filled .docx and what AHS Ltd still has to do in it.
async function renderDraft(t, values) {
  const z = await JSZip.loadAsync(fs.readFileSync(path.join(DIR, t.id + '.docx')));
  const missing = new Set();
  for (const n of Object.keys(z.files).filter(n => !z.files[n].dir && /\.(xml|rels)$/.test(n))) {
    const x = await z.file(n).async('string');
    if (!x.includes(OPEN)) continue;
    if (/\.rels$/.test(n) || /^docProps\//.test(n)) z.file(n, x.replace(TOKEN, (y, k) => enc(values[k] || '')));
    else if (n === 'word/comments.xml') z.file(n, x.replace(TOKEN, (y, k) => enc(values[k] || '')));
    else z.file(n, fillXml(x, values, missing));
  }
  const buf = await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buf, missing: [...missing].filter(k => k !== 'specialism').map(k => LABELS[k] || k) };
}

// Every draft for a question set, named as the submission folders name them.
async function draftsFor(set, facts, today) {
  if (set !== 'designer' && set !== 'contractor') throw new Error('set must be designer or contractor');
  const v = valuesFrom(facts, today);
  const code = String(v.short || 'CLIENT').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'CLIENT';
  const mm = String(today || new Date().toISOString()).slice(5, 7), yy = String(today || new Date().toISOString()).slice(2, 4);
  const out = [];
  for (const t of templatesFor(set)) {
    const r = await renderDraft(t, v);
    const file = (t.number ? t.number + '_' : '') + t.title + '_' + code + '_' + mm + '_' + yy + '.docx';
    out.push({ id: t.id, folder: t.folder, file, title: t.title, qids: t.qids, reviewBlocks: t.comments, missing: [...new Set(r.missing)], b64: r.buf.toString('base64') });
  }
  return out;
}

module.exports = { templatesFor, valuesFrom, renderDraft, draftsFor, LABELS };
