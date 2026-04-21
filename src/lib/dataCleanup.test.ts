import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findDuplicateCandidates } from './dataCleanup'
import type { Character } from './types'

// Mock LLM and prompts so LLM-backed functions stay offline
vi.mock('@/lib/llm', () => ({ llm: vi.fn() }))
vi.mock('@/lib/prompts', () => ({
  dataCleanup_v1: vi.fn().mockReturnValue({ system: 'sys', user: 'usr' }),
  sanitizeForPrompt: (s: string) => s,
}))

import { llm } from '@/lib/llm'
const mockLlm = vi.mocked(llm)

beforeEach(() => {
  vi.clearAllMocks()
})

function char(id: string, name: string): Character {
  return { id, name, category: 'movies', attributes: {} }
}

describe('findDuplicateCandidates', () => {
  it('returns empty for no characters', () => {
    expect(findDuplicateCandidates([])).toEqual([])
  })

  it('returns empty for a single character', () => {
    expect(findDuplicateCandidates([char('a', 'Mario')])).toEqual([])
  })

  it('finds exact name duplicates', () => {
    const chars = [char('a', 'Mario'), char('b', 'Mario')]
    const pairs = findDuplicateCandidates(chars)
    expect(pairs).toHaveLength(1)
    expect(pairs[0][0].id).toBe('a')
    expect(pairs[0][1].id).toBe('b')
  })

  it('normalizes case, spaces, punctuation', () => {
    const chars = [char('a', 'Spider-Man'), char('b', 'spider man'), char('c', "Spider Man")]
    const pairs = findDuplicateCandidates(chars)
    // All three normalize to "spiderman" → 3 pairs: (a,b), (a,c), (b,c)
    expect(pairs).toHaveLength(3)
  })

  it('finds near-duplicates within Levenshtein distance 2', () => {
    const chars = [char('a', 'Gandalf'), char('b', 'Gandlf')]
    const pairs = findDuplicateCandidates(chars)
    expect(pairs).toHaveLength(1)
  })

  it('does not match distant names', () => {
    const chars = [char('a', 'Mario'), char('b', 'Pikachu')]
    const pairs = findDuplicateCandidates(chars)
    expect(pairs).toHaveLength(0)
  })

  it('handles special characters in names', () => {
    const chars = [char('a', "R2-D2"), char('b', 'R2D2')]
    const pairs = findDuplicateCandidates(chars)
    expect(pairs).toHaveLength(1)
  })

  it('handles large batches efficiently', () => {
    // Use names that are sufficiently different (Levenshtein distance >= 3)
    const names = [
      'Mario', 'Pikachu', 'Gandalf', 'Batman', 'Spongebob',
      'Wolverine', 'Dumbledore', 'Goku', 'Kirby', 'Zelda',
      'Ironman', 'Thanos', 'Yoda', 'Shrek', 'Rapunzel',
      'Naruto', 'Sonic', 'Dracula', 'Hercules', 'Cleopatra',
    ]
    const chars = names.map((n, i) => char(`c${i}`, n))
    const pairs = findDuplicateCandidates(chars)
    expect(pairs).toHaveLength(0)
  })
})

// ── validateCharacterAttributes ───────────────────────────────

describe('validateCharacterAttributes', () => {
  it('returns issues from LLM response', async () => {
    const { validateCharacterAttributes } = await import('./dataCleanup')
    mockLlm.mockResolvedValueOnce(
      JSON.stringify({
        issues: [
          { characterId: 'mario', attribute: 'canFly', currentValue: true, suggestedValue: false, reason: 'Mario cannot fly normally' },
        ],
      })
    )

    const character: Character = { id: 'mario', name: 'Mario', category: 'video-games', attributes: { canFly: true } }
    const issues = await validateCharacterAttributes(character)
    expect(issues).toHaveLength(1)
    expect(issues[0].attribute).toBe('canFly')
    expect(issues[0].type).toBe('likely-incorrect')
    expect(issues[0].characterName).toBe('Mario')
  })

  it('returns empty array on LLM error', async () => {
    const { validateCharacterAttributes } = await import('./dataCleanup')
    mockLlm.mockRejectedValueOnce(new Error('LLM unavailable'))

    const issues = await validateCharacterAttributes(char('mario', 'Mario'))
    expect(issues).toEqual([])
  })

  it('returns empty array when LLM returns invalid JSON', async () => {
    const { validateCharacterAttributes } = await import('./dataCleanup')
    mockLlm.mockResolvedValueOnce('not valid json')

    const issues = await validateCharacterAttributes(char('mario', 'Mario'))
    expect(issues).toEqual([])
  })
})

// ── categorizeCharacter ───────────────────────────────────────

describe('categorizeCharacter', () => {
  it('returns a suggestion when LLM responds with a category', async () => {
    const { categorizeCharacter } = await import('./dataCleanup')
    mockLlm.mockResolvedValueOnce(
      JSON.stringify({
        suggestions: [{ characterId: 'mario', suggestedCategory: 'movies' }],
      })
    )

    const character: Character = { id: 'mario', name: 'Mario', category: 'video-games', attributes: {} }
    const result = await categorizeCharacter(character)
    expect(result).not.toBeNull()
    expect(result!.suggestedCategory).toBe('movies')
    expect(result!.currentCategory).toBe('video-games')
    expect(result!.confidence).toBe(0.8)
  })

  it('returns null when LLM returns no suggestions', async () => {
    const { categorizeCharacter } = await import('./dataCleanup')
    mockLlm.mockResolvedValueOnce(JSON.stringify({ suggestions: [] }))

    const result = await categorizeCharacter(char('mario', 'Mario'))
    expect(result).toBeNull()
  })

  it('returns null on LLM error', async () => {
    const { categorizeCharacter } = await import('./dataCleanup')
    mockLlm.mockRejectedValueOnce(new Error('network error'))

    const result = await categorizeCharacter(char('mario', 'Mario'))
    expect(result).toBeNull()
  })
})

// ── validateAllCharacters – progress callback ─────────────────

describe('validateAllCharacters', () => {
  it('calls onProgress for each character', async () => {
    const { validateAllCharacters } = await import('./dataCleanup')
    vi.useFakeTimers()

    mockLlm
      .mockResolvedValueOnce(JSON.stringify({ issues: [{ characterId: 'a', attribute: 'x', currentValue: true, suggestedValue: false, reason: 'r' }] }))
      .mockResolvedValueOnce(JSON.stringify({ issues: [] }))

    const chars = [char('a', 'Alpha'), char('b', 'Beta')]
    const progress: number[] = []
    const promise = validateAllCharacters(chars, (done) => progress.push(done))
    await vi.runAllTimersAsync()
    const issues = await promise

    expect(issues).toHaveLength(1)
    expect(progress).toEqual([1, 2])

    vi.useRealTimers()
  })
})

// ── scoreQuestions ────────────────────────────────────────────

describe('scoreQuestions', () => {
  it('returns scored questions from LLM', async () => {
    const { scoreQuestions } = await import('./dataCleanup')
    vi.useFakeTimers()

    mockLlm.mockResolvedValueOnce(
      JSON.stringify({
        scores: [{ questionId: 'q1', clarity: 4, power: 5, grammar: 4, rewrite: undefined }],
      })
    )

    const questions = [{ id: 'q1', text: 'Is this character human?', attribute: 'isHuman' }]
    const promise = scoreQuestions(questions)
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results).toHaveLength(1)
    expect(results[0].questionId).toBe('q1')
    expect(results[0].scores.clarity).toBe(4)

    vi.useRealTimers()
  })

  it('skips a batch on LLM error and returns empty results', async () => {
    const { scoreQuestions } = await import('./dataCleanup')
    vi.useFakeTimers()

    mockLlm.mockRejectedValueOnce(new Error('LLM error'))

    const questions = [{ id: 'q1', text: 'Is this character human?', attribute: 'isHuman' }]
    const promise = scoreQuestions(questions)
    await vi.runAllTimersAsync()
    const results = await promise

    expect(results).toHaveLength(0)

    vi.useRealTimers()
  })
})
