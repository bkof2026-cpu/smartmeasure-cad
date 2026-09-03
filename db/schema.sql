-- ─────────────────────────────────────────────────────────────────────────────
-- SmartMeasure CAD — Auth, Roles & KPI Dashboard schema (Neon Postgres).
-- Run this ONCE against a fresh Neon database (Neon SQL editor, or
-- `npm run migrate`, see scripts/migrate.ts). Safe to re-run — every
-- statement is guarded so a second run is a no-op instead of an error.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('employee', 'manager', 'ceo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,           -- employee ID, e.g. "E101" (manually assigned)
  name          TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'employee',
  email         TEXT UNIQUE,                -- required for manager/ceo, optional for employee
  pin_hash      TEXT,                       -- required for manager/ceo only (bcrypt hash)
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drawings (
  id                SERIAL PRIMARY KEY,
  employee_id       TEXT NOT NULL REFERENCES users(id),
  product_category  TEXT NOT NULL,   -- e.g. "Master Bedroom"
  product_name      TEXT NOT NULL,   -- e.g. "Bed", "TV Unit"
  project_id        TEXT,
  client_name       TEXT,
  pdf_generated     BOOLEAN NOT NULL DEFAULT false,
  measurements_json JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,          -- random 32+ byte token
  user_id       TEXT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL       -- e.g. now() + interval '90 days'
);

-- Simple DB-backed login-attempt counter for rate limiting (section 3e) —
-- one row per (identifier, ip) pair, reset by simply expiring old rows.
CREATE TABLE IF NOT EXISTS login_attempts (
  id            SERIAL PRIMARY KEY,
  identifier    TEXT NOT NULL,   -- employee id, or admin email
  ip            TEXT NOT NULL,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawings_employee_id ON drawings(employee_id);
CREATE INDEX IF NOT EXISTS idx_drawings_created_at ON drawings(created_at);
CREATE INDEX IF NOT EXISTS idx_drawings_product_name ON drawings(product_name);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(identifier, ip, attempted_at);
