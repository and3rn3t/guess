import type { ReactElement } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing, typography } from './tokens'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import type { MobilePhaseScreenProps } from './types'

/**
 * CompareScreen
 *
 * Compare player stats to leaderboard/peers. MP.2 placeholder (L1 functional).
 * Shows relative standing and category breakdowns.
 */
export function CompareScreen(_props: MobilePhaseScreenProps): ReactElement {
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
            Compare
          </Text>
        </Animated.View>

        <View style={styles.comparisonCard}>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonLabel}>
              <Text style={styles.labelText}>Your Rank</Text>
              <Text style={styles.labelValue}>—</Text>
            </View>
            <View style={styles.comparisonLabel}>
              <Text style={styles.labelText}>Players Ahead</Text>
              <Text style={styles.labelValue}>—</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Rankings</Text>
          <View style={styles.categoryItem}>
            <Text style={styles.categoryName}>Films</Text>
            <Text style={styles.categoryRank}>—</Text>
          </View>
          <View style={styles.categoryItem}>
            <Text style={styles.categoryName}>TV Shows</Text>
            <Text style={styles.categoryRank}>—</Text>
          </View>
        </View>
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
  comparisonCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  comparisonLabel: {
    alignItems: 'center',
  },
  labelText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  labelValue: {
    ...typography.heading2,
    color: colors.accent,
  },
  section: {
    marginVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.md,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryName: {
    ...typography.body,
    color: colors.text,
  },
  categoryRank: {
    ...typography.body,
    color: colors.accent,
  },
})
