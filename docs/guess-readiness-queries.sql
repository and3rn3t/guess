-- Guess readiness calibration queries
-- Run these against D1 after migration 0015 is applied.

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