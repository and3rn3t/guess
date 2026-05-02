/**
 * GET /api/admin/analytics/aha-moments — Ranked list of "aha moment" attributes.
 *
 * Reads the `kv:aha-moments` blob written by the nightly aggregator
 * (scripts/aggregate-real-game-signals.ts) and returns it to the admin UI.
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../../_helpers'
import type { AhaMomentSummary } from '../_aha'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const raw = await kv.get('kv:aha-moments', 'json') as AhaMomentSummary[] | null
  return jsonResponse({ moments: raw ?? [] })
}
