-- Sim-vs-Real calibration overlay queries
--
-- Pairs each query against both `sim_game_stats` (latest run) and
-- `game_stats` (last 7 days of real play) so we can confirm the simulator
-- is tracking real outcomes. Run side-by-side via:
--   pnpm wrangler d1 execute guess-db --env production --remote --file docs/sim-vs-real-queries.sql
--
-- Targets in docs/guess-readiness-calibration.md still apply for the sim
-- column; the real column is what we're trying to match.

-- ─────────────────────────────────────────────────────────────────────────────
-- Q0. Side-by-side: top-line metrics (last 7 days real / latest sim run)
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
),
real_recent AS (
  SELECT *
  FROM game_stats
  WHERE created_at > (strftime('%s', 'now') - 7*86400) * 1000
),
sim_recent AS (
  SELECT s.* FROM sim_game_stats s JOIN latest_run r ON s.run_id = r.run_id
)
SELECT
  'sim'                                      AS source,
  COUNT(*)                                   AS games,
  ROUND(100.0 * AVG(won), 1)                 AS win_pct,
  ROUND(AVG(confidence_at_guess), 3)         AS avg_confidence,
  ROUND(AVG(questions_asked), 1)             AS avg_questions,
  ROUND(AVG(guesses_used), 2)                AS avg_guesses
FROM sim_recent
UNION ALL
SELECT
  'real'                                     AS source,
  COUNT(*)                                   AS games,
  ROUND(100.0 * AVG(won), 1)                 AS win_pct,
  ROUND(AVG(confidence_at_guess), 3)         AS avg_confidence,
  ROUND(AVG(questions_asked), 1)             AS avg_questions,
  ROUND(AVG(guesses_used), 2)                AS avg_guesses
FROM real_recent;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q1. Win rate by difficulty (sim vs real)
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
)
SELECT
  source,
  difficulty,
  games,
  win_pct
FROM (
  SELECT 'sim' AS source, s.difficulty, COUNT(*) AS games,
         ROUND(100.0 * AVG(s.won), 1) AS win_pct
  FROM sim_game_stats s
  JOIN latest_run r ON s.run_id = r.run_id
  GROUP BY s.difficulty
  UNION ALL
  SELECT 'real' AS source, difficulty, COUNT(*) AS games,
         ROUND(100.0 * AVG(won), 1) AS win_pct
  FROM game_stats
  WHERE created_at > (strftime('%s', 'now') - 7*86400) * 1000
  GROUP BY difficulty
)
ORDER BY difficulty, source;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q2. Calibration by confidence band (sim vs real)
-- A perfectly calibrated engine has actual_win_pct ≈ band midpoint.
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
),
banded AS (
  SELECT 'sim' AS source, s.confidence_at_guess AS conf, s.won
  FROM sim_game_stats s
  JOIN latest_run r ON s.run_id = r.run_id
  UNION ALL
  SELECT 'real' AS source, confidence_at_guess AS conf, won
  FROM game_stats
  WHERE created_at > (strftime('%s', 'now') - 7*86400) * 1000
)
SELECT
  source,
  CASE
    WHEN conf < 0.5  THEN '0.0–0.5'
    WHEN conf < 0.7  THEN '0.5–0.7'
    WHEN conf < 0.85 THEN '0.7–0.85'
    WHEN conf < 0.95 THEN '0.85–0.95'
    ELSE                  '0.95–1.0'
  END                                                    AS confidence_band,
  COUNT(*)                                               AS games,
  ROUND(100.0 * AVG(won), 1)                             AS win_pct
FROM banded
GROUP BY source, confidence_band
ORDER BY confidence_band, source;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q3. Guess-trigger distribution (sim vs real)
-- Drives readiness-gate tuning: do real users hit `forced` at the same rate?
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
)
SELECT source, guess_trigger, games, ROUND(100.0 * win_pct, 1) AS win_pct, avg_questions
FROM (
  SELECT 'sim' AS source, s.guess_trigger,
         COUNT(*) AS games,
         AVG(s.won) AS win_pct,
         ROUND(AVG(s.questions_asked), 1) AS avg_questions
  FROM sim_game_stats s
  JOIN latest_run r ON s.run_id = r.run_id
  WHERE s.guess_trigger IS NOT NULL
  GROUP BY s.guess_trigger
  UNION ALL
  SELECT 'real' AS source, guess_trigger,
         COUNT(*) AS games,
         AVG(won) AS win_pct,
         ROUND(AVG(questions_asked), 1) AS avg_questions
  FROM game_stats
  WHERE created_at > (strftime('%s', 'now') - 7*86400) * 1000
    AND guess_trigger IS NOT NULL
  GROUP BY guess_trigger
)
ORDER BY guess_trigger, source;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q4. Variant comparison (real only) — used once experiments are running.
-- Compares win rate and avg questions between A/B variants from the new
-- game_stats.variant + game_stats.selector columns (migration 0033).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  variant,
  selector,
  COUNT(*)                              AS games,
  ROUND(100.0 * AVG(won), 1)            AS win_pct,
  ROUND(AVG(confidence_at_guess), 3)    AS avg_confidence,
  ROUND(AVG(questions_asked), 1)        AS avg_questions,
  ROUND(AVG(guesses_used), 2)           AS avg_guesses
FROM game_stats
WHERE created_at > (strftime('%s', 'now') - 14*86400) * 1000
GROUP BY variant, selector
ORDER BY variant, selector;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q5. Empirical info-gain coverage from question_attempts (real only).
-- Verifies the new write-path in functions/api/v2/game/answer.ts is producing
-- usable data and exposes outliers (very large or very small avg drop).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  attribute,
  COUNT(*)                                                                   AS attempts,
  ROUND(AVG((CAST(candidates_before AS REAL) - candidates_after)
            / NULLIF(candidates_before, 0)), 4)                              AS avg_norm_drop,
  MIN(candidates_before)                                                     AS min_pre,
  MAX(candidates_before)                                                     AS max_pre
FROM question_attempts
WHERE created_at > (strftime('%s', 'now') - 7*86400) * 1000
  AND candidates_before IS NOT NULL
  AND candidates_after IS NOT NULL
GROUP BY attribute
HAVING attempts >= 10
ORDER BY avg_norm_drop DESC
LIMIT 30;
