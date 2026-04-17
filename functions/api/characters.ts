import {
  type Env,
  ValidationError,
  validateString,
  checkRateLimit,
  getUserId,
  parseJsonBody,
  jsonResponse,
  errorResponse,
  kvGetArray,
  kvPut,
  isValidCategory,
} from './_helpers'

interface StoredCharacter {
  id: string
  name: string
  category: string
  attributes: Record<string, boolean | null>
  createdBy: string
  createdAt: number
}

const KV_KEY = 'global:characters'
const MAX_PER_HOUR = 5

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) {
    return errorResponse('KV not configured', 503)
  }

  const characters = await kvGetArray<StoredCharacter>(kv, KV_KEY)
  return jsonResponse(characters)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) {
    return errorResponse('KV not configured', 503)
  }

  const body = await parseJsonBody<{
    name?: string
    category?: string
    attributes?: Record<string, boolean | null>
  }>(context.request)

  if (!body) {
    return errorResponse('Invalid JSON body', 400)
  }

  try {
    const name = validateString(body.name, 'name', 2, 50)
    if (!body.category || !isValidCategory(body.category)) {
      return errorResponse('Invalid category', 400)
    }
    const category: string = body.category

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
    const { allowed } = await checkRateLimit(kv, userId, 'characters', MAX_PER_HOUR)
    if (!allowed) {
      return errorResponse('Rate limit exceeded. Try again later.', 429)
    }

    // Duplicate check
    const existing = await kvGetArray<StoredCharacter>(kv, KV_KEY)
    const duplicate = existing.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    )
    if (duplicate) {
      return errorResponse(`Character "${name}" already exists`, 409)
    }

    // Create character
    const character: StoredCharacter = {
      id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      category,
      attributes,
      createdBy: userId,
      createdAt: Date.now(),
    }

    existing.push(character)
    await kvPut(kv, KV_KEY, existing)

    return jsonResponse(character, 201)
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400)
    }
    console.error('Characters API error:', err)
    return errorResponse('Internal server error', 500)
  }
}
