-- Add dedicated guess-readiness analytics columns to game_stats
ALTER TABLE game_stats ADD COLUMN guess_trigger TEXT;
ALTER TABLE game_stats ADD COLUMN forced_guess INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_stats ADD COLUMN gap_at_guess REAL;
ALTER TABLE game_stats ADD COLUMN alive_count_at_guess INTEGER;
ALTER TABLE game_stats ADD COLUMN questions_remaining_at_guess INTEGER;