// ══════════════════════════════════════════════════════════════
//  /api/offline — pairing for the PC-held offline copy.
//
//  A file:// page cannot use the session cookie cross-origin, so the
//  offline copy authenticates with a per-consultant bearer token instead:
//  generated once in the live app (cookie-authed, consultant only), stored
//  HASHED on the user row, pasted into the offline copy. The Bearer routes
//  are CORS-open ('*', no credentials) — the token is the secret, cookies
//  are never read here, so the wildcard leaks nothing.
//
//  Push carries the updatedAt the copy pulled against; if the server moved
//  on since, the push 409s and the copy asks before overwriting (same
//  optimistic-concurrency idea as the in-app save).
// ══════════════════════════════════════════════════════════════
const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// CORS for every /api/offline route. No cookies involved — Authorization
// header only — so '*' with no credentials is the safe shape.
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();

// ── Pairing token (cookie-authed; the live app's Admin tab calls this) ──
// POST /api/offline/token → { token } — shown once; regenerating revokes the old one.
router.post('/token', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'consultant') return res.status(403).json({ error: 'consultant_only' });
    const token = crypto.randomBytes(24).toString('hex');   // 48 hex chars
    await pool.query(`UPDATE users SET offline_token_hash = $1 WHERE id = $2`,
      [sha256(token).toString('hex'), req.user.id]);
    res.json({ token });
  } catch (err) {
    console.error('POST /api/offline/token error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});
// POST /api/offline/token/revoke → clears it.
router.post('/token/revoke', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'consultant') return res.status(403).json({ error: 'consultant_only' });
    await pool.query(`UPDATE users SET offline_token_hash = NULL WHERE id = $1`, [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/offline/token/revoke error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Bearer auth for the offline copy ──
async function requireOfflineToken(req, res, next) {
  try {
    const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    if (!m || m[1].length < 32) return res.status(401).json({ error: 'token_required' });
    const digest = sha256(m[1]);
    const r = await pool.query(
      `SELECT id, email, display_name, offline_token_hash FROM users
        WHERE role = 'consultant' AND offline_token_hash IS NOT NULL AND is_active = TRUE`);
    const hit = r.rows.find(u => {
      try {
        const stored = Buffer.from(u.offline_token_hash, 'hex');
        return stored.length === digest.length && crypto.timingSafeEqual(stored, digest);
      } catch (e) { return false; }
    });
    if (!hit) return res.status(401).json({ error: 'bad_token' });
    req.offlineUser = { id: hit.id, email: hit.email, name: hit.display_name || hit.email };
    next();
  } catch (err) {
    console.error('offline token check error:', err);
    res.status(500).json({ error: 'server_error' });
  }
}

// GET /api/offline/tenants — the client list for the picker.
router.get('/tenants', requireOfflineToken, async (_req, res) => {
  try {
    const r = await pool.query(`SELECT id, name FROM tenants ORDER BY name`);
    res.json({ tenants: r.rows });
  } catch (err) {
    console.error('GET /api/offline/tenants error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/offline/state?tenantId= — pull one client's state.
router.get('/state', requireOfflineToken, async (req, res) => {
  const tenantId = String(req.query?.tenantId || '').trim();
  if (!tenantId) return res.status(400).json({ error: 'tenant_required' });
  try {
    const t = await pool.query(`SELECT id, name FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    if (!t.rows.length) return res.status(404).json({ error: 'tenant_not_found' });
    const r = await pool.query(`SELECT state, updated_at FROM app_state WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    res.json({
      tenantId, name: t.rows[0].name,
      state: r.rows.length ? r.rows[0].state : null,
      updatedAt: r.rows.length ? r.rows[0].updated_at : null,
    });
  } catch (err) {
    console.error('GET /api/offline/state error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/offline/state?tenantId= — push the offline work back.
// Body: { state, baseUpdatedAt, force } — 409s if the server moved on since
// the pull, unless force is set (the copy asks the user first).
router.post('/state', requireOfflineToken, express.json({ limit: '25mb' }), async (req, res) => {
  const tenantId = String(req.query?.tenantId || '').trim();
  if (!tenantId) return res.status(400).json({ error: 'tenant_required' });
  const state = req.body && req.body.state;
  if (!state || typeof state !== 'object') return res.status(400).json({ error: 'state_required' });
  try {
    const t = await pool.query(`SELECT id FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    if (!t.rows.length) return res.status(404).json({ error: 'tenant_not_found' });
    const cur = await pool.query(`SELECT updated_at FROM app_state WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    const serverUpd = cur.rows.length ? cur.rows[0].updated_at : null;
    const base = req.body.baseUpdatedAt ? new Date(req.body.baseUpdatedAt) : null;
    if (!req.body.force && serverUpd && (!base || new Date(serverUpd).getTime() !== base.getTime())) {
      return res.status(409).json({ error: 'conflict', serverUpdatedAt: serverUpd });
    }
    const upd = await pool.query(
      `INSERT INTO app_state (tenant_id, state, updated_at, updated_by)
         VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (tenant_id) DO UPDATE SET state = $2, updated_at = NOW(), updated_by = $3
       RETURNING updated_at`,
      [tenantId, state, req.offlineUser.id]);
    res.json({ ok: true, updatedAt: upd.rows[0].updated_at });
  } catch (err) {
    console.error('POST /api/offline/state error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
