-- AN.2: Track where a user dropped out of a game session.
-- dropped_at_phase = 'playing' is set on session start; cleared to NULL on completion.
-- Sessions that expire without completion retain 'playing' — giving us funnel data.

ALTER TABLE game_sessions ADD COLUMN dropped_at_phase TEXT;

-- Index for efficient funnel queries (group by phase, order by time)
CREATE INDEX IF NOT EXISTS idx_game_sessions_dropped ON game_sessions(dropped_at_phase, created_at DESC);
