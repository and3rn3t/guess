-- Add analytics columns to game_stats for guess quality tracking
ALTER TABLE game_stats ADD COLUMN confidence_at_guess REAL;
ALTER TABLE game_stats ADD COLUMN entropy_at_guess REAL;
ALTER TABLE game_stats ADD COLUMN remaining_at_guess INTEGER;
ALTER TABLE game_stats ADD COLUMN answer_distribution TEXT; -- JSON: {"yes":N,"no":N,"maybe":N,"unknown":N}
