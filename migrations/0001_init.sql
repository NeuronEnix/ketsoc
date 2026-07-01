-- 0001_init.sql — baseline schema for ketsoc D1.
-- Per-feature tables (users, orgs, environments, api_keys, telemetry, …) are
-- added by their own epics. This baseline just proves the migration pipeline
-- and gives us a place to record schema-level metadata.

CREATE TABLE IF NOT EXISTS app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO app_meta (key, value, updated_at)
VALUES ('schema_version', '1', 0);
