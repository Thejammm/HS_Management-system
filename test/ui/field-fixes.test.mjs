// ══════════════════════════════════════════════════════════════
//  Simon's five-item field list, 2026-09-29:
//   1 the training matrix understands a tab per business
//   2 the linked Inspection app sync works, and says why when it does not
//   3 the sign-off send finds where a document lives, from anywhere in Compass
//   4 a CPD certificate can go straight to the share screen to email it
//   5 typing on Quick links is not thrown out by a redraw
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Field fixes - tabs, sync, file location, share, cursor');
const { browser, page, errors } = await openApp();
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

// ── 1. training matrix: a tab per business ──
const TRAINING = () => ({ filename: 'matrix.xlsx',
  sheets: [
    { name: 'Archer Ltd', group: 'staff', status: 'active', courses: [{ name: 'Fire Warden', col: 4 }, { name: 'First Aid', col: 5 }] },
    { name: 'Fineline Ltd', group: 'staff', status: 'active', courses: [{ name: 'Asbestos Awareness', col: 4 }, { name: 'Working at Height', col: 5 }] },
    { name: 'Leavers', group: 'staff', status: 'left', courses: [] } ],
  people: [
    { id: 'p1', sheet: 'Archer Ltd', row: 2, group: 'staff', status: 'active', lastName: 'Kane', firstName: 'Mick', badge: '', job: 'Supervisor', cells: { 'Fire Warden': { type: 'date', v: '2027-03-01' } } },
    { id: 'p2', sheet: 'Archer Ltd', row: 3, group: 'staff', status: 'active', lastName: 'Nair', firstName: 'Priya', badge: '', job: 'Fitter', cells: {} },
    { id: 'p3', sheet: 'Fineline Ltd', row: 2, group: 'staff', status: 'active', lastName: 'Boyes', firstName: 'Sophie', badge: '', job: 'Architect', cells: { 'Asbestos Awareness': { type: 'date', v: '2027-01-10' } } },
    { id: 'p4', sheet: 'Fineline Ltd', row: 3, group: 'staff', status: 'active', lastName: 'Barrett', firstName: 'Chloe', badge: '', job: 'Office Manager', cells: {} },
    { id: 'p5', sheet: 'Fineline Ltd', row: 4, group: 'staff', status: 'active', lastName: 'Reid', firstName: 'Tom', badge: '', job: 'Surveyor', cells: {} },
    { id: 'p6', sheet: 'Leavers', row: 2, group: 'staff', status: 'left', lastName: 'Gone', firstName: 'Old', badge: '', job: '', cells: {} } ] });

await seed(page, { company: { legalName: 'Archer Group' }, trainingData: TRAINING(),
  policySignoff: { policies: [], staff: [], signed: {}, log: [], logMigrated: true } }, 'monitoring');
await wait(page, 300);
{
  const t = await page.evaluate(() => {
    const secs = _tSections().map(s => s.label + ':' + s.key);
    const html = _trainingMatrixHTML();
    const box = document.createElement('div'); box.innerHTML = html;
    const tables = [...box.querySelectorAll('table')];
    const heads = tables.map(tb => [...tb.querySelectorAll('thead th')].map(th => th.textContent.trim()).filter(Boolean).join('|'));
    return { secs, html: box.innerText, heads };
  });
  R.ok(t.secs.length === 2 && /^Archer Ltd:/.test(t.secs[0]) && /^Fineline Ltd:/.test(t.secs[1]), 'the workbook\'s two active tabs are two lists, in workbook order - not one "Staff" (' + t.secs.join(', ') + ')');
  R.ok(/Archer Ltd/.test(t.html) && /Fineline Ltd/.test(t.html), 'each table carries its own tab\'s name');
  R.ok(t.heads.some(h => /Fire Warden/.test(h) && !/Asbestos/.test(h)) && t.heads.some(h => /Asbestos Awareness/.test(h) && !/Fire Warden/.test(h)),
    'and its own columns - one business\'s courses do not run into the other\'s');
}
{
  const t = await page.evaluate(() => {
    trainingAddPerson();
    const ov = [...document.body.children].reverse().find(d => d.querySelector && d.querySelector('#_tpG'));
    const opts = [...ov.querySelectorAll('#_tpG option')].map(o => o.textContent);
    const sel = ov.querySelector('#_tpG'); sel.value = [...sel.options].find(o => o.textContent === 'Fineline Ltd').value; sel.onchange();
    const cols = [...ov.querySelectorAll('#_tpCols input[data-course]')].map(i => i.dataset.course);
    ov.querySelector('#_tpF').value = 'Daniel'; ov.querySelector('#_tpL').value = 'Ashworth';
    ov.querySelector('#_tpSave').onclick();
    const p = _trainingData().people.find(x => x.lastName === 'Ashworth');
    return { opts, cols, tab: p && p.tab, sec: p && _tSectionOf(p) };
  });
  R.ok(t.opts.join('|') === 'Archer Ltd|Fineline Ltd', 'adding a person asks which tab they belong on (' + t.opts.join(', ') + ')');
  R.ok(t.cols.join('|') === 'Asbestos Awareness|Working at Height', 'and offers that tab\'s columns');
  R.ok(t.tab === 'Fineline Ltd' && t.sec === 'sheet:Fineline Ltd', 'the person joins that tab, and the export puts them back into it');
}
{
  const t = await page.evaluate(() => {
    addStaffFromTraining();
    const ov = document.getElementById('tStaffPick');
    const rows = ov ? [...ov.querySelectorAll('label.pso-pick')].map(l => l.innerText.replace(/\s+/g, ' ').trim()) : [];
    const archer = ov && [...ov.querySelectorAll('input[data-sec]')].find(i => i.getAttribute('data-sec') === 'sheet:Archer Ltd');
    if (archer) archer.checked = false;
    if (ov) ov.querySelector('#tspAdd').onclick();
    return { open: !!ov, rows, staff: _psoState().staff.map(s => s.name).sort(), gone: !document.getElementById('tStaffPick') };
  });
  R.ok(t.open && t.rows.length === 2, 'with more than one tab, adding employees asks which tabs - a tick box each');
  R.ok(t.rows.some(r => /Fineline Ltd.*4 people.*4 not on the register/i.test(r)), 'each says how many are on it and how many are new (' + t.rows.join(' / ') + ')');
  R.ok(t.gone && t.staff.join('|') === 'Chloe Barrett|Daniel Ashworth|Sophie Boyes|Tom Reid', 'unticking Archer Ltd adds only the Fineline people (' + t.staff.join(', ') + ')');
}
{
  const t = await page.evaluate(() => {
    S.trainingData = { filename: 'one.xlsx', sheets: [{ name: 'Staff', group: 'staff', status: 'active', courses: [{ name: 'Manual Handling', col: 4 }] }],
      people: [{ id: 'q1', sheet: 'Staff', row: 2, group: 'staff', status: 'active', lastName: 'Solo', firstName: 'Sam', badge: '', job: '', cells: {} }] };
    S.policySignoff = { policies: [], staff: [], signed: {}, log: [], logMigrated: true };
    addStaffFromTraining();
    return { picker: !!document.getElementById('tStaffPick'), staff: _psoState().staff.map(s => s.name) };
  });
  R.ok(!t.picker && t.staff.join() === 'Sam Solo', 'a single-tab workbook adds everyone straight away, as before - no extra step');
}

// ── 2 + 5. linked Inspection app ──
await seed(page, { company: { legalName: 'Easy Travel Service' },
  linkedApps: [{ id: 'la1', kind: 'inspections', label: 'Inspection app', baseUrl: 'https://inspections.archerhs.co.uk', remoteTenantId: 'easytravel', autoSync: false, lastSyncAt: '', lastStatus: '' }],
  inspections: [], actions: [{ id: 'own1', inspId: '', periodTo: day(3), location: 'Office', manager: 'Simon', sectionName: 'Office', itemId: 'x', itemName: 'Own action', issue: 'Raised in Compass', note: '', assignedTo: '', dueDate: day(-5), beforePhotos: [], resolved: false, resolvedBy: '', resolvedAt: '', resolvedNote: '', afterPhotos: [] }] }, 'links');
await wait(page, 300);
{
  const t = await page.evaluate(async (d) => {
    const calls = [];
    const payload = { ok: true, fetchedAt: new Date().toISOString(),
      inspections: [{ id: 'insp_1', typeId: 'garage_inspection', typeName: 'Garage Inspection', periodFrom: d.a, periodTo: d.a, manager: 'Gareth', location: 'Main garage', ref: 'W1', title: 'Weekly walkround',
        results: { a1: 'pass', a2: 'action' }, notes: {}, actionDetails: {}, rectifyDetails: {}, checklistSnapshot: [{ id: 's1', name: 'Workshop', items: [{ id: 'a1', name: 'Housekeeping' }, { id: 'a2', name: 'Guarding' }] }],
        submittedAt: d.a + 'T09:00:00.000Z', status: 'open', awaitingReview: true }],
      actions: [{ id: 'act_1', inspId: 'insp_1', periodTo: d.a, location: 'Main garage', manager: 'Gareth', sectionName: 'Workshop', itemId: 'a2', itemName: 'Guarding', issue: 'Guard missing', note: '', assignedTo: 'Mick', dueDate: d.b, beforePhotos: [], resolved: false, resolvedBy: '', resolvedAt: '', resolvedNote: '', afterPhotos: [] }] };
    let reply = { ok: true, status: 200, body: payload };
    Auth.isSignedIn = () => true; Auth.activeTenantId = () => 'easytravel-compass';
    Auth.saveToServer = async () => { calls.push('save'); await new Promise(r => setTimeout(r, 30)); return { ok: true, updatedAt: new Date().toISOString() }; };
    const realFetch = window.fetch;
    window.fetch = async (url, o) => { if (String(url).indexOf('/api/linked/inspections') === 0) { calls.push('fetch'); await new Promise(r => setTimeout(r, 60)); return { ok: reply.ok, status: reply.status, json: async () => reply.body }; } return realFetch(url, o); };
    const out = {};
    // a tenant id typed a moment ago, then Sync now straight away
    updateLinkedApp('la1', 'remoteTenantId', 'easytravel');
    await syncLinkedApp('la1');
    out.order = calls.join(',');
    out.nInsp = S.inspections.length; out.nAct = S.actions.length;
    // the cursor: typing in the label box when a sync lands
    const inp = document.querySelector('#appLinksContainer [data-f="la-la1-label"]');
    inp.focus(); inp.setSelectionRange(3, 3);
    await syncLinkedApp('la1', { silent: true });
    const ae = document.activeElement;
    out.cursor = { keptFocus: !!(ae && ae.getAttribute && ae.getAttribute('data-f') === 'la-la1-label'), caret: ae && ae.selectionStart };
    // a failure says what went wrong, in words
    reply = { ok: false, status: 404, body: { ok: false, error: 'remote_tenant_not_found' } };
    await syncLinkedApp('la1', { silent: true });
    out.card = document.getElementById('appLinksContainer').innerText.replace(/\s+/g, ' ');
    // the synced action is resolved where it was raised
    switchTab('actions'); await new Promise(r => setTimeout(r, 300));
    const cards = [...document.querySelectorAll('.action-card')];
    const synced = cards.find(c => /Guarding/.test(c.innerText)), own = cards.find(c => /Own action/.test(c.innerText));
    out.synced = synced ? { form: !!synced.querySelector('#rb-act_1'), del: !!synced.querySelector('[onclick^="deleteAction"]'), note: /resolve it there/.test(synced.innerText), open: !!synced.querySelector('a[href^="https://inspections.archerhs.co.uk"]') } : null;
    out.own = own ? { form: !!own.querySelector('#rb-own1'), del: !!own.querySelector('[onclick^="deleteAction"]') } : null;
    window.fetch = realFetch;
    return out;
  }, { a: day(5), b: day(-10) });
  R.ok(/^save,fetch/.test(t.order), 'Sync now saves the link first, then pulls - a tenant id typed a moment ago is the one used (' + t.order + ')');
  R.ok(t.nInsp === 1 && t.nAct === 2, 'the Inspection app\'s inspection and action land beside Compass\'s own (' + t.nInsp + ' inspection, ' + t.nAct + ' actions)');
  R.ok(t.cursor.keptFocus && t.cursor.caret === 3, 'typing on Quick links survives a sync landing - same box, same place (caret ' + t.cursor.caret + ')');
  R.ok(/Sync failed: the Inspection app has no client with that id - copy it from the client's row on the Inspection app's Admin tab/.test(t.card), 'a failed sync says what went wrong and where to look');
  R.ok(t.synced && !t.synced.form && !t.synced.del && t.synced.note && t.synced.open, 'a synced action points to the app it was raised in - no resolve form or delete that the next sync would undo');
  R.ok(t.own && t.own.form && t.own.del, 'Compass\'s own actions are resolved here as before');
}

// ── 3. sign-off: where the document lives ──
await seed(page, { company: { legalName: 'Fairbank Fabrications Ltd' },
  documents: [{ id: 'd1', name: 'Fire Safety Policy v3.1.pdf', link: 'https://fairbank.sharepoint.com/fire-v3.1.pdf' },
              { id: 'd2', name: 'Fire Safety Policy (old draft)', link: 'https://fairbank.sharepoint.com/fire-draft.docx' },
              { id: 'd3', name: 'Driving for Work Policy', link: 'https://fairbank.sharepoint.com/driving.pdf' }],
  raRegister: [{ id: 'rar1', title: 'Working at height - mezzanine', ref: 'RA-004', location: 'https://fairbank.sharepoint.com/ra/wah.pdf', riskId: 'r1' }],
  riskProfile: [{ id: 'r1', activity: 'Working at height on the mezzanine', actions: [] }],
  policySignoff: { policies: [
      { id: 'p1', title: 'Fire Safety Policy', type: 'Policy', version: '3.1', riskIds: [] },
      { id: 'p2', title: 'Risk assessment - Working at height on the mezzanine', type: 'Risk assessment', riskIds: ['r1'], source: { kind: 'risk', id: 'r1' } },
      { id: 'p3', title: 'Lone Working Procedure', type: 'Procedure', riskIds: [] } ],
    staff: [{ id: 's1', name: 'Daniel Ashworth', role: 'Supervisor' }], signed: {}, log: [], logMigrated: true } }, 'signoff');
await wait(page, 300);
{
  const t = await page.evaluate(() => {
    const P = (id) => _psoState().policies.find(x => x.id === id);
    Auth.isSignedIn = () => true; Auth.activeTenantId = () => 'fairbank';
    openSignoffSend('p1');
    const ov = document.getElementById('psoSendOv');
    const out = { link1: document.getElementById('psoLink').value, txt1: ov.innerText.replace(/\s+/g, ' '),
      chips: [...ov.querySelectorAll('button[data-l]')].map(b => b.getAttribute('data-l')) };
    const chip = ov.querySelector('button[data-l]'); if (chip) chip.click();
    out.afterClick = document.getElementById('psoLink').value;
    ov.remove();
    out.link2 = _psoPolicyLink(P('p2'));
    openSignoffSend('p3'); const ov3 = document.getElementById('psoSendOv');
    out.link3 = document.getElementById('psoLink').value; out.txt3 = ov3.innerText.replace(/\s+/g, ' '); ov3.remove();
    out.driving = _psoLinkCandidates(P('p1')).some(c => /driving/.test(c.link));
    return out;
  });
  R.ok(t.link1 === 'https://fairbank.sharepoint.com/fire-v3.1.pdf', '"Fire Safety Policy" finds "Fire Safety Policy v3.1.pdf" on the Documents register - no longer exact-match only');
  R.ok(/Found on the Documents register as "Fire Safety Policy v3.1.pdf"/.test(t.txt1), 'and says where it found it, and under what name');
  R.ok(t.chips.includes('https://fairbank.sharepoint.com/fire-draft.docx') && t.afterClick === 'https://fairbank.sharepoint.com/fire-draft.docx', 'another match is offered, and one tap uses it');
  R.ok(!t.driving, 'an unrelated policy that only shares the word "policy" is not offered');
  R.ok(t.link2 === 'https://fairbank.sharepoint.com/ra/wah.pdf', 'a risk assessment issued from a risk finds its RA register entry');
  R.ok(t.link3 === '' && /Nothing on the Documents register or the RA register matches "Lone Working Procedure"/.test(t.txt3), 'where nothing matches it says so, rather than guessing');
}

// ── 4. certificate: email / share ──
{
  const t = await page.evaluate(async () => {
    S.branding = Object.assign({}, S.branding, { producer: 'Archer Health & Safety', certSignatory: 'Simon Archer CMIOSH CMaPS MCABE' });
    S.company = { legalName: 'Fineline Architectural Design' };
    S.policySignoff = { policies: [{ id: 'c1', title: 'Health and Safety Essentials', type: 'Training / CPD', delivered: '2026-09-16', riskIds: [] }],
      staff: [{ id: 's1', name: 'Sophie Boyes', role: 'Architect' }], signed: {}, log: [], logMigrated: true, certificates: [] };
    const e = _psoRecord('s1', 'c1', 'acknowledged', { method: 'link' }); _psoRebuildSigned();
    const btn = _certEntryHTML(e, _psoState().policies[0]);
    const shared = [];
    const oCan = navigator.canShare, oShare = navigator.share;
    navigator.canShare = (d) => !!(d && d.files && d.files.length);
    navigator.share = async (d) => { shared.push({ name: d.files[0].name, type: d.files[0].type, size: d.files[0].size, title: d.title, text: d.text }); };
    shareCertificate(e.id);
    await new Promise(r => setTimeout(r, 50));
    const rec = _psoState().certificates.slice();
    // a browser that cannot share a file falls back to download + email
    navigator.canShare = undefined;
    let fell = null; const oFb = window._certShareFallback; window._certShareFallback = (b, s, x) => { fell = { fname: b.fname, subject: s }; };
    shareCertificate(e.id);
    window._certShareFallback = oFb; navigator.canShare = oCan; navigator.share = oShare;
    return { btn: /Email \/ share/.test(btn), shared, rec: rec.map(c => c.ref), fell, recAfter: _psoState().certificates.length };
  });
  R.ok(t.btn, 'the trail offers Email / share beside the certificate');
  R.ok(t.shared.length === 1 && t.shared[0].type === 'application/pdf' && /^certificate-sophie-boyes-AHS-CPD-20260916-01\.pdf$/.test(t.shared[0].name) && t.shared[0].size > 1000,
    'the share screen opens with the certificate attached as a PDF (' + (t.shared[0] || {}).name + ')');
  R.ok(/^Hi Sophie,/.test((t.shared[0] || {}).text || '') && /16 September 2026/.test(t.shared[0].text) && /AHS-CPD-20260916-01/.test(t.shared[0].text) && /Your certificate of attendance/.test(t.shared[0].title),
    'with a message to the delegate, by name, with the session, the date and the number');
  R.ok(t.rec.join() === 'AHS-CPD-20260916-01' && t.recAfter === 1, 'sharing issues the certificate once and keeps its number - sharing again is the same certificate');
  R.ok(t.fell && /AHS-CPD-20260916-01/.test(t.fell.fname), 'a browser that cannot share a file downloads it and opens an email instead');
}

await R.done(browser, errors);
