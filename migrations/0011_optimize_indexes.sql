-- Composite index for game history queries (user_id + created_at DESC).
-- Note: 0011b_composite_indexes.sql is a historical duplicate of this file (same index, IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS idx_game_stats_user_created ON game_stats(user_id, created_at DESC);
