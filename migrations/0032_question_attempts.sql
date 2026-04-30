-- Migration 0032: question_attempts (denormalized from game_stats.steps JSON)
--
-- Each row = one question asked in one game. Replaces the need to parse
-- `game_stats.steps` JSON for analytics like:
--   - Per-question average information gain (probability_delta)
--   - Per-question skip / "maybe" rates
--   - Empirical net-gain map for the question selector (kv:question-empirical-gain)
--
-- Backfilled from existing game_stats rows by scripts/backfill-question-attempts.ts;
-- new games write live via /api/v2/game/answer.

CREATE TABLE IF NOT EXISTS question_attempts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id          TEXT NOT NULL,
  question_id         TEXT,                    -- nullable: legacy steps stored attribute only
  attribute           TEXT NOT NULL,
  answer              TEXT NOT NULL,           -- 'yes' | 'no' | 'maybe' | 'unknown'
  probability_delta   REAL,                    -- |topP_after - topP_before|; null if unknown
  candidates_before   INTEGER,
  candidates_after    INTEGER,
  question_index      INTEGER NOT NULL,        -- 0-based index within the game
  created_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_attempts_attr_created
  ON question_attempts(attribute, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_attempts_session
  ON question_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_question_created
  ON question_attempts(question_id, created_at DESC);
