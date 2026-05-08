import type { ReactElement } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing, typography } from './tokens'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import { useGame } from '../state/GameContext'
import type { MobilePhaseScreenProps } from './types'

/**
 * CompareScreen
 *
 * Compare player stats to leaderboard/peers. MP.2 placeholder (L1 functional).
 * Shows relative standing and category breakdowns.
 */
export function CompareScreen(_props: MobilePhaseScreenProps): ReactElement {
  const headerEntrance = useScreenEntranceMotion(0)
  const contentEntrance = useScreenEntranceMotion(80)
  const { insights } = useGame()
  const { snapshot, history, loading, error } = insights

  const averageWinRate = snapshot.successRates.length
    ? snapshot.successRates.reduce((sum, row) => sum + row.winRate, 0) / snapshot.successRates.length
    : snapshot.winRate

  const performanceBand = getPerformanceBand(averageWinRate)
  const estimatedPercentile = getEstimatedPercentile(averageWinRate)

  const categoryRankings = deriveAttributeRankings(history)
  const topSignals = categoryRankings.slice(0, 4)

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
          <Text style={styles.subtitle}>
            Relative performance trends against your own difficulty profile.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.comparisonCard, contentEntrance]}>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonLabel}>
              <Text style={styles.labelText}>Estimated Percentile</Text>
              <Text style={styles.labelValue}>{estimatedPercentile}</Text>
            </View>
            <View style={styles.comparisonLabel}>
              <Text style={styles.labelText}>Performance Band</Text>
              <Text style={styles.labelValue}>{performanceBand}</Text>
            </View>
          </View>
          <Text style={styles.metaText}>
            Derived from your recent outcomes and difficulty-level win rates.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.sectionCard, contentEntrance]}>
          <Text style={styles.sectionTitle}>Difficulty Comparison</Text>
          {snapshot.successRates.length === 0 ? (
            <Text style={styles.placeholder}>Play more games to unlock comparisons.</Text>
          ) : (
            <View style={styles.rateList}>
              {snapshot.successRates.map((row) => (
                <View key={row.id} style={styles.rateItem}>
                  <View style={styles.rateHeader}>
                    <Text style={styles.rateName}>{row.label}</Text>
                    <Text style={styles.rateValue}>{formatPercent(row.winRate)}</Text>
                  </View>
                  <View style={styles.rateTrack}>
                    <View style={[styles.rateFill, { width: `${Math.max(6, row.winRate)}%` }]} />
                  </View>
                  <Text style={styles.rateMeta}>
                    {row.games} game{row.games === 1 ? '' : 's'} · avg {formatNumber(row.avgQuestions)} questions
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.sectionCard, contentEntrance]}>
          <Text style={styles.sectionTitle}>Top Attribute Signals</Text>
          {loading && topSignals.length === 0 ? (
            <Text style={styles.placeholder}>Loading signal strengths...</Text>
          ) : topSignals.length === 0 ? (
            <Text style={styles.placeholder}>Not enough answer history yet.</Text>
          ) : (
            <View style={styles.categoryList}>
              {topSignals.map((row) => (
                <View key={row.id} style={styles.categoryItem}>
                  <Text style={styles.categoryName}>{row.label}</Text>
                  <Text style={styles.categoryRank}>{row.score}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.sectionMeta}>
            Scores combine answer volume and consistency across recent games.
          </Text>
        </Animated.View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

interface AttributeRanking {
  id: string
  label: string
  score: string
  rawScore: number
}

const deriveAttributeRankings = (
  history: ReadonlyArray<{
    steps: ReadonlyArray<{ attribute: string; answer: 'yes' | 'no' | 'unknown' }>
  }>,
): AttributeRanking[] => {
  const stats = new Map<string, { total: number; positive: number }>()

  for (const game of history.slice(0, 20)) {
    for (const step of game.steps) {
      const key = step.attribute || 'unknown'
      const current = stats.get(key) ?? { total: 0, positive: 0 }
      current.total += 1
      if (step.answer === 'yes') {
        current.positive += 1
      }
      stats.set(key, current)
    }
  }

  return [...stats.entries()]
    .map(([attribute, value]) => {
      const ratio = value.total === 0 ? 0 : value.positive / value.total
      const weighted = ratio * Math.min(value.total, 8)
      return {
        id: attribute,
        label: titleCase(attribute.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ')),
        score: `${Math.round(weighted * 10)} pts`,
        rawScore: weighted,
      }
    })
    .sort((left, right) => right.rawScore - left.rawScore)
}

const titleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const formatPercent = (value: number): string => `${formatNumber(value)}%`

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1)

const getEstimatedPercentile = (winRate: number): string => {
  if (winRate >= 85) return 'Top 10%'
  if (winRate >= 75) return 'Top 20%'
  if (winRate >= 65) return 'Top 35%'
  if (winRate >= 55) return 'Top 50%'
  if (winRate >= 45) return 'Top 65%'
  if (winRate >= 35) return 'Top 80%'
  return 'Top 95%'
}

const getPerformanceBand = (winRate: number): string => {
  if (winRate >= 80) return 'Elite'
  if (winRate >= 65) return 'Strong'
  if (winRate >= 50) return 'Steady'
  if (winRate >= 35) return 'Developing'
  return 'Learning'
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
  comparisonCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  comparisonLabel: {
    flex: 1,
    alignItems: 'center',
  },
  labelText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  labelValue: {
    ...typography.heading2,
    color: colors.accent,
    textAlign: 'center',
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
  },
  sectionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rateList: {
    gap: spacing.md,
  },
  rateItem: {
    gap: spacing.xs,
  },
  rateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rateName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  rateValue: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rateTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  rateFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radii.full,
  },
  rateMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  categoryList: {
    gap: spacing.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  placeholder: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructiveBg,
  },
})
