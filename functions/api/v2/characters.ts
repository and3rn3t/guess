import {
  type Env,
  ValidationError,
  validateString,
  checkRateLimit,
  getUserId,
  parseJsonBody,
  jsonResponse,
  errorResponse,
  isValidCategory,
  d1Query,
  d1Run,
  d1First,
  d1Batch,
} from '../_helpers'
import type { CharactersRow, CharacterAttributesRow } from '../_db-types'

// ── Types ────────────────────────────────────────────────────

type CharacterRow = CharactersRow

type AttributeRow = Pick<CharacterAttributesRow, 'attribute_key' | 'value' | 'confidence'>

// ── GET /api/v2/characters ───────────────────────────────────
// Paginated, filterable by category, searchable by name

const CHARACTERS_CACHE_HEADERS = 'public, max-age=60, stale-while-revalidate=300'
const CHARACTERS_CACHE_TTL = 300 // 5 minutes

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  const kv = context.env.GUESS_KV
  if (!db) return errorResponse('D1 not configured', 503)

  const url = new URL(context.request.url)
  const category = url.searchParams.get('category')
  const search = url.searchParams.get('search')
  const id = url.searchParams.get('id')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0)

  // Single character by ID — include attributes
  if (id) {
    const char = await d1First<CharacterRow>(db, 'SELECT * FROM characters WHERE id = ?', [id])
    if (!char) return errorResponse('Character not found', 404)

    const attrs = await d1Query<AttributeRow>(
      db,
      'SELECT attribute_key, value, confidence FROM character_attributes WHERE character_id = ?',
      [id]
    )

    const attributes: Record<string, boolean | null> = {}
    for (const a of attrs) {
      attributes[a.attribute_key] = a.value === 1 ? true : a.value === 0 ? false : null
    }

    return jsonResponse({ ...char, attributes })
  }

  // List characters with filters
  const conditions: string[] = []
  const params: unknown[] = []

  if (category && isValidCategory(category)) {
    conditions.push('category = ?')
    params.push(category)
  }

  if (search && search.length >= 2) {
    // Use FTS5 index for fast full-text prefix search (no leading-wildcard table scan)
    // Append '*' for prefix matching so "bat" finds "Batman", "Batgirl", etc.
    conditions.push('c.rowid IN (SELECT rowid FROM characters_fts WHERE name MATCH ?)')
    params.push(`${search}*`)
  }

  // KV cache: unfiltered default-pagination list only (most common request)
  const isDefaultList = !category && !search && offset === 0 && limit === 50
  const cacheKey = 'cache:characters:list'
  if (isDefaultList && kv) {
    const cached = await kv.get(cacheKey)
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': CHARACTERS_CACHE_HEADERS,
        },
      })
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = await d1First<{ total: number }>(
    db,
    `SELECT COUNT(*) as total FROM characters ${where}`,
    params
  )
  const total = countRow?.total ?? 0

  const characters = await d1Query<CharacterRow>(
    db,
    `SELECT * FROM characters ${where} ORDER BY popularity DESC, name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  const result = { characters, total, limit, offset }
  const json = JSON.stringify(result)

  // Store in KV cache (unfiltered default list only)
  if (isDefaultList && kv) {
    context.waitUntil(
      kv.put(cacheKey, json, { expirationTtl: CHARACTERS_CACHE_TTL })
    )
  }

  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': CHARACTERS_CACHE_HEADERS,
    },
  })
}

// Create a new character with attributes

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  const kv = context.env.GUESS_KV
  if (!db) return errorResponse('D1 not configured', 503)
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<{
    name?: string
    category?: string
    attributes?: Record<string, boolean | null>
    description?: string
  }>(context.request)

  if (!body) return errorResponse('Invalid JSON body', 400)

  try {
    const name = validateString(body.name, 'name', 2, 50)
    if (!body.category || !isValidCategory(body.category)) {
      return errorResponse('Invalid category', 400)
    }
    const category = body.category

    const attributes = body.attributes
    if (!attributes || typeof attributes !== 'object') {
      return errorResponse('Missing or invalid "attributes"', 400)
    }

    const nonNullCount = Object.values(attributes).filter((v) => v !== null).length
    if (nonNullCount < 5) {
      return errorResponse('Character must have at least 5 non-null attributes', 400)
    }

    // Rate limit
    const userId = getUserId(context.request)
    const { allowed } = await checkRateLimit(kv, userId, 'characters-v2', 5)
    if (!allowed) return errorResponse('Rate limit exceeded. Try again later.', 429)

    // Duplicate check
    const existing = await d1First<{ id: string }>(
      db,
      'SELECT id FROM characters WHERE LOWER(name) = LOWER(?)',
      [name]
    )
    if (existing) return errorResponse(`Character "${name}" already exists`, 409)

    // Create character
    const id = `char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const description = body.description ? validateString(body.description, 'description', 0, 2000) : null

    await d1Run(
      db,
      `INSERT INTO characters (id, name, category, source, is_custom, created_by, description)
       VALUES (?, ?, ?, 'user', 1, ?, ?)`,
      [id, name, category, userId, description]
    )

    // Insert attributes
    const attrStatements = Object.entries(attributes).map(([key, value]) => ({
      sql: 'INSERT INTO character_attributes (character_id, attribute_key, value, confidence) VALUES (?, ?, ?, 1.0)',
      params: [id, key, value === true ? 1 : value === false ? 0 : null] as unknown[],
    }))

    if (attrStatements.length > 0) {
      await d1Batch(db, attrStatements)
    }

    return jsonResponse({ id, name, category, description }, 201)
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400)
    }
    console.error('POST /api/v2/characters error:', err)
    return errorResponse('Internal error', 500)
  }
}
