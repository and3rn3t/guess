-- AN.11: "Aha moment" detector
-- Stores the attribute key and posterior jump (0-1) of the biggest breakthrough per game.
-- Null when the session ended before 3 answers (not enough data to detect a jump).
ALTER TABLE game_stats ADD COLUMN aha_attr TEXT;
ALTER TABLE game_stats ADD COLUMN aha_jump REAL;

CREATE INDEX IF NOT EXISTS idx_game_stats_aha ON game_stats(aha_attr) WHERE aha_attr IS NOT NULL;
