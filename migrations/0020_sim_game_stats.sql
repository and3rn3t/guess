-- Simulation game stats table.
-- Stores results from headless game simulations (scripts/simulate/run.ts).
-- Kept separate from game_stats so synthetic data never pollutes real-game analytics.

CREATE TABLE IF NOT EXISTS sim_game_stats (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id                    TEXT    NOT NULL,  -- UUID grouping all games in one simulation batch
  target_character_id       TEXT    NOT NULL,
  target_character_name     TEXT    NOT NULL,
  won                       INTEGER NOT NULL,  -- 0|1
  questions_asked           INTEGER NOT NULL,
  guesses_used              INTEGER NOT NULL DEFAULT 0,
  guess_trigger             TEXT,              -- 'singleton'|'max_questions'|'high_certainty'|'strict_readiness'|'insufficient_data'
  forced_guess              INTEGER NOT NULL DEFAULT 0,
  confidence_at_guess       REAL,
  entropy_at_guess          REAL,
  gap_at_guess              REAL,
  alive_count_at_guess      INTEGER,
  second_best_character_id  TEXT,              -- character most confused with target
  second_best_character_name TEXT,
  second_best_probability   REAL,
  questions_sequence        TEXT,              -- JSON: [{attribute, answer, infoGain}]
  answer_distribution       TEXT,             -- JSON: {yes, no, maybe, unknown}
  character_pool_size       INTEGER,
  max_questions             INTEGER,
  difficulty                TEXT    NOT NULL DEFAULT 'medium',
  created_at                INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sim_target ON sim_game_stats (target_character_id);
CREATE INDEX IF NOT EXISTS idx_sim_run    ON sim_game_stats (run_id);
CREATE INDEX IF NOT EXISTS idx_sim_won    ON sim_game_stats (won, created_at);
CREATE INDEX IF NOT EXISTS idx_sim_created ON sim_game_stats (created_at DESC);
