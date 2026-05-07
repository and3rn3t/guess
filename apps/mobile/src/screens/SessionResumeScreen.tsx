import type { ReactElement } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing, typography } from './tokens'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import type { MobilePhaseScreenProps } from './types'

/**
 * SessionResumeScreen
 *
 * Resume an interrupted session. MP.2 placeholder (L1 functional).
 * Allows player to continue where they left off or start fresh.
 */
export function SessionResumeScreen({ _dispatch, _state, _server }: MobilePhaseScreenProps): ReactElement {
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
            Resume Session?
          </Text>
        </Animated.View>

        <Animated.View style={[styles.content, contentEntrance]}>
          <View style={styles.sessionCard}>
            <Text style={styles.sessionTitle}>Character Name</Text>
            <Text style={styles.sessionMeta}>5 of 20 questions asked</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '25%' }]} />
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Resume</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.actionButtonSecondary]}>
              <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                Start Over
              </Text>
            </Pressable>
          </View>
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
    justifyContent: 'center',
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
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sessionTitle: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sessionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  actions: {
    gap: spacing.md,
  },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: colors.surface,
  },
  actionButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: colors.text,
  },
})
