/**
 * GET /api/admin/matrix — character × attribute attribute matrix.
 *
 * Returns the top characters and their attribute values for a given category.
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const category = url.searchParams.get('category') ?? ''
  const charLimit = Math.min(50, Math.max(10, parseInt(url.searchParams.get('chars') ?? '30', 10)))
  const attrLimit = Math.min(80, Math.max(10, parseInt(url.searchParams.get('attrs') ?? '40', 10)))

  const categoryFilter = category && category !== 'all' ? 'AND c.category = ?' : ''
  const categoryParams: string[] = category && category !== 'all' ? [category] : []

  const [attrRows, charRows] = await Promise.all([
    // Top attributes by coverage (most filled)
    db.prepare(`
      SELECT ad.key, ad.display_text AS displayText
      FROM attribute_definitions ad
      WHERE ad.is_active = 1
      ORDER BY ad.key ASC
      LIMIT ?
    `).bind(attrLimit).all<{ key: string; displayText: string }>(),

    // Top characters by popularity
    db.prepare(`
      SELECT c.id, c.name, c.category, c.popularity
      FROM characters c
      WHERE 1=1
      ${categoryFilter}
      ORDER BY c.popularity DESC
      LIMIT ?
    `).bind(...categoryParams, charLimit).all<{ id: string; name: string; category: string; popularity: number }>(),
  ])

  const characters = charRows.results ?? []
  const attributes = attrRows.results ?? []

  if (characters.length === 0 || attributes.length === 0) {
    return jsonResponse({ characters: [], attributes: [], values: {} })
  }

  // Fetch all attribute values for these characters
  const charIds = characters.map((c) => c.id)
  const attrKeys = attributes.map((a) => a.key)

  // Build placeholders for IN clause
  const charPlaceholders = charIds.map(() => '?').join(',')
  const attrPlaceholders = attrKeys.map(() => '?').join(',')

  const valueRows = await db.prepare(`
    SELECT character_id, attribute_key, value
    FROM character_attributes
    WHERE character_id IN (${charPlaceholders})
      AND attribute_key IN (${attrPlaceholders})
  `).bind(...charIds, ...attrKeys).all<{ character_id: string; attribute_key: string; value: 0 | 1 | null }>()

  // Build lookup: values[charId][attrKey] = value
  const values: Record<string, Record<string, number | null>> = {}
  for (const row of (valueRows.results ?? [])) {
    if (!values[row.character_id]) values[row.character_id] = {}
    values[row.character_id][row.attribute_key] = row.value
  }

  return jsonResponse({ characters, attributes, values })
}
