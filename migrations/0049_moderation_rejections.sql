-- AI.6 — Persisted log of moderation rejections for human review.
-- `_moderation.ts` writes one row per rejected payload so admins can audit
-- false positives (legitimate submissions blocked by Llama-Guard) and tune
-- the LDNOOBW fast-path / escalation thresholds over time.
--
-- Source endpoints currently gated:
--   - POST /api/v2/characters         (user-submitted character name + description)
--   - POST /api/admin/proposed-attributes (LLM-discovered attribute proposals)
--   - POST /api/v2/game/feedback      (post-game feedback_text)
--
-- The admin /admin/community/rejected route lists rows ordered by `created_at DESC`.

CREATE TABLE IF NOT EXISTS moderation_rejections (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT    NOT NULL,    -- 'v2/characters' | 'admin/proposed-attributes' | 'v2/game/feedback'
  reason       TEXT    NOT NULL,    -- 'ldnoobw' | 'llama-guard:S1,S5' | 'llama-guard-error' | …
  payload      TEXT    NOT NULL,    -- offending text snippet, truncated to 2000 chars
  actor_id     TEXT,                -- userId from cookie when known
  reviewed     INTEGER NOT NULL DEFAULT 0,  -- 0 = pending review, 1 = reviewed
  reviewed_by  TEXT,
  reviewed_at  INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Admin list view orders newest-first and filters by reviewed flag.
CREATE INDEX IF NOT EXISTS idx_moderation_rejections_created
  ON moderation_rejections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_rejections_reviewed
  ON moderation_rejections(reviewed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_rejections_source
  ON moderation_rejections(source);
