-- 0002_auth.sql — user accounts + auth sessions (Epic 2).

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,      -- usr_…
  email         TEXT NOT NULL UNIQUE,  -- stored lowercased
  password_hash TEXT NOT NULL,         -- pbkdf2$iters$salt$hash
  display_name  TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id                 TEXT PRIMARY KEY,  -- ses_…
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,     -- SHA-256 of the rotating refresh token
  user_agent         TEXT,
  ip                 TEXT,
  expires_at         INTEGER NOT NULL,
  created_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions (expires_at);
