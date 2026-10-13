// Policy drafts - the anonymised AHS Ltd templates (data/policy-templates)
// filled from one client's fact sheet by lib/policy-drafts.js. Every draft
// must open (well-formed Word XML), carry no unfilled token, show the
// client's facts, mark each missing fact in yellow, and carry the review
// comments; and the public templates must hold nothing that looks like a
// real person's contact details. Node only. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const need = createRequire(import.meta.url);
const JSZip = need('jszip');
const { SaxesParser } = need('saxes');
const P = need('../lib/policy-drafts.js');
const here = path.dirname(url.fileURLToPath(import.meta.url));
const DIR = path.join(here, '..', 'data', 'policy-templates');
const TODAY = '2026-10-13';
const FACTS = { legalName: 'Example Design Ltd', shortName: 'EDL', address: '1 Example Street, Leeds, LS1 1AA', regNo: '01234567', hsLead: 'Jane Doe', hsLeadRole: 'Managing Director', description: 'a lighting design consultancy' };

function wellFormed(xml, name) {
  const p = new SaxesParser({ xmlns: false }); let err = null;
  p.on('error', e => { err = e; }); p.write(xml).close();
  assert.equal(err, null, name + ' is not well-formed XML: ' + (err && err.message));
}
async function parts(buf) {
  const z = await JSZip.loadAsync(buf), out = {};
  for (const n of Object.keys(z.files).filter(n => !z.files[n].dir && /\.(xml|rels)$/.test(n))) out[n] = await z.file(n).async('string');
  return out;
}

test('the template set: one manifest, a file for each, a set for each role', () => {
  const m = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  assert.ok(m.templates.length >= 60);
  m.templates.forEach(t => assert.ok(fs.existsSync(path.join(DIR, t.id + '.docx')), t.id + ' has its file'));
  const d = P.templatesFor('designer'), c = P.templatesFor('contractor');
  assert.ok(d.length >= 35 && c.length >= 35, 'designer ' + d.length + ', contractor ' + c.length);
  assert.ok(d.some(t => t.title === 'Health and Safety Policy') && c.some(t => t.title === 'Health and Safety Policy'), 'each role has its own H&S policy');
  assert.ok(c.some(t => t.title === 'Hot Works Permit') && !d.some(t => t.title === 'Hot Works Permit'), 'contractor-only documents stay with the contractor');
  assert.ok(d.some(t => /Design for Places of Work/.test(t.title)) && !c.some(t => /Design for Places of Work/.test(t.title)), 'designer-only documents stay with the designer');
  const qids = new Set(m.templates.flatMap(t => t.qids));
  assert.ok(['HS-02', 'HS-06', 'HS-07', 'GV-01', 'GV-02', 'IS-02', 'FR-01', 'QA-01', 'EN-01'].every(q => qids.has(q)), 'the drafts cover the core policy questions');
});

test('every draft opens, is filled from the fact sheet, and leaves no token behind', async () => {
  for (const set of ['designer', 'contractor']) {
    const drafts = await P.draftsFor(set, FACTS, TODAY);
    assert.equal(drafts.length, P.templatesFor(set).length);
    for (const d of drafts) {
      assert.match(d.file, /_EDL_10_26\.docx$/, d.file);
      assert.match(d.folder, /^\d\d /, d.file + ' has a submission folder');
      const x = await parts(Buffer.from(d.b64, 'base64'));
      for (const [n, xml] of Object.entries(x)) {
        wellFormed(xml, d.file + ' ' + n);
        assert.ok(!xml.includes('⟦') && !xml.includes('⟧'), d.file + ' ' + n + ' still has a token');
      }
      const all = Object.values(x).join(' ');
      if (/Policy/.test(d.title)) assert.ok(/Example Design Ltd|EDL/.test(all), d.file + ' names the client');
    }
  }
});

test('a missing fact is left in yellow for AHS Ltd; a review paragraph carries a comment naming the client\'s work', async () => {
  const drafts = await P.draftsFor('designer', FACTS, TODAY);
  const card = drafts.find(d => d.title === 'Reporting Routes Card');
  assert.ok(card.missing.includes('the name of the person responsible for data protection'), 'missing: ' + card.missing.join('; '));
  const doc = (await parts(Buffer.from(card.b64, 'base64')))['word/document.xml'];
  assert.match(doc, /<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">\[Enter the name of the person responsible for data protection\]/);
  const hs = drafts.find(d => d.title === 'Health and Safety Policy');
  const x = await parts(Buffer.from(hs.b64, 'base64'));
  assert.ok(hs.reviewBlocks > 0 && x['word/comments.xml'], 'the H&S policy has review comments');
  assert.match(x['word/comments.xml'], /Check it fits a lighting design consultancy/);
  const text = x['word/document.xml'].replace(/<[^>]+>/g, '');
  assert.match(text, /Jane Doe, Managing Director/);
  assert.match(text, /October 2027/, 'the review date is a year on');
  // once the fact is given, the gap goes
  const full = await P.draftsFor('designer', Object.assign({}, FACTS, { dpLead: 'Sam Smith', dpEmail: 'sam@example.com', dpPhone: '0113 000 0000', hsLeadPhone: '0113 000 0001' }), TODAY);
  assert.deepEqual(full.find(d => d.title === 'Reporting Routes Card').missing, []);
});

test('the public templates hold no personal contact details and no pictures', async () => {
  const m = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  for (const t of m.templates) {
    const z = await JSZip.loadAsync(fs.readFileSync(path.join(DIR, t.id + '.docx')));
    for (const n of Object.keys(z.files).filter(n => !z.files[n].dir)) {
      if (/^word\/media\//.test(n)) { assert.ok((await z.file(n).async('nodebuffer')).length < 200, t.id + ' ' + n + ' is a blank picture'); continue; }
      if (!/\.(xml|rels)$/.test(n)) continue;
      const text = (await z.file(n).async('string')).replace(/<[^>]+>/g, ' ');
      (text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []).forEach(e => assert.match(e, /@(archerhs\.co\.uk|phishing\.gov\.uk|ico\.org\.uk)$/i, t.id + ' carries an email address: ' + e));
      (text.match(/\b07\d{3}\s?\d{3}\s?\d{3}\b/g) || []).forEach(p => assert.equal(p.replace(/\s/g, ''), '07487615747', t.id + ' carries a mobile number: ' + p));
      assert.ok(!/customXml|people\.xml/.test(n), t.id + ' still has ' + n);
    }
  }
});
