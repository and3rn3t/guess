import type { Character, Question } from './types'
import { llm } from './llm'

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

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response format')
    }

    const newQuestions: Question[] = parsed.questions.map((q: Record<string, string>, index: number) => ({
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
