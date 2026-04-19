-- Game statistics table for server-side game engine
CREATE TABLE IF NOT EXISTS game_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  won INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  questions_asked INTEGER NOT NULL DEFAULT 0,
  character_pool_size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_stats_user ON game_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_created ON game_stats(created_at);
