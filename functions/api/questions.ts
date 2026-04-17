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
} from './_helpers'

interface StoredQuestion {
  id: string
  text: string
  attribute: string
  createdBy: string
  createdAt: number
}

const KV_KEY = 'global:questions'
const MAX_PER_HOUR = 10

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const questions = await kvGetArray<StoredQuestion>(kv, KV_KEY)
  return jsonResponse(questions)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.GUESS_KV
  if (!kv) return errorResponse('KV not configured', 503)

  const body = await parseJsonBody<{
    text?: string
    attribute?: string
  }>(context.request)

  if (!body) return errorResponse('Invalid JSON body', 400)

  try {
    const text = validateString(body.text, 'text', 10, 200)
    const attribute = validateString(body.attribute, 'attribute', 2, 50)

    // Validate attribute is camelCase (letters only, starts lowercase)
    if (!/^[a-z][a-zA-Z]*$/.test(attribute)) {
      return errorResponse('Attribute must be camelCase (letters only)', 400)
    }

    const userId = getUserId(context.request)
    const { allowed } = await checkRateLimit(kv, userId, 'questions', MAX_PER_HOUR)
    if (!allowed) return errorResponse('Rate limit exceeded', 429)

    // Duplicate check by attribute
    const existing = await kvGetArray<StoredQuestion>(kv, KV_KEY)
    if (existing.some((q) => q.attribute === attribute)) {
      return errorResponse(`Question for attribute "${attribute}" already exists`, 409)
    }

    const question: StoredQuestion = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      attribute,
      createdBy: userId,
      createdAt: Date.now(),
    }

    existing.push(question)
    await kvPut(kv, KV_KEY, existing)

    return jsonResponse(question, 201)
  } catch (err) {
    if (err instanceof ValidationError) return errorResponse(err.message, 400)
    console.error('Questions API error:', err)
    return errorResponse('Internal server error', 500)
  }
}
