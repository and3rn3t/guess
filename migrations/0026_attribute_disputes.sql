-- Adversarial attribute validation disputes
-- Tracks LLM-flagged disagreements with existing enriched attribute values
CREATE TABLE IF NOT EXISTS attribute_disputes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  attribute_key TEXT NOT NULL,
  current_value INTEGER,          -- 1=true, 0=false, NULL=unknown
  dispute_reason TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  disputed_by TEXT NOT NULL DEFAULT 'skeptic-llm',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN ('open', 'resolved', 'dismissed')),
  resolved_by TEXT,
  resolved_at INTEGER,
  UNIQUE(character_id, attribute_key, status)
);

CREATE INDEX IF NOT EXISTS idx_attribute_disputes_status ON attribute_disputes(status);
CREATE INDEX IF NOT EXISTS idx_attribute_disputes_character ON attribute_disputes(character_id);
CREATE INDEX IF NOT EXISTS idx_attribute_disputes_attr ON attribute_disputes(attribute_key);
