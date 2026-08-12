// ══════════════════════════════════════════════════════════════
//  Database connection + schema migration runner
//
//  Production: real Postgres via DATABASE_URL (set by Coolify).
//  Local/dev:  if DATABASE_URL is unset, fall back to an in-memory
//  Postgres (pg-mem) so the app can be run and tested without a
//  database. This branch is INERT in production (DATABASE_URL is
//  always set there). Demo data is not persisted between restarts.
// ══════════════════════════════════════════════════════════════
const fs   = require('fs');
const path = require('path');

let pool;
const DEMO = !process.env.DATABASE_URL;

if(DEMO){
  console.log('• No DATABASE_URL — LOCAL DEV mode (in-memory pg-mem). Not for production.');
  let newDb;
  try { ({ newDb } = require('pg-mem')); }
  catch(e){ console.error('FATAL: local dev needs pg-mem (npm install), or set DATABASE_URL.'); process.exit(1); }
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.registerFunction({ name: 'now', returns: 'timestamptz', implementation: () => new Date() });
  const pg = mem.adapters.createPg();
  pool = new pg.Pool();
} else {
  const { Pool } = require('pg');
  // Render's internal Postgres URL doesn't require SSL.
  // External URLs (e.g. from a laptop) do — auto-detect by hostname.
  const needsSsl = /\.render\.com|\.render-postgres\.com/i.test(process.env.DATABASE_URL);
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
  pool.on('error', (err) => { console.error('Unexpected pg pool error:', err); });
}

// Run schema.sql on startup. Idempotent (CREATE TABLE IF NOT EXISTS).
async function migrate(){
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  if(DEMO){ await pool.query(sql); console.log('✓ Schema migration applied (local)'); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✓ Schema migration applied');
  } catch(err){
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Quick health check used by /healthz
async function isHealthy(){
  try {
    const r = await pool.query('SELECT 1 AS ok');
    return r.rows[0].ok === 1;
  } catch(e){
    return false;
  }
}

module.exports = { pool, migrate, isHealthy, DEMO };
