import { useReducer, useCallback, useRef, useEffect } from 'react'
import type { Character, Question, Answer, AnswerValue, ReasoningExplanation, GameHistoryStep } from '@/lib/types'

const SESSION_KEY = 'kv:game-session'

// ========== GAME PHASE TYPE ==========
export type GamePhase =
  | 'welcome'
  | 'playing'
  | 'guessing'
  | 'gameOver'
  | 'teaching'
  | 'manage'
  | 'demo'
  | 'stats'
  | 'compare'
  | 'coverage'
  | 'recommender'
  | 'categoryRecommender'
  | 'environmentTest'
  | 'bulkHabitat'
  | 'history'
  | 'challenge'
  | 'costDashboard'
  | 'dataHygiene'
  | 'describeYourself'

// ========== STATE ==========
export interface GameState {
  phase: GamePhase
  answers: Answer[]
  currentQuestion: Question | null
  reasoning: ReasoningExplanation | null
  possibleCharacters: Character[]
  finalGuess: Character | null
  isThinking: boolean
  gameWon: boolean
  gameSteps: GameHistoryStep[]
  selectedCharacter: Character | null
  showDevTools: boolean
  guessCount: number
  exhausted: boolean
  surrendered: boolean
}

// ========== ACTIONS ==========
export type GameAction =
  | { type: 'START_GAME'; characters: Character[]; guessCount?: number }
  | { type: 'SET_QUESTION'; question: Question; reasoning: ReasoningExplanation }
  | { type: 'ANSWER'; value: AnswerValue }
  | { type: 'SKIP_QUESTION' }
  | { type: 'MAKE_GUESS'; character: Character }
  | { type: 'CORRECT_GUESS' }
  | { type: 'INCORRECT_GUESS' }
  | { type: 'REJECT_GUESS' }
  | { type: 'SET_EXHAUSTED' }
  | { type: 'SURRENDER' }
  | { type: 'GIVE_UP' }
  | { type: 'UNDO_LAST_ANSWER' }
  | { type: 'SET_THINKING'; isThinking: boolean }
  | { type: 'SET_POSSIBLE_CHARACTERS'; characters: Character[] }
  | { type: 'NAVIGATE'; phase: GamePhase; character?: Character }
  | { type: 'TOGGLE_DEV_TOOLS' }
  | { type: 'RESTORE_SESSION'; state: GameState }

// ========== INITIAL STATE ==========
/** Default game state — welcome phase with empty collections. */
export const initialState: GameState = {
  phase: 'welcome',
  answers: [],
  currentQuestion: null,
  reasoning: null,
  possibleCharacters: [],
  finalGuess: null,
  isThinking: false,
  gameWon: false,
  gameSteps: [],
  selectedCharacter: null,
  showDevTools: false,
  guessCount: 0,
  exhausted: false,
  surrendered: false,
}

// ========== REDUCER ==========
/** Pure reducer handling all game state transitions (start, answer, guess, navigate, etc.). */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...initialState,
        phase: 'playing',
        possibleCharacters: action.characters,
        guessCount: action.guessCount ?? 0,
      }

    case 'SET_QUESTION':
      return {
        ...state,
        currentQuestion: action.question,
        reasoning: action.reasoning,
      }

    case 'SKIP_QUESTION':
      // Replace currentQuestion with null so the next fetch can load a different one;
      // questionsRemaining is NOT decremented (skip is free).
      return {
        ...state,
        currentQuestion: null,
        isThinking: true,
      }

    case 'ANSWER': {
      if (!state.currentQuestion) return state
      const newAnswer: Answer = { questionId: state.currentQuestion.attribute, value: action.value }
      const newStep: GameHistoryStep = {
        questionText: state.currentQuestion.displayText || state.currentQuestion.text,
        attribute: state.currentQuestion.attribute,
        answer: action.value,
      }
      return {
        ...state,
        answers: [...state.answers, newAnswer],
        gameSteps: [...state.gameSteps, newStep],
        currentQuestion: null,
      }
    }

    case 'MAKE_GUESS':
      return {
        ...state,
        finalGuess: action.character,
        phase: 'guessing',
        isThinking: false,
      }

    case 'CORRECT_GUESS':
      return { ...state, gameWon: true, phase: 'gameOver' }

    case 'INCORRECT_GUESS':
      return { ...state, gameWon: false, phase: 'gameOver' }

    case 'REJECT_GUESS':
      return {
        ...state,
        phase: 'playing',
        finalGuess: null,
        guessCount: state.guessCount + 1,
        isThinking: true,
      }

    case 'SET_EXHAUSTED':
      return { ...state, exhausted: true, gameWon: false, phase: 'gameOver' }

    case 'SURRENDER':
      return { ...state, surrendered: true, gameWon: false, phase: 'gameOver' }

    case 'GIVE_UP':
      return { ...state, surrendered: true, gameWon: false, phase: 'gameOver' }

    case 'UNDO_LAST_ANSWER':
      return {
        ...state,
        answers: state.answers.slice(0, -1),
        gameSteps: state.gameSteps.slice(0, -1),
      }

    case 'SET_THINKING':
      return { ...state, isThinking: action.isThinking }

    case 'SET_POSSIBLE_CHARACTERS':
      return { ...state, possibleCharacters: action.characters }

    case 'NAVIGATE':
      return {
        ...state,
        phase: action.phase,
        selectedCharacter: action.character ?? (action.phase === 'welcome' ? null : state.selectedCharacter),
        ...(action.phase === 'welcome' ? { guessCount: 0, exhausted: false, surrendered: false } : {}),
      }

    case 'TOGGLE_DEV_TOOLS':
      return { ...state, showDevTools: !state.showDevTools }

    case 'RESTORE_SESSION':
      return { ...action.state, isThinking: false }

    default:
      return state
  }
}

// ========== SESSION PERSISTENCE ==========
const ACTIVE_PHASES: ReadonlySet<string> = new Set(['playing', 'guessing'])

function saveSession(state: GameState): void {
  const serialized = JSON.stringify(state)
  try {
    localStorage.setItem(SESSION_KEY, serialized)
  } catch (e) {
    // On QuotaExceededError, evict the stale entry and retry once
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      localStorage.removeItem(SESSION_KEY)
      try {
        localStorage.setItem(SESSION_KEY, serialized)
      } catch {
        // Storage unavailable — silently skip
      }
    }
  }
}

function loadSession(): GameState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as GameState
    // Only restore active game sessions
    if (ACTIVE_PHASES.has(saved.phase)) return saved
    // Stale session — clean up
    localStorage.removeItem(SESSION_KEY)
  } catch {
    localStorage.removeItem(SESSION_KEY)
  }
  return null
}

function clearSavedSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

// ========== HOOK ==========
/** Main game state hook — wraps useReducer with session persistence, navigation helper, and resume/clear callbacks. */
export function useGameState() {
  const savedSession = useRef(loadSession())
  const [state, dispatch] = useReducer(gameReducer, initialState)

  // Persist session for active games
  useEffect(() => {
    if (ACTIVE_PHASES.has(state.phase)) {
      saveSession(state)
    } else if (state.phase === 'gameOver' || state.phase === 'welcome') {
      clearSavedSession()
    }
  }, [state])

  const navigate = useCallback(
    (phase: GamePhase, character?: Character) => dispatch({ type: 'NAVIGATE', phase, character }),
    [],
  )

  const resumeSession = useCallback(() => {
    const session = savedSession.current
    if (!session) return
    dispatch({ type: 'RESTORE_SESSION', state: session })
    savedSession.current = null
  }, [dispatch])

  const clearSession = useCallback(() => {
    clearSavedSession()
    savedSession.current = null
  }, [])

  return {
    state,
    dispatch,
    navigate,
    hasSavedSession: savedSession.current !== null,
    resumeSession,
    clearSession,
  }
}
