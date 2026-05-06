// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { HapticsAdapter, NetworkAdapter } from '@guess/app-core'

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: 'http://localhost:8788',
      },
    },
  },
}))

vi.mock('react-native', () => ({
  NativeModules: {
    SourceCode: {},
  },
}))

import { useMobileServerGame } from './useMobileServerGame'

const createNetworkAdapter = (responses: Array<Record<string, unknown>>): NetworkAdapter => ({
  fetchJson: async <T>() => responses.shift() as T,
})

const createHapticsAdapter = (): HapticsAdapter => ({
  trigger: async () => {},
})

describe('useMobileServerGame accessibility cues', () => {
  it('emits a start cue and a follow-up question cue', async () => {
    const phaseDispatch = vi.fn()
    const haptics = createHapticsAdapter()

    const responses: Array<Record<string, unknown>> = [
      {
        sessionId: 'sess-1',
        question: { text: 'Is your character human?' },
        reasoning: { confidence: 0.8 },
        totalCharacters: 42,
      },
      {
        type: 'question',
        question: { text: 'Can your character use magic?' },
        reasoning: { confidence: 0.7 },
        remaining: 18,
      },
    ]

    const network = createNetworkAdapter(responses)

    const { result } = renderHook(() => useMobileServerGame(phaseDispatch, network, haptics))

    await act(async () => {
      await result.current.startGame()
    })

    expect(result.current.accessibilityCue?.message).toBe('Game started. Is your character human?')
    expect(result.current.accessibilityCue?.priority).toBe('default')

    await act(async () => {
      await result.current.submitAnswer('yes')
    })

    expect(result.current.accessibilityCue?.message).toBe('Next question. Can your character use magic?')
    expect(result.current.accessibilityCue?.priority).toBe('default')
  })

  it('emits a high-priority cue when the server proposes a guess', async () => {
    const phaseDispatch = vi.fn()
    const haptics = createHapticsAdapter()

    const responses: Array<Record<string, unknown>> = [
      {
        sessionId: 'sess-2',
        question: { text: 'Is your character from a video game?' },
        reasoning: { confidence: 0.8 },
        totalCharacters: 50,
      },
      {
        type: 'guess',
        character: {
          id: 'mario',
          name: 'Mario',
          category: 'game',
        },
        remaining: 4,
      },
    ]

    const network = createNetworkAdapter(responses)

    const { result } = renderHook(() => useMobileServerGame(phaseDispatch, network, haptics))

    await act(async () => {
      await result.current.startGame()
    })

    await act(async () => {
      await result.current.submitAnswer('yes')
    })

    expect(result.current.accessibilityCue?.message).toBe('I think your character is Mario.')
    expect(result.current.accessibilityCue?.priority).toBe('high')
    expect(phaseDispatch).toHaveBeenCalledWith({ type: 'SHOW_GUESS' })
  })
})
