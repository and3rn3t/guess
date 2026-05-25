/// <reference types="@cloudflare/workers-types" />
/**
 * SE.1 — Weekly CSP violation digest.
 *
 * Triggered by the Monday 13:00 UTC cron (configured in the Cloudflare
 * dashboard as `0 13 * * 1`). The dispatcher checks `trigger.cron` and
 * no-ops on any other tick so this is safe to wire into the shared
 * runScheduled handler.
 *
 * Output: writes a JSON summary into kv_cache under key
 * `admin:csp:last-digest`. Schema is intentionally small (top 10 by
 * 7-day count + per-directive totals) so the admin route can render
 * it without a follow-up query.
 */

import { d1CachePut } from '../api/_d1_cache'

export const CSP_DIGEST_CRON = '0 13 * * 1' // Mondays, 13:00 UTC
export const CSP_DIGEST_KEY = 'admin:csp:last-digest'
export const CSP_DIGEST_WINDOW_DAYS = 7
const CSP_DIGEST_TOP_N = 10

export interface CspDigestEnv {
  GUESS_DB?: D1Database
}

interface DigestRow {
  directive: string
  blocked_uri: string
  count: number
  last_seen: number
}

interface DirectiveBucket {
  directive: string
  count: number
}

export interface CspDigest {
  generatedAt: number
  windowDays: number
  totalViolations: number
  uniquePairs: number
  topViolations: DigestRow[]
  byDirective: DirectiveBucket[]
}

export interface CspDigestSummary {
  status: 'generated' | 'skipped' | 'error'
  reason?: string
  totalViolations: number
  uniquePairs: number
}

export async function runCspDigest(
  trigger: { cron: string },
  env: CspDigestEnv,
  log: (msg: unknown) => void = console.log,
): Promise<CspDigestSummary> {
  if (trigger.cron !== CSP_DIGEST_CRON) {
    return { status: 'skipped', reason: 'cron does not match', totalViolations: 0, uniquePairs: 0 }
  }
  if (!env.GUESS_DB) {
    return { status: 'skipped', reason: 'no D1 binding', totalViolations: 0, uniquePairs: 0 }
  }

  const sinceMs = Date.now() - CSP_DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000

  try {
    const [topRes, totalsRes, directiveRes] = await Promise.all([
      env.GUESS_DB.prepare(
        `SELECT directive, blocked_uri, count, last_seen
           FROM csp_violations
          WHERE last_seen >= ?
          ORDER BY count DESC, last_seen DESC
          LIMIT ?`,
      )
        .bind(sinceMs, CSP_DIGEST_TOP_N)
        .all<DigestRow>(),
      env.GUESS_DB.prepare(
        `SELECT COALESCE(SUM(count), 0) AS total, COUNT(*) AS pairs
           FROM csp_violations
          WHERE last_seen >= ?`,
      )
        .bind(sinceMs)
        .first<{ total: number; pairs: number }>(),
      env.GUESS_DB.prepare(
        `SELECT directive, SUM(count) AS count
           FROM csp_violations
          WHERE last_seen >= ?
          GROUP BY directive
          ORDER BY count DESC`,
      )
        .bind(sinceMs)
        .all<DirectiveBucket>(),
    ])

    const digest: CspDigest = {
      generatedAt: Date.now(),
      windowDays: CSP_DIGEST_WINDOW_DAYS,
      totalViolations: totalsRes?.total ?? 0,
      uniquePairs: totalsRes?.pairs ?? 0,
      topViolations: topRes.results ?? [],
      byDirective: directiveRes.results ?? [],
    }

    await d1CachePut(env.GUESS_DB, CSP_DIGEST_KEY, digest)

    log({
      event: 'cron.csp_digest',
      totalViolations: digest.totalViolations,
      uniquePairs: digest.uniquePairs,
      topDirective: digest.byDirective[0]?.directive ?? null,
    })

    return {
      status: 'generated',
      totalViolations: digest.totalViolations,
      uniquePairs: digest.uniquePairs,
    }
  } catch (err) {
    const reason = (err as Error).message
    log({ event: 'cron.csp_digest_failed', error: reason })
    return { status: 'error', reason, totalViolations: 0, uniquePairs: 0 }
  }
}
