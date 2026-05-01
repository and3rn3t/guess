import { type Env, errorResponse } from '../../_helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  const kv = context.env.GUESS_KV
  if (!db) return errorResponse('DB not configured', 503)

  const encoder = new TextEncoder()
  const send = (event: string, data: unknown) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  const snapshot = async () => {
    const [runs, jobFlag, pendingResult] = await Promise.all([
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
    ])
    return { runs: runs.results, jobActive: !!jobFlag, pendingCount: pendingResult?.n ?? 0 }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initial snapshot
        controller.enqueue(send('snapshot', await snapshot()))

        // Poll every 3 s for 90 s (30 ticks)
        for (let i = 0; i < 30; i++) {
          await new Promise<void>((r) => setTimeout(r, 3000))
          controller.enqueue(send('update', await snapshot()))
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
