import { defineHandler } from './_handler'
import {
  ValidationError,
  errorResponse,
  jsonResponse,
  kvGetArray,
  kvPut,
  parseJsonBody,
  validateString,
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

export const onRequestGet = defineHandler(
  { name: 'questions', requireUser: false },
  async ({ env }) => {
    const questions = await kvGetArray<StoredQuestion>(env.GUESS_KV, KV_KEY)
    const response = jsonResponse(questions)
    const res = new Response(response.body, response)
    Object.entries(DEPRECATION_HEADERS).forEach(([k, v]) =>
      res.headers.set(k, v),
    )
    return res
  },
)

export const onRequestPost = defineHandler(
  { name: 'questions', rateLimit: MAX_PER_HOUR },
  async ({ env, request, userId }) => {
    const body = await parseJsonBody<{
      text?: string
      attribute?: string
    }>(request)

    if (!body) return errorResponse('Invalid JSON body', 400)

    let text: string
    let attribute: string
    try {
      text = validateString(body.text, 'text', 10, 200)
      attribute = validateString(body.attribute, 'attribute', 2, 50)
    } catch (err) {
      if (err instanceof ValidationError) return errorResponse(err.message, 400)
      throw err
    }

    if (!/^[a-z][a-zA-Z]*$/.test(attribute)) {
      return errorResponse('Attribute must be camelCase (letters only)', 400)
    }

    const kv = env.GUESS_KV
    const existing = await kvGetArray<StoredQuestion>(kv, KV_KEY)
    if (existing.some((q) => q.attribute === attribute)) {
      return errorResponse(
        `Question for attribute "${attribute}" already exists`,
        409,
      )
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
  },
)
