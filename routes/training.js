// ══════════════════════════════════════════════════════════════
//  /api/training — Excel round-trip for the training matrix
//
//  POST /parse   (raw .xlsx bytes)      -> { sheets, people }   (no side effects)
//  POST /layout  (raw .xlsx bytes)      -> the chosen tab's columns and every tab, for the mapping screen
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
const { parse, layout, buildReport, buildFresh, peek: xlsxPeek } = require('../lib/training-xlsx');

const router = express.Router();
const rawBody = express.raw({ type: () => true, limit: '25mb' });

// Same tenant rule as /api/state: client_user/employee → own tenant; consultant → ?tenantId=.
function _resolveTenant(req){
  if(req.user.role !== 'consultant') return req.user.tenantId || null;
  return (req.query?.tenantId || '').toString() || null;
}

// Parse an uploaded workbook and return the model. Does NOT store anything.
router.post('/parse', requireAuth, rawBody, async (req, res) => {
  if(!_resolveTenant(req)) return res.status(400).json({ error: 'tenant_required' });
  if(!req.body || !req.body.length) return res.status(400).json({ error: 'no_file' });
  try {
    const headerRow = parseInt((req.query && req.query.headerRow) || '', 10) || 0;   // 'where the table starts' override
    let mapping = null;   // DRM-style explicit column mapping from the in-app wizard
    try { if(req.query && req.query.mapping) mapping = JSON.parse(String(req.query.mapping)); } catch(e){ return res.status(400).json({ error: 'bad_mapping' }); }
    // the mapping screen also says which tab the matrix is on, whether its headings run
    // over two rows, and which tabs were ticked to bring in
    const opts = Object.assign({}, headerRow ? { headerRow } : {}, mapping ? { fixed: mapping.fixed || null, skip: mapping.skip || [] } : {},
      (mapping && typeof mapping.sheet === 'string') ? { sheet: mapping.sheet } : {},
      (mapping && (mapping.headRows === 1 || mapping.headRows === 2)) ? { headRows: mapping.headRows } : {},
      (mapping && Array.isArray(mapping.tabs)) ? { tabs: mapping.tabs.map(String) } : {});
    const model = await parse(req.body, opts);
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
    let buf, report = null;
    if(r.rows.length){
      const out = await buildReport(Buffer.from(r.rows[0].data, 'base64'), state);
      buf = out.buffer;
      // what the export did with people moved, added or deleted in Compass, for the app to say
      // (names are sent URI-encoded: a header holds plain ASCII only)
      report = { moved: out.moved.length, movedNames: out.moved.slice(0, 6), notMoved: out.notMoved.length, noLeftTab: out.notMoved.filter(x => x.why === 'no Left tab').length,
        dropped: out.dropped.length, added: out.added, notRemoved: out.notRemoved, formulaKept: out.formulaKept };
    } else buf = await buildFresh(state);
    const base = String((r.rows[0] && r.rows[0].filename) || 'Training Matrix.xlsx').replace(/\.xlsx?$/i, '');
    const rev = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base} (rev ${rev}).xlsx"`);
    if(report) res.setHeader('X-Export-Report', encodeURIComponent(JSON.stringify(report)));
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

// The mapping screen, once the headings row is clicked: the chosen tab's columns under the
// names they will carry, and every tab - whether it holds people the same way, how many,
// and how many of them are also on the chosen tab. Reads only; stores nothing.
router.post('/layout', requireAuth, rawBody, async (req, res) => {
  if(!_resolveTenant(req)) return res.status(400).json({ error: 'tenant_required' });
  if(!req.body || !req.body.length) return res.status(400).json({ error: 'no_file' });
  try {
    const q = req.query || {};
    let fixed = {}; try { if(q.fixed) fixed = JSON.parse(String(q.fixed)) || {}; } catch(e){ return res.status(400).json({ error: 'bad_mapping' }); }
    const headRows = parseInt(q.headRows || '', 10);
    res.json(await layout(req.body, { sheet: q.sheet == null ? '' : String(q.sheet), headerRow: parseInt(q.headerRow || '', 10) || 1,
      headRows: (headRows === 1 || headRows === 2) ? headRows : undefined, fixed }));
  } catch(err){ console.error('training/layout error:', err.message); res.status(422).json({ error: 'could_not_read_workbook' }); }
});

// First rows of each sheet, as strings - the Map & import preview.
router.post('/peek', requireAuth, rawBody, async (req, res) => {
  if(!_resolveTenant(req)) return res.status(400).json({ error: 'tenant_required' });
  if(!req.body || !req.body.length) return res.status(400).json({ error: 'no_file' });
  try { res.json(await xlsxPeek(req.body)); }
  catch(err){ console.error('training/peek error:', err.message); res.status(422).json({ error: 'could_not_read_workbook' }); }
});

module.exports = router;
