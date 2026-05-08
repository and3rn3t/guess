/**
 * GameContext
 *
 * Provides shared game state (phase + server) to all Expo Router screens.
 * Lives in the root _layout so state persists across navigation transitions.
 */
import {
  type CorePhaseAction,
  type CorePhaseState,
} from '@guess/app-core'
import type { Dispatch, ReactElement, ReactNode } from 'react'
import { createContext, useContext, useMemo } from 'react'
import { createMobilePlatformAdapters } from '../platform/adapters'
import { useCoreGameFlow } from './useCoreGameFlow'
import { useMobilePlayerInsights, type MobilePlayerInsightsActions, type MobilePlayerInsightsState } from './useMobilePlayerInsights'
import { useMobileServerGame, type MobileServerGameActions, type MobileServerGameState } from './useMobileServerGame'

interface GameContextValue {
  state: CorePhaseState
  dispatch: Dispatch<CorePhaseAction>
  phaseTitle: string
  phaseSubtitle: string
  server: MobileServerGameState & MobileServerGameActions
  insights: MobilePlayerInsightsState & MobilePlayerInsightsActions
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }): ReactElement {
  const platformAdapters = useMemo(() => createMobilePlatformAdapters(), [])
  const { state, dispatch, phaseTitle, phaseSubtitle } = useCoreGameFlow()
  const insights = useMobilePlayerInsights(platformAdapters.network)
  const server = useMobileServerGame(
    dispatch,
    platformAdapters.network,
    platformAdapters.haptics,
    insights.refresh,
  )

  const value = useMemo(
    () => ({ state, dispatch, phaseTitle, phaseSubtitle, server, insights }),
    [state, dispatch, phaseTitle, phaseSubtitle, server, insights],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within <GameProvider>')
  return ctx
}
