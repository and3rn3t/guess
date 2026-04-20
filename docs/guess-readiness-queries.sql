-- Guess readiness calibration queries
-- Run these against D1 after migration 0015 is applied.

-- 0. Recent sample gate (use before tuning thresholds)
SELECT
  COUNT(*) AS games_last_14d,
  ROUND(100.0 * AVG(won), 1) AS overall_win_pct_last_14d,
  ROUND(AVG(confidence_at_guess), 2) AS avg_confidence_last_14d,
  ROUND(AVG(questions_asked), 1) AS avg_questions_last_14d,
  ROUND(AVG(guesses_used), 1) AS avg_guesses_last_14d
FROM game_stats
WHERE created_at >= unixepoch('now', '-14 days') * 1000;

-- 1. Accuracy by confidence band
SELECT
  ROUND(confidence_at_guess, 1) AS confidence_band,
  COUNT(*) AS total_games,
  SUM(won) AS wins,
  ROUND(100.0 * SUM(won) / COUNT(*), 1) AS win_pct
FROM game_stats
WHERE confidence_at_guess IS NOT NULL
GROUP BY ROUND(confidence_at_guess, 1)
ORDER BY confidence_band;

-- 2. Accuracy by trigger type
SELECT
  COALESCE(guess_trigger, 'unknown') AS guess_trigger,
  COUNT(*) AS total_games,
  ROUND(AVG(confidence_at_guess), 2) AS avg_confidence,
  ROUND(AVG(entropy_at_guess), 2) AS avg_entropy,
  ROUND(100.0 * AVG(won), 1) AS win_pct
FROM game_stats
GROUP BY COALESCE(guess_trigger, 'unknown')
ORDER BY total_games DESC;

-- 3. Forced guess quality
SELECT
  forced_guess,
  COUNT(*) AS total_games,
  ROUND(AVG(confidence_at_guess), 2) AS avg_confidence,
  ROUND(AVG(gap_at_guess), 2) AS avg_gap,
  ROUND(100.0 * AVG(won), 1) AS win_pct
FROM game_stats
GROUP BY forced_guess;

-- 4. Remaining-question effectiveness
SELECT
  questions_remaining_at_guess,
  COUNT(*) AS total_games,
  ROUND(100.0 * AVG(won), 1) AS win_pct
FROM game_stats
WHERE questions_remaining_at_guess IS NOT NULL
GROUP BY questions_remaining_at_guess
ORDER BY questions_remaining_at_guess;

-- 5. Ambiguity quality by alive suspects / gap
SELECT
  alive_count_at_guess,
  ROUND(AVG(gap_at_guess), 2) AS avg_gap,
  ROUND(AVG(confidence_at_guess), 2) AS avg_confidence,
  ROUND(100.0 * AVG(won), 1) AS win_pct,
  COUNT(*) AS total_games
FROM game_stats
WHERE alive_count_at_guess IS NOT NULL
GROUP BY alive_count_at_guess
ORDER BY alive_count_at_guess;

-- 6. Difficulty breakdown for current thresholds
SELECT
  difficulty,
  COUNT(*) AS total_games,
  ROUND(AVG(confidence_at_guess), 2) AS avg_confidence,
  ROUND(AVG(entropy_at_guess), 2) AS avg_entropy,
  ROUND(AVG(gap_at_guess), 2) AS avg_gap,
  ROUND(100.0 * AVG(won), 1) AS win_pct,
  ROUND(AVG(questions_asked), 1) AS avg_questions,
  ROUND(AVG(guesses_used), 1) AS avg_guesses
FROM game_stats
GROUP BY difficulty
ORDER BY difficulty;

-- 7. KPI summary for threshold review
SELECT
  COUNT(*) AS total_games,
  ROUND(100.0 * AVG(won), 1) AS overall_win_pct,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'strict_readiness' THEN won END), 1) AS strict_readiness_win_pct,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'high_certainty' THEN won END), 1) AS high_certainty_win_pct,
  ROUND(100.0 * AVG(CASE WHEN forced_guess = 1 THEN won END), 1) AS forced_guess_win_pct,
  ROUND(100.0 * AVG(CASE WHEN questions_remaining_at_guess >= 4 THEN won END), 1) AS early_guess_win_pct,
  ROUND(100.0 * AVG(CASE WHEN alive_count_at_guess <= 3 THEN won END), 1) AS low_ambiguity_win_pct,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'max_questions' THEN 1 ELSE 0 END), 1) AS max_question_guess_rate,
  ROUND(100.0 * AVG(CASE WHEN forced_guess = 1 THEN 1 ELSE 0 END), 1) AS forced_guess_rate
FROM game_stats
WHERE confidence_at_guess IS NOT NULL;