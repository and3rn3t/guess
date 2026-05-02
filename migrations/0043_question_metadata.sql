-- Migration 0043: Question metadata and player affinity tables
-- Adds rich annotations to questions for narrative coherence + premium UX signals
-- Also adds affinity tracking and player feedback for data-driven iteration

-- ── Question metadata ─────────────────────────────────────────────────────────

ALTER TABLE questions ADD COLUMN theme TEXT DEFAULT 'ability'; -- visual|ability|personality|relationship|origin|franchise|stat
ALTER TABLE questions ADD COLUMN surprise_factor REAL DEFAULT 0.5; -- [0, 1] empirically computed
ALTER TABLE questions ADD COLUMN difficulty_tag TEXT DEFAULT 'medium'; -- easy|medium|hard for future curated pools

-- ── Player question affinity (dynamic recommendation learning) ──────────────

CREATE TABLE IF NOT EXISTS player_question_affinity (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  player_cohort       TEXT NOT NULL,           -- archetype: e.g. 'animal-lover', 'scifi-fan', 'logic-focused'
  question_id         TEXT NOT NULL,
  avg_info_gain       REAL,                    -- empirical mean from real games
  skew_score          REAL,                    -- stddev of info gain (high = variable outcome)
  updated_at          INTEGER NOT NULL,
  UNIQUE(player_cohort, question_id)
);

-- ── Player feedback on games ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_feedback (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id          TEXT NOT NULL,
  game_id             TEXT,                    -- reference to the game in game_stats
  rating              INTEGER NOT NULL,        -- 1-5 stars
  feedback_text       TEXT,                    -- optional comment from player
  created_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_feedback_session
  ON game_feedback(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_feedback_rating
  ON game_feedback(rating, created_at DESC);

-- ── Analytics view: per-theme question performance ──────────────────────

CREATE VIEW IF NOT EXISTS v_question_theme_stats AS
SELECT
  q.theme,
  COUNT(DISTINCT q.id) as question_count,
  AVG(qa.probability_delta) as avg_info_gain,
  SUM(CASE WHEN qa.answer = 'unknown' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as unknown_rate,
  SUM(CASE WHEN qa.answer = 'maybe' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as maybe_rate,
  COUNT(DISTINCT qa.session_id) as unique_games
FROM questions q
LEFT JOIN question_attempts qa ON q.id = qa.question_id AND qa.created_at > unixepoch('now', '-90 days')
WHERE q.deleted_at IS NULL
GROUP BY q.theme;
