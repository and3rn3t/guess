// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { PanInfo } from 'framer-motion'
import { useSwipeAnswer } from './useSwipeAnswer'

// Mock framer-motion motion values
vi.mock('framer-motion', () => ({
  useMotionValue: (init: number) => ({ get: () => init, set: vi.fn() }),
  useTransform: () => ({ get: () => 0 }),
}))

// Mock haptic — use vi.hoisted so the factory can reference the stub
const { hapticMedium } = vi.hoisted(() => ({ hapticMedium: vi.fn() }))
vi.mock('@/lib/sounds', () => ({ hapticMedium }))

function makePanInfo(offsetX: number, offsetY: number, velocityX = 0): PanInfo {
  return {
    offset: { x: offsetX, y: offsetY },
    velocity: { x: velocityX, y: 0 },
    delta: { x: 0, y: 0 },
    point: { x: 0, y: 0 },
  }
}

beforeEach(() => {
  hapticMedium.mockReset()
})

describe('useSwipeAnswer – handleDragEnd', () => {
  it('calls onAnswer("yes") and hapticMedium when swiped right past threshold', () => {
    const onAnswer = vi.fn()
    const { result } = renderHook(() => useSwipeAnswer({ onAnswer }))
    result.current.handleDragEnd(new PointerEvent('pointerup'), makePanInfo(120, 0))
    expect(onAnswer).toHaveBeenCalledWith('yes')
    expect(hapticMedium).toHaveBeenCalledOnce()
  })

  it('calls onAnswer("no") when swiped left past threshold', () => {
    const onAnswer = vi.fn()
    const { result } = renderHook(() => useSwipeAnswer({ onAnswer }))
    result.current.handleDragEnd(new PointerEvent('pointerup'), makePanInfo(-120, 0))
    expect(onAnswer).toHaveBeenCalledWith('no')
    expect(hapticMedium).toHaveBeenCalledOnce()
  })

  it('calls onAnswer("yes") via velocity when fast rightward flick (above threshold)', () => {
    const onAnswer = vi.fn()
    const { result } = renderHook(() => useSwipeAnswer({ onAnswer }))
    // offset=50 (below threshold) but velocity=400 (above VELOCITY_THRESHOLD=300) and offset > 0
    result.current.handleDragEnd(new PointerEvent('pointerup'), makePanInfo(50, 0, 400))
    expect(onAnswer).toHaveBeenCalledWith('yes')
  })

  it('calls onAnswer("no") via velocity when fast leftward flick', () => {
    const onAnswer = vi.fn()
    const { result } = renderHook(() => useSwipeAnswer({ onAnswer }))
    // offset=-50 (above threshold) but velocity=-400 and offset < 0
    result.current.handleDragEnd(new PointerEvent('pointerup'), makePanInfo(-50, 0, -400))
    expect(onAnswer).toHaveBeenCalledWith('no')
  })

  it('does NOT fire when gesture is primarily vertical (scroll attempt)', () => {
    const onAnswer = vi.fn()
    const { result } = renderHook(() => useSwipeAnswer({ onAnswer }))
    result.current.handleDragEnd(new PointerEvent('pointerup'), makePanInfo(120, 100, 0))
    expect(onAnswer).not.toHaveBeenCalled()
    expect(hapticMedium).not.toHaveBeenCalled()
  })

  it('does NOT fire when offset is below threshold and velocity is low', () => {
    const onAnswer = vi.fn()
    const { result } = renderHook(() => useSwipeAnswer({ onAnswer }))
    result.current.handleDragEnd(new PointerEvent('pointerup'), makePanInfo(40, 0, 100))
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('does NOT fire when enabled=false', () => {
    const onAnswer = vi.fn()
    const { result } = renderHook(() => useSwipeAnswer({ onAnswer, enabled: false }))
    result.current.handleDragEnd(new PointerEvent('pointerup'), makePanInfo(200, 0))
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('isDragEnabled reflects the enabled option', () => {
    const { result: enabled } = renderHook(() => useSwipeAnswer({ onAnswer: vi.fn(), enabled: true }))
    const { result: disabled } = renderHook(() => useSwipeAnswer({ onAnswer: vi.fn(), enabled: false }))
    expect(enabled.current.isDragEnabled).toBe(true)
    expect(disabled.current.isDragEnabled).toBe(false)
  })
})
