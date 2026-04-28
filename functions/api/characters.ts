import { defineHandler } from './_handler'
import {
  errorResponse,
  jsonResponse,
  kvGetArray,
  kvPut,
  parseJsonBodyWithSchema,
} from './_helpers'
import { CreateCharacterRequestSchema } from './_schemas'

const DEPRECATION_HEADERS = {
  Deprecation: 'true',
  Sunset: 'Wed, 01 Jan 2027 00:00:00 GMT',
  Link: '</api/v2/characters>; rel="successor-version"',
}

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

export const onRequestGet = defineHandler(
  { name: 'characters', requireUser: false },
  async ({ env }) => {
    const characters = await kvGetArray<StoredCharacter>(env.GUESS_KV, KV_KEY)
    const response = jsonResponse(characters)
    const res = new Response(response.body, response)
    Object.entries(DEPRECATION_HEADERS).forEach(([k, v]) =>
      res.headers.set(k, v),
    )
    return res
  },
)

export const onRequestPost = defineHandler(
  { name: 'characters', rateLimit: MAX_PER_HOUR },
  async ({ env, request, userId }) => {
    const parsed = await parseJsonBodyWithSchema(request, CreateCharacterRequestSchema)
    if (!parsed.success) return parsed.response
    const { name, category, attributes } = parsed.data

    const kv = env.GUESS_KV
    const existing = await kvGetArray<StoredCharacter>(kv, KV_KEY)
    const duplicate = existing.find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) {
      return errorResponse(`Character "${name}" already exists`, 409)
    }

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
  },
)
