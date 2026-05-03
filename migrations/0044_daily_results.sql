-- P.9: Daily challenge global leaderboard
-- Stores one completion row per (date, user_id). First write wins.

CREATE TABLE IF NOT EXISTS daily_results (
  date TEXT NOT NULL,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  won INTEGER NOT NULL,
  questions_asked INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (date, user_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_results_date_rank
  ON daily_results (date, won, questions_asked, completed_at);

CREATE INDEX IF NOT EXISTS idx_daily_results_user_date
  ON daily_results (user_id, date DESC);
