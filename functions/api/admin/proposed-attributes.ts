import { type Env, jsonResponse, errorResponse, parseJsonBody } from '../_helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const status = url.searchParams.get('status') ?? 'pending'
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10)))
  const offset = (page - 1) * pageSize

  const validStatuses = ['pending', 'approved', 'rejected', 'all']
  const filterStatus = validStatuses.includes(status) ? status : 'pending'

  const hasFilter = filterStatus !== 'all'
  const where = hasFilter ? 'WHERE status = ?' : ''
  const filterParams = hasFilter ? [filterStatus] : []

  const [rows, total] = await Promise.all([
    db.prepare(
      `SELECT id, key, display_text, question_text, rationale, example_chars, proposed_by,
              status, reviewed_by, reviewed_at, created_at
       FROM proposed_attributes ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...filterParams, pageSize, offset).all(),
    db.prepare(`SELECT COUNT(*) as n FROM proposed_attributes ${where}`).bind(...filterParams).first<{ n: number }>(),
  ])

  return jsonResponse({ proposals: rows.results, total: total?.n ?? 0, page, pageSize })
}

interface ProposedAttrBody {
  key: string
  display_text: string
  question_text: string
  rationale?: string
  example_chars?: string  // JSON string
  proposed_by?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const body = await parseJsonBody<{ proposals: ProposedAttrBody[] } | ProposedAttrBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  // Accept either a single proposal or an array under `proposals`
  const proposals: ProposedAttrBody[] = Array.isArray((body as { proposals: ProposedAttrBody[] }).proposals)
    ? (body as { proposals: ProposedAttrBody[] }).proposals
    : [body as ProposedAttrBody]

  if (proposals.length === 0) return errorResponse('No proposals provided', 400)
  if (proposals.length > 100) return errorResponse('Max 100 proposals per request', 400)

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO proposed_attributes (key, display_text, question_text, rationale, example_chars, proposed_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  )

  let inserted = 0
  for (const p of proposals) {
    if (!p.key || !p.display_text || !p.question_text) continue
    const result = await stmt.bind(
      p.key.trim(),
      p.display_text.trim(),
      p.question_text.trim(),
      p.rationale?.trim() ?? null,
      p.example_chars ?? null,
      p.proposed_by ?? 'llm',
    ).run()
    if (result.meta.changes > 0) inserted++
  }

  return jsonResponse({ inserted, submitted: proposals.length })
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const body = await parseJsonBody<{ id: number; status: string; reviewed_by?: string }>(context.request)
  if (!body?.id || !body.status) return errorResponse('id and status required', 400)

  const validStatuses = ['approved', 'rejected']
  if (!validStatuses.includes(body.status)) return errorResponse('status must be approved or rejected', 400)

  await db.prepare(
    `UPDATE proposed_attributes SET status = ?, reviewed_by = ?, reviewed_at = unixepoch() WHERE id = ?`
  ).bind(body.status, body.reviewed_by ?? 'admin', body.id).run()

  return jsonResponse({ ok: true })
}

