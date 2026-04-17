import { llm } from '@/lib/llm'
import { dataCleanup_v1, sanitizeForPrompt } from '@/lib/prompts'
import type { Character, Question, CharacterCategory } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttributeIssue {
  characterId: string
  characterName: string
  type: 'contradiction' | 'likely-incorrect' | 'missing-critical'
  attribute: string
  currentValue: boolean | null
  suggestedValue: boolean | null
  reason: string
}

export interface DuplicateGroup {
  canonical: Character
  duplicates: Character[]
  confidence: number
}

export interface QuestionScore {
  questionId: string
  questionText: string
  scores: { clarity: number; power: number; grammar: number }
  rewrite?: string
}

export interface CategorySuggestion {
  characterId: string
  characterName: string
  currentCategory: CharacterCategory
  suggestedCategory: CharacterCategory
  confidence: number
  reasoning: string
}

// ---------------------------------------------------------------------------
// 8.1 Attribute Validation
// ---------------------------------------------------------------------------

export async function validateCharacterAttributes(
  character: Character
): Promise<AttributeIssue[]> {
  const { system, user } = dataCleanup_v1(
    [{ name: character.name, id: character.id }],
    'attributes'
  )

  try {
    const response = await llm(`${system}\n\n${user}\n\nCharacter attributes: ${JSON.stringify(character.attributes)}`, 'gpt-4o-mini', true)
    const parsed = JSON.parse(response) as {
      issues: Array<{
        characterId: string
        attribute: string
        currentValue: boolean | null
        suggestedValue: boolean | null
        reason: string
      }>
    }

    return parsed.issues.map((issue) => ({
      ...issue,
      characterName: character.name,
      type: 'likely-incorrect' as const,
    }))
  } catch {
    return []
  }
}

export async function validateAllCharacters(
  characters: Character[],
  onProgress?: (done: number, total: number) => void
): Promise<AttributeIssue[]> {
  const results: AttributeIssue[] = []

  for (let i = 0; i < characters.length; i++) {
    const issues = await validateCharacterAttributes(characters[i])
    results.push(...issues)
    onProgress?.(i + 1, characters.length)

    // Rate limiting: 500ms between calls
    if (i < characters.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// 8.2 Character Deduplication
// ---------------------------------------------------------------------------

function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[\s\-_.'":!?]/g, '')
    .trim()
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => {
      if (i === 0) return j
      if (j === 0) return i
      return 0
    })
  )

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[a.length][b.length]
}

export function findDuplicateCandidates(characters: Character[]): Array<[Character, Character]> {
  const pairs: Array<[Character, Character]> = []

  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const a = normalizeForComparison(characters[i].name)
      const b = normalizeForComparison(characters[j].name)

      if (a === b || levenshteinDistance(a, b) < 3) {
        pairs.push([characters[i], characters[j]])
      }
    }
  }

  return pairs
}

export async function findDuplicates(
  characters: Character[],
  onProgress?: (done: number, total: number) => void
): Promise<DuplicateGroup[]> {
  const candidates = findDuplicateCandidates(characters)
  const groups: DuplicateGroup[] = []

  for (let i = 0; i < candidates.length; i++) {
    const [a, b] = candidates[i]

    try {
      const { system, user } = dataCleanup_v1(
        [{ name: a.name, id: a.id }, { name: b.name, id: b.id }],
        'duplicates'
      )
      const response = await llm(`${system}\n\n${user}`, 'gpt-4o-mini', true)
      const parsed = JSON.parse(response) as {
        groups: Array<{ canonical: string; duplicates: string[] }>
      }

      if (parsed.groups.length > 0) {
        const group = parsed.groups[0]
        const canonical = group.canonical === a.id ? a : b
        const dupes = group.canonical === a.id ? [b] : [a]
        groups.push({ canonical, duplicates: dupes, confidence: 0.9 })
      }
    } catch {
      // Skip this pair
    }

    onProgress?.(i + 1, candidates.length)

    if (i < candidates.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return groups
}

// ---------------------------------------------------------------------------
// 8.3 Question Quality Scoring
// ---------------------------------------------------------------------------

export async function scoreQuestions(
  questions: Question[],
  onProgress?: (done: number, total: number) => void
): Promise<QuestionScore[]> {
  const results: QuestionScore[] = []
  const batchSize = 10

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize)
    const questionList = batch
      .map((q) => `- [${q.id}] "${sanitizeForPrompt(q.text)}" (attribute: ${q.attribute})`)
      .join('\n')

    const prompt = `Rate these yes/no questions for a character guessing game on three dimensions (1-5 each):
- Clarity: Is the question unambiguous?
- Discriminative power: Does it effectively split the character space?
- Grammar/naturalness: Does it sound natural?

If any score < 3, suggest a rewrite.

Questions:
${questionList}

Return JSON: { "scores": [{ "questionId": "id", "clarity": 1-5, "power": 1-5, "grammar": 1-5, "rewrite": "optional improved text" }] }`

    try {
      const response = await llm(prompt, 'gpt-4o-mini', true)
      const parsed = JSON.parse(response) as {
        scores: Array<{
          questionId: string
          clarity: number
          power: number
          grammar: number
          rewrite?: string
        }>
      }

      for (const score of parsed.scores) {
        const q = batch.find((b) => b.id === score.questionId)
        if (q) {
          results.push({
            questionId: q.id,
            questionText: q.text,
            scores: { clarity: score.clarity, power: score.power, grammar: score.grammar },
            rewrite: score.rewrite,
          })
        }
      }
    } catch {
      // Skip batch on failure
    }

    onProgress?.(Math.min(i + batchSize, questions.length), questions.length)

    if (i + batchSize < questions.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// 8.4 Auto-Categorization
// ---------------------------------------------------------------------------

export async function categorizeCharacter(
  character: Character
): Promise<CategorySuggestion | null> {
  const { system, user } = dataCleanup_v1(
    [{ name: character.name, id: character.id }],
    'categorization'
  )

  try {
    const response = await llm(
      `${system}\n\n${user}\n\nCharacter attributes: ${JSON.stringify(character.attributes)}`,
      'gpt-4o-mini',
      true
    )
    const parsed = JSON.parse(response) as {
      suggestions: Array<{
        characterId: string
        suggestedCategory: CharacterCategory
      }>
    }

    if (parsed.suggestions.length > 0) {
      const suggestion = parsed.suggestions[0]
      return {
        characterId: character.id,
        characterName: character.name,
        currentCategory: character.category,
        suggestedCategory: suggestion.suggestedCategory,
        confidence: 0.8,
        reasoning: `LLM suggested ${suggestion.suggestedCategory} based on character attributes`,
      }
    }
  } catch {
    // Return null on failure
  }

  return null
}

export async function categorizeAllCharacters(
  characters: Character[],
  onProgress?: (done: number, total: number) => void
): Promise<CategorySuggestion[]> {
  const results: CategorySuggestion[] = []

  for (let i = 0; i < characters.length; i++) {
    const suggestion = await categorizeCharacter(characters[i])
    if (suggestion && suggestion.suggestedCategory !== characters[i].category) {
      results.push(suggestion)
    }
    onProgress?.(i + 1, characters.length)

    if (i < characters.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return results
}
