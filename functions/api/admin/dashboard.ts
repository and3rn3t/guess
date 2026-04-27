/**
 * GET /api/admin/dashboard — aggregate stats for the admin landing page.
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const [
    totalCharsRow,
    enrichedRow,
    pendingEnrichRow,
    activeQuestionsRow,
    openDisputesRow,
    pendingProposalsRow,
    games7dRow,
    recentGames,
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM characters').first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM characters c WHERE EXISTS (SELECT 1 FROM character_attributes ca WHERE ca.character_id = c.id LIMIT 1)").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM characters c WHERE NOT EXISTS (SELECT 1 FROM character_attributes ca WHERE ca.character_id = c.id LIMIT 1)").first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM attribute_definitions WHERE is_active = 1').first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM attribute_disputes WHERE status = 'open'").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM proposed_attributes WHERE status = 'pending'").first<{ n: number }>(),
    db.prepare(`
      SELECT COUNT(*) AS n FROM game_sessions
      WHERE created_at >= unixepoch('now', '-7 days')
    `).first<{ n: number }>(),
    db.prepare(`
      SELECT gs.id, gs.won, gs.questions_asked, gs.character_id AS target_character_id, gs.character_name
      FROM game_stats gs
      WHERE gs.created_at >= unixepoch('now', '-24 hours')
      ORDER BY gs.created_at DESC
      LIMIT 5
    `).all<{ id: number; won: number; questions_asked: number; target_character_id: string | null; character_name: string | null }>(),
  ])

  return jsonResponse({
    stats: {
      totalCharacters: totalCharsRow?.n ?? 0,
      enriched: enrichedRow?.n ?? 0,
      pendingEnrich: pendingEnrichRow?.n ?? 0,
      activeQuestions: activeQuestionsRow?.n ?? 0,
      openDisputes: openDisputesRow?.n ?? 0,
      pendingProposals: pendingProposalsRow?.n ?? 0,
      games7d: games7dRow?.n ?? 0,
    },
    recentGames: recentGames.results ?? [],
  })
}
