// ══════════════════════════════════════════════════════════════
//  /api/signoff — acknowledgement by link.
//
//  Simon, 2026-09-28: an employee log-in is the wrong shape for someone who
//  has to do one thing twice a year. They get a link instead - by email or
//  WhatsApp, sent by the consultant or the client, never by Compass - open it
//  on their phone, read the document where it actually lives on the client's
//  own system, and confirm.
//
//  Two rules shape everything here:
//
//  1. COMPASS DOES NOT SEND. It mints the links and composes the message; a
//     human sends it. No SMTP, no deliverability, no bounce handling, and no
//     new processor relationship. It is the pattern the app already uses for
//     near-miss notifications.
//
//  2. THE PUBLIC ENDPOINT NEVER TOUCHES THE STATE BLOB. A signature lands in
//     this table and nowhere else; the app merges it into the acknowledgement
//     trail the next time a consultant opens the register. A public route that
//     could write a tenant's whole state is a public route that will one day
//     destroy one.
//
//  The token follows the offline-pairing pattern already in this codebase:
//  random bytes given out once, only the SHA-256 kept.
// ══════════════════════════════════════════════════════════════
const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const TOKEN_BYTES = 32;
const DEFAULT_DAYS = 60;
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// A document link is only clickable if it is actually reachable from a phone.
// A UNC path or a drive letter is shown as text, because a link that cannot
// open is worse than no link - it looks like the app is broken.
const isWebLink = (s) => /^https?:\/\//i.test(String(s || '').trim());

// ── Mint links ────────────────────────────────────────────────
// POST /api/signoff/invite   { tenantId, days?, items:[{...}] }
router.post('/invite', requireAuth, express.json({ limit: '1mb' }), async (req, res) => {
  const tenantId = req.user.role !== 'consultant'
    ? (req.user.tenantId || '')
    : String(req.query?.tenantId || req.body?.tenantId || '').trim();
  if (!tenantId) return res.status(400).json({ error: 'tenant_required' });

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'no_items' });
  if (items.length > 500) return res.status(400).json({ error: 'too_many' });

  const days = Math.min(365, Math.max(1, parseInt(req.body?.days, 10) || DEFAULT_DAYS));
  const base = String(req.body?.base || '').replace(/\/+$/, '')
    || (req.headers.origin ? String(req.headers.origin).replace(/\/+$/, '') : '');

  try {
    const out = [];
    for (const it of items) {
      const staffId = String(it.staffId || '').trim();
      const policyId = String(it.policyId || '').trim();
      if (!staffId || !policyId) continue;
      const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
      const id = 'inv_' + crypto.randomBytes(9).toString('hex');
      await pool.query(
        `INSERT INTO signoff_invite
           (id, tenant_id, token_hash, staff_id, staff_name, staff_role, policy_id,
            policy_title, policy_version, policy_issued, policy_link, declaration,
            created_by, expires_at, content)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now() + ($14 || ' days')::interval, $15)`,
        [id, tenantId, sha256(token), staffId, String(it.staffName || ''), String(it.staffRole || ''),
         policyId, String(it.policyTitle || ''), String(it.policyVersion || ''),
         String(it.policyIssued || ''), String(it.policyLink || ''), String(it.declaration || ''),
         String(req.user.name || req.user.email || ''), String(days),
         // what was covered - a talk's points or a month's learning, capped: never a document
         String(it.content || '').slice(0, 8000)]);
      out.push({ id, staffId, policyId, url: (base || '') + '/s/' + token });
    }
    res.json({ ok: true, invites: out, expiresDays: days });
  } catch (err) {
    console.error('POST /api/signoff/invite:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── What has come back, and what has not ──────────────────────
// GET /api/signoff/status?tenantId=x
router.get('/status', requireAuth, async (req, res) => {
  const tenantId = req.user.role !== 'consultant'
    ? (req.user.tenantId || '')
    : String(req.query?.tenantId || '').trim();
  if (!tenantId) return res.status(400).json({ error: 'tenant_required' });
  try {
    const r = await pool.query(
      `SELECT id, staff_id, staff_name, staff_role, policy_id, policy_title, policy_version,
              policy_issued, policy_link, declaration, created_at, created_by, expires_at,
              signed_at, signed_name, signed_ip, signed_ua
         FROM signoff_invite WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 2000`, [tenantId]);
    res.json({ ok: true, invites: r.rows });
  } catch (err) {
    console.error('GET /api/signoff/status:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── The page the employee opens. No login, no session. ────────
function page(title, inner, extraHead) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>${extraHead || ''}
<style>
  :root{--ink:#1d1f20;--muted:#6a6c6e;--hair:#d4d4d7;--accent:#0E8F7E;--bg:#f2f2f3;}
  *{box-sizing:border-box;border-radius:0;}
  body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;}
  .wrap{max-width:560px;margin:0 auto;padding:20px 16px 48px;}
  .card{background:#fff;border:1px solid var(--hair);padding:20px 18px;margin-bottom:14px;}
  h1{font-size:19px;margin:0 0 4px;line-height:1.25;}
  .org{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;}
  .lab{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:16px 0 4px;}
  .doc{font-size:17px;font-weight:700;line-height:1.3;}
  .meta{font-size:14px;color:var(--muted);margin-top:2px;}
  a.open{display:block;text-align:center;padding:14px;margin:12px 0 0;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;}
  .where{padding:11px 12px;background:var(--bg);border:1px solid var(--hair);font-size:14px;word-break:break-all;margin-top:10px;}
  .dec{white-space:pre-wrap;font-size:15px;line-height:1.6;padding:13px;background:var(--bg);border:1px solid var(--hair);}
  label.tick{display:flex;gap:10px;align-items:flex-start;margin:16px 0 4px;font-size:15px;cursor:pointer;}
  label.tick input{width:22px;height:22px;flex:0 0 auto;margin-top:1px;accent-color:var(--accent);}
  input.name{width:100%;padding:12px;border:1px solid var(--hair);font-size:16px;font-family:inherit;margin-top:6px;background:#fff;color:inherit;}
  button.sign{width:100%;padding:15px;margin-top:16px;border:0;background:var(--accent);color:#fff;font:700 16px inherit;font-family:inherit;cursor:pointer;}
  button.sign:disabled{background:#b9bcbe;cursor:not-allowed;}
  .foot{font-size:12px;color:var(--muted);line-height:1.5;margin-top:14px;}
  .done{border-left:4px solid var(--accent);}
  .bad{border-left:4px solid #B45309;}
  .err{color:#B45309;font-weight:600;font-size:14px;margin-top:10px;min-height:20px;}
</style></head><body><div class="wrap">${inner}</div></body></html>`;
}

const LEGAL = 'This record is kept by your employer to show that health and safety information has '
  + 'been provided to employees and brought to their notice - Health and Safety at Work etc. Act 1974 '
  + 's.2(2)(c) and s.2(3), and Management of Health and Safety at Work Regulations 1999 reg. 10.';

router.get('/view/:token', async (req, res) => {
  const token = String(req.params.token || '');
  res.set('Cache-Control', 'no-store');
  try {
    const r = await pool.query(
      `SELECT i.*, t.name AS tenant_name FROM signoff_invite i
         JOIN tenants t ON t.id = i.tenant_id
        WHERE i.token_hash = $1 LIMIT 1`, [sha256(token)]);
    if (!r.rows.length) {
      return res.status(404).send(page('Not found', `<div class="card bad"><h1>This link is not valid</h1>
        <p class="meta">It may have been mistyped, or replaced by a newer one. Ask whoever sent it for a fresh link.</p></div>`));
    }
    const v = r.rows[0];
    const org = esc(v.tenant_name || 'Your employer');

    if (v.signed_at) {
      const when = new Date(v.signed_at).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      return res.send(page('Already confirmed', `<div class="org">${org}</div>
        <div class="card done"><h1>Already confirmed</h1>
        <div class="meta">${esc(v.policy_title)}${v.policy_version ? (', version ' + esc(v.policy_version)) : ''}</div>
        <p class="meta">Confirmed by ${esc(v.signed_name || v.staff_name)} on ${esc(when)}. Nothing further to do.</p>
        <div class="foot">${esc(LEGAL)}</div></div>`));
    }
    if (new Date(v.expires_at) < new Date()) {
      return res.status(410).send(page('Link expired', `<div class="org">${org}</div>
        <div class="card bad"><h1>This link has expired</h1>
        <p class="meta">Ask whoever sent it for a new one - it only takes them a moment.</p></div>`));
    }

    const web = isWebLink(v.policy_link);
    // A talk's points, or a month's learning with its links, carried on the
    // invite itself so the page can show what was covered.
    const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, (m) => '<a href="' + m + '" target="_blank" rel="noopener">' + m + '</a>');
    const covered = v.content ? '<div class="lab">What it covers</div><div class="dec">' + linkify(v.content) + '</div>' : '';
    const where = v.policy_link
      ? (web
        ? `<a class="open" href="${esc(v.policy_link)}" target="_blank" rel="noopener">Open the document</a>`
        : `<div class="lab">Where to find it</div><div class="where">${esc(v.policy_link)}</div>`)
      : `<div class="lab">Where to find it</div><div class="where">Ask your manager where this document is kept.</div>`;

    res.send(page('Confirm you have read this', `<div class="org">${org}</div>
      <div class="card">
        <h1>Please confirm you have read this</h1>
        <div class="lab">Document</div>
        <div class="doc">${esc(v.policy_title || 'Document')}</div>
        <div class="meta">${v.policy_version ? ('Version ' + esc(v.policy_version)) : 'No version given'}${v.policy_issued ? (' &middot; issued ' + esc(v.policy_issued)) : ''}</div>
        ${where}
        ${covered}
      </div>
      <div class="card">
        <div class="lab">Declaration</div>
        <div class="dec">${esc(v.declaration || 'I confirm I have read and understood this document.')}</div>
        <label class="tick"><input type="checkbox" id="agree"><span>I have read it and I agree to the above.</span></label>
        <div class="lab">Your full name</div>
        <input class="name" id="who" value="${esc(v.staff_name || '')}" autocomplete="name" placeholder="Type your full name">
        <div class="err" id="err"></div>
        <button class="sign" id="go" disabled>Confirm</button>
        <div class="foot">${esc(LEGAL)}</div>
      </div>
      <script>
        var a=document.getElementById('agree'), w=document.getElementById('who'),
            g=document.getElementById('go'), e=document.getElementById('err');
        function upd(){ g.disabled = !(a.checked && w.value.trim().length>1); }
        a.addEventListener('change',upd); w.addEventListener('input',upd); upd();
        g.addEventListener('click', function(){
          g.disabled=true; e.textContent='';
          fetch('/api/signoff/sign',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({token:${JSON.stringify(token)},name:w.value.trim()})})
            .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
            .then(function(o){ if(o.ok){ location.reload(); }
              else { e.textContent = o.j && o.j.error==='already_signed' ? 'This has already been confirmed.' : 'Could not save that - please try again.'; upd(); } })
            .catch(function(){ e.textContent='No connection - please try again.'; upd(); });
        });
      <\/script>`));
  } catch (err) {
    console.error('GET /s/:token:', err);
    res.status(500).send(page('Something went wrong', `<div class="card bad"><h1>Something went wrong</h1>
      <p class="meta">Please try again shortly, or tell whoever sent you the link.</p></div>`));
  }
});

// ── The signature. Public, and it writes to this table only. ──
router.post('/sign', express.json({ limit: '32kb' }), async (req, res) => {
  const token = String(req.body?.token || '');
  const name = String(req.body?.name || '').trim().slice(0, 120);
  if (!token || name.length < 2) return res.status(400).json({ error: 'bad_request' });
  res.set('Cache-Control', 'no-store');
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 64);
    const ua = String(req.headers['user-agent'] || '').slice(0, 240);
    // One shot: only an unsigned, unexpired invite can be claimed, and the
    // update itself is the guard - two taps cannot both win.
    const r = await pool.query(
      `UPDATE signoff_invite
          SET signed_at = now(), signed_name = $2, signed_ip = $3, signed_ua = $4
        WHERE token_hash = $1 AND signed_at IS NULL AND expires_at > now()
        RETURNING id`, [sha256(token), name, ip, ua]);
    if (!r.rows.length) {
      const e = await pool.query(`SELECT signed_at FROM signoff_invite WHERE token_hash = $1 LIMIT 1`, [sha256(token)]);
      if (e.rows.length && e.rows[0].signed_at) return res.status(409).json({ error: 'already_signed' });
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/signoff/sign:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
