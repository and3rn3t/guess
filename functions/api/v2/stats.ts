import {
  type Env,
  jsonResponse,
  errorResponse,
  d1Query,
  d1First,
} from '../_helpers'

// ── GET /api/v2/stats ────────────────────────────────────────
// Database overview + game statistics from D1

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  // ── KV cache: return cached stats if available ───────────
  const kv = context.env.GUESS_KV
  if (kv) {
    const cached = await kv.get('cache:stats')
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const [characters, attributes, questions, byCategory, bySource] = await Promise.all([
    d1First<{ count: number }>(db, 'SELECT COUNT(*) as count FROM characters'),
    d1First<{ count: number }>(db, 'SELECT COUNT(*) as count FROM attribute_definitions'),
    d1First<{ count: number }>(db, 'SELECT COUNT(*) as count FROM questions'),
    d1Query<{ category: string; count: number }>(
      db,
      'SELECT category, COUNT(*) as count FROM characters GROUP BY category ORDER BY count DESC'
    ),
    d1Query<{ source: string; count: number }>(
      db,
      'SELECT source, COUNT(*) as count FROM characters GROUP BY source ORDER BY count DESC'
    ),
  ])

  const totalAttrs = await d1First<{ total: number; filled: number }>(
    db,
    `SELECT
       COUNT(*) as total,
       COUNT(CASE WHEN value IS NOT NULL THEN 1 END) as filled
     FROM character_attributes`
  )

  // Game statistics from game_stats table
  let gameStats = null
  try {
    const [overview, byDifficulty, recent] = await Promise.all([
      d1First<{
        total_games: number
        wins: number
        avg_questions: number
        avg_pool_size: number
      }>(
        db,
        `SELECT
           COUNT(*) as total_games,
           SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) as wins,
           ROUND(AVG(questions_asked), 1) as avg_questions,
           ROUND(AVG(character_pool_size), 0) as avg_pool_size
         FROM game_stats`
      ),
      d1Query<{
        difficulty: string
        games: number
        wins: number
        avg_questions: number
      }>(
        db,
        `SELECT
           difficulty,
           COUNT(*) as games,
           SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) as wins,
           ROUND(AVG(questions_asked), 1) as avg_questions
         FROM game_stats
         GROUP BY difficulty
         ORDER BY games DESC`
      ),
      d1Query<{
        won: number
        difficulty: string
        questions_asked: number
        character_pool_size: number
        created_at: number
      }>(
        db,
        `SELECT won, difficulty, questions_asked, character_pool_size, created_at
         FROM game_stats
         ORDER BY created_at DESC
         LIMIT 50`
      ),
    ])

    const readinessSummary = await d1First<{
      instrumented_games: number
      recent_instrumented_games: number
      avg_confidence: number | null
      avg_questions_at_guess: number | null
      strict_readiness_win_pct: number | null
      high_certainty_win_pct: number | null
      forced_guess_rate: number | null
      forced_guess_win_pct: number | null
      early_guess_win_pct: number | null
      low_ambiguity_win_pct: number | null
      max_question_guess_rate: number | null
    }>(
      db,
      `SELECT
         COUNT(*) AS instrumented_games,
         SUM(CASE WHEN created_at >= unixepoch('now', '-14 days') * 1000 THEN 1 ELSE 0 END) AS recent_instrumented_games,
         ROUND(AVG(confidence_at_guess), 2) AS avg_confidence,
         ROUND(AVG(questions_asked), 1) AS avg_questions_at_guess,
         ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'strict_readiness' THEN won END), 1) AS strict_readiness_win_pct,
         ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'high_certainty' THEN won END), 1) AS high_certainty_win_pct,
         ROUND(100.0 * AVG(CASE WHEN forced_guess = 1 THEN 1 ELSE 0 END), 1) AS forced_guess_rate,
         ROUND(100.0 * AVG(CASE WHEN forced_guess = 1 THEN won END), 1) AS forced_guess_win_pct,
         ROUND(100.0 * AVG(CASE WHEN questions_remaining_at_guess >= 4 THEN won END), 1) AS early_guess_win_pct,
         ROUND(100.0 * AVG(CASE WHEN alive_count_at_guess <= 3 THEN won END), 1) AS low_ambiguity_win_pct,
         ROUND(100.0 * AVG(CASE WHEN guess_trigger = 'max_questions' THEN 1 ELSE 0 END), 1) AS max_question_guess_rate
       FROM game_stats
       WHERE confidence_at_guess IS NOT NULL`
    )

    gameStats = {
      totalGames: overview?.total_games ?? 0,
      wins: overview?.wins ?? 0,
      winRate: overview?.total_games
        ? Math.round(((overview.wins ?? 0) / overview.total_games) * 1000) / 10
        : 0,
      avgQuestions: overview?.avg_questions ?? 0,
      avgPoolSize: overview?.avg_pool_size ?? 0,
      byDifficulty: byDifficulty.map((d) => ({
        difficulty: d.difficulty,
        games: d.games,
        wins: d.wins,
        winRate: d.games ? Math.round((d.wins / d.games) * 1000) / 10 : 0,
        avgQuestions: d.avg_questions,
      })),
      recentGames: recent.map((g) => ({
        won: g.won === 1,
        difficulty: g.difficulty,
        questionsAsked: g.questions_asked,
        poolSize: g.character_pool_size,
        timestamp: g.created_at,
      })),
      readiness: readinessSummary && readinessSummary.instrumented_games > 0
        ? {
            instrumentedGames: readinessSummary.instrumented_games,
            recentInstrumentedGames: readinessSummary.recent_instrumented_games,
            avgConfidence: readinessSummary.avg_confidence ?? 0,
            avgQuestionsAtGuess: readinessSummary.avg_questions_at_guess ?? 0,
            strictReadinessWinRate: readinessSummary.strict_readiness_win_pct,
            highCertaintyWinRate: readinessSummary.high_certainty_win_pct,
            forcedGuessRate: readinessSummary.forced_guess_rate ?? 0,
            forcedGuessWinRate: readinessSummary.forced_guess_win_pct,
            earlyGuessWinRate: readinessSummary.early_guess_win_pct,
            lowAmbiguityWinRate: readinessSummary.low_ambiguity_win_pct,
            maxQuestionGuessRate: readinessSummary.max_question_guess_rate ?? 0,
          }
        : null,
    }
  } catch {
    // game_stats table may not exist yet
  }

  const result = {
    characters: characters?.count ?? 0,
    attributes: attributes?.count ?? 0,
    questions: questions?.count ?? 0,
    characterAttributes: {
      total: totalAttrs?.total ?? 0,
      filled: totalAttrs?.filled ?? 0,
      fillRate: totalAttrs?.total
        ? Math.round(((totalAttrs.filled ?? 0) / totalAttrs.total) * 1000) / 10
        : 0,
    },
    byCategory,
    bySource,
    gameStats,
    confusion: null as Array<{
      targetName: string
      secondBestName: string
      count: number
      lossRate: number
    }> | null,
    calibration: null as Array<{
      difficulty: string
      realGames: number
      realWinRate: number
      realAvgQ: number
      simGames: number
      simWinRate: number
      simAvgQ: number
    }> | null,
  }

  // ── AN.7: Confusion pairs from sim_game_stats ─────────────
  try {
    const confusionRows = await d1Query<{
      target_character_name: string
      second_best_character_name: string
      confusion_count: number
      loss_rate: number
    }>(
      db,
      `SELECT
         target_character_name,
         second_best_character_name,
         COUNT(*) AS confusion_count,
         ROUND(100.0 * SUM(CASE WHEN won = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS loss_rate
       FROM sim_game_stats
       WHERE second_best_character_name IS NOT NULL
       GROUP BY target_character_name, second_best_character_name
       ORDER BY confusion_count DESC
       LIMIT 20`
    )
    if (confusionRows.length > 0) {
      result.confusion = confusionRows.map((r) => ({
        targetName: r.target_character_name,
        secondBestName: r.second_best_character_name,
        count: r.confusion_count,
        lossRate: r.loss_rate,
      }))
    }
  } catch {
    // sim_game_stats may not exist yet
  }

  // ── AN.8: Calibration overlay (real vs sim) ───────────────
  try {
    const [realRows, simRows] = await Promise.all([
      d1Query<{
        difficulty: string
        real_games: number
        real_win_rate: number
        real_avg_q: number
      }>(
        db,
        `SELECT
           difficulty,
           COUNT(*) AS real_games,
           ROUND(100.0 * AVG(won), 1) AS real_win_rate,
           ROUND(AVG(questions_asked), 1) AS real_avg_q
         FROM game_stats
         GROUP BY difficulty`
      ),
      d1Query<{
        difficulty: string
        sim_games: number
        sim_win_rate: number
        sim_avg_q: number
      }>(
        db,
        `SELECT
           difficulty,
           COUNT(*) AS sim_games,
           ROUND(100.0 * AVG(won), 1) AS sim_win_rate,
           ROUND(AVG(questions_asked), 1) AS sim_avg_q
         FROM sim_game_stats
         WHERE run_id = (
           SELECT run_id FROM sim_game_stats ORDER BY created_at DESC LIMIT 1
         )
         GROUP BY difficulty`
      ),
    ])

    if (realRows.length > 0 || simRows.length > 0) {
      const difficulties = [
        ...new Set([...realRows.map((r) => r.difficulty), ...simRows.map((r) => r.difficulty)]),
      ]
      result.calibration = difficulties.map((diff) => {
        const real = realRows.find((r) => r.difficulty === diff)
        const sim = simRows.find((r) => r.difficulty === diff)
        return {
          difficulty: diff,
          realGames: real?.real_games ?? 0,
          realWinRate: real?.real_win_rate ?? 0,
          realAvgQ: real?.real_avg_q ?? 0,
          simGames: sim?.sim_games ?? 0,
          simWinRate: sim?.sim_win_rate ?? 0,
          simAvgQ: sim?.sim_avg_q ?? 0,
        }
      })
    }
  } catch {
    // sim_game_stats may not exist yet
  }

  // ── KV cache: store result with 5-minute TTL ─────────────
  if (kv) {
    context.waitUntil(
      kv.put('cache:stats', JSON.stringify(result), { expirationTtl: 300 })
    )
  }

  return jsonResponse(result)
}
