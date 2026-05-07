import type { ReactElement } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing, typography } from './tokens'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import type { MobilePhaseScreenProps } from './types'

/**
 * PostGameFeedbackScreen
 *
 * Collect post-game feedback. MP.2 placeholder (L1 functional).
 * Quick reaction, difficulty rating, and optional comment.
 */
export function PostGameFeedbackScreen({ _dispatch, _state, _server }: MobilePhaseScreenProps): ReactElement {
  const headerEntrance = useScreenEntranceMotion(0)
  const contentEntrance = useScreenEntranceMotion(80)

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
        </Animated.View>

        <Animated.View style={[styles.content, contentEntrance]}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Question Quality</Text>
            <View style={styles.ratingButtons}>
              <Pressable style={styles.ratingButton}>
                <Text style={styles.ratingEmoji}>😞</Text>
              </Pressable>
              <Pressable style={styles.ratingButton}>
                <Text style={styles.ratingEmoji}>😕</Text>
              </Pressable>
              <Pressable style={styles.ratingButton}>
                <Text style={styles.ratingEmoji}>😊</Text>
              </Pressable>
              <Pressable style={styles.ratingButton}>
                <Text style={styles.ratingEmoji}>😄</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Difficulty</Text>
            <View style={styles.difficultyButtons}>
              <Pressable style={styles.difficultyButton}>
                <Text style={styles.difficultyLabel}>Easy</Text>
              </Pressable>
              <Pressable style={[styles.difficultyButton, styles.difficultyButtonInactive]}>
                <Text style={[styles.difficultyLabel, styles.difficultyLabelInactive]}>
                  Medium
                </Text>
              </Pressable>
              <Pressable style={[styles.difficultyButton, styles.difficultyButtonInactive]}>
                <Text style={[styles.difficultyLabel, styles.difficultyLabelInactive]}>Hard</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.submitButton}>
            <Text style={styles.submitButtonText}>Submit Feedback</Text>
          </Pressable>
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
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  ratingEmoji: {
    fontSize: 32,
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
  submitButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
})
