import { getCompletionsEndpoint, getLlmHeaders, type Env } from '../_helpers'
import type { Answer, ServerQuestion, ReasoningExplanation } from './_game-engine'

/**
 * Rephrase a static question into a conversational, context-aware version
 * using gpt-4o-mini. Returns null on any failure so callers can fall back
 * to the original question text.
 *
 * @param questionLookup - Optional map of attribute → question text so that the
 *   rephrasing prompt can reference recent questions by their human-readable text
 *   rather than raw camelCase attribute keys.
 */
export async function rephraseQuestion(
  env: Env,
  question: ServerQuestion,
  answers: Answer[],
  reasoning: ReasoningExplanation,
  questionNumber: number,
  maxQuestions: number,
  questionLookup?: Map<string, string>,
): Promise<string | null> {
  if (!env.OPENAI_API_KEY) return null

  try {
    const recentContext = answers
      .slice(-5)
      .map((a) => {
        const text = questionLookup?.get(a.questionId) ?? a.questionId
        return `Q: "${text}" → ${a.value}`
      })
      .join('\n')

    // Only expose top suspects in the second half of the game to avoid biasing
    // early questions toward whichever character floats to the top prematurely.
    const progress = questionNumber / maxQuestions
    const candidateHint =
      progress >= 0.5 && reasoning.topCandidates && reasoning.topCandidates.length > 0
        ? `\nTop suspects: ${reasoning.topCandidates.map((c) => c.name).join(', ')}`
        : ''

    let tone = 'curious and exploratory'
    if (progress > 0.7) tone = 'confident and closing in'
    else if (progress > 0.4) tone = 'strategic and focused'

    const systemPrompt = `You are the AI guesser in a 20-questions character guessing game. Rephrase the given yes/no question to sound natural, conversational, and engaging — like a curious detective narrowing down suspects.

Rules:
- Keep the same yes/no intent targeting the same attribute
- Under 120 characters
- Don't mention attribute names or internal logic
- Sound ${tone}
- Build on recent answers when possible (e.g., "Since they're human, do they...")
- Vary sentence structure — don't always start the same way
- Return ONLY valid JSON: { "text": "rephrased question" }`

    const userPrompt = `Original: "${question.text}"
Attribute: "${question.attribute}"
Question ${questionNumber} of ${maxQuestions}
${recentContext ? `\nRecent answers:\n${recentContext}` : '\nThis is the first question.'}${candidateHint}
Confidence: ${reasoning.confidence}%

Rephrase this question.`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(getCompletionsEndpoint(env), {
      method: 'POST',
      headers: getLlmHeaders(env),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 100,
        temperature: 0.6,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) return null

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }

    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return null

    // Strip markdown code fences if present
    const cleaned = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(cleaned) as { text: string }
    const rephrased = parsed.text?.trim()

    // Basic sanity: must be a question, not too long, not empty
    if (!rephrased || rephrased.length > 150) return null

    return rephrased
  } catch {
    return null
  }
}

// ── KV-cached rephrase for first questions ───────────────────────────────────
// The first question (answers.length === 0) has no game context, so the rephrased
// text is safe to reuse across sessions. Storing it avoids LLM calls on cache hits.

const REPHRASE_ATTR_PREFIX = 'rephrase:attr:'
const REPHRASE_ATTR_TTL = 86400 // 24 hours

/** Like rephraseQuestion but caches the result in KV when there are no answers yet
 *  (context-free first question). On a cache hit the LLM call is skipped entirely. */
export async function rephraseQuestionWithCache(
  env: Env,
  kv: KVNamespace,
  question: ServerQuestion,
  answers: Answer[],
  reasoning: ReasoningExplanation,
  questionNumber: number,
  maxQuestions: number,
  questionLookup?: Map<string, string>,
): Promise<string | null> {
  const isCacheable = answers.length === 0

  if (isCacheable) {
    const cached = await kv.get(`${REPHRASE_ATTR_PREFIX}${question.attribute}`)
    if (cached) return cached
  }

  const rephrased = await rephraseQuestion(env, question, answers, reasoning, questionNumber, maxQuestions, questionLookup)

  if (rephrased && isCacheable) {
    // Fire-and-forget — not critical if it fails
    kv.put(`${REPHRASE_ATTR_PREFIX}${question.attribute}`, rephrased, { expirationTtl: REPHRASE_ATTR_TTL }).catch(() => {})
  }

  return rephrased
}
