-- Composite index for game history queries (user_id + created_at DESC)
CREATE INDEX IF NOT EXISTS idx_game_stats_user_created ON game_stats(user_id, created_at DESC);
