import { useCallback, useRef } from 'react'
import { useMotionValue, useTransform } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { hapticMedium } from '@/lib/sounds'

const SWIPE_THRESHOLD = 100
const VELOCITY_THRESHOLD = 300
const VERTICAL_LIMIT = 75

interface UseSwipeAnswerOptions {
  onAnswer: (value: 'yes' | 'no') => void
  enabled?: boolean
}

/**
 * Provides horizontal swipe-to-answer gesture state for QuestionCard.
 * Swipe right = Yes, swipe left = No.
 * Fires haptic feedback and calls onAnswer when the threshold is crossed.
 */
export function useSwipeAnswer({ onAnswer, enabled = true }: UseSwipeAnswerOptions) {
  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer

  const dragX = useMotionValue(0)

  // Card tilt tracks drag position
  const cardRotate = useTransform(dragX, [-200, 0, 200], [-6, 0, 6])

  // Green overlay grows when swiping right, red when swiping left
  const yesOverlayOpacity = useTransform(
    dragX,
    [0, SWIPE_THRESHOLD],
    [0, 0.35],
    { clamp: true },
  )
  const noOverlayOpacity = useTransform(
    dragX,
    [-SWIPE_THRESHOLD, 0],
    [0.35, 0],
    { clamp: true },
  )

  // Hint labels fade in after 40% of the threshold
  const yesLabelOpacity = useTransform(
    dragX,
    [SWIPE_THRESHOLD * 0.4, SWIPE_THRESHOLD],
    [0, 1],
    { clamp: true },
  )
  const noLabelOpacity = useTransform(
    dragX,
    [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.4],
    [1, 0],
    { clamp: true },
  )

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!enabled) return
      const { offset, velocity } = info
      // Reject near-vertical gestures (likely a scroll attempt)
      if (Math.abs(offset.y) > VERTICAL_LIMIT) return
      const isSwipeRight =
        offset.x > SWIPE_THRESHOLD || (velocity.x > VELOCITY_THRESHOLD && offset.x > 0)
      const isSwipeLeft =
        offset.x < -SWIPE_THRESHOLD || (velocity.x < -VELOCITY_THRESHOLD && offset.x < 0)
      if (isSwipeRight) {
        hapticMedium()
        onAnswerRef.current('yes')
      } else if (isSwipeLeft) {
        hapticMedium()
        onAnswerRef.current('no')
      }
    },
    [enabled],
  )

  return {
    dragX,
    cardRotate,
    yesOverlayOpacity,
    noOverlayOpacity,
    yesLabelOpacity,
    noLabelOpacity,
    handleDragEnd,
    isDragEnabled: enabled,
  }
}
