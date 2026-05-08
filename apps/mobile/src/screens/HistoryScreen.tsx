import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing, typography } from './tokens'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import { useGame } from '../state/GameContext'
import type { MobilePhaseScreenProps } from './types'

/**
 * HistoryScreen
 *
 * Detailed game history and session replay. MP.2 placeholder (L1 functional).
 * Lists past games with difficulty, outcome, and question count.
 */
export function HistoryScreen(_props: MobilePhaseScreenProps): ReactElement {
  const headerEntrance = useScreenEntranceMotion(0)
  const contentEntrance = useScreenEntranceMotion(80)
  const { insights } = useGame()
  const { history, loading, error, snapshot } = insights
  const [filter, setFilter] = useState<'all' | 'week'>('all')

  const filteredHistory = useMemo(() => {
    if (filter === 'all') {
      return history
    }

    const cutoff = Date.now() - 7 * 86_400_000
    return history.filter((entry) => entry.timestamp >= cutoff)
  }, [filter, history])

  const filteredWins = filteredHistory.filter((entry) => entry.won).length

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
          <Text style={styles.subtitle}>Review recent sessions and how efficiently you closed them out.</Text>
        </Animated.View>

        <Animated.View style={[styles.filterRow, contentEntrance]}>
          <Pressable
            style={[styles.filterButton, filter === 'all' ? null : styles.filterButtonInactive]}
            onPress={() => setFilter('all')}
          >
            <Text style={styles.filterButtonText}>All Time</Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, filter === 'week' ? null : styles.filterButtonInactive]}
            onPress={() => setFilter('week')}
          >
            <Text style={[styles.filterButtonText, filter === 'week' ? null : styles.filterButtonTextInactive]}>
              This Week
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.summaryCard, contentEntrance]}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{filteredHistory.length}</Text>
            <Text style={styles.summaryLabel}>Shown</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{filteredWins}</Text>
            <Text style={styles.summaryLabel}>Wins</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{snapshot.dailyStreak}</Text>
            <Text style={styles.summaryLabel}>Current Streak</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.historyList, contentEntrance]}>
          {loading && filteredHistory.length === 0 ? (
            <Text style={styles.placeholder}>Loading completed sessions...</Text>
          ) : filteredHistory.length === 0 ? (
            <Text style={styles.placeholder}>No games in this range yet.</Text>
          ) : (
            filteredHistory.map((entry) => (
              <View key={entry.id} style={styles.historyItem}>
                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemCharacter}>{entry.characterName}</Text>
                    <Text style={[styles.itemBadge, entry.won ? styles.itemBadgeWin : styles.itemBadgeLoss]}>
                      {entry.won ? 'Won' : 'Lost'}
                    </Text>
                  </View>
                  <Text style={styles.itemMeta}>
                    {titleCase(entry.difficulty)} · {entry.totalQuestions} questions · {formatRelativeTime(entry.timestamp)}
                  </Text>
                  {entry.steps.length > 0 ? (
                    <Text style={styles.itemDetail} numberOfLines={2}>
                      Last question: {entry.steps[entry.steps.length - 1]?.questionText}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </Animated.View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1)

const formatRelativeTime = (timestamp: number): string => {
  const deltaMs = Date.now() - timestamp
  const deltaHours = Math.floor(deltaMs / 3_600_000)
  if (deltaHours < 1) {
    const deltaMinutes = Math.max(1, Math.floor(deltaMs / 60_000))
    return `${deltaMinutes}m ago`
  }
  if (deltaHours < 24) {
    return `${deltaHours}h ago`
  }
  const deltaDays = Math.floor(deltaHours / 24)
  return `${deltaDays}d ago`
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
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryValue: {
    ...typography.heading2,
    color: colors.accent,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  historyList: {
    gap: spacing.md,
  },
  historyItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  itemContent: {
    gap: spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemCharacter: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  itemDetail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  itemBadge: {
    ...typography.caption,
    fontWeight: '600',
  },
  itemBadgeWin: {
    color: colors.accent,
  },
  itemBadgeLoss: {
    color: colors.textSecondary,
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
