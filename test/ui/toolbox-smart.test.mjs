// ══════════════════════════════════════════════════════════════
//  The toolbox talks tab gets the CPD tab's treatment. Simon, 2026-09-30:
//  "the toolbox talks tab needs the same smart treatment as cpd but how do I
//  add my own, bespoke ones? or does it add them from the cpd/toolbox talk
//  tabs when I choose an item?"
//  Talks are listed for the kind of work the client does (discovery first,
//  else the Company setup sector), your own talks lead the list, and what
//  you write is offered on the sign-off Add line like any other talk.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter } from './harness.mjs';

const R = reporter('Toolbox talks - by kind of work, and your own');
const { browser, page, errors } = await openApp();

await seed(page, {
  company: { legalName: 'Easy Travel Service', sector: 'Motor trade' },
  profiler: { sectors: { motor: true, transportsvc: true } },
  toolbox: { custom: [{ id: 'tbt-old', cat: 'Construction', title: 'Our old site talk', mins: '10', why: 'Written before kinds of work.', points: ['One.'], ask: [], legal: '' }], hidden: [], deliveries: [], migratedAt: '2026-09-01' },
  policySignoff: { policies: [], staff: [{ id: 's1', name: 'Mick Kane' }, { id: 's2', name: 'Priya Nair' }], signed: {}, log: [], logMigrated: true } }, 'toolbox');
await page.evaluate(() => { window.openSignoffSend = () => {}; renderToolbox(); });
await wait(page, 300);

// ── the tab reads as talks for this client ──
{
  const t = await page.evaluate(() => {
    const card = document.querySelector('#toolboxContainer .card');
    return { title: card.querySelector('.card-band h3').textContent.replace(/●/g, '').trim(), kind: card.querySelector('.cpt-kind').innerText,
      groups: [...card.querySelectorAll('.cpt-grp')].map(g => g.textContent), titles: [...card.querySelectorAll('.cpt-title')].map(x => x.textContent),
      view: document.getElementById('tbtView').value, write: [...card.querySelectorAll('button')].some(b => /Write your own talk/.test(b.textContent)),
      hero: document.querySelector('#tab-toolbox .rep-hero p').textContent };
  });
  R.ok(t.title === 'Toolbox talks for Easy Travel Service', 'the tab is talks for the client: ' + t.title);
  R.ok(/Vehicle repair or maintenance · Transport, passenger or delivery services/.test(t.kind) && /discovery/.test(t.kind), 'the kind of work is read the same way as the CPD tab');
  R.ok(t.groups.join('|') === 'Your own talks|Vehicle repair or maintenance|Transport, passenger or delivery services|Every business', 'your own talks first, then the work, then every business: ' + t.groups.join(' | '));
  R.ok(t.titles.some(x => /Vehicle lifts and jacking/.test(x)) && t.titles.some(x => /Daily walkaround checks/.test(x)) && t.titles.some(x => /Safeguarding - spotting and reporting/.test(x)) && !t.titles.some(x => /drone|Allergens|racking/i.test(x)), 'garage and passenger-transport talks - nothing for architects, kitchens or warehouses');
  R.ok(t.titles.some(x => /Our old site talk/.test(x) && /Yours/.test(x)), 'a talk written before this change is still there, marked as yours');
  R.ok(t.write && /any you write yourself/.test(t.hero), 'and it says how to write your own, at the top');
}

// ── writing your own ──
{
  const t = await page.evaluate(async () => {
    addTbtTalk();
    await new Promise(r => setTimeout(r, 30));
    const own = _tbtState().custom[0];
    const row = document.getElementById('tbt-' + own.id);
    const out = { sectors: own.sectors.join(','), open: !!row.querySelector('.tbt-edit'), focus: document.activeElement && document.activeElement.closest('.tbt-edit') !== null,
      firstGroup: document.querySelector('#toolboxContainer .cpt-grp').textContent };
    const set = (sel, v, i) => { const el = row.querySelectorAll(sel)[i || 0]; el.value = v; el.dispatchEvent(new Event('input')); };
    set('.tbt-edit input', 'Washing down vehicles on the ramp', 0);
    set('.tbt-edit textarea', 'Ramp on the level.\nPower washer lance pointed down.\nNo washing near the electrics.', 0);
    set('.tbt-edit textarea', 'Where is the isolator for the wash bay?', 1);
    const kind = row.querySelector('.tbt-edit select'); kind.value = 'transportsvc'; kind.dispatchEvent(new Event('change'));
    out.saved = { title: own.title, points: own.points.length, ask: own.ask.length, sectors: own.sectors.join(','), cat: own.cat };
    out.meta = document.querySelector('#tbt-' + own.id + ' .cpt-meta').textContent;
    // the sign-off Add line offers it, and brings its points
    switchTab('signoff'); psoAddOpen('tbt');
    out.offered = [...document.querySelectorAll('#psoAddList option')].map(o => o.value);
    const ti = document.getElementById('psoAddTitle'); ti.value = 'Washing down vehicles on the ramp'; ti.dispatchEvent(new Event('input')); ti.dispatchEvent(new Event('change'));
    psoAddSave();
    const pol = _psoState().policies.find(x => x.title === 'Washing down vehicles on the ramp') || {};
    out.pol = { type: pol.type, src: pol.source && pol.source.kind + ':' + pol.source.id, content: pol.content || '', inTbt: !!document.querySelector('#pss-tbt #psl-' + pol.id) };
    out.ownId = own.id;
    return out;
  });
  R.ok(t.sectors === 'motor' && t.open && t.focus && t.firstGroup === 'Your own talks', 'Write your own opens a blank talk at the top, ready to type, in the client\'s kind of work');
  R.ok(t.saved.title === 'Washing down vehicles on the ramp' && t.saved.points === 3 && t.saved.ask === 1 && t.saved.sectors === 'transportsvc' && !t.saved.cat, 'what you type is kept - the title, the points one per line, the questions, the kind of work');
  R.ok(/10 min · Transport, passenger or delivery services/.test(t.meta), 'and the line says so: ' + t.meta);
  R.ok(t.offered.includes('Washing down vehicles on the ramp') && t.offered.includes('Vehicle lifts and jacking') && !t.offered.includes('Flying the survey drone'), 'the sign-off Add line offers your talk with the client\'s others - not everyone else\'s');
  R.ok(t.pol.type === 'Toolbox talk' && t.pol.src === 'talk:' + t.ownId && /1\. Ramp on the level\./.test(t.pol.content) && /isolator/.test(t.pol.content) && t.pol.inTbt, 'picked there, it arrives in the Toolbox talks section with its points and questions');
}

// ── issue from the tab, and the row reads the register ──
{
  const t = await page.evaluate(() => {
    switchTab('toolbox');
    issueTalkForSignoff('tbt-lifts');
    const pol = _psoState().policies.find(x => x.source && x.source.id === 'tbt-lifts');
    _psoRecord('s1', pol.id, 'acknowledged', { method: 'link' }); _psoRebuildSigned();
    switchTab('toolbox'); renderToolbox();
    const st = document.querySelector('#tbt-tbt-lifts .cpt-status').innerText.replace(/\s+/g, ' ');
    return { st, inTbt: _psoSectionOf(pol).k === 'tbt' };
  });
  R.ok(/Issued/.test(t.st) && /1 of 2 signed/.test(t.st) && t.inTbt, 'Issue puts it in the Toolbox talks section; the row reads who has signed from the register: ' + t.st);
}

// ── search keeps the cursor; any one kind of work can be looked at ──
{
  const t = await page.evaluate(() => {
    const q = document.getElementById('tbtQ'); q.focus(); q.value = 'tyre'; q.setSelectionRange(4, 4); setTbtQ('tyre');
    const n = document.getElementById('tbtQ');
    const out = { focus: document.activeElement === n, caret: n.selectionStart, titles: [...document.querySelectorAll('#toolboxContainer .cpt-title')].map(x => x.textContent) };
    setTbtQ(''); setTbtView('design');
    out.design = [...document.querySelectorAll('#toolboxContainer .cpt-grp')].map(g => g.textContent);
    out.designTitles = [...document.querySelectorAll('#toolboxContainer .cpt-title')].map(x => x.textContent);
    setTbtView('client');
    return out;
  });
  R.ok(t.focus && t.caret === 4 && t.titles.length < 5 && t.titles.some(x => /Tyre inflation/.test(x)), 'search narrows the list and the cursor stays where you were typing');
  R.ok(t.design[0] === 'Design, surveying or consultancy' && t.designTitles.some(x => /Flying the survey drone/.test(x)) && t.designTitles.some(x => /Surveying empty and damaged homes/.test(x)), 'any kind of work can be looked at on its own');
}

// ── an architect, and a client with no kind of work yet ──
{
  const t = await page.evaluate(() => {
    S.company = { legalName: 'Fineline Architects', sector: 'Design / architecture / surveying' }; S.profiler.sectors = {}; S.toolbox.custom = [];
    renderToolbox();
    const out = { groups: [...document.querySelectorAll('#toolboxContainer .cpt-grp')].map(g => g.textContent),
      titles: [...document.querySelectorAll('#toolboxContainer .cpt-title')].map(x => x.textContent) };
    S.company = { legalName: 'New Client' }; renderToolbox();
    out.unset = { view: document.getElementById('tbtView').value, n: document.querySelectorAll('#toolboxContainer .cpt-row').length, total: _tbtAllTalks().length,
      kind: document.querySelector('#toolboxContainer .cpt-kind').innerText };
    return out;
  });
  R.ok(t.groups[0] === 'Design, surveying or consultancy' && t.titles.includes('Site visits - arriving safely on a live site') && t.titles.includes('Your workstation - set it up in five minutes') && !t.titles.some(x => /Vehicle lifts|Tyre/.test(x)), 'an architect gets site visits, void surveys, drones, the workstation - nothing for garages');
  R.ok(t.unset.view === 'all' && t.unset.n === t.unset.total && /Not set yet/.test(t.unset.kind), 'no kind of work set: it says so and shows every talk (' + t.unset.n + ')');
}

// ── every talk is complete, and every kind of work has talks ──
{
  const t = await page.evaluate(() => {
    const keys = SECTOR_DEFS.map(d => d.k).concat(['all']);
    const all = TBT_LIBRARY.concat(TBT_LIBRARY_MORE);
    const bad = all.filter(x => !x.id || !x.title || !x.why || (x.points || []).length < 3 || !x.mins || _tbtSectorsOf(x).some(k => keys.indexOf(k) < 0)).map(x => x.id);
    const ids = all.map(x => x.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    const thin = SECTOR_DEFS.filter(d => all.filter(x => _tbtSectorsOf(x).indexOf(d.k) >= 0).length < 2).map(d => d.k);
    const american = TBT_LIBRARY_MORE.filter(x => /\b(organiz|authoriz|recogniz|minimiz|color\b|center\b|program\b|defense)/i.test(JSON.stringify(x))).map(x => x.id);
    // "reg 12" or "regulation 4" - not the year in "Regulations 1999"
    const regNo = TBT_LIBRARY_MORE.filter(x => /\breg(ulation)?\s+\d{1,3}\b/i.test(x.legal || '')).map(x => x.id);
    return { n: all.length, bad, dup, thin, american, regNo };
  });
  R.ok(!t.bad.length && !t.dup.length, 'all ' + t.n + ' talks have a title, why, at least three points, minutes and a known kind of work' + (t.bad.length ? ' - bad: ' + t.bad.join(',') : '') + (t.dup.length ? ' dup: ' + t.dup.join(',') : ''));
  R.ok(!t.thin.length, 'every kind of work has at least two talks of its own' + (t.thin.length ? ' - thin: ' + t.thin.join(',') : ''));
  R.ok(!t.american.length && !t.regNo.length, 'British spelling, and the new talks name the law without regulation numbers' + (t.american.concat(t.regNo).length ? ' - ' + t.american.concat(t.regNo).join(',') : ''));
}

await R.done(browser, errors);
