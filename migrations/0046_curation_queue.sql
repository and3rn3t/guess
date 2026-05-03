-- DQ.36: Manual curator closure queue
-- Captures irreducible ambiguity cases that automation cannot safely resolve
-- Supports assignment, resolution tracking, and lock semantics to prevent retry loops

CREATE TABLE IF NOT EXISTS curation_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  attribute_key TEXT NOT NULL,
  -- Issue classification: cannot_infer | canon_conflict | subjective
  issue_type TEXT NOT NULL CHECK(issue_type IN ('cannot_infer', 'canon_conflict', 'subjective')),
  -- Reason why this pair cannot be auto-resolved
  issue_reason TEXT NOT NULL,
  -- Category for sorting/filtering
  category TEXT NOT NULL,
  -- Assignment and resolution
  assigned_to TEXT,  -- curator ID or email
  resolved_at INTEGER,  -- unix-ms when curator resolved
  resolution_reason TEXT,  -- why the curator made this decision
  resolution_value TEXT,  -- JSON: the resolved attribute value or metadata
  -- Lock to prevent reprocessing
  locked_until INTEGER,  -- unix-ms until when this item is locked
  lock_reason TEXT,  -- why it's locked (e.g., "awaiting player feedback")
  -- Aging and lifecycle
  created_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer)),
  updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch() * 1000 as integer)),
  -- Scores for prioritization
  popularity REAL NOT NULL DEFAULT 0.0,
  priority_score REAL NOT NULL DEFAULT 0.0,
  UNIQUE(character_id, attribute_key),
  FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS curation_queue_issue_type ON curation_queue(issue_type);
CREATE INDEX IF NOT EXISTS curation_queue_assigned_to ON curation_queue(assigned_to);
CREATE INDEX IF NOT EXISTS curation_queue_resolved_at ON curation_queue(resolved_at);
CREATE INDEX IF NOT EXISTS curation_queue_locked_until ON curation_queue(locked_until);
CREATE INDEX IF NOT EXISTS curation_queue_priority ON curation_queue(priority_score DESC);
CREATE INDEX IF NOT EXISTS curation_queue_category ON curation_queue(category);
