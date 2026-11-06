// ══════════════════════════════════════════════════════════════
//  The front, tidied (Simon, 6 November 2026): the risk ladder on its own tab
//  under Risk profile, a tooltip on every block of the cockpit, and How to use
//  Compass walking the journey start to finish. In the user's order: open the
//  ladder tab -> tick a Top 5 there -> the cockpit no longer carries the ladder
//  and its customiser does not offer it -> hover any cockpit block -> read the
//  guide and press Open on each step -> the views.
//  Run: npm run test:ui
// ══════════════════════════════════════════════════════════════
import { openApp, seed, wait, reporter, RISKS } from './harness.mjs';

const R = reporter('The front, tidied - ladder tab, cockpit tooltips, How to use Compass');
const { browser, page, errors } = await openApp();
const risks = RISKS();
risks[1].actions = [{ id: 'v2a1', desc: 'Survey every skylight before work starts', owner: 'Surveyor', due: '2020-01-10', status: 'In progress' }];   // something open, so the fall from height can be a priority
await seed(page, { company: { legalName: 'Example Architects Group Ltd', tradingName: 'Example Architects', slt: [] }, riskProfile: risks }, 'cockpit');
await wait(page, 500);

// ── the ladder tab, under Risk profile ──
{
  const t = await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="ladder"]'); const front = [...document.querySelectorAll('.nav-grp-front .tab-btn')].map(x => x.getAttribute('data-tab'));
    switchTab('ladder'); const p = document.querySelector('#tab-ladder .ckx-panel.ckl');
    return { label: b ? b.innerText.trim() : '', front: front.join(), panel: !!p, lines: p ? p.querySelectorAll('.ckl-line').length : 0, head: p ? (p.querySelector('.ckl-head') || {}).textContent : '', sub: (document.querySelector('#ladderContainer .ck-sub') || {}).innerText || '', onCockpit: !!document.querySelector('#tab-cockpit .ckl') }; });
  R.ok(t.label === 'Risk ladder' && t.front === 'cockpit,risk,ladder,works', 'Risk ladder sits in the Front door group, right under Risk profile');
  R.ok(t.panel && t.lines >= 5 && /Top 5 · 0 of 5/.test(t.head) && t.sub === 'Risk ladder', 'the tab draws the same ladder: every rated risk, the Top 5 and Sheet columns');
  R.ok(!t.onCockpit, 'and the cockpit no longer draws it');
  const k = await page.evaluate(() => { const line = [...document.querySelectorAll('#tab-ladder .ckl-line')].find(l => /fall from height/.test(l.textContent)); const box = line.querySelector('.ckl-t5 input'); box.checked = true; box.dispatchEvent(new Event('change'));
    const p = document.querySelector('#tab-ladder .ckl'); return { head: (p.querySelector('.ckl-head') || {}).textContent, on: !![...p.querySelectorAll('.ckl-line')].find(l => /fall from height/.test(l.textContent)).querySelector('.ckl-t5 input:checked'), marks: _top5List().length }; });
  R.ok(/Top 5 · 1 of 5/.test(k.head) && k.on && k.marks === 1, 'a tick on the tab marks the action and the tab repaints itself: ' + k.head);
  const c = await page.evaluate(() => { switchTab('cockpit'); _cockpitEditorOpen = true; renderCockpit(); const offered = [...document.querySelectorAll('.ckb-row')].map(r => r.textContent.trim()); _cockpitEditorOpen = false; renderCockpit(); return { offered: offered.some(x => /Risk ladder/.test(x)), n: offered.length, ladder: !!document.querySelector('#tab-cockpit .ckl') }; });
  R.ok(!c.offered && c.n > 20 && !c.ladder, 'the cockpit customiser no longer offers the ladder (' + c.n + ' other blocks do)');
}
// ── a tooltip on every block of the cockpit ──
{
  const t = await page.evaluate(() => { switchTab('cockpit'); const cont = document.getElementById('cockpitContainer');
    const roots = [...cont.querySelectorAll('.ckx-panel, .ckx-kpi, .ck-card')].filter(e => !e.parentElement.closest('.ckx-panel, .ckx-kpi, .ck-card'));
    const missing = roots.filter(e => !e.getAttribute('title')).map(e => (e.querySelector('h4, .ckx-lbl') || {}).textContent || e.className);
    const tips = roots.map(e => e.getAttribute('title') || '');
    const shown = _cockpitLayout().reduce((n, z) => n + z.ids.length, 0);
    return { roots: roots.length, shown, missing, kpi: (cont.querySelector('.ckx-kpi') || {}).title || '', why: tips.every(x => /Here /.test(x)), customise: (document.querySelector('[onclick="toggleCockpitEditor()"]') || {}).title || '', control: tips.filter(x => /control/i.test(x)).length }; });
  R.ok(t.roots === t.shown && t.missing.length === 0, 'every one of the ' + t.shown + ' blocks drawn has a tooltip' + (t.missing.length ? ' - missing: ' + t.missing.join(' | ') : ''));
  R.ok(t.why, 'each says what it shows and why it is there');
  R.ok(/Click to open/.test(t.kpi) && !/^Open /.test(t.kpi), 'a clickable figure keeps its click but says more than "Open"');
  R.ok(/Choose which blocks/.test(t.customise), 'the Customise button says what it does');
}
// ── How to use Compass ──
{
  const t = await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="howto"]'); const tools = [...document.querySelectorAll('.nav-grp[data-grp="tools"] .tab-btn')].map(x => x.getAttribute('data-tab'));
    switchTab('howto'); const steps = [...document.querySelectorAll('#howtoContainer .ht-step')];
    return { label: b ? b.innerText.trim() : '', first: tools[0], n: steps.length, nums: steps.map(s => s.querySelector('.ht-n').innerText).join(), heads: steps.map(s => s.querySelector('h3').innerText), rows: steps.every(s => s.querySelectorAll('.ht-row').length === 3), opens: steps.every(s => !!s.querySelector('button')), intro: (document.querySelector('#howtoContainer .slt-muted') || {}).innerText || '', client: /How Example Architects works now/.test(document.getElementById('howtoContainer').innerText) }; });
  R.ok(t.label === 'How to use Compass' && t.first === 'howto', 'How to use Compass sits first in Consultant tools');
  R.ok(t.n === 16 && t.nums === '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16' && t.rows && t.opens, 'sixteen numbered steps, each with what it is for, how to use it, what it feeds, and its way in');
  R.ok(/Company setup/.test(t.heads[0]) && /discovery/.test(t.heads[1]) && /register/.test(t.heads[2]) && /Cockpit/.test(t.heads[5]) && /Risk ladder/.test(t.heads[6]) && /Top 5/.test(t.heads[7]) && /works now/.test(t.heads[11]) && /OpRAMS/.test(t.heads[12]) && /consultant/.test(t.heads[15]), 'in the order the work is done: setup, discovery, the register, duties, maturity, the cockpit, the ladder, the meeting, the sheets, the plan, the records, how it works now, RAMS, monitoring, review, tools');
  R.ok(/put the company.s issues in, manage them until they are controlled/.test(t.intro) && t.client, 'it opens with the loop in Simon\'s words and uses the client\'s name');
  // "talks me through each screen/tab": every tab in the sidebar has a way in from the guide, under its sidebar name
  const cover = await page.evaluate(() => { const reach = new Set(HOWTO_STEPS.flatMap(s => s.opens.map(o => o.tab).filter(Boolean))); const all = [...document.querySelectorAll('.tab-btn[data-tab]')].map(b => b.getAttribute('data-tab')).filter(t => t !== 'howto');
    const names = {}; [...document.querySelectorAll('.tab-btn[data-tab]')].forEach(b => { names[b.getAttribute('data-tab')] = b.innerText.replace(/\s+\d+$/, '').replace(/\s+/g, ' ').trim(); });
    const wrong = HOWTO_STEPS.flatMap(s => s.opens.filter(o => o.tab && o.label && o.label !== names[o.tab]).map(o => o.label + ' != ' + names[o.tab]));
    return { missing: all.filter(t => !reach.has(t)), n: all.length, wrong }; });
  R.ok(!cover.missing.length && cover.n === 25, 'every one of the ' + cover.n + ' tabs in the sidebar opens from the guide' + (cover.missing.length ? ' - missing: ' + cover.missing.join(', ') : ''));
  R.ok(!cover.wrong.length, 'each button carries the sidebar\'s own name for its screen' + (cover.wrong.length ? ': ' + cover.wrong.join(' | ') : ''));
  const open = await page.evaluate(async () => { const out = []; for (let i = 0; i < HOWTO_STEPS.length; i++) { const row = []; for (let k = 0; k < HOWTO_STEPS[i].opens.length; k++) { switchTab('howto'); const b = document.querySelectorAll('#howtoContainer .ht-step')[i].querySelectorAll('button')[k];
        if (b.disabled) { row.push('off:' + HOWTO_STEPS[i].opens[k].tab); continue; }
        b.click(); await new Promise(r => setTimeout(r, 60));
        const t5 = !!document.getElementById('t5Ov'), as = !!document.getElementById('asOv'); row.push(t5 ? 'top5' : as ? 'sheets' : document.querySelector('.tab-btn.active').getAttribute('data-tab')); if (t5) closeLiveTop5(); if (as) closeActionSheets(); } out.push(row.join('+')); } switchTab('howto'); return out; });
  R.ok(open.join() === 'company,risk,risk,requirements,maturity,cockpit,ladder,top5,sheets,execplan+off:actions,documents+signoff+toolbox+cpd,works,links,monitoring+siteinsp+off:monthly,journey+off:review+off:audit+reports+cas,links+off:triage+setup+off:admin', 'each button goes to its screen; one this view hides is greyed out, not opened: ' + open.join());
  const off = await page.evaluate(() => { switchTab('howto'); const b = [...document.querySelectorAll('#howtoContainer .ht-step button')].find(x => x.disabled), live = [...document.querySelectorAll('#howtoContainer .ht-step button')].find(x => !x.disabled); return b ? { title: b.title, dim: parseFloat(getComputedStyle(b).opacity), live: parseFloat(getComputedStyle(live).opacity) } : {}; });
  R.ok(/not showing in this view or for this client/.test(off.title) && off.dim < 0.6 && off.live === 1, 'a greyed-out button looks it, and says why');
  // walked on a client copy (6 November 2026): steps 2 and 3 both open the Risk profile tab, and the register sits in a collapsed section
  const reg = await page.evaluate(async () => { const settle = () => new Promise(r => setTimeout(r, 1300)); const head = d => Math.round(d.querySelector('summary').getBoundingClientRect().top);
    switchTab('howto'); window.scrollTo(0, 400); howtoOpen(1); await new Promise(r => setTimeout(r, 200)); const disc = window.scrollY; const d = document.getElementById('wfRegister'); d.open = false; await new Promise(r => setTimeout(r, 100));
    switchTab('howto'); window.scrollTo(0, 0); howtoOpen(2); await settle(); const closed = { open: d.open, top: head(d) };
    switchTab('howto'); window.scrollTo(0, 0); howtoOpen(2); await settle(); const already = { open: d.open, top: head(d) };
    return { disc, closed, already, bar: document.querySelector('.topbar, header') ? Math.round(document.querySelector('.topbar, header').getBoundingClientRect().bottom) : 61, tab: document.querySelector('.tab-btn.active').getAttribute('data-tab') }; });
  const clear = o => o.open && o.top >= reg.bar && o.top < reg.bar + 40;
  R.ok(reg.tab === 'risk' && reg.disc === 0 && clear(reg.closed) && clear(reg.already), 'step 2 opens at the top of the tab; step 3 opens the register, collapsed or not, with its heading clear of the header bar (' + reg.closed.top + 'px and ' + reg.already.top + 'px, bar ends ' + reg.bar + 'px)');
  // the wording the move left behind: nothing says the ladder or Minutes is on the cockpit
  const left = await page.evaluate(() => { const said = ['tab-triage', 'tab-reports'].map(id => { switchTab(id.slice(4)); return document.getElementById(id).innerText; }).join(' '); switchTab('howto'); return said; });
  R.ok(!/cockpit.{0,3}s? (risk )?ladder|✎ Minutes on the cockpit|cockpit.s ✎ Minutes/i.test(left), 'Triage and Reports point at the Risk ladder, not the cockpit');
  const intro = await page.evaluate(() => { switchTab('ladder'); const t = document.querySelector('#ladderContainer .slt-muted').innerText; switchTab('howto'); return t; });
  R.ok(/first Top 5 sheet takes these ticks/.test(intro) && !/pick the five here/.test(intro), 'the ladder says what its ticks really do: they feed the first sheet, and after that the five change on the sheet');
  const words = await page.evaluate(() => document.getElementById('howtoContainer').innerText);
  R.ok(!/\bcontrol\b(?! measure)/i.test(words.replace(/under control|controlled|controls/gi, '')), 'its words: "under control", "controlled" and the back office\'s own "Controls and rating" only');
}
// ── the views ──
{
  const v = await page.evaluate(() => { const was = _viewMode, out = {}; const show = t => { const b = document.querySelector('.tab-btn[data-tab="' + t + '"]'); return b.style.display !== 'none'; };
    _viewMode = 'management'; applyViewMode(); out.client = [show('ladder'), show('howto')]; _viewMode = 'employee'; applyViewMode(); out.emp = [show('ladder'), show('howto')]; _viewMode = was; applyViewMode(); out.cons = [show('ladder'), show('howto')]; return out; });
  R.ok(v.cons.every(Boolean) && v.client.every(Boolean) && v.emp.every(x => !x), 'the consultant and the client see both tabs; the employee view sees neither');
}

await R.done(browser, errors);
