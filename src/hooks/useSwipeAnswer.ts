import { useCallback, useRef } from 'react'
import { useMotionValue, useTransform } from 'motion/react'
import type { PanInfo } from 'motion/react'
import { hapticMedium } from '@/lib/sounds'

const SWIPE_THRESHOLD = 100
const VELOCITY_THRESHOLD = 300
const VERTICAL_LIMIT = 75
const UP_SWIPE_THRESHOLD = 80

interface UseSwipeAnswerOptions {
  onAnswer: (value: 'yes' | 'no' | 'maybe') => void
  enabled?: boolean
}

/**
 * Provides swipe-to-answer gesture state for QuestionCard.
 * Swipe right = Yes, swipe left = No, swipe up = Maybe.
 * Fires haptic feedback and calls onAnswer when the threshold is crossed.
 */
export function useSwipeAnswer({ onAnswer, enabled = true }: UseSwipeAnswerOptions) {
  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer

  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)

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
  // Amber overlay grows when swiping up
  const maybeOverlayOpacity = useTransform(
    dragY,
    [-UP_SWIPE_THRESHOLD, 0],
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
  const maybeLabelOpacity = useTransform(
    dragY,
    [-UP_SWIPE_THRESHOLD, -UP_SWIPE_THRESHOLD * 0.4],
    [1, 0],
    { clamp: true },
  )

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!enabled) return
      const { offset, velocity } = info

      // Up-swipe for Maybe — dominant vertical-up gesture
      const isUpSwipe =
        offset.y < -UP_SWIPE_THRESHOLD &&
        Math.abs(offset.y) > Math.abs(offset.x) &&
        (velocity.y < -200 || offset.y < -UP_SWIPE_THRESHOLD)
      if (isUpSwipe) {
        hapticMedium()
        onAnswerRef.current('maybe')
        return
      }

      // Reject near-vertical gestures that aren't up-swipes (likely scroll attempts)
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
    dragY,
    cardRotate,
    yesOverlayOpacity,
    noOverlayOpacity,
    maybeOverlayOpacity,
    yesLabelOpacity,
    noLabelOpacity,
    maybeLabelOpacity,
    handleDragEnd,
    isDragEnabled: enabled,
  }
}

