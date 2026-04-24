-- Migration 0023: Proposed attributes queue for AD.8
-- Stores LLM-proposed (or admin-proposed) attribute definitions awaiting review.

CREATE TABLE proposed_attributes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  key              TEXT    NOT NULL,
  display_text     TEXT    NOT NULL,
  question_text    TEXT    NOT NULL,
  rationale        TEXT,
  example_chars    TEXT,   -- JSON array of { id, name }
  proposed_by      TEXT    NOT NULL DEFAULT 'llm', -- 'llm' | 'user' | 'admin'
  status           TEXT    NOT NULL DEFAULT 'pending'
                           CHECK(status IN ('pending', 'approved', 'rejected')),
  reviewed_by      TEXT,
  reviewed_at      INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_proposed_attributes_status     ON proposed_attributes(status);
CREATE INDEX idx_proposed_attributes_created_at ON proposed_attributes(created_at DESC);
