import { type Env, errorResponse } from '../../_helpers'

interface LastBatchStats {
  batchId: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  characters: number
  runAt: string
  status: 'success' | 'error'
}

interface KvJobFlag {
  queuedAt: number
  batchId: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  const kv = context.env.GUESS_KV
  if (!db) return errorResponse('DB not configured', 503)

  const encoder = new TextEncoder()
  const send = (event: string, data: unknown) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  const snapshot = async () => {
    const [runs, jobFlagRaw, pendingResult, statsRaw] = await Promise.all([
      db.prepare(
        `SELECT pr.id, pr.run_batch, pr.character_id, c.name AS character_name,
                pr.step, pr.status, pr.error, pr.duration_ms, pr.created_at
         FROM pipeline_runs pr
         LEFT JOIN characters c ON c.id = pr.character_id
         WHERE pr.step = 'enrich'
         ORDER BY pr.created_at DESC LIMIT 100`
      ).all(),
      kv?.get('admin:enrich-start'),
      db.prepare(
        `SELECT COUNT(*) AS n FROM characters c
         WHERE NOT EXISTS (
           SELECT 1 FROM character_attributes ca WHERE ca.character_id = c.id LIMIT 1
         )`
      ).first<{ n: number }>(),
      kv?.get('enrich:last-batch-stats'),
    ])

    // Parse the KV flag to surface startedAt and activeBatchId to the frontend
    let jobStartedAt: number | null = null
    let activeBatchId: string | null = null
    if (jobFlagRaw) {
      try {
        const flag = JSON.parse(jobFlagRaw as string) as KvJobFlag
        jobStartedAt = flag.queuedAt ?? null
        activeBatchId = flag.batchId ?? null
      } catch { /* flag may be a bare string from older versions */ }
    }

    let lastBatchStats: LastBatchStats | null = null
    if (statsRaw) {
      try { lastBatchStats = JSON.parse(statsRaw as string) as LastBatchStats } catch { /* ignore */ }
    }
    return {
      runs: runs.results,
      jobActive: !!jobFlagRaw,
      jobStartedAt,
      activeBatchId,
      pendingCount: pendingResult?.n ?? 0,
      lastBatchStats,
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
