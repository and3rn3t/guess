import {
  corePhaseReducer,
  createInitialCorePhaseState,
  type CorePhaseAction,
  type CorePhaseState,
} from '@guess/app-core'
import type { Dispatch } from 'react'
import { useMemo, useReducer } from 'react'

export interface CoreGameFlow {
  state: CorePhaseState
  dispatch: Dispatch<CorePhaseAction>
  phaseTitle: string
  phaseSubtitle: string
}

const PHASE_META: Record<CorePhaseState['phase'], { title: string; subtitle: string }> = {
  welcome: {
    title: 'Welcome',
    subtitle: 'Entry point for onboarding and start controls.',
  },
  playing: {
    title: 'Playing',
    subtitle: 'Question loop and elimination flow will live here.',
  },
  guessing: {
    title: 'Guessing',
    subtitle: 'Native reveal and confirmation interactions.',
  },
  gameOver: {
    title: 'Game Over',
    subtitle: 'Summary, reflection, and replay actions.',
  },
  challenge: {
    title: 'Challenge',
    subtitle: 'Challenge entry and share-friendly invitation flow.',
  },
}

export const useCoreGameFlow = (): CoreGameFlow => {
  const [state, dispatch] = useReducer(corePhaseReducer, undefined, createInitialCorePhaseState)

  const phaseMeta = useMemo(() => PHASE_META[state.phase], [state.phase])

  return {
    state,
    dispatch,
    phaseTitle: phaseMeta.title,
    phaseSubtitle: phaseMeta.subtitle,
  }
}
