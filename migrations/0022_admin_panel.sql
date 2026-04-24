-- Admin panel support migrations.
-- 1. is_active flag on attribute_definitions — lets admins disable questions without deleting them.
-- 2. pipeline_runs table — audit log for enrichment pipeline steps (AD.5).

ALTER TABLE attribute_definitions ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- Pipeline runs audit log
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_batch    TEXT    NOT NULL,             -- UUID grouping runs triggered in one batch
  character_id TEXT    NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  step         TEXT    NOT NULL CHECK (step IN ('fetch','dedup','enrich','image','upload')),
  status       TEXT    NOT NULL CHECK (status IN ('pending','running','success','error')),
  error        TEXT,                         -- error message if status = 'error'
  duration_ms  INTEGER,                      -- wall-clock duration of the step
  created_at   INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_pipeline_runs_batch     ON pipeline_runs(run_batch);
CREATE INDEX idx_pipeline_runs_character ON pipeline_runs(character_id);
CREATE INDEX idx_pipeline_runs_status    ON pipeline_runs(status, created_at DESC);
CREATE INDEX idx_pipeline_runs_created   ON pipeline_runs(created_at DESC);
