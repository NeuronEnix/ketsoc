-- 0005_api_keys.sql — public/secret API keys per environment (Epic 5).

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,   -- kid (short base62, embedded in the key)
  env_id       TEXT NOT NULL REFERENCES environments (id) ON DELETE CASCADE,
  type         TEXT NOT NULL,      -- public | secret
  label        TEXT,
  key_hash     TEXT NOT NULL,      -- SHA-256 hex of the full key (never store the key)
  key_prefix   TEXT NOT NULL,      -- display hint (kpk.<env>.<kid>.)
  last_used_at INTEGER,
  revoked_at   INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_keys_env ON api_keys (env_id);
