/**
 * Mobile server game hook.
 *
 * Mirrors the responsibilities of the web's `useServerGame` but uses:
 * - The shared `NetworkAdapter` (no web-specific `httpClient`)
 * - Shared app-core action plan builders for all server response flows
 * - `CorePhaseAction` dispatch for phase transitions
 *
 * Local state holds: session ID, current question/reasoning, remaining count.
 * Phase transitions (welcome → playing → guessing → gameOver) are sent via
 * the `phaseDispatch` delegate passed in from the parent.
 */
import {
  buildRejectReadinessSnapshot,
  buildServerAnswerActionPlan,
  buildServerAnswerOutcome,
  buildServerRejectActionPlan,
  buildServerSkipActionPlan,
  buildStartBootstrapPlan,
  buildCollectingEvidenceMessage,
  buildRetryGuessMessage,
  getRejectCooldownRemaining,
  type CorePhaseAction,
  type HapticsAdapter,
  type NetworkAdapter,
} from '@guess/app-core'
import type { Dispatch } from 'react'
import { useCallback, useRef, useState } from 'react'

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Base URL for the server API.
 * In production, set EXPO_PUBLIC_API_BASE_URL to the deployed Cloudflare Pages domain.
 * During development, set to your local `pnpm cf:dev` URL.
 */
const API_BASE =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_BASE_URL) || ''

const ENDPOINTS = {
  start: `${API_BASE}/api/v2/game/start`,
  answer: `${API_BASE}/api/v2/game/answer`,
  skip: `${API_BASE}/api/v2/game/skip`,
  rejectGuess: `${API_BASE}/api/v2/game/reject-guess`,
  result: `${API_BASE}/api/v2/game/result`,
} as const

// ── Types ────────────────────────────────────────────────────────────────────

export interface MobileQuestion {
  id?: string
  text: string
}

export interface MobileReasoning {
  explanation?: string
  confidence?: number
}

export interface MobileGuessCharacter {
  id: string
  name: string
  category: string
  imageUrl?: string | null
  trivia?: string[]
}

export interface MobileServerGameState {
  sessionId: string | null
  question: MobileQuestion | null
  reasoning: MobileReasoning | null
  remaining: number
  guessCharacter: MobileGuessCharacter | null
  isLoading: boolean
  error: string | null
  alertMessage: string | null
}

export interface MobileServerGameActions {
  startGame: () => Promise<void>
  submitAnswer: (value: 'yes' | 'no' | 'unknown') => Promise<void>
  skipQuestion: () => Promise<void>
  rejectGuess: (characterId: string) => Promise<void>
  confirmCorrect: () => Promise<void>
  clearError: () => void
  clearAlert: () => void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useMobileServerGame = (
  phaseDispatch: Dispatch<CorePhaseAction>,
  network: NetworkAdapter,
  haptics: HapticsAdapter,
): MobileServerGameState & MobileServerGameActions => {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [question, setQuestion] = useState<MobileQuestion | null>(null)
  const [reasoning, setReasoning] = useState<MobileReasoning | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [guessCharacter, setGuessCharacter] = useState<MobileGuessCharacter | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const sessionIdRef = useRef<string | null>(null)
  const lastRejectedCharIdRef = useRef<string | null>(null)


  // ── Helpers ──────────────────────────────────────────────────────────────

  const postJson = useCallback(
    <T>(url: string, body: unknown): Promise<T> =>
      network.fetchJson<T>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    [network],
  )

  const applyBootstrapPlan = useCallback(
    (data: { question?: unknown; reasoning?: unknown; totalCharacters?: number }) => {
      const steps = buildStartBootstrapPlan<MobileQuestion, MobileReasoning>(
        data as { question: MobileQuestion; reasoning: MobileReasoning },
      )
      for (const step of steps) {
        if (step.type === 'start-game') {
          phaseDispatch({ type: 'START_GAME' })
        } else if (step.type === 'set-question') {
          setQuestion(step.question)
          setReasoning(step.reasoning)
        }
        // 'answer' replay steps are not needed on fresh start
      }
      if (data.totalCharacters) {
        setRemaining(data.totalCharacters)
      }
    },
    [phaseDispatch],
  )

  // ── Actions ──────────────────────────────────────────────────────────────

  const startGame = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    setAlertMessage(null)
    try {
      const data = await postJson<{
        sessionId: string
        question: MobileQuestion
        reasoning: MobileReasoning
        totalCharacters: number
        maxQuestions?: number
      }>(ENDPOINTS.start, { difficulty: 'medium' })

      sessionIdRef.current = data.sessionId
      setSessionId(data.sessionId)
      applyBootstrapPlan(data)
      void haptics.trigger('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start game'
      setError(message)
      void haptics.trigger('error')
    } finally {
      setIsLoading(false)
    }
  }, [postJson, applyBootstrapPlan, haptics])

  const submitAnswer = useCallback(
    async (value: 'yes' | 'no' | 'unknown'): Promise<void> => {
      const sid = sessionIdRef.current
      if (!sid) return
      setIsLoading(true)
      setError(null)
      setAlertMessage(null)
      try {
        const data = await postJson<Record<string, unknown>>(ENDPOINTS.answer, {
          sessionId: sid,
          answer: value,
        })
        const outcome = buildServerAnswerOutcome<
          MobileQuestion,
          MobileReasoning,
          Record<string, unknown>,
          typeof data
        >(data)
        const plan = buildServerAnswerActionPlan(outcome)

        for (const step of plan) {
          if (step.type === 'undo-last-answer') {
            // No-op on mobile for now; we don't track answer history locally
          } else if (step.type === 'set-question') {
            setQuestion(step.question)
            setReasoning(step.reasoning)
          } else if (step.type === 'make-guess') {
            setGuessCharacter(step.character)
            phaseDispatch({ type: 'SHOW_GUESS' })
            void haptics.trigger('medium')
          }
        }

        if (outcome.kind === 'contradiction') {
          setAlertMessage(outcome.message)
          void haptics.trigger('warning')
        } else if (outcome.kind === 'question' && outcome.remaining !== undefined) {
          setRemaining(outcome.remaining)
          void haptics.trigger('light')
          if (outcome.readiness?.blockedByRejectCooldown) {
            const cooldown = getRejectCooldownRemaining(outcome.readiness)
            setAlertMessage(buildCollectingEvidenceMessage(cooldown))
          }
        } else if (outcome.kind === 'guess' && outcome.remaining !== undefined) {
          setRemaining(outcome.remaining)
          void haptics.trigger('medium')
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit answer'
        setError(message)
        void haptics.trigger('error')
      } finally {
        setIsLoading(false)
      }
    },
    [postJson, phaseDispatch, haptics],
  )

  const skipQuestion = useCallback(async (): Promise<void> => {
    const sid = sessionIdRef.current
    if (!sid) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await postJson<Record<string, unknown>>(ENDPOINTS.skip, { sessionId: sid })
      const plan = buildServerSkipActionPlan<MobileQuestion, MobileReasoning>(data)

      for (const step of plan) {
        if (step.type === 'set-exhausted') {
          setAlertMessage('No more questions to skip to!')
          phaseDispatch({ type: 'END_GAME', exhausted: true })
          void haptics.trigger('warning')
        } else if (step.type === 'set-question') {
          setQuestion(step.question)
          setReasoning(step.reasoning)
          const remaining = (data as { remaining?: number }).remaining
          if (remaining !== undefined) setRemaining(remaining)
          void haptics.trigger('light')
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to skip'
      setError(message)
      void haptics.trigger('error')
    } finally {
      setIsLoading(false)
    }
  }, [postJson, phaseDispatch, haptics])

  const rejectGuess = useCallback(
    async (characterId: string): Promise<void> => {
      const sid = sessionIdRef.current
      if (!sid) return
      lastRejectedCharIdRef.current = characterId
      setIsLoading(true)
      setError(null)
      try {
        const data = await postJson<Record<string, unknown>>(ENDPOINTS.rejectGuess, {
          sessionId: sid,
          characterId,
        })
        const plan = buildServerRejectActionPlan<MobileQuestion, MobileReasoning, typeof data>(data)

        for (const step of plan) {
          if (step.type === 'set-exhausted') {
            phaseDispatch({ type: 'END_GAME', exhausted: true })
            void postJson(ENDPOINTS.result, { sessionId: sid, correct: false }).catch(() => {})
            void haptics.trigger('warning')
          } else if (step.type === 'set-question') {
            setQuestion(step.question)
            setReasoning(step.reasoning)
            phaseDispatch({ type: 'START_GAME' }) // return to playing phase
            const snapshot = buildRejectReadinessSnapshot(
              (data as { rejectCooldownRemaining?: number }).rejectCooldownRemaining,
            )
            const cooldown = getRejectCooldownRemaining(snapshot)
            setAlertMessage(buildRetryGuessMessage(cooldown))
            const remaining = (data as { remaining?: number }).remaining
            if (remaining !== undefined) setRemaining(remaining)
            void haptics.trigger('light')
          }
        }

        if (plan.length === 0) {
          throw new Error('Unexpected server response after rejecting guess')
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reject guess'
        setError(message)
        void haptics.trigger('error')
      } finally {
        setIsLoading(false)
      }
    },
    [postJson, phaseDispatch, haptics],
  )

  const confirmCorrect = useCallback(async (): Promise<void> => {
    const sid = sessionIdRef.current
    if (!sid) return
    void postJson(ENDPOINTS.result, { sessionId: sid, correct: true }).catch(() => {})
    sessionIdRef.current = null
    setSessionId(null)
    phaseDispatch({ type: 'END_GAME' })
    void haptics.trigger('success')
  }, [postJson, phaseDispatch, haptics])

  const clearError = useCallback(() => setError(null), [])
  const clearAlert = useCallback(() => setAlertMessage(null), [])

  return {
    sessionId,
    question,
    reasoning,
    remaining,
    guessCharacter,
    isLoading,
    error,
    alertMessage,
    startGame,
    submitAnswer,
    skipQuestion,
    rejectGuess,
    confirmCorrect,
    clearError,
    clearAlert,
  }
}
