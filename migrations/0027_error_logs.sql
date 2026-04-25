-- Error logs table for admin observability.
-- Worker console.error / console.warn calls write here so errors are
-- visible in the Admin → Error Logs panel without needing Cloudflare's
-- paid Logpush product.
-- Capped at 1000 rows (oldest evicted on each insert via logError helper).

CREATE TABLE IF NOT EXISTS error_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT    NOT NULL,   -- 'error' | 'warn'
  source     TEXT    NOT NULL,   -- endpoint / module name  (e.g. 'answer', 'llm')
  message    TEXT    NOT NULL,   -- short description (≤ 500 chars)
  detail     TEXT,               -- JSON-stringified stack / context (≤ 2 KB)
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_level   ON error_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_source  ON error_logs(source, created_at DESC);
