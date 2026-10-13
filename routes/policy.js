// Policy drafts for the submission pack. A consultant asks for the drafts for
// a client's question set and sends the client's facts; the server fills the
// anonymised AHS Ltd templates (lib/policy-drafts.js) and returns the drafts.
// Consultant only: the templates are AHS Ltd's.
const express = require('express');
const { requireAuth, requireConsultant } = require('../middleware/auth');
const { draftsFor } = require('../lib/policy-drafts');

const router = express.Router();

// POST /api/policy/drafts  { set: 'designer'|'contractor', facts: {...}, today?: 'YYYY-MM-DD' }
router.post('/drafts', requireAuth, requireConsultant, async (req, res) => {
  try {
    const b = req.body || {};
    if (b.set !== 'designer' && b.set !== 'contractor') return res.status(400).json({ error: 'set must be designer or contractor' });
    const facts = (b.facts && typeof b.facts === 'object') ? b.facts : {};
    const today = /^\d{4}-\d{2}-\d{2}$/.test(b.today || '') ? b.today : new Date().toISOString().slice(0, 10);
    const drafts = await draftsFor(b.set, facts, today);
    res.json({ drafts, left: ['Carbon Reduction Plan', 'Health and Safety Advice Record', 'CDM Designer Good Practice Audit'] });
  } catch (e) {
    console.error('policy drafts', e);
    res.status(500).json({ error: 'drafts_failed' });
  }
});

module.exports = router;
