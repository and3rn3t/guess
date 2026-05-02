import { httpClient } from '@/lib/http'
import type { Character, Question } from '@/lib/types'
import {
  findDuplicateCandidates,
  type AttributeIssue,
  type CategorySuggestion,
  type DuplicateGroup,
  type QuestionScore,
} from './dataCleanup'

interface HygieneAttributesResponse {
  issues: AttributeIssue[]
}

async function analyzeCharacterAttributes(character: Character): Promise<AttributeIssue[]> {
  const response = await httpClient.postJson<HygieneAttributesResponse>('/api/admin/hygiene-attributes', {
    characterId: character.id,
    characterName: character.name,
    attributes: character.attributes,
  })
  return response.issues ?? []
}

export async function validateAllCharactersServer(
  characters: Character[],
  onProgress?: (done: number, total: number) => void,
): Promise<AttributeIssue[]> {
  const results: AttributeIssue[] = []

  for (let i = 0; i < characters.length; i++) {
    try {
      const issues = await analyzeCharacterAttributes(characters[i])
      results.push(...issues)
    } catch {
      // Continue so one failed request does not cancel the full scan.
    }

    onProgress?.(i + 1, characters.length)
  }

  return results
}

interface DuplicatePairResponse {
  isDuplicate: boolean
  canonicalId?: string
}

async function analyzeDuplicatePair(
  a: Character,
  b: Character,
): Promise<DuplicatePairResponse> {
  return httpClient.postJson<DuplicatePairResponse>('/api/admin/hygiene-duplicates', {
    a: { id: a.id, name: a.name },
    b: { id: b.id, name: b.name },
  })
}

export async function findDuplicatesServer(
  characters: Character[],
  onProgress?: (done: number, total: number) => void,
): Promise<DuplicateGroup[]> {
  const candidates = findDuplicateCandidates(characters)
  const groups: DuplicateGroup[] = []

  for (let i = 0; i < candidates.length; i++) {
    const [a, b] = candidates[i]
    try {
      const result = await analyzeDuplicatePair(a, b)
      if (result.isDuplicate && result.canonicalId) {
        const canonical = result.canonicalId === a.id ? a : b
        const duplicate = result.canonicalId === a.id ? b : a
        groups.push({ canonical, duplicates: [duplicate], confidence: 0.9 })
      }
    } catch {
      // Continue so one failed pair does not cancel the full scan.
    }

    onProgress?.(i + 1, candidates.length)
  }

  return groups
}

interface QuestionScoreResponse {
  scores: Array<{
    questionId: string
    clarity: number
    power: number
    grammar: number
    rewrite?: string
  }>
}

export async function scoreQuestionsServer(
  questions: Question[],
  onProgress?: (done: number, total: number) => void,
): Promise<QuestionScore[]> {
  const results: QuestionScore[] = []
  const batchSize = 10

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize)
    try {
      const response = await httpClient.postJson<QuestionScoreResponse>(
        '/api/admin/hygiene-question-scores',
        {
          questions: batch.map((question) => ({
            id: question.id,
            text: question.text,
            attribute: question.attribute,
          })),
        },
      )

      for (const score of response.scores ?? []) {
        const question = batch.find((item) => item.id === score.questionId)
        if (question) {
          results.push({
            questionId: question.id,
            questionText: question.text,
            scores: {
              clarity: score.clarity,
              power: score.power,
              grammar: score.grammar,
            },
            rewrite: score.rewrite,
          })
        }
      }
    } catch {
      // Continue so one failed batch does not cancel the full scan.
    }

    onProgress?.(Math.min(i + batchSize, questions.length), questions.length)
  }

  return results
}

interface CategorySuggestionResponse {
  suggestion: null | {
    characterId: string
    characterName: string
    currentCategory: Character['category']
    suggestedCategory: Character['category']
    confidence: number
    reasoning: string
  }
}

export async function categorizeAllCharactersServer(
  characters: Character[],
  onProgress?: (done: number, total: number) => void,
): Promise<CategorySuggestion[]> {
  const results: CategorySuggestion[] = []

  for (let i = 0; i < characters.length; i++) {
    const character = characters[i]
    try {
      const response = await httpClient.postJson<CategorySuggestionResponse>(
        '/api/admin/hygiene-categories',
        {
          characterId: character.id,
          characterName: character.name,
          currentCategory: character.category,
          attributes: character.attributes,
        },
      )

      if (response.suggestion && response.suggestion.suggestedCategory !== character.category) {
        results.push(response.suggestion)
      }
    } catch {
      // Continue so one failed request does not cancel the full scan.
    }

    onProgress?.(i + 1, characters.length)
  }

  return results
}