// ══════════════════════════════════════════════════════════════
//  /api/linked — server-to-server pull from linked sibling apps
//
//  The browser only ever calls THIS route with its normal cookie session;
//  the service token (LINK_SERVICE_TOKEN) lives server-side and goes only
//  to hosts named in LINKED_APP_HOSTS (comma-separated), so this can never
//  be used as an open proxy and the token never reaches a browser.
//  Which remote to call comes from the tenant's own saved link config
//  (state.linkedApps) — nothing hardcoded, no client data in source.
// ══════════════════════════════════════════════════════════════
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function allowedHosts(){
  return String(process.env.LINKED_APP_HOSTS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// GET /api/linked/inspections?tenantId=xxx[&linkId=yyy]
router.get('/inspections', requireAuth, async (req, res) => {
  const token = process.env.LINK_SERVICE_TOKEN || '';
  if(token.length < 32){
    return res.status(503).json({ ok: false, error: 'link_not_configured' });
  }

  const tenantId = req.user.role !== 'consultant'
    ? (req.user.tenantId || '')
    : String(req.query?.tenantId || '').trim();
  if(!tenantId) return res.status(400).json({ ok: false, error: 'tenant_required' });

  try {
    const r = await pool.query(`SELECT state FROM app_state WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    if(!r.rows.length) return res.status(404).json({ ok: false, error: 'tenant_not_found' });
    const links = (r.rows[0].state && Array.isArray(r.rows[0].state.linkedApps))
      ? r.rows[0].state.linkedApps : [];
    const linkId = String(req.query?.linkId || '').trim();
    const link = linkId
      ? links.find(l => l && l.id === linkId)
      : links.find(l => l && l.kind === 'inspections');
    if(!link || !link.baseUrl || !link.remoteTenantId){
      return res.status(400).json({ ok: false, error: 'no_link_configured' });
    }

    let target;
    try { target = new URL(link.baseUrl); }
    catch(e){ return res.status(400).json({ ok: false, error: 'bad_link_url' }); }
    const isLocal = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
    if(target.protocol !== 'https:' && !isLocal){
      return res.status(400).json({ ok: false, error: 'https_required' });
    }
    if(!allowedHosts().includes(target.hostname.toLowerCase())){
      return res.status(400).json({ ok: false, error: 'host_not_allowed' });
    }

    const url = target.origin + '/api/link/state?tenantId=' + encodeURIComponent(link.remoteTenantId);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let remote;
    try {
      remote = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: ctrl.signal });
    } catch(e){
      clearTimeout(timer);
      return res.status(502).json({ ok: false, error: 'remote_unreachable' });
    }
    clearTimeout(timer);

    if(remote.status === 401) return res.status(502).json({ ok: false, error: 'remote_auth_failed' });
    if(remote.status === 404) return res.status(404).json({ ok: false, error: 'remote_tenant_not_found' });
    if(remote.status === 503) return res.status(502).json({ ok: false, error: 'remote_link_not_configured' });
    if(!remote.ok) return res.status(502).json({ ok: false, error: 'remote_error', status: remote.status });

    let body;
    try { body = await remote.json(); }
    catch(e){ return res.status(502).json({ ok: false, error: 'remote_bad_payload' }); }
    const st = (body && body.state && typeof body.state === 'object') ? body.state : {};

    res.json({
      ok: true,
      source: { url: target.origin, remoteTenantId: link.remoteTenantId, linkId: link.id || null },
      fetchedAt: new Date().toISOString(),
      remoteUpdatedAt: body.updatedAt || null,
      inspections: Array.isArray(st.inspections) ? st.inspections : [],
      actions: Array.isArray(st.actions) ? st.actions : [],
      inspectionTypes: (st.inspectionTypes && typeof st.inspectionTypes === 'object') ? st.inspectionTypes : null,
    });
  } catch(err){
    console.error('GET /api/linked/inspections error:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// GET /api/linked/casaudit?tenantId=xxx[&linkId=yyy]
// The evidence-day list from the CAS Auditor app - same server-to-server
// pull as inspections: the remote serves /api/link/state per client id,
// guarded by the shared LINK_SERVICE_TOKEN and the host allow-list.
router.get('/casaudit', requireAuth, async (req, res) => {
  const token = process.env.LINK_SERVICE_TOKEN || '';
  if(token.length < 32){
    return res.status(503).json({ ok: false, error: 'link_not_configured' });
  }

  const tenantId = req.user.role !== 'consultant'
    ? (req.user.tenantId || '')
    : String(req.query?.tenantId || '').trim();
  if(!tenantId) return res.status(400).json({ ok: false, error: 'tenant_required' });

  try {
    const r = await pool.query(`SELECT state FROM app_state WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    if(!r.rows.length) return res.status(404).json({ ok: false, error: 'tenant_not_found' });
    const links = (r.rows[0].state && Array.isArray(r.rows[0].state.linkedApps))
      ? r.rows[0].state.linkedApps : [];
    const linkId = String(req.query?.linkId || '').trim();
    const link = linkId
      ? links.find(l => l && l.id === linkId)
      : links.find(l => l && l.kind === 'casaudit');
    if(!link || !link.baseUrl || !link.remoteTenantId){
      return res.status(400).json({ ok: false, error: 'no_link_configured' });
    }

    let target;
    try { target = new URL(link.baseUrl); }
    catch(e){ return res.status(400).json({ ok: false, error: 'bad_link_url' }); }
    const isLocal = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
    if(target.protocol !== 'https:' && !isLocal){
      return res.status(400).json({ ok: false, error: 'https_required' });
    }
    if(!allowedHosts().includes(target.hostname.toLowerCase())){
      return res.status(400).json({ ok: false, error: 'host_not_allowed' });
    }

    const url = target.origin + '/api/link/state?tenantId=' + encodeURIComponent(link.remoteTenantId);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    let remote;
    try {
      remote = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: ctrl.signal });
    } catch(e){
      clearTimeout(timer);
      return res.status(502).json({ ok: false, error: 'remote_unreachable' });
    }
    clearTimeout(timer);

    if(remote.status === 401) return res.status(502).json({ ok: false, error: 'remote_auth_failed' });
    if(remote.status === 404) return res.status(404).json({ ok: false, error: 'remote_tenant_not_found' });
    if(remote.status === 503) return res.status(502).json({ ok: false, error: 'remote_link_not_configured' });
    if(!remote.ok) return res.status(502).json({ ok: false, error: 'remote_error', status: remote.status });

    let body;
    try { body = await remote.json(); }
    catch(e){ return res.status(502).json({ ok: false, error: 'remote_bad_payload' }); }
    const st = (body && body.state && typeof body.state === 'object') ? body.state : {};

    res.json({
      ok: true,
      source: { url: target.origin, remoteTenantId: link.remoteTenantId, linkId: link.id || null },
      fetchedAt: new Date().toISOString(),
      remoteUpdatedAt: body.updatedAt || null,
      client: {
        id: st.id || link.remoteTenantId,
        name: st.name || '',
        chas: st.chas || '',
        clg: st.clg || '',
        deadline: st.deadline || '',
        lines: Array.isArray(st.lines) ? st.lines.map(l => ({
          name: String(l && l.name || ''),
          hint: String(l && l.hint || ''),
          status: String(l && l.status || ''),
          note: String(l && l.note || ''),
          path: String(l && l.path || ''),
          last: String(l && l.last || ''),
          custom: !!(l && l.custom),
        })) : [],
      },
    });
  } catch(err){
    console.error('GET /api/linked/casaudit error:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;
