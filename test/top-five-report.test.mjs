// ══════════════════════════════════════════════════════════════
//  The Top 5 Risks report. Simon, 2026-10-01: "I have been given a task to
//  provide the top five risks that need to be dealt with back to the SLT -
//  I thought we had a report for this but we don't". The five are the ones
//  chosen for the month (the ladder / execution plan Top 5 ticks - one
//  choosing mechanism), topped up from the system's ranking when fewer are
//  chosen, each saying which it is.
//  Run: node --test test/top-five-report.test.mjs
// ══════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, REPORTS } from '../public/reports/templates/index.js';

const TODAY = '2026-10-15', MONTH = '2026-10';
const risk = (id, ref, name, l, s, extra) => Object.assign({ id, ref, activity: name, likelihood: String(l), severity: String(s), targetL: '2', targetS: '2', actions: [] }, extra || {});
const STATE = () => ({
  company: { legalName: 'Fineline Architects Ltd' },
  riskProfile: [
    risk('r1', 'A-001', 'Asbestos disturbance on survey', 4, 4, { assocRisk: 'Drilling into lagging', controls: 'Survey before work; stop if suspect',
      actions: [ { id: 'a1', desc: 'Get the R&D survey', owner: 'Jo', due: '2026-09-01', status: 'Not started' },
                 { id: 'a2', desc: 'Brief the surveyors', owner: '', due: '2026-12-01', status: 'Not started', top5: MONTH },
                 { id: 'a3', desc: 'Done already', owner: 'Jo', due: '2026-01-01', status: 'Complete' } ] }),
    risk('r2', 'B-002', 'Fall through a fragile roof', 5, 4, { actions: [ { id: 'b1', desc: 'Buy staging', owner: 'Sam', due: '2026-11-01', status: 'In progress' } ] }),
    risk('r3', 'C-003', 'Driving for work', 3, 4),
    risk('r4', 'D-004', 'Display screen work', 2, 2, { targetL: '', targetS: '' }),
    risk('r5', 'E-005', 'Lone working in void property', 4, 3),
    risk('r6', 'F-006', 'Manual handling of kit', 3, 3),
    risk('r7', 'G-007', 'Office fire', 1, 3),
  ],
});
const page1 = rep => rep.pages[0];
const listOf = rep => page1(rep).blocks.find(b => b.type === 'dataTable' && b.title === 'The list');

test('it is a report of its own, with a cover and a brief format', () => {
  assert.ok(REPORTS['top-five'], 'registered as top-five');
  const rep = buildReport(STATE(), 'top-five', { today: TODAY });
  assert.equal(rep.meta.title, 'Top 5 Risks');
  assert.equal(rep.pages.length, 6, 'a front page and a page for each of the five');
  assert.equal(page1(rep).cover, true, 'signal has the cover');
  assert.equal(page1(buildReport(STATE(), 'top-five', { today: TODAY, format: 'brief' })).cover, false, 'brief does not');
});

test('the chosen risks lead, the rest come from the system ranking, and each says which', () => {
  const rep = buildReport(STATE(), 'top-five', { today: TODAY });
  const rows = listOf(rep).rows;
  assert.equal(rows.length, 5);
  assert.match(rows[0][1].html, /A-001.*Asbestos disturbance on survey.*chosen for October 2026/s, 'the ticked risk is first, marked chosen');
  assert.ok(rows.slice(1).every(r => /system ranking/.test(r[1].html)), 'the others are marked as the system ranking');
  assert.ok(!rows.some(r => /Office fire/.test(r[1].html)), 'the lowest risk is not on the list');
  assert.match(page1(rep).blocks.find(b => b.type === 'titleBlock').standfirst, /1 chosen as the priorities for October 2026, topped up to 5/);
});

test('none chosen: the five the system ranks worst, and it says how to make them the agreed list', () => {
  const s = STATE(); s.riskProfile[0].actions[1].top5 = '';
  const rep = buildReport(s, 'top-five', { today: TODAY });
  assert.ok(listOf(rep).rows.every(r => /system ranking/.test(r[1].html)));
  assert.match(page1(rep).blocks.find(b => b.type === 'titleBlock').standfirst, /None has been chosen for October 2026 yet.*Tick them on the cockpit.s risk ladder/);
});

test('each risk page: where it stands, why, controls, what will be done, and what the SLT is asked', () => {
  const rep = buildReport(STATE(), 'top-five', { today: TODAY });
  const p = rep.pages[1];
  const t = p.blocks.find(b => b.type === 'titleBlock');
  assert.match(t.kicker, /^Risk 1 of 5 · A-001 · chosen for October 2026/);
  assert.equal(t.headline, 'Asbestos disturbance on survey');
  assert.match(t.standfirst, /What could happen: Drilling into lagging/);
  const tiles = p.blocks.find(b => b.type === 'kpiStrip').tiles;
  assert.equal(tiles[0].value, '16', 'score now'); assert.equal(tiles[1].value, '4', 'target');
  assert.equal(tiles[3].value, '2', 'two open actions - the complete one is not counted'); assert.match(tiles[3].note, /1 overdue/);
  const ctl = p.blocks.find(b => b.type === 'dataTable' && b.title === 'Controls in place');
  assert.deepEqual(ctl.rows.map(r => r[0]), ['Survey before work', 'stop if suspect']);
  const acts = p.blocks.find(b => b.type === 'dataTable' && b.title === 'What will be done');
  assert.match(acts.rows[0][0], /^Get the R&D survey/, 'the overdue action first');
  assert.match(acts.rows[1][0], /^★ Brief the surveyors/, 'the month\'s Top 5 action is starred');
  assert.equal(acts.rows[1][1].text, 'no owner');
  const asks = p.blocks.find(b => b.type === 'decisionsPanel').items.map(i => i.text).join(' | ');
  assert.match(asks, /Name an owner for the action that has none/);
  assert.match(asks, /Re-date or resource the 1 overdue action/);
  assert.ok(p.blocks.some(b => b.type === 'notesLines'), 'room for the SLT\'s comments');
});

test('a risk with nothing planned says so, and asks the SLT to agree what will be done', () => {
  const rep = buildReport(STATE(), 'top-five', { today: TODAY });
  const p = rep.pages.find(pg => /Driving for work/.test(pg.label));
  assert.ok(p, 'driving is on the list');
  assert.equal(p.blocks.find(b => b.type === 'textBlock' && b.title === 'What will be done').body, 'Nothing is planned on this risk yet.');
  assert.match(p.blocks.find(b => b.type === 'decisionsPanel').items[0].text, /Agree what will be done/);
  const row = listOf(rep).rows.find(r => /Driving for work/.test(r[1].html));
  assert.equal(row[4].text, 'Nothing planned');
});

test('no risks: the front page says so and nothing else is printed', () => {
  const rep = buildReport({ company: { legalName: 'New Ltd' } }, 'top-five', { today: TODAY });
  assert.equal(rep.pages.length, 1);
  assert.equal(page1(rep).blocks.find(b => b.type === 'titleBlock').headline, 'No risks are recorded yet.');
});
