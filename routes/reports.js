// ══════════════════════════════════════════════════════════════
//  /api/reports — server-side PDF for the shared report layer
//
//  Renders the SAME templates + CSS the browser preview uses (the pure
//  ESM modules under public/reports/) through headless Chromium, so the
//  downloaded PDF is pixel-identical to the print output but arrives as
//  a real file with selectable text — matching how every other report
//  in the app is delivered.
//
//  Chromium comes from the system (NIXPACKS_PKGS=chromium in Coolify,
//  or local Chrome in dev) via puppeteer-core; nothing is bundled.
//  If no browser is available the route answers 501 and the front end
//  falls back to the print dialog — no regression, ever.
// ══════════════════════════════════════════════════════════════
const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// A candidate is only usable if it's a real browser binary. Ubuntu images
// carry /usr/bin/chromium-browser as a tiny snap STUB that fails with
// "requires the chromium snap" — a real Chromium is tens of MB; the stub is
// a shell script. Filter those out, and prefer the nix-provided binary.
function isRealBrowser(p){
  try {
    const st = fs.statSync(p);
    if(!st.isFile() && !st.isSymbolicLink()) return false;
    if(st.size < 1024 * 1024){                       // stubs are a few KB
      const head = fs.readFileSync(p, { encoding: 'utf8', flag: 'r' }).slice(0, 400);
      if(/snap|exec /i.test(head) && head.startsWith('#!')) return false;
      return false;                                  // <1MB is never a browser
    }
    return true;
  } catch(e){ return false; }
}
function chromiumCandidates(){
  const cands = [];
  const push = c => { if(c && !cands.includes(c)) cands.push(c); };
  push(process.env.PUPPETEER_EXECUTABLE_PATH);
  push(process.env.CHROMIUM_PATH);
  // PATH lookup first — nix (nixpacks.toml) puts its chromium on PATH.
  try {
    const { execSync } = require('child_process');
    const cmd = process.platform === 'win32' ? 'where chromium' : 'which -a chromium chromium-browser google-chrome 2>/dev/null || true';
    execSync(cmd, { encoding: 'utf8' }).split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(push);
  } catch(e){}
  ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
   'C:/Program Files/Google/Chrome/Application/chrome.exe',
   'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].forEach(push);
  return cands.filter(c => { try { return fs.existsSync(c) && isRealBrowser(c); } catch(e){ return false; } });
}

// One warm browser, one render at a time — report generation is a rare,
// consultant-driven event; a queue beats a memory spike.
let _browser = null;
let _chain = Promise.resolve();
async function withPage(fn){
  const run = async () => {
    let puppeteer;
    try { puppeteer = require('puppeteer-core'); }
    catch(e){ const err = new Error('renderer_unavailable'); err.code = 501; throw err; }
    if(!_browser || !_browser.connected){
      const cands = chromiumCandidates();
      if(!cands.length){ const err = new Error('chromium_not_found'); err.code = 501; throw err; }
      let lastErr = null;
      for(const exe of cands){
        try {
          _browser = await puppeteer.launch({
            executablePath: exe,
            args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
          });
          lastErr = null;
          break;
        } catch(e){ lastErr = e; _browser = null; console.error('Chromium candidate failed:', exe, '-', e.message.split('\n')[0]); }
      }
      if(!_browser){ const err = new Error('chromium_launch_failed: ' + (lastErr ? lastErr.message.split('\n')[0] : '')); err.code = 501; throw err; }
    }
    const page = await _browser.newPage();
    try { return await fn(page); }
    finally { try { await page.close(); } catch(e){} }
  };
  const p = _chain.then(run, run);
  _chain = p.catch(() => {});
  return p;
}

// GET /api/reports/pdf?tenantId=x&report=board-report[&format=signal]
router.get('/pdf', requireAuth, async (req, res) => {
  const tenantId = req.user.role === 'client_user'
    ? (req.user.tenantId || '')
    : String(req.query?.tenantId || '').trim();
  if(!tenantId) return res.status(400).json({ error: 'tenant_required' });
  const reportId = String(req.query?.report || 'board-report').trim();
  if(!/^[a-z0-9-]+$/.test(reportId)) return res.status(400).json({ error: 'bad_report_id' });

  try {
    const t = await pool.query(`SELECT name FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    if(!t.rows.length) return res.status(404).json({ error: 'tenant_not_found' });
    const s = await pool.query(`SELECT state FROM app_state WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    const state = (s.rows[0] && s.rows[0].state) || {};

    // Same pure modules the browser uses — imported into Node.
    const tplUrl = 'file://' + path.join(__dirname, '..', 'public', 'reports', 'templates', 'index.js').replace(/\\/g, '/');
    const engUrl = 'file://' + path.join(__dirname, '..', 'public', 'reports', 'engine.js').replace(/\\/g, '/');
    const [tpl, eng] = await Promise.all([import(tplUrl), import(engUrl)]);
    const format = req.query?.format ? String(req.query.format) : undefined;
    const report = tpl.buildReport(state, reportId, { format, tenant: { name: t.rows[0].name || '' } });
    const bodyHtml = eng.reportHTML(report);

    // Resolve /reports/report.css and /fonts/* against our own static server.
    const base = 'http://127.0.0.1:' + (parseInt(process.env.PORT, 10) || 3000) + '/';
    const html = '<!doctype html><html><head><meta charset="utf-8">'
      + '<base href="' + base + '">'
      + '<link rel="stylesheet" href="/reports/report.css">'
      + '<style>body{margin:0;background:#fff}</style></head><body>'
      + bodyHtml + '</body></html>';

    const pdf = await withPage(async (page) => {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      try { await page.evaluateHandle('document.fonts.ready'); } catch(e){}
      return page.pdf({
        format: 'A4', printBackground: true, preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    });

    const client = (t.rows[0].name || tenantId).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + reportId + '-' + client + '.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    res.end(Buffer.from(pdf));
  } catch(err){
    if(err && err.code === 501){
      return res.status(501).json({ error: 'renderer_unavailable' });
    }
    console.error('GET /api/reports/pdf error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
