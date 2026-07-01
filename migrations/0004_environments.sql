-- 0004_environments.sql — environments (Epic 4).

CREATE TABLE IF NOT EXISTS environments (
  id           TEXT PRIMARY KEY,   -- env_…
  org_id       TEXT NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,      -- ^[a-z]{4}$ (or seeded prod/test); immutable
  mode         TEXT NOT NULL,      -- live (prod only) | test
  is_permanent INTEGER NOT NULL,   -- 1 for prod
  created_at   INTEGER NOT NULL,
  UNIQUE (org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_environments_org ON environments (org_id);
