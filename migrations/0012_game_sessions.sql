-- D1 backup for game sessions — survives KV expiration
CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  character_ids TEXT NOT NULL,      -- JSON array of selected character IDs
  answers TEXT NOT NULL DEFAULT '[]', -- JSON array of {questionId, value}
  current_question_attr TEXT,        -- attribute key of current question
  difficulty TEXT NOT NULL DEFAULT 'medium',
  max_questions INTEGER NOT NULL DEFAULT 15,
  created_at INTEGER NOT NULL,
  completed_at INTEGER               -- NULL while in progress
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON game_sessions(user_id, created_at DESC);
