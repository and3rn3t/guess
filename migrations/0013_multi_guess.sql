-- Multi-guess support: track how many guesses the AI made per game
ALTER TABLE game_stats ADD COLUMN guesses_used INTEGER NOT NULL DEFAULT 1;
