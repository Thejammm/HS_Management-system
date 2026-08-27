// ══════════════════════════════════════════════════════════════
//  H&S Management System — server
//
//  - Serves the front-end from public/
//  - Postgres-backed per-tenant state
//  - Email/password auth with JWT in httpOnly cookie
//  - Bootstrap creates a consultant user on first run
// ══════════════════════════════════════════════════════════════
const express      = require('express');
const cookieParser = require('cookie-parser');
const path         = require('path');

const { migrate, isHealthy } = require('./db');
const { bootstrap, seedLocal } = require('./bootstrap');
const authRoutes             = require('./routes/auth');
const stateRoutes            = require('./routes/state');
const adminRoutes            = require('./routes/admin');

const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';

// Trust Render's proxy so req.protocol / req.ip work correctly
app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────
app.use(cookieParser());

// JSON body parsing. A route CANNOT override this by mounting its own parser:
// express.json marks req._body on the first successful parse and every later
// parser short-circuits on it, so a global parser silently caps the routes that
// think they raised the limit. The two routes that carry a whole client record
// are therefore skipped here and parse themselves (50mb and 25mb respectively).
// Without this, any client record over 1mb failed to save with an HTML 413 that
// the app could not even read as JSON.
const _ownsItsBody = (p) => p === '/api/state' || p === '/api/offline/state';
app.use((req, res, next) => _ownsItsBody(req.path) ? next() : express.json({ limit: '1mb' })(req, res, next));

// ── Health check ──────────────────────────────────────────────
//   /healthz returns 200 if both the process AND the DB are reachable.
app.get('/healthz', async (_req, res) => {
  const dbOk = await isHealthy();
  if(!dbOk) return res.status(503).json({ ok: false, db: false });
  res.json({ ok: true, db: true, ts: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/training', require('./routes/training'));
app.use('/api/statutory', require('./routes/statutory'));
app.use('/api/linked', require('./routes/linked'));   // server-to-server pull from linked apps
app.use('/api/reports', require('./routes/reports'));  // server-side PDF for the shared report layer
app.use('/api/cas', require('./routes/cas'));          // CAS question-set Excel export
app.use('/api/offline', require('./routes/offline'));  // pairing + pull/push for the PC-held offline copy

// 404 for any unknown /api/* path (don't fall through to the SPA)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// ── Static front-end ──────────────────────────────────────────
// HTML is always revalidated so deploys are picked up immediately by the
// browser. Static assets (none yet, but future JS/CSS/images) still get
// short-cached so the page is fast.
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if(/\.html$/i.test(filePath)){
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
    // Fonts are fetched in CORS mode by spec; the server-side PDF renderer
    // loads the page from an opaque origin, so without this the report PDFs
    // silently fall back to Arial. Fonts are public assets — * is safe.
    if(/\.woff2?$/i.test(filePath)){
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));

// SPA fallback — any other route serves index.html (also no-cache)
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Startup sequence ──────────────────────────────────────────
(async () => {
  try {
    await migrate();
    await bootstrap();
    if(typeof seedLocal === 'function') await seedLocal();
    app.listen(PORT, HOST, () => {
      console.log(`✓ H&S Management System listening on http://${HOST}:${PORT}`);
    });
  } catch(err){
    console.error('FATAL: startup failed:', err);
    process.exit(1);
  }
})();
