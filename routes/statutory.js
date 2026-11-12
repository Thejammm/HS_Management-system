// ══════════════════════════════════════════════════════════════
//  /api/statutory — Excel round-trip for the statutory register.
//  Mirrors /api/training: parse / store / status / export, tenant-
//  scoped; the client's workbook is kept verbatim for export.
// ══════════════════════════════════════════════════════════════
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { parse, build, buildFresh, peekLayout, parseLayout, buildLayout } = require('../lib/statutory-xlsx');

const router = express.Router();
const rawBody = express.raw({ type: () => true, limit: '25mb' });

function _resolveTenant(req){
  if(req.user.role !== 'consultant') return req.user.tenantId || null;
  return (req.query?.tenantId || '').toString() || null;
}

router.post('/parse', requireAuth, rawBody, async (req, res) => {
  if(!_resolveTenant(req)) return res.status(400).json({ error: 'tenant_required' });
  if(!req.body || !req.body.length) return res.status(400).json({ error: 'no_file' });
  try {
    const headerRow = parseInt((req.query && req.query.headerRow) || '', 10) || 0;   // 'where the table starts' override
    let mapping = null;   // DRM-style explicit column mapping from the in-app wizard
    try { if(req.query && req.query.mapping) mapping = JSON.parse(String(req.query.mapping)); } catch(e){ return res.status(400).json({ error: 'bad_mapping' }); }
    // the client's own columns, each in or out (12 November 2026); the older field mapping stays for anything else
    const model = (mapping && mapping.layout)
      ? await parseLayout(req.body, { headerRow: headerRow || 1, layout: mapping.layout })
      : await parse(req.body, Object.assign({}, headerRow ? { headerRow } : {}, mapping ? { fixed: mapping.fixed || null, skip: mapping.skip || [] } : {}));
    if(!model.items.length) return res.status(422).json({ error: 'no_items_found' });
    res.json(model);
  } catch(err){
    console.error('statutory/parse error:', err.message);
    res.status(422).json({ error: 'could_not_read_workbook' });
  }
});

router.post('/store', requireAuth, rawBody, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  if(!req.body || !req.body.length) return res.status(400).json({ error: 'no_file' });
  const filename = (req.get('X-Filename') || 'Statutory Register.xlsx').slice(0, 200);
  try {
    await pool.query(
      `INSERT INTO statutory_workbook (tenant_id, filename, data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET filename = EXCLUDED.filename, data = EXCLUDED.data, updated_at = NOW()`,
      [tenantId, filename, req.body.toString('base64')]
    );
    res.json({ ok: true, filename });
  } catch(err){
    console.error('statutory/store error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/status', requireAuth, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  try {
    const r = await pool.query(`SELECT filename, updated_at FROM statutory_workbook WHERE tenant_id = $1`, [tenantId]);
    if(!r.rows.length) return res.json({ hasWorkbook: false });
    res.json({ hasWorkbook: true, filename: r.rows[0].filename, updatedAt: r.rows[0].updated_at });
  } catch(err){
    console.error('statutory/status error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/export', requireAuth, rawBody, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  let state;
  try { state = JSON.parse(req.body.toString('utf8')).state; } catch(e){ return res.status(400).json({ error: 'bad_state' }); }
  try {
    const r = await pool.query(`SELECT filename, data FROM statutory_workbook WHERE tenant_id = $1`, [tenantId]);
    // No stored workbook (rows typed in or pasted): build a fresh file. A client
    // imported with its own layout gets only its changed cells written back.
    let buf;
    if(r.rows.length && state && state.layout){
      const out = await buildLayout(Buffer.from(r.rows[0].data, 'base64'), state);
      buf = out.buffer;
      res.setHeader('X-Not-Removed', String(out.notRemoved));
      res.setHeader('X-Cells-Changed', String(out.changed));
      res.setHeader('X-Rows-Added', String(out.appended));
    } else buf = r.rows.length
      ? await build(Buffer.from(r.rows[0].data, 'base64'), state)
      : await buildFresh(state);
    const base = String((r.rows[0] && r.rows[0].filename) || 'Statutory Register.xlsx').replace(/\.xlsx?$/i, '');
    const rev = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base} (rev ${rev}).xlsx"`);
    res.send(Buffer.from(buf));
  } catch(err){
    console.error('statutory/export error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// Remove the stored workbook (used by 'delete all statutory data').
router.delete('/workbook', requireAuth, async (req, res) => {
  const tenantId = _resolveTenant(req);
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  try { await pool.query('DELETE FROM statutory_workbook WHERE tenant_id = $1', [tenantId]); res.json({ ok: true }); }
  catch(err){ console.error('statutory/delete error:', err.message); res.status(500).json({ error: 'server_error' }); }
});

// First rows of each sheet, as strings - the Map & import preview - with which
// cells hold formulas and the merges, so the mapping screen can show them.
router.post('/peek', requireAuth, rawBody, async (req, res) => {
  if(!_resolveTenant(req)) return res.status(400).json({ error: 'tenant_required' });
  if(!req.body || !req.body.length) return res.status(400).json({ error: 'no_file' });
  try { res.json(await peekLayout(req.body)); }
  catch(err){ console.error('statutory/peek error:', err.message); res.status(422).json({ error: 'could_not_read_workbook' }); }
});

module.exports = router;
