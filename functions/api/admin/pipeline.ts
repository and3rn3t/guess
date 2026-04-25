/**
 * GET /api/admin/pipeline — paginated pipeline_runs audit log
 * POST /api/admin/pipeline — log a pipeline run step (called by CLI enrichment scripts)
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../_helpers'
import type { PipelineRunsRow } from '../_db-types'

type PipelineStep = 'fetch' | 'dedup' | 'enrich' | 'image' | 'upload'
type PipelineStatus = 'pending' | 'running' | 'success' | 'error'

export interface PipelineRun {
  id: number
  runBatch: string
  characterId: string
  step: PipelineStep
  status: PipelineStatus
  error: string | null
  durationMs: number | null
  createdAt: number
}

const VALID_STEPS = new Set<string>(['fetch', 'dedup', 'enrich', 'image', 'upload'])
const VALID_STATUSES = new Set<string>(['pending', 'running', 'success', 'error'])

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '50', 10)))
  const offset = (page - 1) * pageSize

  const filterStep = url.searchParams.get('step') ?? ''
  const filterStatus = url.searchParams.get('status') ?? ''
  const filterBatch = url.searchParams.get('batch') ?? ''
  const filterCharacter = url.searchParams.get('character') ?? ''

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (filterStep && VALID_STEPS.has(filterStep)) {
    conditions.push('step = ?')
    params.push(filterStep)
  }
  if (filterStatus && VALID_STATUSES.has(filterStatus)) {
    conditions.push('status = ?')
    params.push(filterStatus)
  }
  if (filterBatch) {
    conditions.push('run_batch = ?')
    params.push(filterBatch)
  }
  if (filterCharacter) {
    conditions.push('character_id = ?')
    params.push(filterCharacter)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [countResult, rows] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) as total FROM pipeline_runs ${where}`)
      .bind(...params)
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT id, run_batch, character_id, step, status, error, duration_ms, created_at
       FROM pipeline_runs
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
      )
      .bind(...params, pageSize, offset)
      .all<PipelineRunsRow>(),
  ])

  const runs: PipelineRun[] = (rows.results ?? []).map((r) => ({
    id: r.id,
    runBatch: r.run_batch,
    characterId: r.character_id,
    step: r.step,
    status: r.status,
    error: r.error,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  }))

  return jsonResponse({ runs, total: countResult?.total ?? 0, page, pageSize })
}

interface PipelineLogBody {
  runBatch: string
  characterId: string
  step: string
  status: string
  error?: string
  durationMs?: number
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const body = await parseJsonBody<PipelineLogBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  const { runBatch, characterId, step, status } = body
  if (!runBatch || !characterId || !step || !status) {
    return errorResponse('Missing required fields: runBatch, characterId, step, status', 400)
  }
  if (!VALID_STEPS.has(step)) return errorResponse(`Invalid step. Must be one of: ${[...VALID_STEPS].join(', ')}`, 400)
  if (!VALID_STATUSES.has(status)) return errorResponse(`Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}`, 400)

  const result = await db
    .prepare(
      `INSERT INTO pipeline_runs (run_batch, character_id, step, status, error, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      runBatch,
      characterId,
      step,
      status,
      body.error ?? null,
      body.durationMs ?? null,
    )
    .run()

  return jsonResponse({ ok: true, id: result.meta.last_row_id }, 201)
}
