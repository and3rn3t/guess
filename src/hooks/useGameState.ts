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
}

// ========== ACTIONS ==========
export type GameAction =
  | { type: 'START_GAME'; characters: Character[] }
  | { type: 'SET_QUESTION'; question: Question; reasoning: ReasoningExplanation }
  | { type: 'ANSWER'; value: AnswerValue }
  | { type: 'MAKE_GUESS'; character: Character }
  | { type: 'CORRECT_GUESS' }
  | { type: 'INCORRECT_GUESS' }
  | { type: 'UNDO_LAST_ANSWER' }
  | { type: 'SET_THINKING'; isThinking: boolean }
  | { type: 'SET_POSSIBLE_CHARACTERS'; characters: Character[] }
  | { type: 'NAVIGATE'; phase: GamePhase; character?: Character }
  | { type: 'TOGGLE_DEV_TOOLS' }
  | { type: 'RESTORE_SESSION'; state: GameState }

// ========== INITIAL STATE ==========
const initialState: GameState = {
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
}

// ========== REDUCER ==========
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...initialState,
        phase: 'playing',
        possibleCharacters: action.characters,
      }

    case 'SET_QUESTION':
      return {
        ...state,
        currentQuestion: action.question,
        reasoning: action.reasoning,
      }

    case 'ANSWER': {
      if (!state.currentQuestion) return state
      const newAnswer: Answer = { questionId: state.currentQuestion.attribute, value: action.value }
      const newStep: GameHistoryStep = {
        questionText: state.currentQuestion.text,
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
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state))
  } catch {
    // Storage full — ignore
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
    // Dispatch individual actions to rebuild state from saved session
    dispatch({ type: 'START_GAME', characters: session.possibleCharacters })
    // Restore answers by replaying — but since we saved full state, we need a restore action
    // Add a RESTORE_SESSION action type for this
    dispatch({ type: 'RESTORE_SESSION', state: session })
    savedSession.current = null
  }, [])

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
