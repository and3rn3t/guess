-- SE.1 — CSP violation reports persisted to D1 with dedup.
-- The /api/csp-report endpoint upserts on (directive, blocked_uri) so a
-- spammy violation increments `count` instead of flooding error_logs.
-- The admin /admin/security route reads the top-N by count for triage,
-- and a weekly cron digest (functions/cron/_csp_digest.ts) summarises the
-- 7-day top-10 into automation_runs for operator handoff.

CREATE TABLE IF NOT EXISTS csp_violations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  directive     TEXT    NOT NULL,                                  -- e.g. 'script-src-elem', 'img-src'
  blocked_uri   TEXT    NOT NULL,                                  -- ≤ 200 chars (endpoint truncates)
  document_uri  TEXT,                                              -- page that hit the violation (≤ 500 chars)
  user_agent    TEXT,                                              -- UA snapshot from last sighting (≤ 200 chars)
  count         INTEGER NOT NULL DEFAULT 1,                        -- dedup counter
  first_seen    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_seen     INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Dedup key — endpoint upserts via ON CONFLICT(directive, blocked_uri).
CREATE UNIQUE INDEX IF NOT EXISTS idx_csp_violations_dedup
  ON csp_violations(directive, blocked_uri);

-- Admin list view sorts by count DESC and filters by last_seen window.
CREATE INDEX IF NOT EXISTS idx_csp_violations_count
  ON csp_violations(count DESC);
CREATE INDEX IF NOT EXISTS idx_csp_violations_last_seen
  ON csp_violations(last_seen DESC);
