-- Migration 0038: anomaly alerts (AN.33)
--
-- Stores one row per detected metric anomaly. The nightly anomaly checker
-- (functions/cron/_anomaly_check.ts) computes a 14-day rolling baseline
-- (mean ± 2σ) per metric over data_quality_snapshots and writes a row here
-- whenever today's value crosses the threshold band. A webhook post to
-- ALERTS_WEBHOOK_URL is best-effort; success/failure is recorded inline.
--
-- Columns:
--   metric          TEXT — e.g. 'data_health_score', 'coverage_pct'
--   value           REAL — today's observed value
--   baseline_mean   REAL — mean of the prior N samples
--   baseline_std    REAL — sample standard deviation of the prior N samples
--   delta           REAL — value - baseline_mean (signed)
--   z_score         REAL — (value - mean) / std (signed); 0 when std == 0
--   direction       TEXT — 'above' | 'below' (sign of delta)
--   sample_size     INTEGER — N used for the baseline
--   webhook_status  TEXT NULL — 'sent' | 'skipped' | 'failed'
--   webhook_error   TEXT NULL — non-null on failures
--   created_at      INTEGER NOT NULL DEFAULT (unixepoch())

CREATE TABLE IF NOT EXISTS alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  metric          TEXT    NOT NULL,
  value           REAL    NOT NULL,
  baseline_mean   REAL    NOT NULL,
  baseline_std    REAL    NOT NULL,
  delta           REAL    NOT NULL,
  z_score         REAL    NOT NULL,
  direction       TEXT    NOT NULL CHECK (direction IN ('above', 'below')),
  sample_size     INTEGER NOT NULL,
  webhook_status  TEXT,
  webhook_error   TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_alerts_metric_created
  ON alerts(metric, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_created
  ON alerts(created_at DESC);
