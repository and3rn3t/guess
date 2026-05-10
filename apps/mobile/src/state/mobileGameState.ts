import type { CoreGamePhase } from '@guess/app-core';
import type {
  MobileGuessCandidate,
  MobileQuestion,
  MobileReasoning
} from '../network/mobileGameApi';

export type MobileGamePhase =
  | CoreGamePhase
  | 'stats'
  | 'history'
  | 'compare'
  | 'resume'
  | 'preferences'
  | 'teaching'
  | 'feedback';

export interface MobileGameState {
  phase: MobileGamePhase;
  isBusy: boolean;
  sessionId: string | null;
  lastSessionId: string | null;
  currentQuestion: MobileQuestion | null;
  reasoning: MobileReasoning | null;
  finalGuess: MobileGuessCandidate | null;
  guessConfidence: number | null;
  rejectCooldownRemaining: number | null;
  lastError: string | null;
  guessCount: number;
  exhausted: boolean;
  surrendered: boolean;
}

export type MobileGameAction =
  | {
      type: 'START_SUCCESS';
      sessionId: string;
      question: MobileQuestion;
      reasoning: MobileReasoning;
    }
  | {
      type: 'RESUME_SUCCESS';
      sessionId: string;
      question: MobileQuestion;
      reasoning: MobileReasoning;
      guessCount: number;
    }
  | { type: 'RESUME_EXPIRED' }
  | {
      type: 'ANSWER_QUESTION';
      question: MobileQuestion;
      reasoning: MobileReasoning;
    }
  | {
      type: 'ANSWER_GUESS';
      character: MobileGuessCandidate;
      confidence?: number;
    }
  | {
      type: 'SKIP_QUESTION';
      question: MobileQuestion;
      reasoning: MobileReasoning;
    }
  | { type: 'SKIP_EXHAUSTED' }
  | {
      type: 'REJECT_QUESTION';
      question: MobileQuestion;
      reasoning: MobileReasoning;
      rejectCooldownRemaining?: number;
      guessCount?: number;
    }
  | {
      type: 'REJECT_EXHAUSTED';
      message?: string;
    }
  | {
      type: 'ANSWER_CONTRADICTION';
      message?: string;
      question?: MobileQuestion;
      reasoning?: MobileReasoning;
    }
  | { type: 'SHOW_GUESS' }
  | { type: 'END_GAME'; exhausted?: boolean; surrendered?: boolean }
  | { type: 'GO_TO_CHALLENGE' }
  | { type: 'BACK_TO_WELCOME' }
  | { type: 'OPEN_PHASE'; phase: Exclude<MobileGamePhase, CoreGamePhase> }
  | { type: 'INCREMENT_GUESS_COUNT' }
  | { type: 'SET_BUSY'; isBusy: boolean }
  | { type: 'SET_ERROR'; message: string | null }
  | { type: 'RESTORE_SESSION_ID'; sessionId: string };

export const createInitialMobileGameState = (): MobileGameState => ({
  phase: 'welcome',
  isBusy: false,
  sessionId: null,
  lastSessionId: null,
  currentQuestion: null,
  reasoning: null,
  finalGuess: null,
  guessConfidence: null,
  rejectCooldownRemaining: null,
  lastError: null,
  guessCount: 0,
  exhausted: false,
  surrendered: false
});

export function mobileGameReducer(
  state: MobileGameState,
  action: MobileGameAction
): MobileGameState {
  switch (action.type) {
    case 'START_SUCCESS':
      return {
        ...state,
        phase: 'playing',
        sessionId: action.sessionId,
        lastSessionId: action.sessionId,
        currentQuestion: action.question,
        reasoning: action.reasoning,
        finalGuess: null,
        guessConfidence: null,
        rejectCooldownRemaining: null,
        lastError: null,
        guessCount: 0,
        exhausted: false,
        surrendered: false
      };
    case 'RESUME_SUCCESS':
      return {
        ...state,
        phase: 'playing',
        sessionId: action.sessionId,
        lastSessionId: action.sessionId,
        currentQuestion: action.question,
        reasoning: action.reasoning,
        finalGuess: null,
        guessConfidence: null,
        rejectCooldownRemaining: null,
        guessCount: action.guessCount,
        lastError: null,
        exhausted: false,
        surrendered: false
      };
    case 'RESUME_EXPIRED':
      return {
        ...state,
        phase: 'welcome',
        sessionId: null,
        lastSessionId: null,
        currentQuestion: null,
        reasoning: null,
        finalGuess: null,
        guessConfidence: null,
        rejectCooldownRemaining: null,
        guessCount: 0,
        lastError: 'Saved session expired. Start a new game.'
      };
    case 'ANSWER_QUESTION':
      return {
        ...state,
        phase: 'playing',
        currentQuestion: action.question,
        reasoning: action.reasoning,
        finalGuess: null,
        guessConfidence: null,
        rejectCooldownRemaining: null,
        lastError: null
      };
    case 'ANSWER_GUESS':
      return {
        ...state,
        phase: 'guessing',
        finalGuess: action.character,
        guessConfidence: action.confidence ?? null,
        rejectCooldownRemaining: null,
        lastError: null
      };
    case 'SKIP_QUESTION':
      return {
        ...state,
        phase: 'playing',
        currentQuestion: action.question,
        reasoning: action.reasoning,
        lastError: null
      };
    case 'SKIP_EXHAUSTED':
      return {
        ...state,
        phase: 'gameOver',
        exhausted: true,
        lastError: null
      };
    case 'REJECT_QUESTION':
      return {
        ...state,
        phase: 'playing',
        currentQuestion: action.question,
        reasoning: action.reasoning,
        finalGuess: null,
        guessConfidence: null,
        rejectCooldownRemaining: action.rejectCooldownRemaining ?? null,
        guessCount: action.guessCount ?? state.guessCount + 1,
        lastError: null
      };
    case 'REJECT_EXHAUSTED':
      return {
        ...state,
        phase: 'gameOver',
        exhausted: true,
        lastError: action.message ?? null
      };
    case 'ANSWER_CONTRADICTION':
      return {
        ...state,
        phase: 'playing',
        currentQuestion: action.question ?? state.currentQuestion,
        reasoning: action.reasoning ?? state.reasoning,
        lastError: action.message ?? 'Contradictory answer detected. Please try again.'
      };
    case 'SHOW_GUESS':
      return {
        ...state,
        phase: 'guessing'
      };
    case 'END_GAME':
      return {
        ...state,
        phase: 'gameOver',
        lastError: null,
        exhausted: action.exhausted ?? false,
        surrendered: action.surrendered ?? false
      };
    case 'GO_TO_CHALLENGE':
      return {
        ...state,
        phase: 'challenge'
      };
    case 'BACK_TO_WELCOME':
      return {
        ...createInitialMobileGameState(),
        lastSessionId: state.sessionId ?? state.lastSessionId
      };
    case 'OPEN_PHASE':
      return {
        ...state,
        lastError: null,
        phase: action.phase
      };
    case 'INCREMENT_GUESS_COUNT':
      return {
        ...state,
        guessCount: state.guessCount + 1
      };
    case 'SET_BUSY':
      return {
        ...state,
        isBusy: action.isBusy
      };
    case 'SET_ERROR':
      return {
        ...state,
        lastError: action.message
      };
      case 'RESTORE_SESSION_ID':
        return {
          ...state,
          lastSessionId: state.lastSessionId ?? action.sessionId
        };
    default:
      return state;
  }
}
