-- Migration 0047: KV → D1 migration
--
-- Replaces all Cloudflare KV usage with D1 tables:
--   kv_cache        — generic TTL-aware cache (replaces GUESS_KV / GUESS_ASSETS caching)
--   enrich_job      — enrichment job coordination (replaces admin:enrich-start KV key)
--   session_state   — game session storage (replaces game:{id} / pool:{id} KV keys)
--   engine_config   — engine flags + A/B experiment config (replaces kv: prefixed KV keys)

-- ── Generic TTL cache ────────────────────────────────────────────────────────
-- Replaces all (env.GUESS_ASSETS ?? env.GUESS_KV).put(key, value, { expirationTtl }) patterns.
-- expires_at is unix seconds; NULL means no expiry.
CREATE TABLE IF NOT EXISTS kv_cache (
  key        TEXT    NOT NULL PRIMARY KEY,
  value      TEXT    NOT NULL,
  cached_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_kv_cache_expires ON kv_cache(expires_at)
  WHERE expires_at IS NOT NULL;

-- ── Enrichment job coordination ──────────────────────────────────────────────
-- Replaces the admin:enrich-start KV key used to coordinate distributed
-- enrichment chain runs and the chain-token auth bypass in _middleware.ts.
CREATE TABLE IF NOT EXISTS enrich_job (
  id                   INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  batch_id             TEXT    NOT NULL,
  queued_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  remaining            INTEGER NOT NULL DEFAULT 0,
  chain_token          TEXT,
  chain_token_consumed INTEGER NOT NULL DEFAULT 0,
  expires_at           INTEGER NOT NULL  -- unix seconds; job is stale after this
);

CREATE INDEX IF NOT EXISTS idx_enrich_job_batch ON enrich_job(batch_id);

-- ── Game session storage ─────────────────────────────────────────────────────
-- Replaces game:{id} (lean session) and pool:{id} (character pool) KV keys.
-- Both blobs are stored in a single row to avoid two round-trips on load.
CREATE TABLE IF NOT EXISTS session_state (
  id         TEXT    NOT NULL PRIMARY KEY,
  lean_json  TEXT    NOT NULL,
  pool_json  TEXT    NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_session_state_expires ON session_state(expires_at);

-- ── Engine flags + A/B experiment config ────────────────────────────────────
-- Replaces KV keys written by admin panel and CI workflows:
--   engine:weights-active, engine:auto-tune-enabled,
--   ab:experiment-pct, ab:experiment-selector,
--   ff:question_expansion_v1_pct, ff:question_expansion_v1_selector
-- Also used for adaptive signals previously in kv_cache with kv: prefix.
CREATE TABLE IF NOT EXISTS engine_config (
  key        TEXT    NOT NULL PRIMARY KEY,
  value      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Seed default values (engine off, no experiment traffic)
INSERT OR IGNORE INTO engine_config (key, value) VALUES
  ('engine:auto-tune-enabled',        'false'),
  ('engine:weights-active',           'null'),
  ('ab:experiment-pct',               '0'),
  ('ab:experiment-selector',          'mcts'),
  ('ff:question_expansion_v1_pct',    '0'),
  ('ff:question_expansion_v1_selector','mcts');
