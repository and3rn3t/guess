import { useReducer, useCallback } from 'react'
import type { Character, Question, Answer, AnswerValue, ReasoningExplanation, GameHistoryStep } from '@/lib/types'

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

    default:
      return state
  }
}

// ========== HOOK ==========
export function useGameState() {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const navigate = useCallback(
    (phase: GamePhase, character?: Character) => dispatch({ type: 'NAVIGATE', phase, character }),
    [],
  )

  return { state, dispatch, navigate }
}
