/**
 * GET /api/admin/security/csp-digest — read the latest cron-generated CSP digest.
 *
 * SE.1 — surfaces the snapshot written by functions/cron/_csp_digest.ts so
 * the admin Security route can render the weekly summary without re-running
 * the aggregation queries on every page load.
 *
 * Protected by Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../../_helpers'
import { d1CacheGet } from '../../_d1_cache'
import { CSP_DIGEST_KEY, type CspDigest } from '../../../cron/_csp_digest'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('D1 not configured', 503)

  const digest = await d1CacheGet<CspDigest>(db, CSP_DIGEST_KEY)
  return jsonResponse({ digest })
}
