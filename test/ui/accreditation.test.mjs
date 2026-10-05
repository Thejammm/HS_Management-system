// ══════════════════════════════════════════════════════════════
//  The accreditation journey on the Accreditation tab: scheme and role,
//  the questions by area, evidence with its date and signature, rejections
//  with their history, the Word pack, site inspection evidence, and the
//  earlier CAS assessment kept whole. Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { openApp, seed, wait, reporter, root } from './harness.mjs';

const require = createRequire(import.meta.url);
const JSZip = require(path.join(root, 'node_modules', 'jszip'));
const R = reporter('Accreditation journey');
const { browser, page, errors } = await openApp();

const todayPlus = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const DOCS = [
  { id: 'd-pol', name: 'H&S policy part 2', dated: todayPlus(-60), signedBy: 'J Morley, MD', signedDirector: true, link: 'C:\\MVL\\Policies\\HS policy.pdf' },
  { id: 'd-old', name: 'Drug and alcohol policy', dated: todayPlus(-400) },
  { id: 'd-ab', name: 'Anti-bribery policy', dated: todayPlus(-30), signedBy: 'J Morley', signedDirector: true },
];
const MEMS = [{ id: 'm-cl', name: 'Constructionline Gold', expiry: todayPlus(150) }];
const OLD_CAS = { gates: { '21': true }, roles: {}, status: { '1-4': { v: 'ready', by: 'Simon', at: '2026-07-01T10:00:00Z' }, '71': { v: 'gap', by: 'Simon', at: '2026-07-01T10:00:00Z' } }, evidence: {} };

// ── a client who has never opened the journey: nothing added, CAS kept ──
await seed(page, { documents: DOCS, memberships: MEMS, cas: JSON.parse(JSON.stringify(OLD_CAS)) }, 'cas');
{
  const t = await page.evaluate(() => ({
    accred: S.accred, cas: JSON.stringify(S.cas),
    hero: (document.getElementById('acjHero') || {}).innerText || '',
    legacyOpen: document.getElementById('casLegacy').open,
    casTables: document.querySelectorAll('#casLegacy #casContainer table').length,
    cockpit: (typeof _casStats === 'function') ? _casStats().ready : null,
  }));
  R.ok(t.accred === undefined, 'opening the tab adds nothing to a client record');
  R.ok(t.cas === JSON.stringify({ gates: { '21': true }, roles: {}, status: { '1-4': { v: 'ready', by: 'Simon', at: '2026-07-01T10:00:00Z' }, '71': { v: 'gap', by: 'Simon', at: '2026-07-01T10:00:00Z' } }, evidence: {} }), 'the earlier CAS assessment is untouched');
  R.ok(t.legacyOpen && t.casTables >= 8, 'a client with a CAS assessment and no journey sees it open, whole (' + t.casTables + ' sections)');
  R.ok(/Start at step 01/.test(t.hero), 'the journey opens on where things stand, pointing at step 01');
  R.ok(t.cockpit === 1, 'the cockpit still reads the CAS assessment before the journey starts');
}

// ── step 01: role and scheme ──
await page.evaluate(() => { toggleAccredRole('contractor'); toggleAccredScheme('cl', true); setAccredMembership('cl', 'm-cl'); });
await wait(page, 350);
const lineOrder = () => page.evaluate(() => [...document.querySelectorAll('.acj-line')].map(l => l.id));
const order0 = await lineOrder();
{
  const t = await page.evaluate(() => ({
    lines: document.querySelectorAll('.acj-line').length,
    areas: [...document.querySelectorAll('.acj-stage h3')].map(h => h.textContent),
    designer: !!document.getElementById('acjL-DS-01'),
    renew: document.querySelector('.acj-renew') ? document.querySelector('.acj-renew').innerText : '',
    legacyOpen: document.getElementById('casLegacy').open,
    must: [...document.querySelectorAll('.acj-must')].length,
  }));
  R.ok(t.lines === 72 && !t.designer, 'a contractor sees the 72 contractor questions, no designer ones (' + t.lines + ')');
  R.ok(t.areas[0] === 'Scheme and role' && t.areas.includes('H&S core') && t.areas.includes('CDM contractor') && !t.areas.includes('CDM designer') && t.areas[t.areas.length - 1] === 'Submission pack', 'the steps run scheme and role, the areas, then the pack');
  R.ok(/Constructionline Gold \(Once For All\) renews/.test(t.renew) && /in 150 days/.test(t.renew), 'the renewal date comes from the certificate linked to the scheme');
  R.ok(t.must === 25, 'every mandatory question is flagged on its line (' + t.must + ')');
}

// ── ticking does not move a line ──
await page.evaluate(() => { toggleAccredLine('HS-02'); });
await wait(page, 200);
await page.select('#acjL-HS-02 select.acj-in', 'doc:d-pol');
await wait(page, 350);
await page.evaluate(() => { toggleAccredLine('HS-05'); });
await wait(page, 200);
await page.click('#acjL-HS-05 .acj-detail .acj-seg button:last-child');   // No
await wait(page, 350);
{
  const order1 = await lineOrder();
  R.ok(JSON.stringify(order0) === JSON.stringify(order1), 'answering lines leaves every line exactly where it was');
  const t = await page.evaluate(() => ({
    hs02: document.getElementById('acjL-HS-02').querySelector('.acj-st').innerText.replace(/\s+/g, ' ').trim(),
    hs02exp: document.getElementById('acjL-HS-02').querySelector('.acj-exp').innerText,
    facts: document.querySelector('#acjL-HS-02 .acj-facts') ? document.querySelector('#acjL-HS-02 .acj-facts').innerText : '',
    hs05: document.getElementById('acjL-HS-05').querySelector('.acj-st').innerText.replace(/\s+/g, ' ').trim(),
    saved: JSON.stringify(S.accred.answers),
  }));
  R.ok(/^EVIDENCED/i.test(t.hs02) && /in 30\d days|in 3\d\d days/.test(t.hs02exp), 'the status sits on the line with its countdown (' + t.hs02 + ' / ' + t.hs02exp.replace(/\s+/g, ' ') + ')');
  R.ok(/J Morley, MD/.test(t.facts) && /a director/.test(t.facts) && /HS policy\.pdf/.test(t.facts), 'the evidence shows its date, who signed it and its file');
  R.ok(/Declared No/.test(t.hs05), 'a declaration is answered on its line');
  R.ok(!/"k"|evidenced|Evidenced/.test(t.saved), 'no status is stored - only the facts');
}

// ── freshness: an old document and an unsigned one are caught ──
await page.evaluate(() => { toggleAccredLine('HS-06'); });
await wait(page, 200);
await page.select('#acjL-HS-06 select.acj-in', 'doc:d-old');
await wait(page, 350);
{
  const t = await page.evaluate(() => document.getElementById('acjL-HS-06').querySelector('.acj-st').innerText.replace(/\s+/g, ' ').trim());
  R.ok(/^GAP Older than 12 months/i.test(t), 'a document older than 12 months is a gap, and says why (' + t + ')');
}

// ── a count jumps to its lines and pins them while you work ──
await page.evaluate(() => setAccredFilter('gap'));
await wait(page, 400);
{
  const n1 = await page.evaluate(() => document.querySelectorAll('.acj-line').length);
  const gaps = await page.evaluate(() => AccredCore.summary(S).counts.gap);
  R.ok(n1 === gaps, 'clicking Gaps shows just the ' + gaps + ' gap lines (' + n1 + ')');
  await page.evaluate(() => { _acjOpen['HS-03'] = true; renderAccred(); });
  await wait(page, 250);
  await page.select('#acjL-HS-03 select.acj-in', 'doc:d-pol');
  await wait(page, 350);
  const t = await page.evaluate(() => ({ n: document.querySelectorAll('.acj-line').length, there: !!document.getElementById('acjL-HS-03'), st: document.getElementById('acjL-HS-03').querySelector('.acj-st b').textContent }));
  R.ok(t.n === n1 && t.there && /Evidenced/i.test(t.st), 'a pinned line put right stays on screen, now evidenced, until the filter is cleared');
  await page.evaluate(() => setAccredFilter(null));
  await wait(page, 300);
  R.ok(await page.evaluate(() => document.querySelectorAll('.acj-line').length) === 72, 'clearing the filter shows every line again');
}

// ── not applicable needs a reason ──
await page.evaluate(() => { _acjOpen['BS-08'] = true; renderAccred(); });
await wait(page, 250);
await page.evaluate(() => setAccredNA('BS-08'));
await wait(page, 200);
{
  const blank = await page.evaluate(() => !(S.accred.answers['BS-08'] && S.accred.answers['BS-08'].na));
  await page.type('#acjNa-BS-08', 'No work on higher-risk buildings');
  await page.evaluate(() => setAccredNA('BS-08'));
  await wait(page, 300);
  const t = await page.evaluate(() => document.getElementById('acjL-BS-08').querySelector('.acj-st').innerText.replace(/\s+/g, ' ').trim());
  R.ok(blank && /^NOT APPLICABLE No work on higher-risk buildings/i.test(t), 'not applicable is refused without a reason, then carries it on the line');
}

// ── a rejection: comment, the document behind it, resubmitted, history kept ──
await page.evaluate(() => { _acjOpen['GV-09'] = true; renderAccred(); });
await wait(page, 250);
await page.select('#acjL-GV-09 select.acj-in', 'doc:d-ab');
await wait(page, 300);
await page.evaluate(() => { document.querySelector('#acjL-GV-09 details.acj-rejadd').open = true; });
await page.type('#acjRejNote-GV-09', 'This is the anti-bribery policy, not anti-bullying');
await page.evaluate(() => recordAccredRejection('GV-09'));
await wait(page, 350);
{
  const t = await page.evaluate(() => ({ st: document.getElementById('acjL-GV-09').querySelector('.acj-st b').textContent, box: (document.querySelector('#acjL-GV-09 .acj-rejbox') || {}).innerText || '', rejected: AccredCore.summary(S).counts.rejected }));
  R.ok(/Rejected/i.test(t.st) && /anti-bribery policy, not anti-bullying/.test(t.box) && /Evidence behind it: Anti-bribery policy/.test(t.box), 'a pasted rejection shows on the line with the document behind it');
  R.ok(t.rejected === 1, 'the overview counts it as rejected');
}
await page.evaluate(() => markAccredResubmitted('GV-09'));
await wait(page, 350);
{
  const t = await page.evaluate(() => ({ st: document.getElementById('acjL-GV-09').querySelector('.acj-st b').textContent, hist: [...document.querySelectorAll('#acjL-GV-09 .acj-hist li')].map(l => l.innerText) }));
  R.ok(!/Rejected/i.test(t.st) && t.hist.length === 2 && /Rejected/.test(t.hist[0]) && /Resubmitted/.test(t.hist[1]), 'resubmitting clears the rejection and both events stay in the history');
}

// ── answer once: HS-01 answered once, in every set that asks it ──
await page.evaluate(() => { _acjOpen['HS-01'] = true; renderAccred(); });
await wait(page, 250);
await page.type('#acjL-HS-01 textarea.acj-in', 'J Morley, Managing Director');
await page.evaluate(() => document.querySelector('#acjL-HS-01 textarea.acj-in').blur());
await wait(page, 250);
{
  const t = await page.evaluate(() => ({ used: [...document.querySelectorAll('#acjL-HS-01 .acj-used li')].map(l => l.innerText), row: document.getElementById('acjL-HS-01').querySelector('.acj-st b').textContent,
    pack: AccredCore.packRows(S, 'cl').flatMap(g => g.rows.filter(r => r.id === 'HS-01').map(r => g.set + '|' + r.answer)) }));
  R.ok(t.used.length === 2 && /REF 2827/.test(t.used[0]) && /REF 1463/.test(t.used[1]), 'the line shows everywhere its one answer is used');
  R.ok(/Evidenced/i.test(t.row), 'typing an answer updates its line without a rebuild');
  R.ok(t.pack.length === 2 && t.pack.every(x => /J Morley, Managing Director$/.test(x)), 'the pack carries the one answer under both sets');
}

// ── site inspection evidence from the Site Safety Inspection link ──
await page.evaluate(() => {
  addLinkedApp('siteinspection');
  const l = S.linkedApps[S.linkedApps.length - 1]; l.remoteTenantId = 'MVL';
  _mergeSiteEvidence(l, { fetchedAt: new Date().toISOString(), records: [{ inspectionId: 'insp-1', project: 'Woldgate School', visit: 4, date: new Date().toISOString().slice(0, 10), inspector: 'Simon Archer', reportName: 'Safety Inspection Report - Woldgate School - visit 4',
    items: [{ qids: ['HS-17'], checkId: 'c25_5', check: 'Workforce consultation', note: 'Weekly toolbox talk signed by all six', photo: 'data:image/jpeg;base64,/9j/4AAQ' },
            { qids: ['HS-02'], checkId: 'x', check: 'Should not replace the chosen policy', note: '' },
            { qids: ['HS-15', 'BS-06'], checkId: 'report', check: 'The site safety inspection report', note: '12 checks reviewed' }] }] });
  _acjOpen['HS-17'] = true; renderAccred();
});
await wait(page, 300);
{
  const t = await page.evaluate(() => ({ link: S.linkedApps.find(l => l.kind === 'siteinspection'), st: document.getElementById('acjL-HS-17').querySelector('.acj-st').innerText.replace(/\s+/g, ' ').trim(),
    facts: (document.querySelector('#acjL-HS-17 .acj-facts') || {}).innerText || '', photo: !!document.querySelector('#acjL-HS-17 img.acj-photo'),
    hs02: AccredCore.statusOf(S, AccredCore.byId('HS-02')).ev.facts.name, focus: _acjFocusPayload().map(f => f.id), focusSite: _acjFocusPayload().every(f => !!AccredCore.byId(f.id).site) }));
  R.ok(t.link && t.link.baseUrl === 'https://siteinspection.archerhs.co.uk' && t.link.label === 'Site Safety Inspection', 'the Site Safety Inspection app links like the other apps');
  R.ok(/^EVIDENCED From a site inspection/i.test(t.st), 'a tagged check sent from site evidences its question (' + t.st + ')');
  R.ok(/Woldgate School, visit 4/.test(t.facts) && /Weekly toolbox talk signed by all six/.test(t.facts) && /stands in from a site inspection/.test(t.facts) && t.photo, 'it is dated, linked back to its inspection report, with its note and photo');
  R.ok(t.hs02 === 'H&S policy part 2', 'site evidence never replaces a document the client picked');
  R.ok(!t.focus.includes('HS-17') && t.focus.length > 0 && t.focusSite, 'focus areas sent to the inspector are the open questions a site inspection can evidence');
}

// ── one readiness figure: the cockpit and the review metric follow the journey ──
{
  const t = await page.evaluate(() => { const m = AccredCore.summary(S); const c = _casStats(); return { pct: m.pct, c: c.pctReady, ready: c.ready, mr: m.ready }; });
  R.ok(t.pct === t.c && t.ready === t.mr, 'once started, the cockpit reads the journey (' + t.c + '%)');
}

// ── the document register records date, signatory and expiry ──
await page.evaluate(() => openDocModal('d-old'));
await wait(page, 250);
await page.evaluate(() => { document.getElementById('docDated').value = new Date().toISOString().slice(0, 10); document.getElementById('docSignedBy').value = 'J Morley'; document.getElementById('docSignedDirector').checked = true; saveDocument('d-old'); });
await wait(page, 350);
{
  const t = await page.evaluate(() => ({ d: S.documents.find(x => x.id === 'd-old'), st: AccredCore.statusOf(S, AccredCore.byId('HS-06')).k }));
  R.ok(t.d.signedBy === 'J Morley' && t.d.signedDirector === true && !!t.d.dated, 'the document form records when it is dated and who signed it');
  R.ok(t.st === 'evidenced', 'dating the document brings its question back into date');
}

// ── the Word pack ──
const tmp = path.join(os.tmpdir(), 'acj-pack-test.docx');
{
  const p = await page.evaluate(async () => { const r = buildAccredPack('cl'); const b = new Uint8Array(await r.blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return { name: r.name, b64: btoa(s), sets: r.groups.length }; });
  fs.writeFileSync(tmp, Buffer.from(p.b64, 'base64'));
  const zip = await JSZip.loadAsync(fs.readFileSync(tmp));
  const parts = Object.keys(zip.files).sort();
  const xml = await zip.file('word/document.xml').async('string');
  const ftr = await zip.file('word/footer1.xml').async('string');
  const wellFormed = await page.evaluate(x => !new DOMParser().parseFromString(x, 'application/xml').querySelector('parsererror'), xml);
  R.ok(/^Constructionline Gold pack - .* - \d{4}-\d{2}-\d{2}\.docx$/.test(p.name), 'the pack is named for the scheme, the client and the day (' + p.name + ')');
  R.ok(['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/footer1.xml', 'word/styles.xml'].every(x => parts.includes(x)), 'it is a complete Word package');
  R.ok(wellFormed, 'its document XML is well formed');
  const iCl = xml.indexOf('OFA Health &amp; Safety (SSIP), Contractor set'), iCrg = xml.indexOf('Corporate Responsibility and Governance (5.0)');
  R.ok(iCl > 0 && iCrg > iCl && xml.indexOf('2827') > iCl && /J Morley, Managing Director/.test(xml), 'it runs in the scheme\u2019s order with each REF, answer and evidence');
  R.ok(/HS policy\.pdf/.test(xml) && /w:orient="landscape"/.test(xml) && /NUMPAGES/.test(ftr) && /Prepared for/.test(ftr), 'evidence file names, landscape pages, and the house footer');
  R.ok(p.sets >= 15, 'every set the client answers is in it (' + p.sets + ')');
}

// ── reload: everything recorded survives ──
const before = await page.evaluate(() => JSON.stringify(S.accred));
await page.evaluate(() => { saveData(); });
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction('typeof S === "object" && typeof switchTab === "function"');
await wait(page, 500);
{
  const after = await page.evaluate(() => { switchTab('cas'); return JSON.stringify(S.accred); });
  R.ok(after === before, 'after a reload the journey reads back exactly as it was saved');
}

R.ok(fs.statSync(tmp).size > 3000, 'the pack was written to disk for opening in Word');
console.log('  pack written to ' + tmp);
await R.done(browser, errors);
