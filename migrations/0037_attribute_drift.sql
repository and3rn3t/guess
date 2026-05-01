-- Migration 0037: attribute_drift (DQ.6 / AN.26)
--
-- Append-only audit log of attribute value flips detected during reconciliation
-- runs (scripts/reconcile-attributes.ts) and any future enrichment ingestion that
-- changes a stored value (EN.28 provenance-aware rollback also reads this).
--
-- Each row = one (character, attribute) pair where a re-evaluation against the
-- same source returned a different value than what's currently stored. The
-- `source` column distinguishes signals: 'reconcile-llm' (DQ.6 nightly), future
-- 'reconcile-wikidata' / 'reconcile-tmdb' / etc., and 'enrich-flip' for
-- ingestion regressions.
--
-- Designed for write-heavy, read-rare access: a daily cron emits N rows, the
-- admin "today's drift" widget reads `WHERE detected_at > now-24h ORDER BY ...`,
-- EN.28 rollback reads `WHERE batch_id = ?`.

CREATE TABLE IF NOT EXISTS attribute_drift (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id    TEXT    NOT NULL,
  attribute_key   TEXT    NOT NULL,
  old_value       INTEGER,                              -- 1 / 0 / NULL (unknown)
  new_value       INTEGER,                              -- 1 / 0 / NULL (unknown)
  source          TEXT    NOT NULL,                     -- 'reconcile-llm' | 'enrich-flip' | future source-specific
  batch_id        TEXT,                                 -- groups events from one reconciliation run; UUID
  detected_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  contradicts_lock INTEGER NOT NULL DEFAULT 0,          -- 1 if old_value was admin-locked (AN.26 callout)
  evidence        TEXT                                  -- optional provenance string from the reconciliation source
);

CREATE INDEX IF NOT EXISTS idx_attribute_drift_detected
  ON attribute_drift(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribute_drift_character
  ON attribute_drift(character_id, attribute_key);
CREATE INDEX IF NOT EXISTS idx_attribute_drift_batch
  ON attribute_drift(batch_id);
CREATE INDEX IF NOT EXISTS idx_attribute_drift_source
  ON attribute_drift(source, detected_at DESC);
