import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing, typography } from './tokens'
import { endpoint } from '../state/apiBase'
import { useGame } from '../state/GameContext'
import { useHaptics } from './useHaptics'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import type { MobilePhaseScreenProps } from './types'

/**
 * PostGameFeedbackScreen
 *
 * Collect post-game feedback. MP.2 placeholder (L1 functional).
 * Quick reaction, difficulty rating, and optional comment.
 */
export function PostGameFeedbackScreen(_props: MobilePhaseScreenProps): ReactElement {
  const headerEntrance = useScreenEntranceMotion(0)
  const contentEntrance = useScreenEntranceMotion(80)
  const { server } = useGame()
  const { trigger, success, warning } = useHaptics()
  const [rating, setRating] = useState<number>(0)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sessionId = server.completedSessionId ?? server.sessionId
  const canSubmit = rating > 0 && Boolean(sessionId) && !submitting

  const emojiRatings = useMemo(
    () => [
      { score: 1, emoji: '😞', label: 'Poor' },
      { score: 2, emoji: '😕', label: 'Needs work' },
      { score: 4, emoji: '😊', label: 'Good' },
      { score: 5, emoji: '😄', label: 'Great' },
    ],
    [],
  )

  const handleSubmit = async () => {
    if (!sessionId) {
      setError('Complete a game before submitting feedback.')
      void warning()
      return
    }
    if (rating < 1) {
      setError('Select a rating first.')
      void warning()
      return
    }

    setSubmitting(true)
    setError(null)
    setStatus(null)

    try {
      const difficultyPrefix = difficulty ? `[Difficulty: ${difficulty}]` : ''
      const feedbackText = `${difficultyPrefix}${difficultyPrefix && comment.trim() ? ' ' : ''}${comment.trim()}`.trim()

      const response = await fetch(endpoint('/api/v2/game/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          rating,
          feedbackText: feedbackText.length > 0 ? feedbackText : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error(`Feedback failed (${response.status})`)
      }

      setStatus('Thanks, feedback submitted.')
      setComment('')
      setDifficulty(null)
      setRating(0)
      void success()
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to submit feedback'
      setError(message)
      void warning()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, headerEntrance]}>
          <Text style={styles.title} maxFontSizeMultiplier={1.6}>
            How was that?
          </Text>
          <Text style={styles.subtitle}>
            Share quick feedback to improve question quality over time.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.content, contentEntrance]}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Question Quality</Text>
            <View style={styles.ratingButtons}>
              {emojiRatings.map((option) => {
                const selected = rating === option.score
                return (
                  <Pressable
                    key={option.score}
                    style={[styles.ratingButton, selected && styles.ratingButtonActive]}
                    onPress={() => {
                      setRating(option.score)
                      void trigger('light')
                    }}
                  >
                    <Text style={styles.ratingEmoji}>{option.emoji}</Text>
                    <Text style={[styles.ratingLabel, selected && styles.ratingLabelActive]}>{option.label}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Difficulty</Text>
            <View style={styles.difficultyButtons}>
              {(['easy', 'medium', 'hard'] as const).map((option) => {
                const selected = difficulty === option
                return (
                  <Pressable
                    key={option}
                    style={[styles.difficultyButton, !selected && styles.difficultyButtonInactive]}
                    onPress={() => {
                      setDifficulty(option)
                      void trigger('light')
                    }}
                  >
                    <Text style={[styles.difficultyLabel, !selected && styles.difficultyLabelInactive]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Optional Comment</Text>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              maxLength={400}
              multiline
              placeholder="What worked well? What felt off?"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </Text>
          </Pressable>

          {!sessionId ? (
            <Text style={styles.helperText}>Finish a game first, then open Feedback to submit.</Text>
          ) : null}
          {status ? <Text style={styles.successText}>{status}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading1,
    color: colors.text,
  },
  subtitle: {
    ...typography.subheading,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  content: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
  },
  ratingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ratingButton: {
    width: 72,
    minHeight: 72,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.fill,
  },
  ratingEmoji: {
    fontSize: 28,
  },
  ratingLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  ratingLabelActive: {
    color: colors.text,
    fontWeight: '600',
  },
  difficultyButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  difficultyButtonInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  difficultyLabel: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
  difficultyLabelInactive: {
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
  commentInput: {
    minHeight: 92,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
    textAlignVertical: 'top',
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  successText: {
    ...typography.caption,
    color: colors.accent,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructiveBg,
  },
})
