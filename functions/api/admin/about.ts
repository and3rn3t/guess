/**
 * GET  /api/admin/about — AP.22 build & data freshness info.
 *
 * Returns system metadata: app version, schema version,
 * last enrichment/cron runs from the database.
 *
 * Protected by the Basic-auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'

interface AboutResponse {
  appVersion: string
  schemaVersion: number
  lastEnrichmentRun: {
    timestamp: number | null
    batchId: string | null
  }
  lastCronRun: {
    timestamp: number | null
    name: string | null
  }
  lastD1Backup: {
    timestamp: number | null
  }
}

/**
 * Determine the latest applied migration number by scanning migration table.
 */
async function getSchemaVersion(db: D1Database): Promise<number> {
  try {
    const result = await db
      .prepare('SELECT MAX(CAST(name AS INTEGER)) as max_version FROM _cf_migration')
      .first<{ max_version: number | null }>()
    return result?.max_version ?? 0
  } catch {
    return 0
  }
}

/**
 * Get the last enrichment run from the attribute_drift table.
 */
async function getLastEnrichmentRun(
  db: D1Database,
): Promise<{ timestamp: number | null; batchId: string | null }> {
  try {
    const result = await db
      .prepare(
        `
        SELECT MAX(created_at) as timestamp, batch_id as batchId
        FROM attribute_drift
        WHERE reconciliation_type = 'enrichment'
        LIMIT 1
      `,
      )
      .first<{ timestamp: number | null; batchId: string | null }>()
    return {
      timestamp: result?.timestamp ?? null,
      batchId: result?.batchId ?? null,
    }
  } catch {
    return { timestamp: null, batchId: null }
  }
}

/**
 * Get the last cron run from the data_quality_snapshots table.
 */
async function getLastCronRun(
  db: D1Database,
): Promise<{ timestamp: number | null; name: string | null }> {
  try {
    const result = await db
      .prepare(
        `
        SELECT MAX(captured_at) as timestamp FROM data_quality_snapshots LIMIT 1
      `,
      )
      .first<{ timestamp: number | null }>()
    return {
      timestamp: result?.timestamp ?? null,
      name: result?.timestamp ? 'data-quality-snapshot' : null,
    }
  } catch {
    return { timestamp: null, name: null }
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  try {
    const [schemaVersion, lastEnrichmentRun, lastCronRun] = await Promise.all([
      getSchemaVersion(db),
      getLastEnrichmentRun(db),
      getLastCronRun(db),
    ])

    const about: AboutResponse = {
      appVersion: '1.6.1', // Injected at build time in v1.7.0+
      schemaVersion,
      lastEnrichmentRun,
      lastCronRun,
      lastD1Backup: {
        timestamp: null, // Tracking D1 backups is handled separately in v1.7.0+
      },
    }

    return jsonResponse(about)
  } catch (err) {
    console.error('[/api/admin/about]', err)
    return errorResponse('Failed to fetch system info', 500)
  }
}
