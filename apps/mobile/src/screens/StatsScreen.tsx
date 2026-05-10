import type { ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type {
  MobileHistoryGame,
  MobileStatsOverview,
} from "../network/mobileGameApi";
import {
  clearMobilePerfMetrics,
  getMobilePerfSummary,
} from "../perf/mobilePerfMetrics";
import type { MobileGameState } from "../state/mobileGameState";

interface StatsScreenProps {
  state: MobileGameState;
  stats: MobileStatsOverview | null;
  historyGames: MobileHistoryGame[];
  isLoading: boolean;
  loadError: string | null;
  onOpenCompare: () => void;
  onBackToWelcome: () => void;
}

interface AchievementBadge {
  id: string;
  label: string;
  emoji: string;
}

const ALL_ACHIEVEMENTS: AchievementBadge[] = [
  { id: "speed-demon", label: "Speed Demon", emoji: "⚡" },
  { id: "hot-streak", label: "Hot Streak", emoji: "🔥" },
  { id: "week-warrior", label: "Week Warrior", emoji: "🗓️" },
  { id: "persistent", label: "Persistent", emoji: "🎮" },
  { id: "veteran", label: "Veteran", emoji: "🏅" },
];

export function StatsScreen({
  state,
  stats,
  historyGames,
  isLoading,
  loadError,
  onOpenCompare,
  onBackToWelcome,
}: Readonly<StatsScreenProps>): ReactElement {
  const streak = computeDailyWinStreak(historyGames);
  const achievements = deriveAchievements(
    historyGames,
    streak,
    stats?.totalGames ?? historyGames.length,
  );
  const perfSummary = getMobilePerfSummary();
  const diagnosticsSnapshot = buildDiagnosticsSnapshot(perfSummary);

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>STATS</Text>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>
          Progression, streaks, and performance insights from your real
          sessions.
        </Text>
      </View>

      <View style={styles.metricsBlock}>
        <Text style={styles.metricLabel}>Player Summary</Text>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Games Played</Text>
          <Text style={styles.metricValue}>
            {stats?.totalGames ?? historyGames.length}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Win Rate</Text>
          <Text style={styles.metricValue}>
            {formatPercent(stats?.winRate ?? 0)}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Current Streak</Text>
          <Text style={styles.metricValue}>
            {streak} day{streak === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Avg Questions</Text>
          <Text style={styles.metricValue}>
            {formatNumber(stats?.avgQuestions ?? 0)}
          </Text>
        </View>
      </View>

      {stats?.byDifficulty.length ? (
        <View style={styles.metricsBlock}>
          <Text style={styles.metricLabel}>Difficulty Breakdown</Text>
          {stats.byDifficulty.map((entry) => (
            <View key={entry.difficulty} style={styles.metricItem}>
              <Text style={styles.metricKey}>{entry.difficulty}</Text>
              <Text style={styles.metricValue}>
                {entry.games} games · {formatPercent(entry.winRate)} WR
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.metricsBlock}>
        <Text style={styles.metricLabel}>Achievements</Text>
        {achievements.length ? (
          <View style={styles.achievementsWrap}>
            {achievements.map((badge) => (
              <View key={badge.id} style={styles.achievementPill}>
                <Text style={styles.achievementLabel}>
                  {badge.emoji} {badge.label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>
            No badges yet. Keep playing to unlock achievements.
          </Text>
        )}
      </View>

      <View style={styles.metricsBlock}>
        <Text style={styles.metricLabel}>MP.6 Diagnostics</Text>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Tap-to-feedback p95</Text>
          <Text
            style={[
              styles.metricValue,
              perfSummary.tap_to_feedback.meetsTarget
                ? styles.metricValuePass
                : styles.metricValueFail,
            ]}
          >
            {formatMs(perfSummary.tap_to_feedback.p95Ms)} / {perfSummary.tap_to_feedback.thresholdMs}ms
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Transition-start p95</Text>
          <Text
            style={[
              styles.metricValue,
              perfSummary.transition_start.meetsTarget
                ? styles.metricValuePass
                : styles.metricValueFail,
            ]}
          >
            {formatMs(perfSummary.transition_start.p95Ms)} / {perfSummary.transition_start.thresholdMs}ms
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Samples</Text>
          <Text style={styles.metricValue}>
            tap {perfSummary.tap_to_feedback.count} · transition {perfSummary.transition_start.count}
          </Text>
        </View>
        <Text style={styles.metricKey}>Pasteback Snapshot</Text>
        <Text selectable style={styles.snapshotText}>
          {diagnosticsSnapshot}
        </Text>
        <Pressable
          onPress={() => {
            clearMobilePerfMetrics();
          }}
          style={[styles.actionButton, styles.actionTertiary]}
        >
          <Text style={[styles.actionLabel, styles.actionLabelSecondary]}>
            Reset Diagnostics Samples
          </Text>
        </Pressable>
      </View>

      <View style={styles.actionsBlock}>
        <Pressable
          onPress={onOpenCompare}
          style={[styles.actionButton, styles.actionPrimary]}
        >
          <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>
            Open Compare
          </Text>
        </Pressable>
        <Pressable
          onPress={onBackToWelcome}
          style={[styles.actionButton, styles.actionSecondary]}
        >
          <Text style={[styles.actionLabel, styles.actionLabelSecondary]}>
            Back To Welcome
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <Text style={styles.infoText}>Loading latest stats...</Text>
      ) : null}
      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
      {state.lastError ? (
        <Text style={styles.errorText}>{state.lastError}</Text>
      ) : null}
    </View>
  );
}

function deriveAchievements(
  historyGames: MobileHistoryGame[],
  streak: number,
  gamesPlayed: number,
): AchievementBadge[] {
  const earned: AchievementBadge[] = [];

  if (historyGames.some((game) => game.won && game.questionsAsked <= 5)) {
    earned.push(ALL_ACHIEVEMENTS[0]);
  }
  if (streak >= 3) {
    earned.push(ALL_ACHIEVEMENTS[1]);
  }
  if (streak >= 7) {
    earned.push(ALL_ACHIEVEMENTS[2]);
  }
  if (gamesPlayed >= 10) {
    earned.push(ALL_ACHIEVEMENTS[3]);
  }
  if (gamesPlayed >= 50) {
    earned.push(ALL_ACHIEVEMENTS[4]);
  }

  return earned;
}

function computeDailyWinStreak(historyGames: MobileHistoryGame[]): number {
  if (!historyGames.length) {
    return 0;
  }

  const wonDates = new Set<string>();
  for (const game of historyGames) {
    if (game.won) {
      wonDates.add(toLocalDate(game.timestamp));
    }
  }

  if (!wonDates.size) {
    return 0;
  }

  const today = toLocalDate(Date.now());
  const yesterday = toLocalDate(Date.now() - 86_400_000);
  if (!wonDates.has(today) && !wonDates.has(yesterday)) {
    return 0;
  }

  let cursor = wonDates.has(today) ? today : yesterday;
  let streak = 0;
  while (wonDates.has(cursor)) {
    streak += 1;
    cursor = toLocalDate(parseDateString(cursor) - 86_400_000);
  }

  return streak;
}

function toLocalDate(timestamp: number): string {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateString(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function formatNumber(value: number): string {
  return `${Math.round(value * 10) / 10}`;
}

function formatMs(value: number): string {
  return `${Math.round(value * 10) / 10}`;
}

function buildDiagnosticsSnapshot(
  summary: ReturnType<typeof getMobilePerfSummary>,
): string {
  const runDate = new Date().toISOString().slice(0, 10);
  return [
    `Run date: ${runDate}`,
    `Tap-to-feedback p95: ${formatMs(summary.tap_to_feedback.p95Ms)} ms / ${summary.tap_to_feedback.thresholdMs} ms`,
    `Transition-start p95: ${formatMs(summary.transition_start.p95Ms)} ms / ${summary.transition_start.thresholdMs} ms`,
    `Tap samples: ${summary.tap_to_feedback.count}`,
    `Transition samples: ${summary.transition_start.count}`
  ].join('\n');
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    gap: 22,
  },
  headerBlock: {
    gap: 8,
  },
  phasePill: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "800",
    color: "#101828",
    backgroundColor: "#d1fadf",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  title: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 16,
    lineHeight: 24,
  },
  metricsBlock: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#0f172a",
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  metricItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metricKey: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "500",
  },
  metricValue: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
  metricValuePass: {
    color: "#4ade80",
  },
  metricValueFail: {
    color: "#f87171",
  },
  snapshotText: {
    color: "#e2e8f0",
    fontSize: 12,
    lineHeight: 18,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    backgroundColor: "#020617",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  achievementsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  achievementPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#475569",
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  achievementLabel: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
  },
  noDataText: {
    color: "#94a3b8",
    fontSize: 14,
    fontStyle: "italic",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionsBlock: {
    gap: 10,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPrimary: {
    backgroundColor: "#7c3aed",
  },
  actionSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#6b7280",
  },
  actionTertiary: {
    marginTop: 8,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#475569",
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  actionLabelPrimary: {
    color: "#ffffff",
  },
  actionLabelSecondary: {
    color: "#d1d5db",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: "500",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#7f1d1d",
  },
  infoText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "500",
  },
});
