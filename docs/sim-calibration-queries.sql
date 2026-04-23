-- Simulation calibration queries — targets sim_game_stats (not game_stats).
-- Run via: pnpm analytics:sim:prod   or   pnpm analytics:sim:preview
--
-- Each query is scoped to the most recent run_id batch (latest_run CTE).
-- To inspect an older run, replace latest_run with:
--   WITH latest_run AS (SELECT 'your-run-id-here' AS run_id)
--
-- Compare results against calibration targets in docs/guess-readiness-calibration.md

-- ─────────────────────────────────────────────────────────────────────────────
-- Q0. Latest run summary + sample gate
-- Confirm you have enough data before drawing conclusions.
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
)
SELECT
  s.run_id,
  COUNT(*)                                   AS total_games,
  ROUND(100.0 * AVG(s.won), 1)               AS overall_win_pct,
  ROUND(AVG(s.confidence_at_guess), 3)       AS avg_confidence,
  ROUND(AVG(s.questions_asked), 1)           AS avg_questions,
  ROUND(AVG(s.guesses_used), 2)              AS avg_guesses,
  datetime(MAX(s.created_at)/1000, 'unixepoch') AS run_timestamp
FROM sim_game_stats s
JOIN latest_run r ON s.run_id = r.run_id
GROUP BY s.run_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q1. Accuracy by confidence band (per difficulty)
-- Reveals whether the engine guesses at appropriate confidence levels.
-- Low-confidence wins = lucky forced guesses; high-conf losses = wrong top candidate.
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
)
SELECT
  s.difficulty,
  CASE
    WHEN s.confidence_at_guess < 0.10 THEN '0–10%'
    WHEN s.confidence_at_guess < 0.25 THEN '10–25%'
    WHEN s.confidence_at_guess < 0.40 THEN '25–40%'
    WHEN s.confidence_at_guess < 0.60 THEN '40–60%'
    WHEN s.confidence_at_guess < 0.80 THEN '60–80%'
    WHEN s.confidence_at_guess < 0.93 THEN '80–93%'
    ELSE '93%+'
  END                                        AS confidence_band,
  COUNT(*)                                   AS total_games,
  SUM(s.won)                                 AS wins,
  ROUND(100.0 * SUM(s.won) / COUNT(*), 1)   AS win_pct
FROM sim_game_stats s
JOIN latest_run r ON s.run_id = r.run_id
WHERE s.confidence_at_guess IS NOT NULL
GROUP BY s.difficulty, confidence_band
ORDER BY s.difficulty, confidence_band;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q2. Accuracy by guess trigger type (per difficulty)
-- Target: strict_readiness ≥75% win, high_certainty ≥90% win.
-- If max_questions is common, the engine runs out of runway too often.
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
)
SELECT
  s.difficulty,
  COALESCE(s.guess_trigger, 'unknown')       AS guess_trigger,
  COUNT(*)                                   AS total_games,
  ROUND(100.0 * AVG(s.won), 1)              AS win_pct,
  ROUND(AVG(s.confidence_at_guess), 3)       AS avg_confidence,
  ROUND(AVG(s.entropy_at_guess), 3)          AS avg_entropy,
  ROUND(AVG(s.questions_asked), 1)           AS avg_questions
FROM sim_game_stats s
JOIN latest_run r ON s.run_id = r.run_id
GROUP BY s.difficulty, guess_trigger
ORDER BY s.difficulty, total_games DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q3. Forced-guess quality (per difficulty)
-- Target: forced_guess_rate < 8%. Forced wins within 15 pts of overall win rate.
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
)
SELECT
  s.difficulty,
  s.forced_guess,
  COUNT(*)                                   AS total_games,
  ROUND(AVG(s.confidence_at_guess), 3)       AS avg_confidence,
  ROUND(AVG(s.gap_at_guess), 3)              AS avg_gap,
  ROUND(100.0 * AVG(s.won), 1)              AS win_pct
FROM sim_game_stats s
JOIN latest_run r ON s.run_id = r.run_id
GROUP BY s.difficulty, s.forced_guess
ORDER BY s.difficulty, s.forced_guess;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q4. Questions-remaining at guess time (per difficulty)
-- Early guesses (questions_remaining ≥ 4) should be rare but accurate.
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
),
derived AS (
  SELECT
    s.difficulty,
    (s.max_questions - s.questions_asked) AS questions_remaining,
    s.won
  FROM sim_game_stats s
  JOIN latest_run r ON s.run_id = r.run_id
)
SELECT
  difficulty,
  questions_remaining,
  COUNT(*)                                   AS total_games,
  ROUND(100.0 * AVG(won), 1)               AS win_pct
FROM derived
GROUP BY difficulty, questions_remaining
ORDER BY difficulty, questions_remaining DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q5. Ambiguity at guess: alive count and gap (per difficulty)
-- Low alive count + high gap = engine waited correctly; high alive = premature.
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
)
SELECT
  s.difficulty,
  CASE
    WHEN s.alive_count_at_guess = 1   THEN '1'
    WHEN s.alive_count_at_guess = 2   THEN '2'
    WHEN s.alive_count_at_guess <= 5  THEN '3–5'
    WHEN s.alive_count_at_guess <= 10 THEN '6–10'
    WHEN s.alive_count_at_guess <= 25 THEN '11–25'
    WHEN s.alive_count_at_guess <= 50 THEN '26–50'
    ELSE '51+'
  END                                        AS alive_bucket,
  COUNT(*)                                   AS total_games,
  ROUND(AVG(s.gap_at_guess), 3)              AS avg_gap,
  ROUND(AVG(s.confidence_at_guess), 3)       AS avg_confidence,
  ROUND(100.0 * AVG(s.won), 1)              AS win_pct
FROM sim_game_stats s
JOIN latest_run r ON s.run_id = r.run_id
WHERE s.alive_count_at_guess IS NOT NULL
GROUP BY s.difficulty, alive_bucket
ORDER BY s.difficulty, s.alive_count_at_guess;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q6. Full difficulty breakdown
-- Side-by-side view across easy/medium/hard for all key metrics.
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
)
SELECT
  s.difficulty,
  COUNT(*)                                   AS total_games,
  ROUND(100.0 * AVG(s.won), 1)              AS win_pct,
  ROUND(AVG(s.confidence_at_guess), 3)       AS avg_confidence,
  ROUND(AVG(s.entropy_at_guess), 3)          AS avg_entropy,
  ROUND(AVG(s.gap_at_guess), 3)              AS avg_gap,
  ROUND(AVG(s.questions_asked), 1)           AS avg_questions,
  ROUND(AVG(s.guesses_used), 2)              AS avg_guesses,
  ROUND(AVG(s.alive_count_at_guess), 1)      AS avg_alive_at_guess,
  ROUND(100.0 * AVG(CASE WHEN s.forced_guess = 1 THEN 1.0 ELSE 0.0 END), 1) AS forced_guess_rate,
  ROUND(100.0 * AVG(CASE WHEN s.guess_trigger = 'max_questions' THEN 1.0 ELSE 0.0 END), 1) AS max_q_rate
FROM sim_game_stats s
JOIN latest_run r ON s.run_id = r.run_id
GROUP BY s.difficulty
ORDER BY s.difficulty;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q7. KPI summary for threshold review (per difficulty + combined)
-- Primary calibration check — compare against targets in guess-readiness-calibration.md
-- Targets: strict_readiness_win_pct ≥75%, high_certainty_win_pct ≥90%,
--          forced_guess_rate <8%, max_question_guess_rate <15%
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
),
base AS (
  SELECT s.* FROM sim_game_stats s JOIN latest_run r ON s.run_id = r.run_id
  WHERE s.confidence_at_guess IS NOT NULL
)
SELECT
  COALESCE(difficulty, 'ALL')                                    AS difficulty,
  COUNT(*)                                                        AS total_games,
  ROUND(100.0 * AVG(won), 1)                                    AS overall_win_pct,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'strict_readiness'  THEN won END), 1) AS strict_readiness_win_pct,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'high_certainty'    THEN won END), 1) AS high_certainty_win_pct,
  ROUND(100.0 * AVG(CASE WHEN forced_guess = 1                    THEN won END), 1) AS forced_guess_win_pct,
  ROUND(100.0 * AVG(CASE WHEN (max_questions - questions_asked) >= 4 THEN won END), 1) AS early_guess_win_pct,
  ROUND(100.0 * AVG(CASE WHEN alive_count_at_guess <= 3            THEN won END), 1) AS low_ambiguity_win_pct,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'max_questions'     THEN 1.0 ELSE 0.0 END), 1) AS max_question_guess_rate,
  ROUND(100.0 * AVG(CASE WHEN forced_guess = 1                    THEN 1.0 ELSE 0.0 END), 1) AS forced_guess_rate,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'strict_readiness'  THEN 1.0 ELSE 0.0 END), 1) AS strict_readiness_rate,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'high_certainty'    THEN 1.0 ELSE 0.0 END), 1) AS high_certainty_rate,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'singleton'         THEN 1.0 ELSE 0.0 END), 1) AS singleton_rate
FROM base
GROUP BY difficulty
UNION ALL
SELECT
  'ALL'                                                           AS difficulty,
  COUNT(*)                                                        AS total_games,
  ROUND(100.0 * AVG(won), 1)                                    AS overall_win_pct,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'strict_readiness'  THEN won END), 1) AS strict_readiness_win_pct,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'high_certainty'    THEN won END), 1) AS high_certainty_win_pct,
  ROUND(100.0 * AVG(CASE WHEN forced_guess = 1                    THEN won END), 1) AS forced_guess_win_pct,
  ROUND(100.0 * AVG(CASE WHEN (max_questions - questions_asked) >= 4 THEN won END), 1) AS early_guess_win_pct,
  ROUND(100.0 * AVG(CASE WHEN alive_count_at_guess <= 3            THEN won END), 1) AS low_ambiguity_win_pct,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'max_questions'     THEN 1.0 ELSE 0.0 END), 1) AS max_question_guess_rate,
  ROUND(100.0 * AVG(CASE WHEN forced_guess = 1                    THEN 1.0 ELSE 0.0 END), 1) AS forced_guess_rate,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'strict_readiness'  THEN 1.0 ELSE 0.0 END), 1) AS strict_readiness_rate,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'high_certainty'    THEN 1.0 ELSE 0.0 END), 1) AS high_certainty_rate,
  ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'singleton'         THEN 1.0 ELSE 0.0 END), 1) AS singleton_rate
FROM base
ORDER BY difficulty;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q8. Information gain by question position
-- Detects plateau: at what question slot does average info gain flatten?
-- Flat gain early → question selector is asking redundant questions.
-- Flat gain late → may be OK (narrowing phase), or question bank is exhausted.
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
),
parsed AS (
  SELECT
    s.difficulty,
    CAST(json_each.key AS INTEGER) + 1       AS position,
    json_extract(json_each.value, '$.infoGain') AS info_gain
  FROM sim_game_stats s
  JOIN latest_run r ON s.run_id = r.run_id,
  json_each(s.questions_sequence)
  WHERE s.questions_sequence IS NOT NULL
    AND s.questions_sequence != '[]'
)
SELECT
  difficulty,
  CASE
    WHEN position <= 3  THEN '01–03'
    WHEN position <= 6  THEN '04–06'
    WHEN position <= 9  THEN '07–09'
    WHEN position <= 12 THEN '10–12'
    WHEN position <= 15 THEN '13–15'
    WHEN position <= 20 THEN '16–20'
    WHEN position <= 30 THEN '21–30'
    ELSE '31+'
  END                                        AS slot_bucket,
  MIN(position)                              AS slot_min,
  COUNT(*)                                   AS observations,
  ROUND(AVG(info_gain), 5)                   AS avg_info_gain,
  ROUND(MIN(info_gain), 5)                   AS min_info_gain,
  ROUND(MAX(info_gain), 5)                   AS max_info_gain
FROM parsed
WHERE info_gain IS NOT NULL
GROUP BY difficulty, slot_bucket
ORDER BY difficulty, slot_min;

-- ─────────────────────────────────────────────────────────────────────────────
-- Q9. Per-character difficulty clustering
-- Bucket characters by how many questions were needed (quartile tiers).
-- Reveals which characters are systematically hard and why.
-- Note: SQLite/D1 lacks PERCENTILE_CONT; approximated via ROW_NUMBER quartile math.
-- ─────────────────────────────────────────────────────────────────────────────
WITH latest_run AS (
  SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
),
base AS (
  SELECT s.* FROM sim_game_stats s JOIN latest_run r ON s.run_id = r.run_id
),
ranked AS (
  SELECT
    id,
    questions_asked,
    ROW_NUMBER() OVER (ORDER BY questions_asked) AS rn,
    COUNT(*) OVER () AS total
  FROM base
),
quartiles AS (
  SELECT
    MAX(CASE WHEN rn <= total * 0.25 THEN questions_asked END) AS q1,
    MAX(CASE WHEN rn <= total * 0.75 THEN questions_asked END) AS q3
  FROM ranked
),
tiered AS (
  SELECT
    b.target_character_id,
    b.target_character_name,
    b.difficulty,
    b.questions_asked,
    b.won,
    b.guess_trigger,
    b.alive_count_at_guess,
    b.confidence_at_guess,
    b.max_questions,
    CASE
      WHEN b.questions_asked <= q.q1  THEN 'easy'
      WHEN b.questions_asked <= q.q3  THEN 'medium'
      WHEN b.questions_asked < b.max_questions THEN 'hard'
      ELSE 'exhausted'
    END AS tier
  FROM base b, quartiles q
)
SELECT
  difficulty,
  tier,
  COUNT(*)                               AS games,
  ROUND(100.0 * AVG(won), 1)            AS win_pct,
  ROUND(AVG(questions_asked), 1)         AS avg_questions,
  ROUND(AVG(alive_count_at_guess), 1)    AS avg_alive,
  ROUND(AVG(confidence_at_guess), 3)     AS avg_confidence
FROM tiered
GROUP BY difficulty, tier
ORDER BY difficulty,
  CASE tier WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END;
