// ══════════════════════════════════════════════════════════════
//  STATE HISTORY - the safety net under every write to app_state.
//
//  app_state holds ONE row per tenant and every save overwrites it in place,
//  so without this there is nothing to go back to. This module is the single
//  definition of what gets kept and when: /api/state and /api/offline/state
//  both use it, because the offline push - the one operation that offers to
//  overwrite the server outright - was writing with no copy kept at all.
// ══════════════════════════════════════════════════════════════
// ── State history ──
// app_state holds ONE row per tenant and every save overwrites it, so without
// this there is nothing to go back to. Before each overwrite the previous
// contents are kept, under two rules:
//   - routine saves are throttled to one snapshot per HISTORY_GAP, so ordinary
//     typing does not fill the table;
//   - a save that makes the record materially smaller is ALWAYS kept, whatever
//     the throttle says. That is the shape a reset, a bad import or a wipe
//     takes, and it is exactly the moment a copy is worth having.
// Pruning keeps the newest HISTORY_KEEP per tenant, and additionally holds on
// to anything materially bigger than what we now hold for 30 days - so a burst
// of bad saves cannot push the last good copy out of the window.
const HISTORY_KEEP = 20;
const HISTORY_GAP_MS = 30 * 60 * 1000;
const SHRINK_FLOOR = 2000;       // ignore byte-shrink on trivially small records
const SHRINK_RATIO = 0.6;

// How much CLIENT WORK a state holds. Bytes alone are not the signal: an emptied
// Compass record still carries default checklists, inspection types and risk
// config, so a full wipe only drops the blob by about a sixth and a byte rule
// sails straight past the disaster it exists for. This counts the things a
// consultant would grieve. It is a heuristic for deciding whether to keep a
// copy, never a number shown to anyone.
function _recordCount(st){
  const s = st || {};
  const n = (v) => Array.isArray(v) ? v.length : 0;
  let total = n(s.riskProfile) + n(s.actionPlan) + n(s.incidents) + n(s.inspections)
            + n(s.documents) + n(s.siteInspections) + n(s.raRegister) + n(s.templates);
  if(Array.isArray(s.requirements)) total += s.requirements.reduce((a, sec) => a + n(sec && sec.items), 0);
  if(s.trainingData && Array.isArray(s.trainingData.people)) total += s.trainingData.people.length;
  if(s.monitoring && s.monitoring.months && typeof s.monitoring.months === 'object') total += Object.keys(s.monitoring.months).length;
  return total;
}

function _shrinkReason(prevState, nextState, prevBytes, nextBytes){
  const prevN = _recordCount(prevState), nextN = _recordCount(nextState);
  if(prevN > 0 && nextN === 0) return 'everything was cleared (' + prevN + ' records to none)';
  if(prevN > 4 && nextN < prevN * SHRINK_RATIO) return 'records removed (' + prevN + ' to ' + nextN + ')';
  if(prevBytes > SHRINK_FLOOR && nextBytes < prevBytes * SHRINK_RATIO){
    return 'large reduction (' + prevBytes + ' to ' + nextBytes + ' bytes)';
  }
  return null;
}

// Keep the state we are about to overwrite. Runs inside the caller's
// transaction, on the same locked row, so it cannot race the write it guards.
// Never throws into the save path: a failed snapshot must not cost a save.
// Deliberately NOT on the caller's transaction. It runs on its own connection
// and commits on its own, before the overwrite it guards lands. A spare
// snapshot, if the save then fails, is harmless; a save that fails BECAUSE of
// snapshotting is not, and a snapshot taken after the overwrite would be lost
// if the process died in between.
async function _keepPrevious(client, tenantId, prevState, nextState, nextBytes, userId, forcedReason){
  try {
    const prevJson = JSON.stringify(prevState == null ? {} : prevState);
    const prevBytes = Buffer.byteLength(prevJson);
    if(prevBytes <= 2) return null;                    // nothing worth keeping
    const shrink = _shrinkReason(prevState, nextState, prevBytes, nextBytes);
    let reason = forcedReason || shrink;
    if(!reason){
      const last = await client.query(
        `SELECT taken_at FROM state_history WHERE tenant_id = $1 ORDER BY taken_at DESC, id DESC LIMIT 1`, [tenantId]);
      const due = !last.rows.length || (Date.now() - new Date(last.rows[0].taken_at).getTime()) >= HISTORY_GAP_MS;
      if(!due) return null;
      reason = 'routine';
    }
    await client.query(
      `INSERT INTO state_history (tenant_id, state, taken_by, reason, bytes)
       VALUES ($1, $2::jsonb, $3, $4, $5)`,
      [tenantId, prevJson, userId || null, reason, prevBytes]);
    await client.query(
      `DELETE FROM state_history
        WHERE tenant_id = $1
          AND id NOT IN (SELECT id FROM state_history WHERE tenant_id = $1 ORDER BY taken_at DESC, id DESC LIMIT $2)
          AND (bytes < $3 OR taken_at < NOW() - INTERVAL '30 days')`,
      [tenantId, HISTORY_KEEP, Math.max(1, nextBytes * 2)]);
    return reason;
  } catch(err){
    console.error('state history snapshot failed (save continues):', err.message);
    return null;
  }
}

module.exports = { keepPrevious: _keepPrevious, recordCount: _recordCount, HISTORY_KEEP, HISTORY_GAP_MS };
