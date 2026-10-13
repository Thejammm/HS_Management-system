// Builds the Constructionline layer on top of the CAS core.
//
//   node scripts/build-constructionline.mjs
//
// Reads the two question banks read from the portal (data/constructionline/)
// and the master list in public/reports/accred-core.js, then:
//   1. gives every master question refs.constructionline: every portal REF it
//      answers, in portal order;
//   2. makes every REF that no master question answers a Constructionline
//      extra (scheme "constructionline", its section names, verbatim text);
//   3. writes public/reports/cl-bank.js, the two banks as reference data for
//      the section view (plain script, no import or export, like accred-core);
//   4. writes public/reports/constructionline-mapping.csv, the table a person
//      reads to check the mapping.
// CAS stays the master: nothing here changes a question's wording, its roles
// or its per-set refs, so the existing journey and the CHAS view are untouched.
// Run it again whenever the banks are refreshed.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const CORE = path.join(root, 'public', 'reports', 'accred-core.js');
const BANKS = { designer: 'CL Question Bank - Designer.json', contractor: 'CL Question Bank - Contractor.json' };

// REFs the master list does not carry yet but which ask exactly what a master
// question asks. Each is a judgement, recorded in BUILD-LOG.md.
const MAP_TO_CAS = {
  '9999': 'BS-05'   // designer: duty holder roles held under the Building Safety Act
};

// Extras that hold a fact the client fact sheet keeps (Company set-up).
const FACT_OF_REF = {
  '299': 'regIsHead',
  '301': 'regOffice', '302': 'regOffice', '303': 'regOffice', '304': 'regOffice', '305': 'regOffice', '306': 'regOffice', '307': 'regOffice',
  '319': 'headOffice', '320': 'headOffice', '321': 'headOffice', '322': 'headOffice', '323': 'headOffice', '324': 'headOffice', '325': 'headOffice',
  '330': 'directors',
  '2684': 'paye', '3603': 'paye',
  '2813': 'qset', '3373': 'qset',
  '25': 'insurance',
  '347': 'companyNo', '384': 'companyNo',
  '2308': 'legalName', '339': 'tradeName'
};

const BSA = name => /^Building Safety Act/i.test(name);

// ── read the master block out of accred-core.js ──
const coreSrc = fs.readFileSync(CORE, 'utf8');
const MARK = '  var MASTER = ';
const mStart = coreSrc.indexOf(MARK);
if (mStart < 0) throw new Error('MASTER block not found in accred-core.js');
const mEnd = coreSrc.indexOf('\n', mStart);
const masterJson = coreSrc.slice(mStart + MARK.length, mEnd).replace(/;\s*$/, '');
const MASTER = JSON.parse(masterJson);
if (MASTER.questions.length !== 77) throw new Error('expected 77 master questions, found ' + MASTER.questions.length);

// REF -> master id, from the per-set refs already on each question
const refToQ = {};
for (const q of MASTER.questions) {
  for (const v of Object.values(q.refs || {})) for (const r of [].concat(v)) {
    const k = String(r);
    if (refToQ[k] && refToQ[k] !== q.id) throw new Error('REF ' + k + ' sits on ' + refToQ[k] + ' and ' + q.id);
    refToQ[k] = q.id;
  }
}
for (const [r, id] of Object.entries(MAP_TO_CAS)) {
  if (!MASTER.questions.some(q => q.id === id)) throw new Error('MAP_TO_CAS names ' + id + ', which is not a master question');
  refToQ[r] = id;
}

// ── read the banks ──
const banks = {};
for (const [set, file] of Object.entries(BANKS)) {
  const b = JSON.parse(fs.readFileSync(path.join(root, 'data', 'constructionline', file), 'utf8'));
  banks[set] = {
    set: b.set, source: b.source,
    sections: b.sections.map(s => ({ name: s.section, qs: s.questions.map(([ref, type, text]) => [String(ref), String(type), String(text)]) }))
  };
}

// ── every REF in portal order, with where it sits ──
const seen = new Map();   // ref -> { type, text, sections:Set, sets:Set, order }
let order = 0;
for (const set of ['designer', 'contractor']) {
  for (const sec of banks[set].sections) for (const [ref, type, text] of sec.qs) {
    if (!seen.has(ref)) seen.set(ref, { type, text, sections: new Set(), sets: new Set(), order: order++ });
    const x = seen.get(ref);
    if (x.text !== text) throw new Error('REF ' + ref + ' has two wordings across the banks');
    x.sections.add(sec.name); x.sets.add(set);
  }
}

// ── 1. refs.constructionline on each master question ──
const clRefs = {};
for (const [ref, x] of [...seen.entries()].sort((a, b) => a[1].order - b[1].order)) {
  const id = refToQ[ref]; if (!id) continue;
  (clRefs[id] = clRefs[id] || []).push(ref);
}
for (const q of MASTER.questions) {
  q.refs = Object.assign({}, q.refs);
  if (clRefs[q.id]) q.refs.constructionline = clRefs[q.id]; else delete q.refs.constructionline;
}

// ── 2. the extras ──
const extras = [];
for (const [ref, x] of [...seen.entries()].sort((a, b) => a[1].order - b[1].order)) {
  if (refToQ[ref]) continue;
  const secs = [...x.sections];
  const e = { id: 'CL-' + ref, scheme: 'constructionline', ref, type: x.type, text: x.text, sections: secs, sets: [...x.sets] };
  if (secs.some(BSA)) e.bsa = true;
  if (FACT_OF_REF[ref]) e.fact = FACT_OF_REF[ref];
  extras.push(e);
}
MASTER.extras = extras;
MASTER.constructionline = {
  captured: '2026-10-13',
  source: 'Constructionline question banks read from RSSC (Designer, 418 questions) and MVL (Contractor, 377 questions) on 13 October 2026. Follow-up questions shown only after a particular answer, and buyer Upgrade modules, are not included.',
  rule: 'Every REF either maps to a CAS master question (refs.constructionline) or is a Constructionline extra (MASTER.extras, scheme constructionline).'
};

// check: every REF in both banks is accounted for, once
const mapped = new Set(Object.values(clRefs).flat());
const extraRefs = new Set(extras.map(e => e.ref));
for (const ref of seen.keys()) {
  const n = (mapped.has(ref) ? 1 : 0) + (extraRefs.has(ref) ? 1 : 0);
  if (n !== 1) throw new Error('REF ' + ref + ' is accounted for ' + n + ' times');
}

// ── write accred-core.js (slice, never String.replace on the big block) ──
const out = coreSrc.slice(0, mStart + MARK.length) + JSON.stringify(MASTER) + ';' + coreSrc.slice(mEnd);
fs.writeFileSync(CORE, out);

// ── 3. cl-bank.js ──
const bankJs = `// ══════════════════════════════════════════════════════════════
//  Constructionline question banks - reference data for the section view.
//  GENERATED by scripts/build-constructionline.mjs from
//  data/constructionline/*.json. Do not edit by hand: refresh the JSON and
//  run the script again.
//
//  Each set lists the portal's sections in portal order, and each section its
//  questions as [REF, answer type, question text], the text exactly as
//  written in Constructionline.
// ══════════════════════════════════════════════════════════════
(function (root) {
  'use strict';
  root.CLBank = ${JSON.stringify({ captured: MASTER.constructionline.captured, sets: banks })};
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
`;
fs.writeFileSync(path.join(root, 'public', 'reports', 'cl-bank.js'), bankJs);

// ── 4. the mapping table a person reads ──
const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const qById = Object.fromEntries(MASTER.questions.map(q => [q.id, q]));
const rows = [['Question set', 'Portal section', 'No in section', 'REF', 'Answer type', 'Constructionline question (verbatim)', 'Maps to', 'CAS question (AHS master wording)', 'Mandatory under CAS', 'Fact sheet field']];
for (const set of ['designer', 'contractor']) {
  for (const sec of banks[set].sections) sec.qs.forEach(([ref, type, text], i) => {
    const id = refToQ[ref];
    const q = id ? qById[id] : null;
    const e = id ? null : extras.find(x => x.ref === ref);
    rows.push([banks[set].set, sec.name, i + 1, ref, type, text.replace(/\s+/g, ' ').trim(),
      id || ('Constructionline extra ' + e.id), q ? q.text : 'Not in CAS: shown only on the Constructionline view', q ? (q.cas ? 'Yes' : 'No') : '', e && e.fact ? e.fact : '']);
  });
}
fs.writeFileSync(path.join(root, 'public', 'reports', 'constructionline-mapping.csv'), '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n');

const total = seen.size;
console.log(`Constructionline layer built: ${total} distinct REFs; ${mapped.size} map to ${Object.keys(clRefs).length} CAS questions, ${extras.length} are extras (${extras.filter(e => e.bsa).length} Building Safety Act).`);
console.log(`Bank questions: designer ${banks.designer.sections.reduce((n, s) => n + s.qs.length, 0)}, contractor ${banks.contractor.sections.reduce((n, s) => n + s.qs.length, 0)}.`);
