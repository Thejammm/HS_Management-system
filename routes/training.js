// ══════════════════════════════════════════════════════════════
//  /api/training — Excel round-trip for the training matrix
//
//  POST /parse   (raw .xlsx bytes)      -> { sheets, people }   (no side effects)
//  POST /store   (raw .xlsx bytes)      -> stores the template workbook for the tenant
//  GET  /status                         -> { hasWorkbook, filename, updatedAt }
//  POST /export  (raw JSON: {state})    -> the client's workbook with current values (xlsx download)
//
//  The client's spreadsheet stays the single source of truth. /store keeps a
//  verbatim copy; /export writes the app's current values back into a copy of
//  that exact file, preserving their tabs, formatting and formulas.
// ══════════════════════════════════════════════════════════════
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { parse, build, buildFresh } = require('../lib/training-xlsx');

const router = express.Router();
const rawBody = express.raw({ type: () => true, limit: '25mb' });

// Same tenant rule as /api/state: client_user → own tenant; consultant → ?tenantId=.
function _resolveTenant(req){
  if(req.user.role === 'client_user') return req.user.tenantId || null;
  return (req.query?.tenantId || '').toString() || null;
}

// Parse an uploaded workbook and return the model. Does NOT store anything.
router.post('/parse', requireAuth, rawBody, async (req, res) => {
  if(!_resolveTenant(req)) return res.status(400).json({ error: 'tenant_required' });
  if(!req.body || !req.body.length) return res.status(400).json({ error: 'no_file' });
  try {
    const headerRow = parseInt((req.query && req.query.headerRow) || '', 10) || 0;   // 'where the table starts' override
    const model = await parse(req.body, headerRow ? { headerRow } : {});
    if(!model.people.length) return res.status(422).json({ error: 'no_people_found' });
    res.json(model);
  } catch(err){
    console.error('training/parse error:', err.message);
    res.status(422).json({ error: 'could_not_read_workbook' });
  }
});

// Store the template workbook (verbatim) for this tenant.
router.post('/store', requireAuth, rawBody, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  if(!req.body || !req.body.length) return res.status(400).json({ error: 'no_file' });
  const filename = (req.get('X-Filename') || 'Training Matrix.xlsx').slice(0, 200);
  try {
    await pool.query(
      `INSERT INTO training_workbook (tenant_id, filename, data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET filename = EXCLUDED.filename, data = EXCLUDED.data, updated_at = NOW()`,
      [tenantId, filename, req.body.toString('base64')]
    );
    res.json({ ok: true, filename });
  } catch(err){
    console.error('training/store error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/status', requireAuth, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  try {
    const r = await pool.query(`SELECT filename, updated_at FROM training_workbook WHERE tenant_id = $1`, [tenantId]);
    if(!r.rows.length) return res.json({ hasWorkbook: false });
    res.json({ hasWorkbook: true, filename: r.rows[0].filename, updatedAt: r.rows[0].updated_at });
  } catch(err){
    console.error('training/status error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// Build the export from the stored template + the app's current values.
// Body is raw JSON text (octet-stream) so it bypasses the global 1mb json limit.
router.post('/export', requireAuth, rawBody, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  let state;
  try { state = JSON.parse(req.body.toString('utf8')).state; } catch(e){ return res.status(400).json({ error: 'bad_state' }); }
  try {
    const r = await pool.query(`SELECT filename, data FROM training_workbook WHERE tenant_id = $1`, [tenantId]);
    // No stored workbook (the data came in by paste or was typed in): build a
    // fresh workbook straight from the app's model instead of failing.
    const buf = r.rows.length
      ? await build(Buffer.from(r.rows[0].data, 'base64'), state)
      : await buildFresh(state);
    const base = String((r.rows[0] && r.rows[0].filename) || 'Training Matrix.xlsx').replace(/\.xlsx?$/i, '');
    const rev = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base} (rev ${rev}).xlsx"`);
    res.send(Buffer.from(buf));
  } catch(err){
    console.error('training/export error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// Remove the stored workbook (used by 'delete all training data').
router.delete('/workbook', requireAuth, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  try { await pool.query('DELETE FROM training_workbook WHERE tenant_id = $1', [tenantId]); res.json({ ok: true }); }
  catch(err){ console.error('training/delete error:', err.message); res.status(500).json({ error: 'server_error' }); }
});

module.exports = router;
