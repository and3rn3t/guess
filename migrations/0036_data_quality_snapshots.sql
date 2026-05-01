-- Migration 0036: data-quality snapshots (DQ.7)
--
-- Stores one row per daily snapshot so /admin/data-quality can render trend
-- charts without re-aggregating expensive queries on every page load.
--
-- Columns:
--   captured_at         INTEGER (unix seconds) — when the snapshot was taken
--   data_health_score   REAL [0, 100] — single rolled-up KPI, weighted average
--   coverage_pct        REAL [0, 1]   — filled (character × active attr) cells
--   evidence_pct        REAL [0, 1]   — % of character_attributes with evidence
--   agreement_avg       REAL [0, 1]   — AVG(agreement_score) where not NULL
--   open_disputes       INTEGER       — COUNT(*) WHERE status = 'open'
--   golden_pass_rate    REAL [0, 1] NULL — last CI run, when reported (DQ.1)
--   vision_pass_rate    REAL [0, 1] NULL — last enrichment batch (DQ.2)
--
-- Snapshots are written nightly by `scripts/snapshot-data-quality.ts`; the
-- admin API also computes a "live" snapshot on every page load so the
-- dashboard never shows stale-by-default numbers.

CREATE TABLE IF NOT EXISTS data_quality_snapshots (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at        INTEGER NOT NULL,
  data_health_score  REAL    NOT NULL,
  coverage_pct       REAL    NOT NULL,
  evidence_pct       REAL    NOT NULL,
  agreement_avg      REAL    NOT NULL,
  open_disputes      INTEGER NOT NULL,
  golden_pass_rate   REAL,
  vision_pass_rate   REAL
);

CREATE INDEX IF NOT EXISTS idx_dq_snapshots_captured
  ON data_quality_snapshots(captured_at DESC);
