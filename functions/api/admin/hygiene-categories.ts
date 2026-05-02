import {
  checkRateLimitBestEffort,
  type Env,
  errorResponse,
  getActorId,
  getCompletionsEndpoint,
  getLlmHeaders,
  getRequestId,
  jsonResponse,
  logError,
  parseJsonBodyWithSchema,
  withRequestId,
} from '../_helpers'
import { z } from 'zod'

const CharacterCategorySchema = z.enum([
  'video-games',
  'movies',
  'anime',
  'comics',
  'books',
  'cartoons',
  'tv-shows',
  'pop-culture',
])

const AttributeValueSchema = z.union([z.boolean(), z.null()])

const BodySchema = z.object({
  characterId: z.string().min(1).max(120),
  characterName: z.string().min(1).max(200),
  currentCategory: CharacterCategorySchema,
  attributes: z.record(z.string(), AttributeValueSchema),
})

const SuggestionSchema = z.object({
  suggestedCategory: CharacterCategorySchema,
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().min(1).max(500).optional(),
})

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)
  const path = new URL(request.url).pathname

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.hygiene.categories', 60)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))

  if (!env.OPENAI_API_KEY) return respond(errorResponse('OpenAI not configured', 503))

  const parsed = await parseJsonBodyWithSchema(request, BodySchema)
  if (!parsed.success) return respond(parsed.response)

  const { characterId, characterName, currentCategory, attributes } = parsed.data

  const attributeDisplay = Object.entries(attributes)
    .slice(0, 300)
    .map(([key, value]) => {
      let valueStr = 'UNKNOWN'
      if (value === true) valueStr = 'YES'
      if (value === false) valueStr = 'NO'
      return `- ${key}: ${valueStr}`
    })
    .join('\n')

  const prompt = `You are classifying a character into one catalog category.

Character:
- id: ${characterId}
- name: ${characterName}
- currentCategory: ${currentCategory}

Attributes:
${attributeDisplay || '- (none)'}

Valid categories:
- video-games
- movies
- anime
- comics
- books
- cartoons
- tv-shows
- pop-culture

Rules:
1) If uncertain, keep the current category.
2) Return only one category.
3) confidence is 0.0 to 1.0.

Return ONLY JSON in this exact shape:
{
  "suggestedCategory": "movies",
  "confidence": 0.8,
  "reasoning": "Short reason"
}`

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: 'POST',
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      context.waitUntil(
        logError(
          env.GUESS_DB,
          'admin.hygiene.categories',
          'error',
          `OpenAI error ${response.status}`,
          undefined,
          { requestId, actorId, path, method: request.method, status: response.status },
        ),
      )
      return respond(errorResponse(`OpenAI error: ${response.status}`, 502))
    }

    const data: { choices?: Array<{ message?: { content?: string } }> } = await response.json()
    const content = data.choices?.[0]?.message?.content ?? '{}'
    const json = JSON.parse(content) as unknown
    const safe = SuggestionSchema.safeParse(json)

    if (!safe.success) {
      return respond(jsonResponse({ suggestion: null }))
    }

    return respond(jsonResponse({
      suggestion: {
        characterId,
        characterName,
        currentCategory,
        suggestedCategory: safe.data.suggestedCategory,
        confidence: safe.data.confidence ?? 0.8,
        reasoning: safe.data.reasoning ?? 'Server-side category recommendation',
      },
    }))
  } catch (err) {
    context.waitUntil(
      logError(
        env.GUESS_DB,
        'admin.hygiene.categories',
        'error',
        'Category suggestion request failed',
        err,
        { requestId, actorId, path, method: request.method },
      ),
    )
    return respond(errorResponse(`Category suggestion failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 500))
  }
}