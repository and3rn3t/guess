-- AN.21: Catastrophic-failure replay queue
-- Auto-snapshots every game where the player's actual target was never in the
-- engine's top-10 candidate list at any question step.
CREATE TABLE IF NOT EXISTS triage_queue (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  actual_character_id   TEXT    NOT NULL,
  actual_character_name TEXT,
  -- Lowest rank the actual character achieved across all steps (1-based).
  -- NULL means the character never appeared in any step's top-10.
  min_rank         INTEGER,
  -- JSON blob: [{attr, answer, questionText, top10: [{id, name}]}]
  steps_json       TEXT    NOT NULL,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_triage_created ON triage_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_triage_character ON triage_queue(actual_character_id);
