-- Migration 0031: character_confusions
--
-- Tracks pairs of characters the engine most frequently confuses with each other,
-- derived from real game outcomes (runner-up vs. actual character on loss reveals,
-- and top-2 candidates at guess time). Populated by the nightly aggregate Cron
-- Worker (functions/_cron-aggregate.ts).
--
-- Used by question selection to boost discriminating questions for known
-- confusion pairs in the endgame, complementing the simulator-derived
-- `confusion-discriminators` KV blob.
--
-- Pair keying: rows are stored canonically with character_a < character_b
-- (lexicographic) so each pair has exactly one row. The aggregate worker
-- enforces ordering on insert.

CREATE TABLE IF NOT EXISTS character_confusions (
  character_a       TEXT NOT NULL,
  character_b       TEXT NOT NULL,
  confusion_count   INTEGER NOT NULL DEFAULT 0,
  last_seen         INTEGER NOT NULL,
  PRIMARY KEY (character_a, character_b),
  CHECK (character_a < character_b)
);

CREATE INDEX IF NOT EXISTS idx_character_confusions_a_count
  ON character_confusions(character_a, confusion_count DESC);
CREATE INDEX IF NOT EXISTS idx_character_confusions_b_count
  ON character_confusions(character_b, confusion_count DESC);
