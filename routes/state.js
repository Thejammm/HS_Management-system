// ══════════════════════════════════════════════════════════════
//  /api/state — per-tenant state load and save
//
//  Every state read/write is scoped to req.user.tenantId.
//  Consultants without a tenant_id need to pick a tenant via
//  ?tenantId=xxx query param (admin UI in Phase B+).
// ══════════════════════════════════════════════════════════════
const express  = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

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

// Resolve which tenant the request is acting on.
// - client_user: always their own tenant_id, ignores query.
// - consultant: must pass ?tenantId=... (or it'd be ambiguous).
function _resolveTenant(req){
  if(req.user.role === 'client_user'){
    return req.user.tenantId || null;
  }
  // consultant
  return (req.query?.tenantId || req.body?.tenantId || '').toString() || null;
}

// GET /api/state[?tenantId=xxx]  (tenantId required for consultants)
router.get('/', requireAuth, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId){
    return res.status(400).json({ error: 'tenant_required' });
  }
  try {
    const r = await pool.query(
      `SELECT state, updated_at FROM app_state WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    if(!r.rows.length){
      // No state yet — return empty state so frontend can seed it
      return res.json({ tenantId, state: null, updatedAt: null });
    }
    res.json({
      tenantId,
      state:     r.rows[0].state,
      updatedAt: r.rows[0].updated_at
    });
  } catch(err){
    console.error('GET /api/state error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/state  body: { state: {...}, tenantId?: 'xxx', baseUpdatedAt?: ISO }
//
// Optimistic concurrency: baseUpdatedAt is the updated_at the client believes is
// current. If another editor (the consultant or the client) has saved this
// tenant since then, we reject with 409 and return the current server copy so
// the client can reconcile, rather than silently overwriting their work. When
// baseUpdatedAt is absent (older client / first save) we fall back to the
// previous last-write-wins behaviour.
router.post('/', requireAuth, express.json({ limit: '50mb' }), async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId){
    return res.status(400).json({ error: 'tenant_required' });
  }
  const state = req.body?.state;
  if(!state || typeof state !== 'object'){
    return res.status(400).json({ error: 'state_object_required' });
  }
  const baseUpdatedAt = req.body?.baseUpdatedAt || null;

  // Cheap pre-checks on the pool (no transaction needed yet).
  try {
    const t = await pool.query(`SELECT 1 FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    if(!t.rows.length){
      return res.status(404).json({ error: 'tenant_not_found' });
    }
    if(req.user.role === 'client_user' && req.user.tenantId !== tenantId){
      return res.status(403).json({ error: 'forbidden' });
    }
  } catch(err){
    console.error('POST /api/state precheck error:', err);
    return res.status(500).json({ error: 'server_error' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the tenant's state row so a concurrent save cannot slip in between
    // our conflict check and our write.
    const cur = await client.query(
      `SELECT state, updated_at FROM app_state WHERE tenant_id = $1 FOR UPDATE`,
      [tenantId]
    );
    if(cur.rows.length && baseUpdatedAt){
      // Compare at millisecond granularity: node-postgres returns updated_at as a
      // JS Date (ms), which is exactly the precision the client last received.
      const curMs  = new Date(cur.rows[0].updated_at).getTime();
      const baseMs = new Date(baseUpdatedAt).getTime();
      if(!Number.isNaN(baseMs) && curMs !== baseMs){
        await client.query('ROLLBACK');
        return res.status(409).json({
          error:     'conflict',
          updatedAt: cur.rows[0].updated_at,
          state:     cur.rows[0].state
        });
      }
    }

    // Keep what is there before it is overwritten.
    if(cur.rows.length){
      await _keepPrevious(pool, tenantId, cur.rows[0].state, state,
        Buffer.byteLength(JSON.stringify(state)), req.user.id, null);
    }

    const r = await client.query(
      `INSERT INTO app_state (tenant_id, state, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (tenant_id) DO UPDATE
         SET state = EXCLUDED.state,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by
       RETURNING updated_at`,
      [tenantId, JSON.stringify(state), req.user.id]
    );
    await client.query('COMMIT');
    res.json({
      ok:        true,
      tenantId,
      updatedAt: r.rows[0].updated_at
    });
  } catch(err){
    try { await client.query('ROLLBACK'); } catch(e){}
    console.error('POST /api/state error:', err);
    if(err.code === '54000' || /size/i.test(err.message)){
      return res.status(413).json({ error: 'state_too_large' });
    }
    res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

// GET /api/state/history[?tenantId=xxx] — what we could go back to. The blobs
// themselves are not sent; a list of them is enough to choose from.
router.get('/history', requireAuth, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  if(req.user.role === 'client_user' && req.user.tenantId !== tenantId){
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const r = await pool.query(
      `SELECT h.id, h.taken_at, h.reason, h.bytes, u.email AS taken_by
         FROM state_history h
         LEFT JOIN users u ON u.id = h.taken_by
        WHERE h.tenant_id = $1
        ORDER BY h.taken_at DESC, h.id DESC
        LIMIT 50`, [tenantId]);
    res.json({ ok: true, tenantId, snapshots: r.rows });
  } catch(err){
    console.error('GET /api/state/history error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/state/history/:id/restore — put a snapshot back. The state being
// replaced is itself kept first, so restoring is as reversible as anything
// else here and a restore to the wrong point is not a second disaster.
router.post('/history/:id/restore', requireAuth, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  if(req.user.role === 'client_user' && req.user.tenantId !== tenantId){
    return res.status(403).json({ error: 'forbidden' });
  }
  const id = String(req.params.id || '').replace(/[^0-9]/g, '');
  if(!id) return res.status(400).json({ error: 'snapshot_required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const snap = await client.query(
      `SELECT state, taken_at FROM state_history WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if(!snap.rows.length){
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'snapshot_not_found' });
    }
    const cur = await client.query(
      `SELECT state FROM app_state WHERE tenant_id = $1 FOR UPDATE`, [tenantId]);
    const restored = snap.rows[0].state;
    if(cur.rows.length){
      await _keepPrevious(pool, tenantId, cur.rows[0].state, restored,
        Buffer.byteLength(JSON.stringify(restored)), req.user.id, 'replaced by a restore');
    }
    const r = await client.query(
      `INSERT INTO app_state (tenant_id, state, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (tenant_id) DO UPDATE
         SET state = EXCLUDED.state, updated_at = NOW(), updated_by = EXCLUDED.updated_by
       RETURNING updated_at`,
      [tenantId, JSON.stringify(restored), req.user.id]);
    await client.query('COMMIT');
    res.json({ ok: true, tenantId, updatedAt: r.rows[0].updated_at, takenAt: snap.rows[0].taken_at, state: restored });
  } catch(err){
    try { await client.query('ROLLBACK'); } catch(e){}
    console.error('POST /api/state/history/:id/restore error:', err);
    res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

module.exports = router;
