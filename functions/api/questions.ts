import { defineHandler } from './_handler'
import {
  errorResponse,
  jsonResponse,
  kvGetArray,
  kvPut,
  parseJsonBodyWithSchema,
} from './_helpers'
import { CreateQuestionRequestSchema } from './_schemas'
import { CreateQuestionRequestSchema } from './_schemas'

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
    const parsed = await parseJsonBodyWithSchema(request, CreateQuestionRequestSchema)
    if (!parsed.success) return parsed.response
    const { text, attribute } = parsed.data

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
