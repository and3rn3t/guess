import { useMemo, type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  buildDifficultyComparisonRows,
  buildRecentMomentumSummary,
  getBestDifficultyHighlight,
  type DifficultyComparisonRow
} from '../lib/compareInsights';
import { triggerImpactHaptic } from '../lib/mobileHaptics';
import type { MobileHistoryGame, MobileStatsOverview } from '../network/mobileGameApi';
import type { MobileGameState } from '../state/mobileGameState';
import { SecondaryActionsSheet } from './SecondaryActionsSheet';

interface CompareScreenProps {
  state: MobileGameState;
  stats: MobileStatsOverview | null;
  historyGames: MobileHistoryGame[];
  onOpenPreferences: () => void;
  onBackToWelcome: () => void;
}

function ComparisonRow({ row }: Readonly<{ row: DifficultyComparisonRow }>): ReactElement {
  return (
    <View style={styles.comparisonItem}>
      <Text style={styles.comparisonKey}>{toTitle(row.difficulty)}</Text>
      <View style={styles.comparisonValueGroup}>
        <Text style={styles.comparisonValueMuted}>{row.games} games</Text>
        <Text style={styles.comparisonValuePrimary}>
          {row.winRatePercent === null ? 'No data' : `${row.winRatePercent}% win`}
        </Text>
        <Text style={styles.comparisonValueMuted}>
          {row.avgQuestions === null ? 'Q avg: --' : `Q avg: ${row.avgQuestions}`}
        </Text>
      </View>
    </View>
  );
}

export function CompareScreen({
  state,
  stats,
  historyGames,
  onOpenPreferences,
  onBackToWelcome
}: Readonly<CompareScreenProps>): ReactElement {
  const difficultyRows = useMemo(
    () => buildDifficultyComparisonRows(stats),
    [stats]
  );
  const momentum = useMemo(
    () => buildRecentMomentumSummary(historyGames),
    [historyGames]
  );
  const bestDifficultyHighlight = useMemo(
    () => getBestDifficultyHighlight(difficultyRows),
    [difficultyRows]
  );
  const sessionStatus = getSessionStatus(state);

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>COMPARE</Text>
        <Text style={styles.title}>Performance Compare</Text>
        <Text style={styles.subtitle}>See where your results are strongest and where to tune your strategy.</Text>
        {bestDifficultyHighlight ? (
          <View style={styles.highlightChip}>
            <Text style={styles.highlightChipLabel}>BEST DIFFICULTY</Text>
            <Text style={styles.highlightChipValue}>{bestDifficultyHighlight.label}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.comparisonBlock}>
        <Text style={styles.comparisonLabel}>By Difficulty</Text>
        {difficultyRows.map((row) => (
          <ComparisonRow key={row.difficulty} row={row} />
        ))}
      </View>

      <View style={styles.sessionMetrics}>
        <Text style={styles.metricsLabel}>Recent Momentum (Last 8 Games)</Text>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Sample</Text>
          <Text style={styles.metricValue}>
            {momentum.recentGames === 0 ? 'No recent games' : `${momentum.recentGames} games`}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Win / Loss</Text>
          <Text style={styles.metricValue}>
            {momentum.recentGames === 0
              ? '--'
              : `${momentum.wins}W ${momentum.losses}L (${momentum.winRatePercent}%)`}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Avg Questions</Text>
          <Text style={styles.metricValue}>
            {formatNullableMetric(momentum.avgQuestions)}
          </Text>
        </View>
      </View>

      <View style={styles.sessionMetrics}>
        <Text style={styles.metricsLabel}>Current Session</Text>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Guesses Used</Text>
          <Text style={styles.metricValue}>{state.guessCount}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Status</Text>
          <Text style={[styles.metricValue, sessionStatus.style]}>
            {sessionStatus.label}
          </Text>
        </View>
      </View>

      <View style={styles.actionsBlock}>
        <SecondaryActionsSheet
          primaryLabel="Open Preferences"
          primaryAccessibilityLabel="Open preferences"
          onPrimaryPress={() => {
            triggerImpactHaptic('light');
            onOpenPreferences();
          }}
          secondaryActions={[
            {
              key: 'back-to-welcome',
              label: 'Back To Welcome',
              accessibilityLabel: 'Back to welcome',
              onPress: () => {
                triggerImpactHaptic('medium');
                onBackToWelcome();
              },
            },
          ]}
        />
      </View>

      {state.lastError ? <Text style={styles.errorText}>{state.lastError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 22
  },
  headerBlock: {
    gap: 8
  },
  phasePill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    color: '#101828',
    backgroundColor: '#d1fadf',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '800'
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24
  },
  highlightChip: {
    alignSelf: 'flex-start',
    marginTop: 2,
    backgroundColor: '#052e16',
    borderWidth: 1,
    borderColor: '#14532d',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2
  },
  highlightChipLabel: {
    color: '#86efac',
    fontSize: 11,
    fontWeight: '700'
  },
  highlightChipValue: {
    color: '#dcfce7',
    fontSize: 12,
    fontWeight: '600'
  },
  comparisonBlock: {
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  comparisonLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  comparisonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  comparisonKey: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600'
  },
  comparisonValueGroup: {
    alignItems: 'flex-end',
    gap: 2
  },
  comparisonValuePrimary: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '700'
  },
  comparisonValueMuted: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500'
  },
  sessionMetrics: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  metricsLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  metricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  metricKey: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500'
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700'
  },
  metricValueActive: {
    color: '#22c55e'
  },
  metricValueWarning: {
    color: '#fbbf24'
  },
  metricValueCritical: {
    color: '#f87171'
  },
  actionsBlock: {
    gap: 10
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7f1d1d'
  }
});

function toTitle(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return value[0].toUpperCase() + value.slice(1);
}

function getSessionStatus(
  state: MobileGameState
): { label: string; style: object } {
  if (state.exhausted) {
    return {
      label: 'Exhausted',
      style: styles.metricValueCritical
    };
  }

  if (state.surrendered) {
    return {
      label: 'Surrendered',
      style: styles.metricValueWarning
    };
  }

  return {
    label: 'Active',
    style: styles.metricValueActive
  };
}

function formatNullableMetric(value: number | null): string {
  return `${value ?? '--'}`;
}
