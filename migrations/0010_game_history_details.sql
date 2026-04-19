-- Add detailed game info to game_stats for server-side game history
ALTER TABLE game_stats ADD COLUMN character_id TEXT;
ALTER TABLE game_stats ADD COLUMN character_name TEXT;
ALTER TABLE game_stats ADD COLUMN steps TEXT; -- JSON array of {questionText, attribute, answer}

CREATE INDEX IF NOT EXISTS idx_game_stats_character ON game_stats(character_id);
