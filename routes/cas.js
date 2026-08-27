// ══════════════════════════════════════════════════════════════
//  /api/cas — the CAS question-set Excel export. The framework and the
//  client's statuses live in the front end; it posts the rows, the server
//  builds the workbook. Tenant-scoped like /api/statutory.
// ══════════════════════════════════════════════════════════════
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { buildCasWorkbook } = require('../lib/cas-xlsx');

const router = express.Router();
const rawBody = express.raw({ type: () => true, limit: '10mb' });

router.post('/export', requireAuth, rawBody, async (req, res) => {
  let payload;
  try { payload = JSON.parse(req.body.toString('utf8')); } catch (e) { return res.status(400).json({ error: 'bad_payload' }); }
  try {
    const buf = await buildCasWorkbook(payload);
    const safe = String(payload.client || 'client').replace(/[^a-z0-9 .-]/gi, '').trim().slice(0, 80) || 'client';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="CAS question set - ${safe}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    if (err.message === 'no_rows') return res.status(400).json({ error: 'no_rows' });
    console.error('cas/export error:', err.message);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
