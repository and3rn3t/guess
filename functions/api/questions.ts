import {
  type Env,
  ValidationError,
  validateString,
  checkRateLimit,
  getOrCreateUserId,
  withSetCookie,
  parseJsonBody,
  jsonResponse,
  errorResponse,
  kvGetArray,
  kvPut,
} from './_helpers'

const DEPRECATION_HEADERS = {
  Deprecation: 'true',
  Sunset: 'Wed, 01 Jan 2027 00:00:00 GMT',
  Link: '</api/v2/questions>; rel="successor-version"',
}

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
  const response = jsonResponse(questions)
  const res = new Response(response.body, response)
  Object.entries(DEPRECATION_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  return res
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

    const { userId, setCookieHeader } = await getOrCreateUserId(context.request, context.env)
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

    return withSetCookie(jsonResponse(question, 201), setCookieHeader)
  } catch (err) {
    if (err instanceof ValidationError) return errorResponse(err.message, 400)
    console.error('Questions API error:', err)
    return errorResponse('Internal server error', 500)
  }
}
