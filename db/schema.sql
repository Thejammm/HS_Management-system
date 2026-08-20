-- ══════════════════════════════════════════════════════════════
--  H&S Management System — Database Schema
--  Run automatically on server startup. Idempotent.
-- ══════════════════════════════════════════════════════════════

-- Tenants: each client business is one tenant.
-- A consultant user has tenant_id NULL (sees all tenants).
CREATE TABLE IF NOT EXISTS tenants (
  id           TEXT PRIMARY KEY,           -- e.g. 'easy-travel'
  name         TEXT NOT NULL,              -- display name e.g. 'Easy Travel Leeds'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-tenant client configuration: icon, location, default inspection type,
-- pack selection and branding. Replaces the hardcoded CLIENTS constant that used
-- to live in the front-end (house rule: no customer data in source). Additive so
-- existing tenants keep working; DEFAULT '{}' backfills every existing row with an
-- empty config the front-end reads as neutral defaults.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Users: anyone who can log in.
-- role = 'consultant' → can see/manage all tenants (Archer staff)
-- role = 'client_user' → scoped to one tenant
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  tenant_id     TEXT REFERENCES tenants(id) ON DELETE SET NULL,
  role          TEXT NOT NULL CHECK (role IN ('consultant', 'client_user')),
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users (tenant_id);

-- Soft-deactivation flag. An inactive user cannot log in, but their record
-- (and any inspection history under their tenant) is preserved — we deactivate
-- rather than hard-delete. Added via ALTER so it also applies to existing
-- databases on deploy; DEFAULT TRUE backfills every existing user as active.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Plain-text copy of the password, kept so the consultant can read back the
-- logins they hand to clients. Written whenever a password is set/reset; login
-- still verifies against password_hash. NULL for users whose password predates
-- this column (their original password was never stored in readable form).
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT;

-- App state: one row per tenant holding the entire S blob from the frontend.
-- Stored as JSONB so we can query inside it later if needed.
CREATE TABLE IF NOT EXISTS app_state (
  tenant_id   TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  state       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- State history: the PREVIOUS contents of app_state, kept before each
-- overwrite, so no single save - a mis-click, a bad import, a reset, a bug -
-- can destroy a client's record beyond recovery. app_state itself is one row
-- per tenant and is overwritten in place, so without this there is nothing to
-- go back to. Bounded per tenant; see routes/state.js for the policy.
CREATE TABLE IF NOT EXISTS state_history (
  id         BIGSERIAL PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  state      JSONB NOT NULL,
  taken_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  taken_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason     TEXT,
  bytes      BIGINT
);
CREATE INDEX IF NOT EXISTS state_history_tenant_idx ON state_history (tenant_id, taken_at DESC);

-- Final resting place for a deleted client. state_history hangs off tenants
-- with ON DELETE CASCADE, so deleting a tenant destroys the very safety net
-- that exists to make loss recoverable. This table deliberately does NOT
-- reference tenants: it keeps the client's last state, and their name, after
-- the tenant row is gone, so a deletion made in error is still answerable.
CREATE TABLE IF NOT EXISTS deleted_tenant_archive (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  tenant_name TEXT,
  state       JSONB,
  users_removed INTEGER,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by  TEXT
);
CREATE INDEX IF NOT EXISTS deleted_tenant_archive_idx ON deleted_tenant_archive (deleted_at DESC);

-- Training-matrix template workbook: the client's uploaded .xlsx kept verbatim
-- so export can write the current values back into a byte-faithful copy of
-- their own file (their exact tabs, formatting and formulas). One per tenant.
CREATE TABLE IF NOT EXISTS training_workbook (
  tenant_id  TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  filename   TEXT,
  data       TEXT NOT NULL,               -- the .xlsx, base64-encoded
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Statutory register template workbook — same round-trip pattern as training:
-- the client's own .xlsx kept verbatim so export reproduces their exact file.
CREATE TABLE IF NOT EXISTS statutory_workbook (
  tenant_id  TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  filename   TEXT,
  data       TEXT NOT NULL,               -- the .xlsx, base64-encoded
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Offline-copy pairing: a per-consultant bearer token (stored hashed) that
-- lets the PC-held file:// copy pull and push tenant state without cookies.
-- Added via ALTER so existing databases pick it up on deploy.
ALTER TABLE users ADD COLUMN IF NOT EXISTS offline_token_hash TEXT;
