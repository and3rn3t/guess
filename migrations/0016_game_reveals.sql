-- Track user-revealed answers when AI fails to guess
-- Enables offline DB enrichment: fill null attributes + flag discrepancies
CREATE TABLE IF NOT EXISTS game_reveals (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  actual_character_name TEXT    NOT NULL,
  actual_character_id   TEXT,           -- NULL if character not found in DB
  answers               TEXT    NOT NULL, -- JSON: [{questionId, value}]
  attributes_filled     INTEGER NOT NULL DEFAULT 0, -- how many null attrs were backfilled
  discrepancies         INTEGER NOT NULL DEFAULT 0, -- answers that contradicted existing attrs
  created_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_game_reveals_character  ON game_reveals(actual_character_id);
CREATE INDEX IF NOT EXISTS idx_game_reveals_name       ON game_reveals(actual_character_name);
CREATE INDEX IF NOT EXISTS idx_game_reveals_created    ON game_reveals(created_at);
