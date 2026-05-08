import type { ReactElement } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing, typography } from './tokens'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import { useGame } from '../state/GameContext'
import type { MobilePhaseScreenProps } from './types'

/**
 * StatsScreen
 *
 * Player stats and session history. MP.2 placeholder (L1 functional).
 * Displays session streaks, session count, and quick stats overview.
 */
export function StatsScreen(_props: MobilePhaseScreenProps): ReactElement {
  const headerEntrance = useScreenEntranceMotion(0)
  const sectionEntrance = useScreenEntranceMotion(80)
  const { insights } = useGame()
  const { snapshot, loading, error, lastUpdated } = insights
  const unlockedIds = new Set(snapshot.achievements.map((item) => item.id))

  const statCards = [
    { id: 'streak', label: 'Daily Streak', value: String(snapshot.dailyStreak) },
    { id: 'games', label: 'Total Games', value: String(snapshot.totalGames) },
    { id: 'avg', label: 'Avg Questions', value: formatNumber(snapshot.avgQuestions) },
    { id: 'rate', label: 'Win Rate', value: `${formatNumber(snapshot.winRate)}%` },
  ]

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
            Your Stats
          </Text>
          <Text style={styles.subtitle}>
            Streaks, achievements, and recent guessing performance.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.statsGrid, sectionEntrance]}>
          {statCards.map((card) => (
            <View key={card.id} style={styles.statCard}>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[styles.sectionCard, sectionEntrance]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            {lastUpdated ? <Text style={styles.sectionMeta}>{formatUpdatedAt(lastUpdated)}</Text> : null}
          </View>
          {loading && snapshot.totalGames === 0 ? (
            <Text style={styles.placeholder}>Loading progress...</Text>
          ) : (
            <View style={styles.achievementList}>
              {snapshot.achievementProgress.map((progress) => {
                const unlocked = unlockedIds.has(progress.achievement.id)
                return (
                  <View key={progress.achievement.id} style={styles.achievementCard}>
                    <Text style={styles.achievementEmoji}>{progress.achievement.emoji}</Text>
                    <View style={styles.achievementCopy}>
                      <View style={styles.achievementHeader}>
                        <Text style={styles.achievementTitle}>{progress.achievement.label}</Text>
                        <Text style={[styles.achievementState, unlocked ? styles.achievementStateUnlocked : null]}>
                          {unlocked ? 'Unlocked' : `${progress.current}/${progress.target}`}
                        </Text>
                      </View>
                      <Text style={styles.achievementDescription}>{progress.achievement.description}</Text>
                      {!unlocked ? (
                        <View style={styles.achievementProgressWrap}>
                          <View style={styles.achievementProgressTrack}>
                            <View
                              style={[
                                styles.achievementProgressFill,
                                { width: `${Math.max(4, progress.progressPct)}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.achievementHint}>{progress.hint}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.sectionCard, sectionEntrance]}>
          <Text style={styles.sectionTitle}>Win Rate by Difficulty</Text>
          {snapshot.successRates.length === 0 ? (
            <Text style={styles.placeholder}>No completed games yet.</Text>
          ) : (
            <View style={styles.rateList}>
              {snapshot.successRates.map((rate) => (
                <View key={rate.id} style={styles.rateRow}>
                  <View style={styles.rateHeader}>
                    <Text style={styles.rateLabel}>{rate.label}</Text>
                    <Text style={styles.rateValue}>
                      {formatNumber(rate.winRate)}% · {rate.games} game{rate.games === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={styles.rateTrack}>
                    <View style={[styles.rateFill, { width: `${Math.max(rate.winRate, 6)}%` }]} />
                  </View>
                  <Text style={styles.rateMeta}>Avg {formatNumber(rate.avgQuestions)} questions</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.sectionCard, sectionEntrance]}>
          <Text style={styles.sectionTitle}>Question Load Heatmap</Text>
          <Text style={styles.sectionDescription}>
            Buckets show where your wins and misses cluster by question count.
          </Text>
          <View style={styles.heatmapGrid}>
            {snapshot.heatmap.map((cell) => (
              <View key={cell.id} style={styles.heatmapCell}>
                <View style={styles.heatmapHeader}>
                  <Text style={styles.heatmapLabel}>{cell.label}</Text>
                  <Text style={styles.heatmapValue}>{cell.games}</Text>
                </View>
                <View style={styles.heatmapTrack}>
                  <View style={[styles.heatmapFill, { width: `${Math.max(cell.intensity, 4)}%` }]} />
                </View>
                <Text style={styles.heatmapMeta}>
                  {cell.wins}W · {cell.losses}L
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.sectionCard, sectionEntrance]}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {snapshot.recentHistory.length === 0 ? (
            <Text style={styles.placeholder}>Your completed games will appear here.</Text>
          ) : (
            <View style={styles.recentList}>
              {snapshot.recentHistory.slice(0, 3).map((entry) => (
                <View key={entry.id} style={styles.recentRow}>
                  <View style={styles.recentCopy}>
                    <Text style={styles.recentTitle}>{entry.characterName}</Text>
                    <Text style={styles.recentMeta}>
                      {titleCase(entry.difficulty)} · {entry.totalQuestions} questions
                    </Text>
                  </View>
                  <Text style={[styles.recentOutcome, entry.won ? styles.recentOutcomeWin : styles.recentOutcomeLoss]}>
                    {entry.won ? 'Won' : 'Lost'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const formatNumber = (value: number): string => {
  if (Number.isInteger(value)) {
    return String(value)
  }
  return value.toFixed(1)
}

const formatUpdatedAt = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `Updated ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1)

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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    ...typography.heading2,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
  },
  sectionDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  placeholder: {
    ...typography.body,
    color: colors.textSecondary,
  },
  achievementList: {
    gap: spacing.md,
  },
  achievementCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  achievementEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  achievementCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  achievementTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  achievementState: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  achievementStateUnlocked: {
    color: colors.accent,
  },
  achievementDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  achievementProgressWrap: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  achievementProgressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radii.full,
  },
  achievementHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rateList: {
    gap: spacing.md,
  },
  rateRow: {
    gap: spacing.xs,
  },
  rateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rateLabel: {
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
  heatmapGrid: {
    gap: spacing.sm,
  },
  heatmapCell: {
    gap: spacing.xs,
  },
  heatmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heatmapLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  heatmapValue: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  heatmapTrack: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  heatmapFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radii.full,
  },
  heatmapMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  recentList: {
    gap: spacing.md,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  recentCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  recentTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  recentMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  recentOutcome: {
    ...typography.caption,
    fontWeight: '600',
  },
  recentOutcomeWin: {
    color: colors.accent,
  },
  recentOutcomeLoss: {
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructiveBg,
  },
})
