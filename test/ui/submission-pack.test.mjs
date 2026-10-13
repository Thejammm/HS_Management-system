// ══════════════════════════════════════════════════════════════
//  Submission pack and imports - accreditation engine step 6. A pack for a
//  designer and a contractor test client opens and matches the EDL and ECL
//  submission folders; the client issue PDF is image pages, print only, with
//  the client's reference; PDBR letters and DRM assessments import against
//  Q10.1 to Q10.3. ExcelJS comes from node_modules (the same build the app
//  loads from cdnjs), so the test needs no network.
//  Run: node test/ui/submission-pack.test.mjs
// ══════════════════════════════════════════════════════════════
import path from 'node:path';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { openApp, seed, wait, reporter, root } from './harness.mjs';

const R = reporter('Submission pack and imports');
const { browser, page, errors } = await openApp();
await page.addScriptTag({ path: path.join(root, 'node_modules', 'exceljs', 'dist', 'exceljs.min.js') });

const valid = { 'Health and Safety': '2026-08-05', 'Once For All Health & Safety - (SSIP)': '2026-09-26', Insurances: '2027-03-24', Quality: '2027-07-17' };
async function pack(){
  const r = await page.evaluate(async () => {
    try{ const p = await buildSubmissionPack(); const b = new Uint8Array(await p.blob.arrayBuffer()); let s = ''; for(let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
      return { ok:true, name:p.name, ref:p.ref, b64:btoa(s) }; }catch(e){ return { ok:false, err:e.message }; }
  });
  if(!r.ok) throw new Error(r.err);
  r.zip = await JSZip.loadAsync(Buffer.from(r.b64, 'base64'));
  return r;
}
const top = (zip, rootName) => Object.keys(zip.files).filter(n => n.startsWith(rootName) && n !== rootName).map(n => n.slice(rootName.length)).filter(n => !n.slice(0, -1).includes('/')).sort();

// a designer test client, as EDL
await seed(page, { company: { legalName: 'Example Design Ltd', shortName: 'EDL' },
  documents: [{ id: 'd1', name: '01 Health and Safety Policy', dated: '2026-10-01', qids: ['HS-02'], link: 'https://example.com/hs.pdf' }, { id: 'd2', name: 'Old advice record', dated: '2025-06-01', qids: ['HS-11'], link: 'https://example.com/old.pdf' }],
  accred: { roles: ['designer'], schemes: { cl: { on: true } }, answers: {}, cl: { valid }, package: { id: 'standard', start: '2026-11', dayRate: '500' } } }, 'cas');
{
  const p = await pack();
  const rootName = 'EDL CL Submission 2026/';
  R.ok(p.name === 'EDL CL Submission 2026.zip', 'the designer pack is named for the client and year: ' + p.name);
  const want = ['00 Pack contents.txt', '00 EDL CL Submission Tracker - Client Copy.xlsx', '00 EDL CL Submission Tracker.xlsx', '01 Company Information/', '02 Insurance/', '03 Health and Safety and SSIP/',
    '04 Training and Competence/', '05 CDM and Building Safety/', '06 Quality and Environment/', '07 Equality and Harassment/', '08 Anti-Bribery Fraud and Tax Evasion/', '09 Modern Slavery and Right to Work/',
    '10 Whistleblowing and Communication Evidence/', '11 Data Protection/', '12 Social Value and Wellbeing/', '99 Do Not Upload - Old Versions/', 'Client Issue/'];
  const got = top(p.zip, rootName);
  R.ok(JSON.stringify(got) === JSON.stringify(want.slice().sort()), 'the folders and trackers match the EDL submission: ' + got.join(' | '));
  R.ok(!!p.zip.file(rootName + '03 Health and Safety and SSIP/01 Health and Safety Policy 2026-10-01.url'), 'the tagged policy is filed in 03 as a shortcut');
  R.ok(!!p.zip.file(rootName + '99 Do Not Upload - Old Versions/Old advice record 2025-06-01.url'), 'the record over 12 months old is in 99');
  for(const [f, sheets] of [['00 EDL CL Submission Tracker.xlsx', 'Constructionline Gold,Annual Service Plan,CL Question Bank (Designer)'], ['00 EDL CL Submission Tracker - Client Copy.xlsx', 'Constructionline Gold,Price List,Annual Service Plan,CL Question Bank (Designer)']]){
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await p.zip.file(rootName + f).async('nodebuffer'));
    R.ok(wb.worksheets.map(w => w.name).join(',') === sheets, f + ' opens, with ' + sheets);
  }
  const pdf = (await p.zip.file(rootName + 'Client Issue/00 EDL CL Submission Tracker - Client Issue.pdf').async('nodebuffer')).toString('latin1');
  const P = /\/P (-?\d+)/.exec(pdf), perm = P ? (+P[1] >>> 0) : 0;
  const pages = (pdf.match(/\/Type \/Page\b/g) || []).length, images = (pdf.match(/\/Subtype \/Image/g) || []).length;
  R.ok(pdf.startsWith('%PDF') && /\/Encrypt/.test(pdf), 'the client issue PDF is protected');
  R.ok((perm & 4) && !(perm & 8) && !(perm & 16) && !(perm & 32), 'printing is allowed; changing, copying and annotating are not (P ' + (P && P[1]) + ')');
  R.ok(pages > 0 && images === pages, 'every page is an image: ' + pages + ' pages, ' + images + ' images');
  R.ok(/^AHS-EDL-\d{4}-[0-9A-F]{4}$/.test(p.ref), 'the client reference: ' + p.ref);
  const again = await pack();
  R.ok(again.ref === p.ref, 'the same client keeps the same reference');
  const contents = await p.zip.file(rootName + '00 Pack contents.txt').async('string');
  R.ok(contents.includes(p.ref) && contents.includes('Example Design Ltd'), 'the pack contents name the client and the reference');
}
// a contractor test client, as ECL
await seed(page, { company: { legalName: 'Example Contracting Ltd', shortName: 'ECL' },
  siteInspections: [{ id: 'v1', kind: 'Site inspection', site: 'Genesis', actual: '2026-09-15', outcome: 'Satisfactory', ref: 'https://example.com/genesis.pdf' }],
  accred: { roles: ['contractor'], schemes: { cl: { on: true } }, answers: {}, cl: { valid: { Insurances: '2026-10-22' } }, package: { id: 'standard', start: '2026-11' } } }, 'cas');
{
  const p = await pack();
  const rootName = 'ECL CL Submission 2026/';
  const got = top(p.zip, rootName).filter(n => n.endsWith('/'));
  R.ok(got.join('|') === '01 Company Information/|02 Insurance/|03 Health and Safety and SSIP/|04 Training and Competence/|05 CDM and Building Safety/|06 Quality and Environment/|07 Equality and Harassment/|08 Anti-Bribery Fraud and Tax Evasion/|09 Modern Slavery and Right to Work/|10 Whistleblowing and Communication Evidence/|11 Data Protection/|12 Social Value and Wellbeing/|13 Site Evidence/|99 Do Not Upload - Old Versions/|Client Issue/', 'the contractor pack has 01 to 13, 99 and Client Issue, as the ECL submission');
  R.ok(!!p.zip.file(rootName + '13 Site Evidence/Site inspection, Genesis 2026-09-15.url'), 'the site inspection is filed in 13 Site Evidence');
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await p.zip.file(rootName + '00 ECL CL Submission Tracker - Client Copy.xlsx').async('nodebuffer'));
  R.ok(wb.worksheets[0].getCell('A1').value === 'ECL & AHS Ltd: Constructionline Gold, ' + (await page.evaluate(() => { const d = new Date(); return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); })) + ' (client copy)', 'the client copy title');
}
// imports: a PDBR letter and a DRM assessment
{
  const t = await page.evaluate(async () => {
    switchTab('documents');
    const xml = '<w:document><w:body><w:p><w:r><w:t>Leeds, 13 October 2026</w:t></w:r></w:p></w:body></w:document>';
    const docx = _packZip([{ n:'[Content_Types].xml', d:'<Types/>' }, { n:'word/document.xml', d:xml }]);
    const letter = new File([docx], 'B853_Client-duties-letter-CDM-2015.docx', { lastModified: Date.UTC(2026, 0, 1) });
    await importPdbrLetters({ files:[letter], value:'' });
    const dra = new File([new Uint8Array([80, 75])], 'DRA_B853_Leeds_Rev02_2026-09-30.xlsx');
    await importDrmDras({ files:[dra], value:'' });
    await importDrmDras({ files:[dra], value:'' });   // the same file again updates, never doubles
    const L = S.documents.find(d => /Client duties letter/.test(d.name)), D = S.documents.filter(d => /Design risk assessment/.test(d.name));
    const reg = document.getElementById('evidenceRegister').innerText;
    return { L, D, reg };
  });
  R.ok(t.L && t.L.name === 'Client duties letter CDM 2015, B853' && t.L.dated === '2026-10-13' && t.L.qids.join() === 'DS-01,BS-02' && t.L.source === 'PDBR AllProject Flow', 'a PDBR letter imports, dated from its text, against Q10.1: ' + JSON.stringify(t.L && [t.L.name, t.L.dated, t.L.qids]));
  R.ok(t.D.length === 1 && t.D[0].name === 'Design risk assessment, B853 Leeds' && t.D[0].version === 'Rev 02' && t.D[0].dated === '2026-09-30' && t.D[0].qids.join() === 'DS-02,DS-03', 'a DRM assessment imports against Q10.2 and Q10.3, once');
  R.ok(/DS-01 \(SSIP Q10\.1\)/.test(t.reg) && /DS-02 \(SSIP Q10\.2\)/.test(t.reg), 'both show in the evidence register');
}
// signed in as AHS Ltd: the draft policies go into their folders, with a review list
{
  const need = (await import('node:module')).createRequire(import.meta.url);
  const drafts = await need('../../lib/policy-drafts.js').draftsFor('designer', { legalName: 'Example Design Ltd', shortName: 'EDL' }, '2026-10-13');
  const before = await (async () => { const p = await pack(); return (await p.zip.file('ECL CL Submission 2026/00 Pack contents.txt').async('string')); })();
  R.ok(/Draft policies are added when AHS Ltd builds the pack signed in/.test(before), 'signed out, the pack says the drafts need AHS Ltd signed in');
  await seed(page, { company: { legalName: 'Example Design Ltd', shortName: 'EDL' }, accred: { roles: ['designer'], schemes: { cl: { on: true } }, answers: {}, cl: { valid } } }, 'cas');
  await page.evaluate(d => {
    window.__auth = [Auth.isSignedIn, Auth.user, window.fetch];
    Auth.isSignedIn = () => true; Auth.user = () => ({ id: 'c1', name: 'AHS consultant', role: 'consultant' });
    window.__asked = null;
    window.fetch = async (u, o) => { if (String(u).includes('/api/policy/drafts')) { window.__asked = JSON.parse(o.body); return new Response(JSON.stringify({ drafts: d, left: ['Carbon Reduction Plan'] }), { status: 200 }); } return window.__auth[2](u, o); };
  }, drafts);
  const p = await pack();
  const asked = await page.evaluate(() => { const a = window.__asked; Auth.isSignedIn = window.__auth[0]; Auth.user = window.__auth[1]; window.fetch = window.__auth[2]; return a; });
  const rootName = 'EDL CL Submission 2026/';
  R.ok(asked && asked.set === 'designer' && asked.facts.legalName === 'Example Design Ltd', 'the pack asks for the designer drafts with the fact sheet');
  const hs = p.zip.file(rootName + '03 Health and Safety and SSIP/01_Health and Safety Policy_EDL_10_26.docx');
  R.ok(!!hs, 'the H&S policy draft is in 03 Health and Safety and SSIP');
  R.ok(!!p.zip.file(rootName + '11 Data Protection/05_GDPR Policy_EDL_10_26.docx') && !!p.zip.file(rootName + '12 Social Value and Wellbeing/11_Drug & Alcohol Policy_EDL_10_26.docx'), 'and the others in theirs');
  const list = await p.zip.file(rootName + '00 Review list.txt').async('string');
  R.ok(/Yellow highlights are facts to enter or wording to check/.test(list) && /Facts to enter: .*data protection/.test(list) && /Not drafted.*Carbon Reduction Plan/.test(list), 'the review list says what to check and fill in each draft');
  const docx = await JSZip.loadAsync(await hs.async('nodebuffer'));
  R.ok(/Example Design Ltd/.test(await docx.file('word/document.xml').async('string')), 'the draft opens and names the client');
}
await R.done(browser, errors);
