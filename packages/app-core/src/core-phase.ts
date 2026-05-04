export const CORE_GAME_PHASES = [
  'welcome',
  'playing',
  'guessing',
  'gameOver',
  'challenge',
] as const

export type CoreGamePhase = (typeof CORE_GAME_PHASES)[number]

export interface CorePhaseState {
  phase: CoreGamePhase
  guessCount: number
  exhausted: boolean
  surrendered: boolean
}

export type CorePhaseAction =
  | { type: 'START_GAME' }
  | { type: 'SHOW_GUESS' }
  | { type: 'END_GAME'; exhausted?: boolean; surrendered?: boolean }
  | { type: 'GO_TO_CHALLENGE' }
  | { type: 'BACK_TO_WELCOME' }
  | { type: 'INCREMENT_GUESS_COUNT' }

export const createInitialCorePhaseState = (): CorePhaseState => ({
  phase: 'welcome',
  guessCount: 0,
  exhausted: false,
  surrendered: false,
})

export const isCoreGamePhase = (value: string): value is CoreGamePhase =>
  CORE_GAME_PHASES.includes(value as CoreGamePhase)

export const corePhaseReducer = (
  state: CorePhaseState,
  action: CorePhaseAction,
): CorePhaseState => {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...state,
        phase: 'playing',
      }
    case 'SHOW_GUESS':
      return {
        ...state,
        phase: 'guessing',
      }
    case 'END_GAME':
      return {
        ...state,
        phase: 'gameOver',
        exhausted: action.exhausted ?? false,
        surrendered: action.surrendered ?? false,
      }
    case 'GO_TO_CHALLENGE':
      return {
        ...state,
        phase: 'challenge',
      }
    case 'BACK_TO_WELCOME':
      return createInitialCorePhaseState()
    case 'INCREMENT_GUESS_COUNT':
      return {
        ...state,
        guessCount: state.guessCount + 1,
      }
    default:
      return state
  }
}
