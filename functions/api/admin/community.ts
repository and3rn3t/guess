import { type Env, jsonResponse, errorResponse, parseJsonBody, d1Run } from '../_helpers'

interface CorrectionVote {
  attribute: string
  currentValue: boolean | null
  suggestedValue: boolean
  userId: string
  createdAt: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  const db = context.env.GUESS_DB
  if (!kv) return errorResponse('KV not configured', 503)

  // List all correction keys in KV
  const listed = await kv.list<CorrectionVote[]>({ prefix: 'corrections:' })
  if (listed.keys.length === 0) return jsonResponse({ items: [], total: 0 })

  // Fetch all correction arrays in parallel (cap at 100)
  const keys = listed.keys.slice(0, 100)
  const results = await Promise.all(
    keys.map(async (k) => {
      const raw = await kv.get<CorrectionVote[]>(k.name, 'json')
      const votes = Array.isArray(raw) ? raw : []
      return { characterId: k.name.replace('corrections:', ''), votes }
    })
  )

  // Filter to only characters with pending votes
  const withVotes = results.filter((r) => r.votes.length > 0)

  // Batch-lookup character names from D1
  let nameMap: Record<string, string> = {}
  if (db && withVotes.length > 0) {
    const ids = withVotes.map((r) => r.characterId)
    const placeholders = ids.map(() => '?').join(',')
    const rows = await db
      .prepare(`SELECT id, name FROM characters WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all<{ id: string; name: string }>()
    nameMap = Object.fromEntries((rows.results ?? []).map((r) => [r.id, r.name]))
  }

  // Build summary per character
  const items = withVotes.map(({ characterId, votes }) => {
    const byAttr = votes.reduce<Record<string, { yes: number; no: number }>>((acc, v) => {
      if (!acc[v.attribute]) acc[v.attribute] = { yes: 0, no: 0 }
      if (v.suggestedValue) acc[v.attribute].yes += 1
      else acc[v.attribute].no += 1
      return acc
    }, {})

    return {
      characterId,
      name: nameMap[characterId] ?? characterId,
      totalVotes: votes.length,
      attributes: Object.entries(byAttr).map(([attr, counts]) => ({
        attribute: attr,
        yesVotes: counts.yes,
        noVotes: counts.no,
        net: counts.yes - counts.no,
      })),
    }
  })

  return jsonResponse({ items, total: items.length })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  const db = context.env.GUESS_DB
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<{ action?: string; characterId?: string }>(context.request)
  if (!body?.action || !body?.characterId) return errorResponse('Missing action or characterId', 400)

  const { action, characterId } = body
  const key = `corrections:${characterId}`

  if (action === 'dismiss') {
    await kv.delete(key)
    return jsonResponse({ ok: true, action: 'dismissed', characterId })
  }

  if (action === 'apply') {
    const raw = await kv.get<CorrectionVote[]>(key, 'json')
    const votes = Array.isArray(raw) ? raw : []
    if (votes.length === 0) return errorResponse('No corrections found', 404)

    // Aggregate net votes per attribute; apply where net > 0
    const byAttr: Record<string, { yes: number; no: number }> = {}
    for (const v of votes) {
      if (!byAttr[v.attribute]) byAttr[v.attribute] = { yes: 0, no: 0 }
      if (v.suggestedValue) byAttr[v.attribute].yes += 1
      else byAttr[v.attribute].no += 1
    }

    const toApply = Object.entries(byAttr).filter(([, c]) => c.yes > c.no)
    if (toApply.length === 0) return jsonResponse({ ok: true, applied: 0, message: 'No majority corrections to apply' })

    if (db) {
      await Promise.all(
        toApply.map(([attr]) =>
          d1Run(
            db,
            `INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence) VALUES (?, ?, 1, 0.75)`,
            [characterId, attr]
          )
        )
      )
    }

    await kv.delete(key)
    return jsonResponse({ ok: true, applied: toApply.length, characterId })
  }

  return errorResponse('Unknown action', 400)
}
