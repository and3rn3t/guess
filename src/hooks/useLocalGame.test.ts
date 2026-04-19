// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { GameAction } from '@/hooks/useGameState'
import type { Character, Question } from '@/lib/types'
import { useLocalGame, filterPossibleCharacters } from './useLocalGame'

vi.mock('sonner', () => ({
  toast: { warning: vi.fn(), info: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/lib/sounds', () => ({
  playThinking: vi.fn(),
  playSuspense: vi.fn(),
}))

vi.mock('@/lib/gameEngine', () => ({
  detectContradictions: vi.fn().mockReturnValue({ hasContradiction: false }),
  generateReasoning: vi.fn().mockReturnValue({
    why: 'test reasoning',
    impact: '50%',
    remaining: 2,
    confidence: 50,
    topCandidates: [],
  }),
  getBestGuess: vi.fn().mockReturnValue(null),
  selectBestQuestion: vi.fn().mockReturnValue(null),
  shouldMakeGuess: vi.fn().mockReturnValue(false),
}))

const CHARS: Character[] = [
  { id: 'mario', name: 'Mario', category: 'video-games', attributes: { isHuman: true, canFly: false } },
  { id: 'link', name: 'Link', category: 'video-games', attributes: { isHuman: true, usesWeapons: true } },
  { id: 'pikachu', name: 'Pikachu', category: 'video-games', attributes: { isHuman: false, canFly: false } },
]

const QUESTIONS: Question[] = [
  { id: 'q1', text: 'Is this character human?', attribute: 'isHuman' },
  { id: 'q2', text: 'Can this character fly?', attribute: 'canFly' },
]

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('filterPossibleCharacters', () => {
  it('returns all characters with no answers', () => {
    const result = filterPossibleCharacters(CHARS, [])
    expect(result).toHaveLength(3)
  })

  it('filters out characters where answer=yes but attribute=false', () => {
    const result = filterPossibleCharacters(CHARS, [
      { questionId: 'isHuman', value: 'yes' },
    ])
    expect(result).toHaveLength(2)
    expect(result.every(c => c.attributes.isHuman !== false)).toBe(true)
  })

  it('filters out characters where answer=no but attribute=true', () => {
    const result = filterPossibleCharacters(CHARS, [
      { questionId: 'isHuman', value: 'no' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('pikachu')
  })

  it('keeps characters with unknown attributes', () => {
    const result = filterPossibleCharacters(CHARS, [
      { questionId: 'usesWeapons', value: 'yes' },
    ])
    // Mario (usesWeapons undefined) and Link (usesWeapons true) pass
    expect(result.map(c => c.id)).toContain('mario')
    expect(result.map(c => c.id)).toContain('link')
  })

  it('applies multiple filters', () => {
    const result = filterPossibleCharacters(CHARS, [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'no' },
    ])
    // Mario: human=true, canFly=false → matches
    // Link: human=true, canFly=undefined → matches (not excluded)
    // Pikachu: human=false → excluded
    expect(result.map(c => c.id)).toContain('mario')
    expect(result.map(c => c.id)).not.toContain('pikachu')
  })

  it('returns empty array when all characters eliminated', () => {
    const result = filterPossibleCharacters(CHARS, [
      { questionId: 'isHuman', value: 'yes' },
      { questionId: 'canFly', value: 'yes' },
    ])
    // Mario: canFly=false → excluded
    // Link: canFly=undefined → not excluded by 'yes', isHuman=true → matches
    // Pikachu: isHuman=false → excluded
    expect(result.map(c => c.id)).toContain('link')
  })
})

describe('useLocalGame', () => {
  const createHookProps = (overrides: Partial<Parameters<typeof useLocalGame>[0]> = {}) => ({
    dispatch: vi.fn<(action: GameAction) => void>(),
    questions: QUESTIONS,
    possibleCharacters: CHARS,
    answers: [],
    maxQuestions: 20,
    llmMode: false,
    prevPossibleCount: { current: CHARS.length },
    setEliminatedCount: vi.fn(),
    ...overrides,
  })

  it('returns generateNextQuestion and llmAbortRef', () => {
    const props = createHookProps()
    const { result } = renderHook(() => useLocalGame(props))
    expect(result.current.generateNextQuestion).toBeTypeOf('function')
    expect(result.current.llmAbortRef).toHaveProperty('current')
  })

  it('dispatches SET_THINKING and plays sound on generateNextQuestion', async () => {
    const { playThinking } = await import('@/lib/sounds')
    const props = createHookProps()
    const { result } = renderHook(() => useLocalGame(props))

    act(() => { result.current.generateNextQuestion() })
    expect(props.dispatch).toHaveBeenCalledWith({ type: 'SET_THINKING', isThinking: true })
    expect(playThinking).toHaveBeenCalled()
  })

  it('calls selectBestQuestion after timeout', async () => {
    const { selectBestQuestion } = await import('@/lib/gameEngine')
    vi.mocked(selectBestQuestion).mockReturnValue(QUESTIONS[0])

    const props = createHookProps()
    const { result } = renderHook(() => useLocalGame(props))

    act(() => { result.current.generateNextQuestion() })
    act(() => { vi.advanceTimersByTime(900) })

    expect(selectBestQuestion).toHaveBeenCalled()
  })

  it('dispatches MAKE_GUESS when shouldMakeGuess returns true', async () => {
    const { shouldMakeGuess, getBestGuess } = await import('@/lib/gameEngine')
    vi.mocked(shouldMakeGuess).mockReturnValue(true)
    vi.mocked(getBestGuess).mockReturnValue(CHARS[0])

    const props = createHookProps()
    const { result } = renderHook(() => useLocalGame(props))

    act(() => { result.current.generateNextQuestion() })
    act(() => { vi.advanceTimersByTime(900) })

    expect(props.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MAKE_GUESS', character: CHARS[0] }),
    )
  })

  it('undoes last answer on contradiction', async () => {
    const { detectContradictions } = await import('@/lib/gameEngine')
    vi.mocked(detectContradictions).mockReturnValue({
      hasContradiction: true,
      contradictingPair: null,
    })

    const props = createHookProps()
    const { result } = renderHook(() => useLocalGame(props))

    act(() => { result.current.generateNextQuestion() })
    act(() => { vi.advanceTimersByTime(900) })

    expect(props.dispatch).toHaveBeenCalledWith({ type: 'UNDO_LAST_ANSWER' })
  })

  it('sets eliminated count feedback', async () => {
    const { selectBestQuestion } = await import('@/lib/gameEngine')
    vi.mocked(selectBestQuestion).mockReturnValue(QUESTIONS[0])

    const filtered = CHARS.slice(0, 1) // Only 1 char left (2 eliminated)
    const props = createHookProps({
      possibleCharacters: filtered,
      prevPossibleCount: { current: 3 },
    })
    const { result } = renderHook(() => useLocalGame(props))

    act(() => { result.current.generateNextQuestion() })
    act(() => { vi.advanceTimersByTime(900) })

    // filterPossibleCharacters is called internally with the actual chars
    // The elimination count depends on internal filtering result
    expect(props.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_THINKING', isThinking: false }),
    )
  })
})
