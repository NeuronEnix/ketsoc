-- 0003_tenancy.sql — orgs, memberships, invites (Epic 3).

CREATE TABLE IF NOT EXISTS orgs (
  id            TEXT PRIMARY KEY,      -- org_…
  display_name  TEXT NOT NULL,
  handle        TEXT UNIQUE,           -- reserved for subdomains; nullable/unused in P1
  owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orgs_owner ON orgs (owner_user_id);

CREATE TABLE IF NOT EXISTS memberships (
  id         TEXT PRIMARY KEY,         -- mbr_…
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  org_id     TEXT NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  role       TEXT NOT NULL,            -- owner | member
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships (org_id);

CREATE TABLE IF NOT EXISTS invites (
  id         TEXT PRIMARY KEY,         -- inv_…
  org_id     TEXT NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  email      TEXT,
  role       TEXT NOT NULL,
  status     TEXT NOT NULL,            -- pending | accepted | revoked
  invited_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invites_org ON invites (org_id);
