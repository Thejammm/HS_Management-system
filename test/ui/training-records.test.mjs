// ══════════════════════════════════════════════════════════════
//  Training records on the Documents tab. Simon, 2026-09-30: "add another
//  section below the inspection reports called training - the same as the
//  risk assessment and inspection sections - capturing employees' training
//  records on a simple tile to show if they have done what I ask or haven't,
//  linked to the sign-off register". Chosen: one tile per employee; what is
//  asked = the CPD & training section of the sign-off register; a matched
//  certificate is shown and counts only when Record as done is pressed.
//
//  One record is a real certificate Compass itself issued, filed under a
//  meaningless name - so the reader is proved against Compass's own layout.
//  The PDF reader loads from cdnjs.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Training records - one tile per employee, linked to sign-off');
const { browser, page, errors } = await openApp();

await seed(page, {
  company: { legalName: 'Easy Travel Service' },
  trainRegister: [], trainFolder: { path: '', lastSync: '' },
  policySignoff: { policies: [
      { id: 'p1', title: 'Health and Safety Policy', type: 'Policy', delivered: '2026-09-01', riskIds: [] },
      { id: 'c1', title: 'Electric and hybrid vehicle safety', type: 'Training / CPD', delivered: '2026-09-10', riskIds: [], source: { kind: 'cpdtopic', id: 'mvr-ev' } },
      { id: 'c2', title: 'H&S learning - September 2026', type: 'Training / CPD', delivered: '2026-09-12', riskIds: [], source: { kind: 'cpd', id: '2026-09' } } ],
    staff: [{ id: 's1', name: 'Mick Kane', role: 'Workshop Supervisor' }, { id: 's2', name: 'Priya Nair', role: 'Technician' }, { id: 's3', name: 'Chloe Barrett', role: 'Office' }],
    signed: {}, log: [], logMigrated: true } }, 'documents');
await page.evaluate(() => { _psoRecord('s1', 'c1', 'acknowledged', { method: 'link' }); _psoRebuildSigned(); renderTrnRegister(); });
await wait(page, 300);

// ── the section is there, below the inspection reports, before anything is indexed ──
{
  const t = await page.evaluate(() => {
    const insr = document.getElementById('insrContainer'), tools = document.getElementById('trnrTools'), list = document.getElementById('trnrContainer');
    const after = el => !!(insr.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { order: after(tools) && after(list) && !!(tools.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING),
      head: tools.querySelector('.card-band h3').textContent.replace(/●/g, '').trim(), drop: !!document.getElementById('trnrDropZone'),
      tiles: [...list.querySelectorAll('.trn-card')].map(c => c.querySelector('.trn-name').textContent + ':' + c.querySelector('.trn-count').innerText.replace(/\s+/g, ' ')),
      bar: list.querySelector('.trn-bar').innerText };
  });
  R.ok(t.order && t.head === 'Training records' && t.drop, 'a Training records section with its drop zone, below the inspection reports');
  R.ok(t.tiles.join('|') === 'Mick Kane:1 of 2 DONE|Priya Nair:0 of 2 DONE|Chloe Barrett:0 of 2 DONE', 'one tile per employee on the sign-off register, counting the CPD & training asked of them: ' + t.tiles.join(' / '));
  R.ok(/2 items in the CPD & training section/.test(t.bar), 'what is asked is the CPD & training section of the register - the policy is not a training item');
}

// ── index a folder: a folder per person, loose names, and a certificate Compass issued ──
{
  const t = await page.evaluate(async () => {
    S.trainFolder.path = 'S:\\H&S\\Training';
    const entry = _psoTrail().find(e => e.staffId === 's1' && e.policyId === 'c1');
    const b = _certBuild(entry.id);
    const cert = new File([b.doc.output('blob')], 'scan0001.pdf', { type: 'application/pdf' });
    const f = (rel, file) => ({ name: rel.split('\\').pop(), rel, mtime: Date.parse('2026-09-15T10:00:00Z'), file: file || new File(['x'], rel.split('\\').pop()) });
    await _trnSyncFiles([
      f('Priya Nair\\EV safety - electric hybrid vehicle.jpg'),
      f('Priya Nair\\First Aid at Work 2025.jpg'),
      f('Mick Kane - HS learning September 2026.docx'),
      f('Scans\\scan0001.pdf', cert),
      f('Scans\\scan0002.png'),
      f('notes.txt') ], true);
    const recs = _trnRecords().map(r => ({ file: r.e.file, who: r.st && r.st.name, what: r.pol && r.pol.id, loc: r.e.location, text: !!r.e.text }));
    const tile = id => { const c = document.getElementById('trn-' + id); return { count: c.querySelector('.trn-count').innerText.replace(/\s+/g, ' '), cls: c.className,
      lines: [...c.querySelectorAll('.trn-line')].map(l => l.querySelector('.trn-mark').textContent + ' ' + l.querySelector('.trn-t').textContent + ' | ' + l.querySelector('.trn-how').textContent + (l.querySelector('button') ? ' [' + l.querySelector('button').textContent + ']' : '')),
      files: c.querySelectorAll('.trn-file').length }; };
    return { n: _trnrState().length, recs, mick: tile('s1'), priya: tile('s2'), chloe: tile('s3'),
      un: (document.getElementById('trn-unmatched') || { innerText: '' }).innerText, badge: document.getElementById('trnrBadge').textContent };
  });
  const rec = n => t.recs.find(r => r.file === n) || {};
  R.ok(t.n === 5, 'five records indexed, the text file skipped (' + t.n + ')');
  R.ok(rec('EV safety - electric hybrid vehicle.jpg').who === 'Priya Nair' && rec('EV safety - electric hybrid vehicle.jpg').what === 'c1', 'a folder per person: the folder names the person, the file name the course');
  R.ok(rec('Mick Kane - HS learning September 2026.docx').who === 'Mick Kane' && rec('Mick Kane - HS learning September 2026.docx').what === 'c2', 'a loose file named for the person and the course matches both');
  R.ok(rec('scan0001.pdf').text && rec('scan0001.pdf').who === 'Mick Kane' && rec('scan0001.pdf').what === 'c1', 'a certificate Compass issued, under a meaningless name, is read for who and what');
  R.ok(rec('First Aid at Work 2025.jpg').who === 'Priya Nair' && !rec('First Aid at Work 2025.jpg').what, 'a record for something not asked is kept on their tile, counting for nothing');
  R.ok(rec('Mick Kane - HS learning September 2026.docx').loc === 'S:\\H&S\\Training\\Mick Kane - HS learning September 2026.docx', 'the folder path plus its place in the folder gives each record its location');
  R.ok(t.mick.lines[0].startsWith('✓ Electric and hybrid vehicle safety | Signed') && /Acknowledged by link/.test(t.mick.lines[0]) && /scan0001\.pdf/.test(t.mick.lines[0]), 'done: signed by link, with the certificate beside it');
  R.ok(t.mick.lines[1].startsWith('◐ H&S learning - September 2026 | Certificate on file - not recorded yet') && /\[Record as done\]$/.test(t.mick.lines[1]), 'on file but not recorded: said so, with Record as done');
  R.ok(t.priya.count === '0 of 2 DONE' && /trn-c-some/.test(t.priya.cls) && t.priya.lines[1].startsWith('✗ H&S learning'), 'a match never counts by itself - 0 of 2, amber because a certificate is waiting');
  R.ok(t.chloe.count === '0 of 2 DONE' && /trn-c-no/.test(t.chloe.cls) && t.chloe.files === 0, 'nothing done, nothing on file: grey, and says so');
  R.ok(/Not matched to an employee/.test(t.un) && /scan0002\.png/.test(t.un) && !/scan0001/.test(t.un), 'what cannot be matched waits on its own tile');
  R.ok(/3 employees · 1 of 6 done · 2 on file to record/.test(t.badge), 'the heading counts it: ' + t.badge);
}

// ── Record as done - the sign-off register, the trail and the tracker agree ──
{
  const t = await page.evaluate(() => {
    const out = {};
    switchTab('signoff'); renderPolicySignoff();
    const cell = (sid, pid) => { const i = document.querySelector('#signoffContainer input[onchange*="\'' + sid + '\',\'' + pid + '\'"]'); return i ? { on: i.checked, file: /on file/.test(i.parentElement.innerText) } : null; };
    out.before = cell('s1', 'c2'); out.priyaBefore = cell('s2', 'c1'); out.polCol = cell('s1', 'p1');
    switchTab('documents');
    const btn = [...document.querySelectorAll('#trn-s1 .trn-line button')].find(b => /Record as done/.test(b.textContent)); btn.click();
    const e = _psoTrail().filter(x => x.staffId === 's1' && x.policyId === 'c2').pop() || {};
    out.entry = { method: e.method, evidence: e.evidence, decl: e.declaration, how: PSO_HOW[e.method] };
    out.tile = document.querySelector('#trn-s1 .trn-count').innerText.replace(/\s+/g, ' '); out.cls = document.getElementById('trn-s1').className;
    out.line = document.querySelectorAll('#trn-s1 .trn-line')[1].innerText.replace(/\s+/g, ' ');
    switchTab('signoff'); renderPolicySignoff();
    out.after = cell('s1', 'c2');
    out.evName = _trnEvidenceName(e.evidence);
    return out;
  });
  R.ok(t.before && !t.before.on && t.before.file && t.priyaBefore.file && !t.polCol.file, 'the sign-off tracker says "on file" under the box where a certificate is waiting - and only there');
  R.ok(t.entry.method === 'certificate' && t.entry.how === 'Certificate on file' && /Mick Kane - HS learning September 2026\.docx$/.test(t.entry.evidence) && /evidenced by a training record/.test(t.entry.decl), 'Record as done goes on the trail as "Certificate on file", with the file as the evidence');
  R.ok(t.tile === '2 of 2 DONE' && /trn-c-all/.test(t.cls) && /Certificate on file/.test(t.line), 'the tile turns green: 2 of 2 - ' + t.line);
  R.ok(t.after.on && !t.after.file, 'and the sign-off tracker is ticked - the same record, not a copy');
  R.ok(t.evName === 'Certificate: Mick Kane - HS learning September 2026.docx', 'the declaration record names the certificate');
}

// ── putting a record right: whose it is, what it counts for ──
{
  const t = await page.evaluate(() => {
    const out = {};
    switchTab('documents');
    const un = _trnrState().find(e => e.file === 'scan0002.png');
    const sel = document.querySelector('#trn-unmatched select'); sel.value = 's3'; sel.dispatchEvent(new Event('change'));
    out.moved = !document.getElementById('trn-unmatched') && [...document.querySelectorAll('#trn-s3 .trn-file')].some(f => /scan0002/.test(f.textContent));
    const fa = _trnrState().find(e => e.file === 'First Aid at Work 2025.jpg');
    setTrnRecord(fa.id, 'polId', 'c2');
    out.counts = document.querySelectorAll('#trn-s2 .trn-line')[1].innerText.replace(/\s+/g, ' ');
    setTrnRecord(fa.id, 'staffId', 'none');
    out.notTheirs = !!document.getElementById('trn-unmatched') && /First Aid at Work/.test(document.getElementById('trn-unmatched').innerText);
    return out;
  });
  R.ok(t.moved, 'say whose an unmatched record is and it moves to their tile');
  R.ok(/Certificate on file/.test(t.counts) && /First Aid at Work 2025\.jpg/.test(t.counts), 'say what a record counts for and the line picks it up');
  R.ok(t.notTheirs, '× on a tile (not theirs) sends it back to Not matched');
}

// ── re-indexing: refreshed, not doubled; gone is flagged, never removed ──
{
  const t = await page.evaluate(async () => {
    const f = rel => ({ name: rel.split('\\').pop(), rel, mtime: Date.parse('2026-09-15T10:00:00Z'), file: new File(['x'], rel.split('\\').pop()) });
    await _trnSyncFiles([f('Priya Nair\\EV safety - electric hybrid vehicle.jpg'), f('Mick Kane - HS learning September 2026.docx'), f('Scans\\scan0002.png')], true);
    const list = _trnrState();
    return { n: list.length, missing: list.filter(e => e.missing).map(e => e.file).sort().join(','),
      flag: /not in last index/.test(document.getElementById('trnrContainer').innerText), still: list.some(e => e.file === 'scan0001.pdf' && e.text) };
  });
  R.ok(t.n === 5 && t.missing === 'First Aid at Work 2025.jpg,scan0001.pdf', 'drag the folder again: nothing doubled, and what has gone is flagged (' + t.missing + ')');
  R.ok(t.flag && t.still, 'flagged on its tile, and kept with what was read from it');
}

// ── who sees it ──
{
  const t = await page.evaluate(() => {
    _viewMode = 'employee'; renderTrnRegister();
    const out = { hidden: document.getElementById('trnrTools').style.display === 'none' && document.getElementById('trnrContainer').innerHTML === '' };
    _viewMode = 'consultant'; renderTrnRegister();
    out.back = document.querySelectorAll('#trnrContainer .trn-card').length === 4;
    out.keys = _IMPORT_KEYS.includes('trainRegister') && _IMPORT_KEYS.includes('trainFolder');
    return out;
  });
  R.ok(t.hidden && t.back, 'hidden in the employee view - one colleague\'s training is not another\'s to browse');
  R.ok(t.keys, 'goes with the client on export and import');
}

await R.done(browser, errors);
