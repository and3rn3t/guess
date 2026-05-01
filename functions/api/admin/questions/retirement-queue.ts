/**
 * GET /api/admin/questions/retirement-queue — AN.17
 *
 * Returns questions ranked by composite "retirement score" computed from
 * `question_attempts` (answer mix + shown counts) and `client_events`
 * (`question_skip` events) over the last N days. Pure scoring lives in
 * `_retirement.ts` for unit-testability.
 *
 * Query params:
 *   - source=live|retired (default `live`)
 *   - windowDays=1..365   (default 30)
 *   - minShown=1..10000   (default 10)
 *   - limit=5..500        (default 50)
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../../_helpers'
import {
  computeRetirementQueue,
  parseRetirementParams,
  type RetirementAttemptRow,
  type RetirementSkipRow,
  type RetirementCandidate,
} from '../_retirement'

interface RetiredRow {
  id: string
  text: string
  attribute_key: string
  retired_at: number
  retired_reason: string | null
}

interface RetiredEntry {
  questionId: string
  text: string
  attributeKey: string
  retiredAt: number
  retiredReason: string | null
}

export interface RetirementQueueResponse {
  source: 'live' | 'retired'
  windowDays: number
  minShown: number
  generatedAt: number
  candidates?: RetirementCandidate[]
  retired?: RetiredEntry[]
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const sourceRaw = url.searchParams.get('source')
  const source: 'live' | 'retired' = sourceRaw === 'retired' ? 'retired' : 'live'
  const params = parseRetirementParams(url.searchParams)
  const generatedAt = Date.now()

  if (source === 'retired') {
    const result = await db
      .prepare(
        `SELECT q.id, q.text, q.attribute_key, q.retired_at, q.retired_reason
         FROM questions q
         WHERE q.retired_at IS NOT NULL
         ORDER BY q.retired_at DESC
         LIMIT ?`,
      )
      .bind(params.limit)
      .all<RetiredRow>()

    const retired: RetiredEntry[] = (result.results ?? []).map((r) => ({
      questionId: r.id,
      text: r.text,
      attributeKey: r.attribute_key,
      retiredAt: Number(r.retired_at),
      retiredReason: r.retired_reason,
    }))

    const retiredResponse: RetirementQueueResponse = {
      source,
      windowDays: params.windowDays,
      minShown: params.minShown,
      generatedAt,
      retired,
    }
    return jsonResponse(retiredResponse)
  }

  // Live queue: pull aggregated attempts + skips and run the scorer.
  // `question_attempts.created_at` is unix seconds; `client_events.created_at` is unix ms.
  const sinceSecs = `unixepoch('now', '-${params.windowDays} days')`
  const sinceMs = `unixepoch('now', '-${params.windowDays} days') * 1000`

  const [attempts, skips] = await Promise.all([
    db
      .prepare(
        `SELECT
           qa.question_id AS question_id,
           q.text         AS text,
           q.attribute_key AS attribute_key,
           COUNT(*)       AS shown,
           SUM(CASE WHEN qa.answer = 'yes'     THEN 1 ELSE 0 END) AS yes,
           SUM(CASE WHEN qa.answer = 'no'      THEN 1 ELSE 0 END) AS no,
           SUM(CASE WHEN qa.answer = 'maybe'   THEN 1 ELSE 0 END) AS maybe,
           SUM(CASE WHEN qa.answer = 'unknown' THEN 1 ELSE 0 END) AS unknown
         FROM question_attempts qa
         INNER JOIN questions q ON q.id = qa.question_id
         WHERE qa.question_id IS NOT NULL
           AND qa.created_at >= ${sinceSecs}
           AND q.retired_at IS NULL
         GROUP BY qa.question_id
         HAVING shown >= ?`,
      )
      .bind(params.minShown)
      .all<RetirementAttemptRow>(),

    db
      .prepare(
        `SELECT
           json_extract(ce.data, '$.questionId') AS question_id,
           COUNT(*) AS skips
         FROM client_events ce
         WHERE ce.event_type = 'question_skip'
           AND ce.created_at >= ${sinceMs}
           AND json_extract(ce.data, '$.questionId') IS NOT NULL
         GROUP BY question_id`,
      )
      .all<RetirementSkipRow>(),
  ])

  const candidates = computeRetirementQueue(
    attempts.results ?? [],
    skips.results ?? [],
    { minShown: params.minShown, limit: params.limit },
  )

  const liveResponse: RetirementQueueResponse = {
    source,
    windowDays: params.windowDays,
    minShown: params.minShown,
    generatedAt,
    candidates,
  }
  return jsonResponse(liveResponse)
}
