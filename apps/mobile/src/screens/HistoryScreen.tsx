import type { ReactElement } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing, typography } from './tokens'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import type { MobilePhaseScreenProps } from './types'

/**
 * HistoryScreen
 *
 * Detailed game history and session replay. MP.2 placeholder (L1 functional).
 * Lists past games with difficulty, outcome, and question count.
 */
export function HistoryScreen({ _dispatch, _state, _server }: MobilePhaseScreenProps): ReactElement {
  const headerEntrance = useScreenEntranceMotion(0)

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
            Game History
          </Text>
        </Animated.View>

        <View style={styles.filterRow}>
          <Pressable style={styles.filterButton}>
            <Text style={styles.filterButtonText}>All Time</Text>
          </Pressable>
          <Pressable style={[styles.filterButton, styles.filterButtonInactive]}>
            <Text style={[styles.filterButtonText, styles.filterButtonTextInactive]}>
              This Week
            </Text>
          </Pressable>
        </View>

        <View style={styles.historyList}>
          <View style={styles.historyItem}>
            <View style={styles.itemContent}>
              <Text style={styles.itemCharacter}>Character Name</Text>
              <Text style={styles.itemMeta}>5 questions • 2 hours ago</Text>
            </View>
            <Text style={styles.itemOutcome}>✓</Text>
          </View>
        </View>

        <Text style={styles.placeholder}>More games loading...</Text>
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
  filterRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.full,
  },
  filterButtonInactive: {
    backgroundColor: colors.surface,
  },
  filterButtonText: {
    ...typography.caption,
    color: colors.background,
  },
  filterButtonTextInactive: {
    color: colors.text,
  },
  historyList: {
    gap: spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemCharacter: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  itemOutcome: {
    ...typography.heading2,
    color: colors.accent,
  },
  placeholder: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
})
