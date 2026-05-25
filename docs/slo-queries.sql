-- =============================================================================
-- SLO burn-rate queries (OB.1)
-- =============================================================================
-- These queries answer "are we burning the error budget faster than the SLO
-- allows?" using the D1 stores that exist on every environment. They are
-- intentionally lightweight so you can paste them into
-- `wrangler d1 execute guess --remote --command "..."` for a quick check.
--
-- The authoritative numbers live in the `worker_tail` Analytics Engine
-- dataset (see docs/slo.md → "Data sources & caveats"). These queries are
-- the fast-feedback supplement, not the source of truth.
--
-- Reference targets (docs/slo.md):
--   /api/v2/game/start  → error rate ≤ 1.0 %
--   /api/v2/game/answer → error rate ≤ 1.0 %
--
-- Burn-rate thresholds:
--   Fast burn (page)   → ≥ 14× over a 1 h window  (≈ 2 % of 28 d budget)
--   Slow burn (ticket) → ≥  6× over a 6 h window  (≈ 5 % of 28 d budget)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Current burn rate per hot route (last 1 h vs. last 6 h)
-- -----------------------------------------------------------------------------
-- Approximates the request count from `game_stats` (one row per completed
-- game ≈ one successful `start` + several `answer` calls) and the error
-- count from `error_logs` rows whose `source` matches the route.
--
-- Burn-rate formula:
--   burn = (errors_in_window / requests_in_window) / slo_target
--   where slo_target = 0.01 (the 1 % objective).
--
-- A burn of 14× means the current error rate is 14 % (vs. the 1 % budget),
-- which would exhaust the monthly budget in ≈ 2 days if sustained.
--
-- Output: one row per (route, window_hours). Sort by burn DESC and
-- compare against the thresholds in the comment block above.
WITH windowed AS (
  SELECT
    'answer' AS route,
    1        AS window_hours,
    (unixepoch() * 1000) - (1 * 3600 * 1000)  AS since_ms
  UNION ALL
  SELECT 'answer', 6, (unixepoch() * 1000) - (6 * 3600 * 1000)
  UNION ALL
  SELECT 'start',  1, (unixepoch() * 1000) - (1 * 3600 * 1000)
  UNION ALL
  SELECT 'start',  6, (unixepoch() * 1000) - (6 * 3600 * 1000)
),
errs AS (
  SELECT
    w.route,
    w.window_hours,
    COUNT(e.id) AS error_count
  FROM windowed w
  LEFT JOIN error_logs e
    ON e.source = w.route
   AND e.level  = 'error'
   AND e.created_at >= w.since_ms
  GROUP BY w.route, w.window_hours
),
reqs AS (
  -- `start` is invoked once per game; `answer` averages ~12 per game
  -- (engine median question count). Tune this multiplier if the engine
  -- median shifts materially.
  SELECT
    w.route,
    w.window_hours,
    CASE w.route
      WHEN 'start'  THEN COUNT(g.id)
      WHEN 'answer' THEN COUNT(g.id) * 12
    END AS request_count
  FROM windowed w
  LEFT JOIN game_stats g
    ON g.created_at >= w.since_ms / 1000   -- game_stats.created_at is seconds
  GROUP BY w.route, w.window_hours
)
SELECT
  errs.route,
  errs.window_hours,
  errs.error_count,
  reqs.request_count,
  CASE
    WHEN reqs.request_count = 0 THEN NULL
    ELSE ROUND(100.0 * errs.error_count / reqs.request_count, 3)
  END AS error_rate_pct,
  CASE
    WHEN reqs.request_count = 0 THEN NULL
    ELSE ROUND((errs.error_count * 1.0 / reqs.request_count) / 0.01, 2)
  END AS burn_rate_x
FROM errs
JOIN reqs USING (route, window_hours)
ORDER BY burn_rate_x DESC NULLS LAST;


-- -----------------------------------------------------------------------------
-- 2. 28-day error-budget consumption per hot route
-- -----------------------------------------------------------------------------
-- Pure budget view: how much of the 1 % monthly budget have we already
-- spent? `budget_consumed_pct` > 100 means the SLO has been missed for
-- the period; < 100 means we still have margin.
WITH month AS (
  SELECT
    (unixepoch() * 1000) - (28 * 86400 * 1000) AS since_ms
),
errs AS (
  SELECT
    e.source AS route,
    COUNT(*) AS error_count
  FROM error_logs e, month
  WHERE e.source IN ('start', 'answer')
    AND e.level   = 'error'
    AND e.created_at >= month.since_ms
  GROUP BY e.source
),
reqs AS (
  SELECT
    'start'  AS route,
    COUNT(*) AS request_count
  FROM game_stats g, month
  WHERE g.created_at >= month.since_ms / 1000
  UNION ALL
  SELECT
    'answer' AS route,
    COUNT(*) * 12 AS request_count   -- see note in query #1
  FROM game_stats g, month
  WHERE g.created_at >= month.since_ms / 1000
)
SELECT
  COALESCE(errs.route, reqs.route)    AS route,
  COALESCE(errs.error_count, 0)       AS error_count_28d,
  reqs.request_count                  AS request_count_28d,
  CASE
    WHEN reqs.request_count = 0 THEN NULL
    ELSE ROUND(reqs.request_count * 0.01, 0)
  END                                 AS budget_errors_28d,
  CASE
    WHEN reqs.request_count = 0 THEN NULL
    ELSE ROUND(100.0 * COALESCE(errs.error_count, 0) / (reqs.request_count * 0.01), 1)
  END                                 AS budget_consumed_pct
FROM reqs
LEFT JOIN errs USING (route)
ORDER BY budget_consumed_pct DESC NULLS LAST;


-- -----------------------------------------------------------------------------
-- 3. Top error sources in the last hour (triage)
-- -----------------------------------------------------------------------------
-- When the burn query above flags a fast burn, this query tells you
-- *what* is failing. Includes non-SLO sources so you can spot collateral
-- damage (e.g. an LLM outage that's spiking `llm` errors but hasn't yet
-- bled into `answer`).
SELECT
  source,
  level,
  COUNT(*) AS count,
  MIN(created_at) AS first_seen_ms,
  MAX(created_at) AS last_seen_ms,
  SUBSTR(GROUP_CONCAT(DISTINCT message), 1, 200) AS sample_messages
FROM error_logs
WHERE created_at >= (unixepoch() * 1000) - (1 * 3600 * 1000)
GROUP BY source, level
ORDER BY count DESC
LIMIT 20;
