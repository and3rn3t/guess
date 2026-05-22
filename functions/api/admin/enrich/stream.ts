import { type Env, errorResponse } from '../../_helpers'
import { d1CacheGet } from '../../_d1_cache'

interface LastBatchStats {
  batchId: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  characters: number
  runAt: string
  status: 'success' | 'error'
}

interface EnrichJobRow {
  queued_at: number
  batch_id: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const encoder = new TextEncoder()
  const send = (event: string, data: unknown) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  const snapshot = async () => {
    const [runs, jobRow, pendingResult, lastBatchStats] = await Promise.all([
      db.prepare(
        `SELECT pr.id, pr.run_batch, pr.character_id, c.name AS character_name,
                pr.step, pr.status, pr.error, pr.duration_ms, pr.created_at
         FROM pipeline_runs pr
         LEFT JOIN characters c ON c.id = pr.character_id
         WHERE pr.step = 'enrich'
         ORDER BY pr.created_at DESC LIMIT 100`
      ).all(),
      db.prepare(
        'SELECT queued_at, batch_id FROM enrich_job WHERE expires_at > unixepoch() ORDER BY queued_at DESC LIMIT 1'
      ).first<EnrichJobRow>(),
      db.prepare(
        `SELECT COUNT(*) AS n FROM characters c
         WHERE NOT EXISTS (
           SELECT 1 FROM character_attributes ca WHERE ca.character_id = c.id LIMIT 1
         )`
      ).first<{ n: number }>(),
      d1CacheGet<LastBatchStats>(db, 'enrich:last-batch-stats'),
    ])

    return {
      runs: runs.results,
      jobActive: !!jobRow,
      jobStartedAt: jobRow?.queued_at ?? null,
      activeBatchId: jobRow?.batch_id ?? null,
      pendingCount: pendingResult?.n ?? 0,
      lastBatchStats: lastBatchStats ?? null,
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initial snapshot
        const initial = await snapshot()
        controller.enqueue(send('snapshot', initial))
        let prevJobActive = initial.jobActive

        // Poll fast while a job is running (1 s), slow when idle (5 s).
        // Break immediately after sending the update that shows the job finished —
        // no need to keep the stream open for the full 90 s window.
        // Max 90 ticks guards against stuck jobs keeping the stream alive forever.
        for (let i = 0; i < 90; i++) {
          await new Promise<void>((r) => setTimeout(r, prevJobActive ? 1000 : 5000))
          const snap = await snapshot()
          controller.enqueue(send('update', snap))

          if (prevJobActive && !snap.jobActive) {
            // Job just finished — one final update was sent; close cleanly.
            break
          }
          prevJobActive = snap.jobActive
        }

        controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'))
        controller.close()
      } catch (e) {
        controller.enqueue(send('error', { message: String(e) }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
