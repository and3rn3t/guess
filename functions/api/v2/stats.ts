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
  }

  // ── KV cache: store result with 5-minute TTL ─────────────
  if (kv) {
    context.waitUntil(
      kv.put('cache:stats', JSON.stringify(result), { expirationTtl: 300 })
    )
  }

  return jsonResponse(result)
}
