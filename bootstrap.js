// ══════════════════════════════════════════════════════════════
//  Bootstrap — one-time setup tasks run on server startup.
//
//  Creates the first consultant user from ADMIN_EMAIL and
//  ADMIN_PASSWORD env vars if no consultants exist yet.
//  After first run, you can (and should) change the password
//  via the app and remove ADMIN_PASSWORD from Render env vars.
// ══════════════════════════════════════════════════════════════
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const { pool, DEMO } = require('./db');

async function bootstrap(){
  const adminEmail    = (process.env.ADMIN_EMAIL    || '').trim().toLowerCase();
  const adminPassword =  process.env.ADMIN_PASSWORD || '';
  const adminName     = (process.env.ADMIN_NAME     || '').trim();

  if(!adminEmail || !adminPassword){
    console.log('• Bootstrap skipped: ADMIN_EMAIL / ADMIN_PASSWORD not set');
    return;
  }

  // Has any consultant already been created?
  const existing = await pool.query(
    `SELECT id FROM users WHERE role = 'consultant' LIMIT 1`
  );
  if(existing.rows.length){
    console.log('• Bootstrap skipped: a consultant already exists');
    return;
  }

  // Validate inputs
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)){
    console.warn('• Bootstrap skipped: ADMIN_EMAIL is not a valid email');
    return;
  }
  if(adminPassword.length < 8){
    console.warn('• Bootstrap skipped: ADMIN_PASSWORD must be at least 8 characters');
    return;
  }

  const id   = crypto.randomUUID();
  const hash = await bcrypt.hash(adminPassword, 10);
  await pool.query(
    `INSERT INTO users (id, email, password_hash, tenant_id, role, display_name)
     VALUES ($1, $2, $3, NULL, 'consultant', $4)`,
    [id, adminEmail, hash, adminName || null]
  );
  console.log(`✓ Bootstrap created consultant user: ${adminEmail}`);
  console.log('  → After first login, remove ADMIN_PASSWORD from Render env vars');
}

// LOCAL DEV ONLY: seed a tenant + consultant + client login so the app can be
// exercised end-to-end without a database. Inert in production (DEMO is false).
async function seedLocal(){
  if(!DEMO) return;
  const has = await pool.query(`SELECT id FROM tenants LIMIT 1`);
  if(has.rows.length) return;
  await pool.query(`INSERT INTO tenants (id, name) VALUES ('easy-travel','Easy Travel (Leeds) Ltd')`);
  const mk = async (email, role, tenant, name) => {
    const hash = await bcrypt.hash('local1234', 10);
    await pool.query(`INSERT INTO users (id, email, password_hash, tenant_id, role, display_name) VALUES ($1,$2,$3,$4,$5,$6)`,
      [crypto.randomUUID(), email, hash, tenant, role, name]);
  };
  await mk('consultant@local.test', 'consultant', null, 'Local Consultant');
  await mk('client@local.test', 'client_user', 'easy-travel', 'Easy Travel');
  await pool.query(`INSERT INTO app_state (tenant_id, state) VALUES ('easy-travel','{}'::jsonb) ON CONFLICT DO NOTHING`);
  console.log('✓ LOCAL seed: tenant easy-travel + consultant@local.test / client@local.test (pw local1234)');
}

module.exports = { bootstrap, seedLocal };
