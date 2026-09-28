// ══════════════════════════════════════════════════════════════
//  One sign-off journey, seen from the report side. Simon, 2026-09-28:
//  "one system not two or three fighting each other". Toolbox talks now
//  live on the sign-off register, so the management plan's briefings come
//  from there - and the old toolbox delivery records are not read at all.
//  Run: node --test test/onejourney-reports.test.mjs
// ══════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { briefingsOf, signoffOf } from '../public/reports/plan-derive.js';

const STATE = () => ({
  policySignoff: {
    policies: [
      { id: 'p1', title: 'Slips, trips and falls on the level', type: 'Toolbox talk', delivered: '2026-09-02', presenter: 'S Archer' },
      { id: 'p2', title: 'Fire Safety Policy', type: 'Policy', delivered: '2026-08-12', version: '3.1' },
      { id: 'p3', title: 'Daily start briefing', type: 'Briefing', delivered: '2026-09-10' },
    ],
    staff: [{ id: 's1', name: 'Daniel Ashworth' }, { id: 's2', name: 'Chloe Barrett' }],
    signed: { 's1|p1': '2026-09-02', 's1|p2': '2026-08-12', 's2|p2': '2026-08-13' },
  },
  // the old shape: must be ignored, not merged
  toolbox: { deliveries: [{ id: 'd9', title: 'Ghost talk', date: '2026-01-01', presenter: 'Nobody', attendees: [{ signed: true }] }] },
});

test('briefings come from the sign-off register, not the old toolbox deliveries', () => {
  const b = briefingsOf(STATE());
  assert.equal(b.length, 2, 'talks and briefings only - not the policy, not the ghost');
  assert.deepEqual(b.map(x => x.title), ['Daily start briefing', 'Slips, trips and falls on the level'], 'newest first');
  assert.equal(b[1].presenter, 'S Archer', 'who gave it');
  assert.equal(b[1].signed, 1, 'signed = who confirmed it');
  assert.equal(b[1].of, 2, 'of everyone on the register');
  assert.ok(!b.some(x => /Ghost/.test(x.title)), 'the toolbox delivery array is not read');
});

test('the same items count once in the register table too - one register, no double books', () => {
  const s = signoffOf(STATE());
  assert.equal(s.rows.length, 3, 'every issued item is on the register');
  assert.equal(s.signedTotal, 3, 'and every confirmation is a signature held');
  const talk = s.rows.find(x => x.id === 'p1');
  assert.equal(talk.signed, 1, 'the talk counts the same here as under briefings');
});

test('an empty client is empty, not an error', () => {
  assert.deepEqual(briefingsOf({}), []);
  assert.deepEqual(briefingsOf({ policySignoff: { policies: [], staff: [] } }), []);
});
