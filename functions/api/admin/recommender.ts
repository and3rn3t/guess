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

const AttributeValueSchema = z.union([z.boolean(), z.null()])

const BodySchema = z.object({
  characterName: z.string().min(1).max(120),
  existingAttributes: z.record(z.string(), AttributeValueSchema),
  availableAttributes: z.array(z.object({
    key: z.string().min(1).max(120),
    label: z.string().min(1).max(160),
  })).max(400),
  maxRecommendations: z.number().int().min(1).max(30).optional(),
  focusDescription: z.string().min(1).max(200).optional(),
})

const RecommendationSchema = z.object({
  attribute: z.string().min(1),
  label: z.string().min(1),
  reason: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']),
})

type Recommendation = z.infer<typeof RecommendationSchema>

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context
  const requestId = getRequestId(request)
  const actorId = getActorId(request)
  const path = new URL(request.url).pathname

  const respond = (response: Response): Response => withRequestId(response, requestId)

  const rate = await checkRateLimitBestEffort(env, actorId, 'admin.recommender', 60)
  if (!rate.allowed) return respond(errorResponse('Rate limit exceeded', 429))

  if (!env.OPENAI_API_KEY) return respond(errorResponse('OpenAI not configured', 503))

  const parsed = await parseJsonBodyWithSchema(request, BodySchema)
  if (!parsed.success) return respond(parsed.response)

  const {
    characterName,
    existingAttributes,
    availableAttributes,
    maxRecommendations = 10,
    focusDescription,
  } = parsed.data

  if (availableAttributes.length === 0) {
    return respond(jsonResponse({ recommendations: [] }))
  }

  const existingAttrDisplay = Object.entries(existingAttributes)
    .slice(0, 300)
    .map(([key, value]) => {
      const valueStr = value === true ? 'YES' : value === false ? 'NO' : 'MAYBE'
      return `  - ${key}: ${valueStr}`
    })
    .join('\n')

  const availableAttrDisplay = availableAttributes
    .map(({ key, label }) => `  - ${label} (${key})`)
    .join('\n')

  const prompt = `You are an expert character analyst for a character guessing game.

CHARACTER:
${characterName}

CURRENT ATTRIBUTES:
${existingAttrDisplay || '  (none)'}

AVAILABLE ATTRIBUTES TO CHOOSE FROM:
${availableAttrDisplay}

FOCUS:
${focusDescription ?? 'General character traits with high strategic value in a guessing game'}

TASK:
Recommend up to ${maxRecommendations} attributes that should be added for this character.

REQUIREMENTS:
1. Accuracy first: only recommend attributes likely true for this character.
2. Prioritize discrimination value for a guessing game.
3. Provide specific, character-aware reasons.
4. Return a mix of high/medium/low priorities when appropriate.

Return ONLY JSON in this shape:
{
  "recommendations": [
    {
      "attribute": "attribute_key",
      "label": "Human Readable Label",
      "reason": "Specific explanation",
      "priority": "high" | "medium" | "low"
    }
  ]
}`

  try {
    const response = await fetch(getCompletionsEndpoint(env), {
      method: 'POST',
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      context.waitUntil(
        logError(
          env.GUESS_DB,
          'admin.recommender',
          'error',
          `OpenAI error ${response.status}`,
          undefined,
          { requestId, actorId, path, method: request.method, status: response.status },
        ),
      )
      return respond(errorResponse(`OpenAI error: ${response.status}`, 502))
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content ?? '{}'
    const json = JSON.parse(content) as { recommendations?: unknown[] }
    const safe = z.array(RecommendationSchema).safeParse(json.recommendations ?? [])

    const recommendations: Recommendation[] = safe.success
      ? safe.data.slice(0, maxRecommendations)
      : []

    return respond(jsonResponse({ recommendations }))
  } catch (err) {
    context.waitUntil(
      logError(
        env.GUESS_DB,
        'admin.recommender',
        'error',
        'Recommender request failed',
        err,
        { requestId, actorId, path, method: request.method },
      ),
    )
    return respond(errorResponse(`Recommendation failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 500))
  }
}
