/**
 * GET /api/admin/triage — Catastrophic-failure replay queue (AN.21).
 *
 * Returns paginated rows from `triage_queue` (games where the actual character
 * was never in the engine's top-10 at any step).
 *
 * Query params:
 *   limit  — max rows (default 50, max 200)
 *   offset — pagination offset (default 0)
 *   id     — if supplied, returns a single detail row (steps JSON parsed)
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'
import type { TriageStep } from './_triage'

interface TriageListRow {
  id: number
  actual_character_id: string
  actual_character_name: string | null
  min_rank: number | null
  created_at: number
}

interface TriageDetailRow extends TriageListRow {
  steps_json: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const idParam = url.searchParams.get('id')

  // ── Single row (detail) ──────────────────────────────────────────────────
  if (idParam) {
    const id = parseInt(idParam, 10)
    if (!Number.isFinite(id)) return errorResponse('Invalid id', 400)

    const row = await db
      .prepare(
        `SELECT id, actual_character_id, actual_character_name, min_rank, steps_json, created_at
         FROM triage_queue
         WHERE id = ?`
      )
      .bind(id)
      .first<TriageDetailRow>()

    if (!row) return errorResponse('Not found', 404)

    let steps: TriageStep[] = []
    try {
      steps = JSON.parse(row.steps_json) as TriageStep[]
    } catch {
      /* malformed JSON — return empty steps */
    }

    return jsonResponse({
      id: row.id,
      actualCharacterId: row.actual_character_id,
      actualCharacterName: row.actual_character_name,
      minRank: row.min_rank,
      createdAt: row.created_at,
      steps,
    })
  }

  // ── List (paginated) ─────────────────────────────────────────────────────
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)))
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10))

  const [rowsResult, totalResult] = await Promise.all([
    db
      .prepare(
        `SELECT id, actual_character_id, actual_character_name, min_rank, created_at
         FROM triage_queue
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<TriageListRow>(),
    db
      .prepare('SELECT COUNT(*) AS n FROM triage_queue')
      .first<{ n: number }>(),
  ])

  return jsonResponse({
    rows: rowsResult.results ?? [],
    total: totalResult?.n ?? 0,
    limit,
    offset,
  })
}
