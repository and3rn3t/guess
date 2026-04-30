-- Migration 0033: A/B variant + selector columns on game_stats
--
-- Enables in-production engine experiments: every game is stamped with the
-- engine variant that played it, so calibration queries can split outcomes by
-- variant and detect regressions before promoting an experiment to control.
--
-- Defaults match current production behavior:
--   variant  = 'control'   (no experiment assigned)
--   selector = 'mcts'      (current default; see functions/api/v2/_game-engine.ts
--                            selectBestQuestion wrapper which delegates to MCTS)

ALTER TABLE game_stats ADD COLUMN variant  TEXT NOT NULL DEFAULT 'control';
ALTER TABLE game_stats ADD COLUMN selector TEXT NOT NULL DEFAULT 'mcts';

CREATE INDEX IF NOT EXISTS idx_game_stats_variant_created
  ON game_stats(variant, created_at);
