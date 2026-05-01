-- Migration 0039: Question retirement queue (AN.17)
--
-- Purpose: Allows admins to retire under-performing questions so the game
-- engine stops asking them. Retirement is reversible — a NULL `retired_at`
-- means the question is live; a non-NULL value means it's retired and the
-- engine must skip it.
--
-- The composite badness score that ranks the retirement queue is computed
-- from existing tables (`question_attempts`, `client_events`) — no new
-- aggregation table is needed. See `functions/api/admin/_retirement.ts`.
--
-- Indexes:
--   * Partial index on `retired_at IS NULL` so the engine's "live questions"
--     query (`SELECT … FROM questions WHERE retired_at IS NULL`) is O(live)
--     not O(total).
--   * Plain index on `retired_at` so the admin "already-retired" tab sort is
--     fast even as the retired set grows.

ALTER TABLE questions ADD COLUMN retired_at INTEGER DEFAULT NULL;
ALTER TABLE questions ADD COLUMN retired_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_live
  ON questions(priority DESC) WHERE retired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_retired_at
  ON questions(retired_at DESC) WHERE retired_at IS NOT NULL;
