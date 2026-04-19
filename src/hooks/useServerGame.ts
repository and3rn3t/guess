import { useReducer, useCallback, useRef, useEffect, useState } from 'react'
import type {
  Character,
  Question,
  AnswerValue,
  Difficulty,
  CharacterCategory,
} from '@/lib/types'
import type { GamePhase } from './useGameState'
import { gameReducer, initialState } from './useGameState'

// ── Server response types ────────────────────────────────────

interface StartResponse {
  sessionId: string
  question: { id: string; text: string; attribute: string }
  reasoning: ReasoningExplanation
  totalCharacters: number
}

interface AnswerResponse {
  type: 'question' | 'guess' | 'contradiction'
  question?: { id: string; text: string; attribute: string }
  reasoning?: ReasoningExplanation
  character?: { id: string; name: string; category: string; imageUrl: string | null }
  confidence?: number
  remaining?: number
  eliminated?: number
  questionCount?: number
  message?: string
}

interface ResultResponse {
  success: boolean
  summary: {
    won: boolean
    difficulty: string
    questionsAsked: number
    maxQuestions: number
    poolSize: number
  }
}

// ── Session persistence ──────────────────────────────────────

const SERVER_SESSION_KEY = 'kv:server-game-session'

function saveServerSession(sessionId: string): void {
  try {
    localStorage.setItem(SERVER_SESSION_KEY, sessionId)
  } catch { /* ignore */ }
}

function loadServerSession(): string | null {
  try {
    return localStorage.getItem(SERVER_SESSION_KEY)
  } catch {
    return null
  }
}

function clearServerSession(): void {
  localStorage.removeItem(SERVER_SESSION_KEY)
}

// ── API helpers ──────────────────────────────────────────────

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error((error as { error: string }).error || `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

// ── Hook ─────────────────────────────────────────────────────

export function useServerGame() {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const [sessionId, setSessionId] = useState<string | null>(loadServerSession)
  const [totalCharacters, setTotalCharacters] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Clean up on unmount
  useEffect(() => {
    const ref = abortRef
    return () => {
      ref.current?.abort()
    }
  }, [])

  const navigate = useCallback(
    (phase: GamePhase, character?: Character) =>
      dispatch({ type: 'NAVIGATE', phase, character }),
    [],
  )

  /** Start a new server-side game */
  const startGame = useCallback(
    async (categories?: CharacterCategory[], difficulty: Difficulty = 'medium') => {
      setError(null)
      dispatch({ type: 'SET_THINKING', isThinking: true })

      try {
        const data = await apiPost<StartResponse>('/api/v2/game/start', {
          categories: categories?.length ? categories : undefined,
          difficulty,
        })

        setSessionId(data.sessionId)
        saveServerSession(data.sessionId)
        setTotalCharacters(data.totalCharacters)

        // Use START_GAME with empty array (characters live server-side)
        dispatch({ type: 'START_GAME', characters: [] })
        dispatch({
          type: 'SET_QUESTION',
          question: data.question as Question,
          reasoning: data.reasoning,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start game')
        dispatch({ type: 'NAVIGATE', phase: 'welcome' })
      } finally {
        dispatch({ type: 'SET_THINKING', isThinking: false })
      }
    },
    [],
  )

  /** Send answer to server, receive next question or guess */
  const handleAnswer = useCallback(
    async (value: AnswerValue) => {
      if (!sessionId) return
      setError(null)

      // Record answer locally for UI (step tracking)
      dispatch({ type: 'ANSWER', value })
      dispatch({ type: 'SET_THINKING', isThinking: true })

      try {
        const data = await apiPost<AnswerResponse>('/api/v2/game/answer', {
          sessionId,
          value,
        })

        if (data.type === 'contradiction') {
          // Server undid the answer — undo locally too
          dispatch({ type: 'UNDO_LAST_ANSWER' })
          if (data.question && data.reasoning) {
            dispatch({
              type: 'SET_QUESTION',
              question: data.question as Question,
              reasoning: data.reasoning,
            })
          }
          setError(data.message || 'Contradictory answers detected')
          return
        }

        if (data.type === 'guess' && data.character) {
          const guessChar: Character = {
            id: data.character.id,
            name: data.character.name,
            category: data.character.category as CharacterCategory,
            attributes: {},
            imageUrl: data.character.imageUrl ?? undefined,
          }
          dispatch({ type: 'MAKE_GUESS', character: guessChar })
          return
        }

        if (data.type === 'question' && data.question && data.reasoning) {
          dispatch({
            type: 'SET_QUESTION',
            question: data.question as Question,
            reasoning: data.reasoning,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process answer')
      } finally {
        dispatch({ type: 'SET_THINKING', isThinking: false })
      }
    },
    [sessionId],
  )

  /** Record game result (correct/incorrect guess) */
  const recordResult = useCallback(
    async (correct: boolean) => {
      if (!sessionId) return

      try {
        await apiPost<ResultResponse>('/api/v2/game/result', {
          sessionId,
          correct,
        })
      } catch {
        // Non-critical — game still works
      } finally {
        clearServerSession()
        setSessionId(null)
      }
    },
    [sessionId],
  )

  const handleCorrectGuess = useCallback(() => {
    dispatch({ type: 'CORRECT_GUESS' })
    recordResult(true)
  }, [recordResult])

  const handleIncorrectGuess = useCallback(() => {
    dispatch({ type: 'INCORRECT_GUESS' })
    recordResult(false)
  }, [recordResult])

  const clearSession = useCallback(() => {
    clearServerSession()
    setSessionId(null)
    dispatch({ type: 'NAVIGATE', phase: 'welcome' })
  }, [])

  return {
    state,
    dispatch,
    navigate,
    sessionId,
    totalCharacters,
    error,
    startGame,
    handleAnswer,
    handleCorrectGuess,
    handleIncorrectGuess,
    clearSession,
    hasSavedSession: sessionId !== null,
  }
}
