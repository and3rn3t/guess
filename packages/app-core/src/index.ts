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

export const createInitialCorePhaseState = (): CorePhaseState => ({
  phase: 'welcome',
  guessCount: 0,
  exhausted: false,
  surrendered: false,
})

export const isCoreGamePhase = (value: string): value is CoreGamePhase =>
  CORE_GAME_PHASES.includes(value as CoreGamePhase)

export * from './adapters'
