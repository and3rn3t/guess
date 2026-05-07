import type { ReactElement } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing, typography } from './tokens'
import { useHaptics } from './useHaptics'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import type { MobilePhaseScreenProps } from './types'

/**
 * TeachingScreen
 *
 * Teaching mode walkthrough. MP.2 placeholder (L1 functional).
 * Interactive tutorial showing how to ask good questions.
 */
export function TeachingScreen({ _dispatch, _state, _server }: MobilePhaseScreenProps): ReactElement {
  const { success } = useHaptics()
  const heroEntrance = useScreenEntranceMotion(0)
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
        <Animated.View style={[styles.hero, heroEntrance]}>
          <Text style={styles.title} maxFontSizeMultiplier={1.6}>
            Learn the Basics
          </Text>
          <Text style={styles.subtitle}>Master the art of asking great questions</Text>
        </Animated.View>

        <Animated.View style={[styles.content, contentEntrance]}>
          <View style={styles.lessonCard}>
            <Text style={styles.lessonNumber}>Lesson 1</Text>
            <Text style={styles.lessonTitle}>Ask Yes/No Questions</Text>
            <Text style={styles.lessonDescription}>
              The AI can only answer yes or no. Questions like "Is it a movie?" work great. Avoid open-ended questions.
            </Text>
            <View style={[styles.example, { borderLeftColor: colors.accent }]}>
              <Text style={styles.exampleLabel}>✓ Good:</Text>
              <Text style={styles.exampleText}>Is it a movie?</Text>
            </View>
            <View style={[styles.example, styles.exampleBad]}>
              <Text style={[styles.exampleLabel, styles.exampleLabelBad]}>✗ Avoid:</Text>
              <Text style={[styles.exampleText, styles.exampleTextBad]}>What is it?</Text>
            </View>
          </View>

          <View style={styles.lessonCard}>
            <Text style={styles.lessonNumber}>Lesson 2</Text>
            <Text style={styles.lessonTitle}>Narrow Down Gradually</Text>
            <Text style={styles.lessonDescription}>
              Start with broad questions (Is it real? Is it from entertainment?) then get more specific.
            </Text>
            <View style={styles.progression}>
              <View style={styles.progressionStep}>
                <Text style={styles.progressionNumber}>1</Text>
                <Text style={styles.progressionText}>Is it real?</Text>
              </View>
              <Text style={styles.progressionArrow}>↓</Text>
              <View style={styles.progressionStep}>
                <Text style={styles.progressionNumber}>2</Text>
                <Text style={styles.progressionText}>Is it from movies?</Text>
              </View>
              <Text style={styles.progressionArrow}>↓</Text>
              <View style={styles.progressionStep}>
                <Text style={styles.progressionNumber}>3</Text>
                <Text style={styles.progressionText}>Are they superhero?</Text>
              </View>
            </View>
          </View>

          <Pressable
            style={styles.startButton}
            onPress={() => success()}
          >
            <Text style={styles.startButtonText}>Ready? Let's Practice</Text>
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
  hero: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.subheading,
    color: colors.textSecondary,
  },
  content: {
    gap: spacing.lg,
  },
  lessonCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  lessonNumber: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  lessonTitle: {
    ...typography.subheading,
    color: colors.text,
  },
  lessonDescription: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  example: {
    backgroundColor: colors.background,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  exampleBad: {
    borderLeftColor: colors.destructiveBg,
  },
  exampleLabel: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  exampleLabelBad: {
    color: colors.destructiveBg,
  },
  exampleText: {
    ...typography.body,
    color: colors.text,
    fontStyle: 'italic',
  },
  exampleTextBad: {
    color: colors.destructiveBg,
  },
  progression: {
    gap: spacing.sm,
  },
  progressionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  progressionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    color: colors.background,
    textAlign: 'center',
    textAlignVertical: 'center',
    ...typography.caption,
    fontWeight: '600',
  },
  progressionText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  progressionArrow: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginVertical: -spacing.sm,
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  startButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
})
