import type { Character, Question } from './types'
import { llm } from './llm'
import { GeneratedQuestionSchema } from './schemas'
import { z } from 'zod'

// ── Schemas for metadata-rich generation ──────────────────────────────────

const GeneratedQuestionWithMetadataSchema = z.object({
  attribute: z.string(),
  text: z.string(),
  theme: z.enum(['visual', 'ability', 'personality', 'relationship', 'origin', 'franchise', 'stat']).default('ability'),
  difficulty_tag: z.enum(['easy', 'medium', 'hard']).default('medium'),
  surprise_factor_estimate: z.number().min(0).max(1).default(0.5), // predicted likelihood of >50% info gain
  reasoning: z.string().optional(), // why this question is good for this attribute
})

export async function analyzeAndGenerateQuestions(
  characters: Character[],
  existingQuestions: Question[]
): Promise<{ newQuestions: Question[]; reasoning: string }> {
  const existingAttributes = new Set(existingQuestions.map((q) => q.attribute))

  const allAttributes = new Set<string>()
  characters.forEach((char) => {
    Object.keys(char.attributes).forEach((attr) => allAttributes.add(attr))
  })

  const newAttributes = Array.from(allAttributes).filter((attr) => !existingAttributes.has(attr))

  if (newAttributes.length === 0) {
    return {
      newQuestions: [],
      reasoning: 'No new attributes found in the character database.',
    }
  }

  const attributeStats = analyzeAttributeDistribution(characters, newAttributes)

  const goodAttributes = attributeStats.filter(
    (stat) => stat.distribution > 0.1 && stat.distribution < 0.9 && stat.coverage > 0.5
  )

  if (goodAttributes.length === 0) {
    return {
      newQuestions: [],
      reasoning:
        'New attributes found, but they are not useful for discrimination (too uniform or too rare).',
    }
  }

  const questionsToGenerate = goodAttributes.slice(0, 5)

  const attributeList = questionsToGenerate
    .map(
      (attr) =>
        `- ${attr.attribute} (${Math.round(attr.distribution * 100)}% of characters have this trait)`
    )
    .join('\n')

  const prompt = `You are a question generator for a character guessing game like Akinator.

Given the following attribute names from characters that users have taught me, generate natural, clear yes/no questions that would help identify these characters.

Attributes to create questions for:
${attributeList}

Requirements:
1. Each question should be clear and answerable with yes, no, maybe, or unknown
2. Questions should feel natural and conversational
3. Questions should avoid technical jargon
4. Questions should be specific enough to be useful for discrimination

Return a JSON object with a "questions" property containing an array of objects with "attribute" and "text" fields.

Example format:
{
  "questions": [
    {"attribute": "hasWings", "text": "Does this character have wings?"},
    {"attribute": "livesInWater", "text": "Does this character live in water?"}
  ]
}`

  try {
    const response = await llm(prompt, 'gpt-4o-mini', true)
    const parsed = JSON.parse(response)

    const questionsResult = z.array(GeneratedQuestionSchema).safeParse(parsed.questions)
    if (!questionsResult.success) {
      throw new Error('Invalid response format')
    }

    const newQuestions: Question[] = questionsResult.data.map((q, index) => ({
      id: `generated-${Date.now()}-${index}`,
      text: q.text,
      attribute: q.attribute,
    }))

    const reasoning = `Discovered ${newAttributes.length} new attributes from user-taught characters. Generated ${newQuestions.length} high-quality questions that will help discriminate between ${Math.round(questionsToGenerate.reduce((sum, attr) => sum + attr.distribution, 0) / questionsToGenerate.length * 100)}% of the character pool on average.`

    return { newQuestions, reasoning }
  } catch (error) {
    console.error('Error generating questions:', error)
    return {
      newQuestions: [],
      reasoning: 'Failed to generate questions due to an error.',
    }
  }
}

function analyzeAttributeDistribution(
  characters: Character[],
  attributes: string[]
): Array<{ attribute: string; distribution: number; coverage: number }> {
  return attributes.map((attr) => {
    let trueCount = 0
    let falseCount = 0
    characters.forEach((char) => {
      const value = char.attributes[attr]
      if (value === true) trueCount++
      else if (value === false) falseCount++
    })

    const total = characters.length
    const coverage = (trueCount + falseCount) / total
    const distribution = Math.min(trueCount, falseCount) / total

    return { attribute: attr, distribution, coverage }
  })
}

export function getQuestionGenerationInsight(
  characters: Character[],
  existingQuestions: Question[]
): string {
  const existingAttributes = new Set(existingQuestions.map((q) => q.attribute))

  const allAttributes = new Set<string>()
  characters.forEach((char) => {
    Object.keys(char.attributes).forEach((attr) => allAttributes.add(attr))
  })

  const newAttributes = Array.from(allAttributes).filter((attr) => !existingAttributes.has(attr))

  if (newAttributes.length === 0) {
    return 'All character attributes are covered by existing questions.'
  }

  const attributeStats = analyzeAttributeDistribution(characters, newAttributes)
  const goodAttributes = attributeStats.filter(
    (stat) => stat.distribution > 0.1 && stat.distribution < 0.9 && stat.coverage > 0.5
  )

  return `${goodAttributes.length} new discriminating attributes discovered from ${characters.length} characters. These could generate ${goodAttributes.length} useful questions.`
}

// ── Targeted generation for audit gaps (Phase 2 expansion) ────────────────────

export interface GeneratedQuestionWithMetadata {
  attribute: string
  text: string
  theme: 'visual' | 'ability' | 'personality' | 'relationship' | 'origin' | 'franchise' | 'stat'
  difficulty_tag: 'easy' | 'medium' | 'hard'
  surprise_factor_estimate: number
  reasoning?: string
}

/**
 * Generate multiple question variants for specific attributes with metadata synthesis.
 * Used by Phase 2 to fill gaps identified in attribute audit.
 *
 * @param targetAttributes - Attributes to generate questions for (from audit)
 * @param characters - Full character pool for distribution analysis
 * @param questionsPerAttribute - Number of variants per attribute (default 2-3)
 * @returns Array of rich questions with theme, difficulty, and quality estimates
 */
export async function generateQuestionsForAttributeGaps(
  targetAttributes: Array<{ key: string; characterCount: number; distribution: number }>,
  characters: Character[],
  questionsPerAttribute: number = 2
): Promise<{ questions: GeneratedQuestionWithMetadata[]; reasoning: string }> {
  if (targetAttributes.length === 0) {
    return { questions: [], reasoning: 'No target attributes provided.' }
  }

  const totalChars = characters.length
  const attributeList = targetAttributes
    .map(
      (attr) =>
        `- ${attr.key} (${attr.characterCount} characters, ${(attr.distribution * 100).toFixed(1)}% distribution)`
    )
    .join('\n')

  const prompt = `You are a senior question designer for a character guessing game (like Akinator).

Your task: Generate ${questionsPerAttribute} question variants per attribute. Each variant should:
1. Target the attribute effectively
2. Have different phrasing/angle to capture nuance
3. Be labeled with theme (ability|personality|visual|origin|relationship|stat|franchise)
4. Be tagged with difficulty (easy|medium|hard based on how obvious the answer is)
5. Include a surprise_factor estimate (0-1, likelihood of high info gain in games)

Context:
- Characters in our pool: ${totalChars}
- These attributes need coverage (gaps identified):

${attributeList}

Return ONLY valid JSON with no markdown, no explanation:

{
  "questions": [
    {
      "attribute": "attributeName",
      "text": "Your question here?",
      "theme": "ability",
      "difficulty_tag": "medium",
      "surprise_factor_estimate": 0.6,
      "reasoning": "Optional: why this variant is useful"
    }
  ]
}

Quality criteria:
- Questions must be phrased naturally (no jargon)
- Avoid yes-only questions (must accommodate yes/no/maybe)
- High surprise_factor (0.7+) for discriminating questions
- Variants should differ in framing (e.g., "Has X trait?" vs "Is X known for Y?" vs "Would you say X?")
- Theme should reflect the attribute's semantic nature
- Difficulty should match how obvious the correct answer is`

  try {
    const response = await llm(prompt, 'gpt-4o-mini', true)
    const parsed = JSON.parse(response)

    const questionsResult = z.array(GeneratedQuestionWithMetadataSchema).safeParse(parsed.questions)
    if (!questionsResult.success) {
      console.error('Validation errors:', questionsResult.error)
      throw new Error('Invalid response format from LLM')
    }

    const questions = questionsResult.data.map((q) => ({
      ...q,
      // Ensure surprise_factor_estimate is in valid range
      surprise_factor_estimate: Math.min(1, Math.max(0, q.surprise_factor_estimate)),
    }))

    const reasoning = `Generated ${questions.length} question variants for ${targetAttributes.length} gap attributes. ${questions.filter((q) => q.surprise_factor_estimate >= 0.7).length} questions estimated high-surprise (likely high info gain).`

    return { questions, reasoning }
  } catch (error) {
    console.error('Error generating targeted questions:', error)
    return {
      questions: [],
      reasoning: `Failed to generate questions: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}
