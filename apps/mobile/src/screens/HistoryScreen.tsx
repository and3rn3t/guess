import { useMemo, useState, type ReactElement } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { triggerImpactHaptic } from "../lib/mobileHaptics";
import type { MobileHistoryGame } from "../network/mobileGameApi";
import type { MobileGameState } from "../state/mobileGameState";
import { SecondaryActionsSheet } from "./SecondaryActionsSheet";

interface HistoryScreenProps {
  state: MobileGameState;
  historyGames: MobileHistoryGame[];
  isLoading: boolean;
  loadError: string | null;
  onOpenStats: () => void;
  onBackToWelcome: () => void;
  onRetry: () => void;
}

export function HistoryScreen({
  state,
  historyGames,
  isLoading,
  loadError,
  onOpenStats,
  onBackToWelcome,
  onRetry,
}: Readonly<HistoryScreenProps>): ReactElement {
  const [showAllRecentGames, setShowAllRecentGames] = useState(false);
  const recentGames = useMemo(
    () => historyGames.slice(0, showAllRecentGames ? 12 : 4),
    [historyGames, showAllRecentGames]
  );
  const wins = useMemo(() => historyGames.filter((game) => game.won).length, [historyGames]);

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>HISTORY</Text>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          Your latest sessions with outcomes, difficulty, and question depth.
        </Text>
      </View>

      {isLoading && (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color="#86efac" size="small" />
          <Text style={styles.infoText}>Loading latest history…</Text>
        </View>
      )}
      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorCardText}>{loadError}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading history"
            onPress={onRetry}
            style={[styles.actionButton, styles.actionSecondary]}
          >
            <Text style={[styles.actionLabel, styles.actionLabelSecondary]}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {state.lastError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorCardText}>{state.lastError}</Text>
        </View>
      ) : null}

      <View style={styles.sessionBlock}>
        <Text style={styles.sessionLabel}>Summary</Text>
        <View style={styles.sessionItem}>
          <Text style={styles.sessionKey}>Games Logged</Text>
          <Text style={styles.sessionValue}>{historyGames.length}</Text>
        </View>
        <View style={styles.sessionItem}>
          <Text style={styles.sessionKey}>Wins</Text>
          <Text style={styles.sessionValue}>{wins}</Text>
        </View>
        <View style={styles.sessionItem}>
          <Text style={styles.sessionKey}>Losses</Text>
          <Text style={styles.sessionValue}>
            {Math.max(historyGames.length - wins, 0)}
          </Text>
        </View>
        {state.sessionId ? (
          <View style={styles.sessionItem}>
            <Text style={styles.sessionKey}>Current Session</Text>
            <Text style={styles.sessionValue}>{state.sessionId}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statsBlock}>
        <View style={styles.statsHeaderRow}>
          <Text style={styles.statsLabel}>Recent Games</Text>
          {historyGames.length > recentGames.length ? (
            <Text style={styles.statsHint}>Showing {recentGames.length} of {historyGames.length}</Text>
          ) : null}
        </View>
        {recentGames.length ? (
          <>
            {recentGames.map((game) => (
              <View key={game.id} style={styles.statItem}>
                <View style={styles.statMeta}>
                  <Text style={styles.statKey}>{game.characterName}</Text>
                  <Text style={styles.statHint}>
                    {toTitle(game.difficulty)} · {game.questionsAsked} questions
                  </Text>
                </View>
                <Text
                  style={[
                    styles.statValue,
                    game.won ? styles.winValue : styles.lossValue,
                  ]}
                >
                  {game.won ? "Won" : "Lost"}
                </Text>
              </View>
            ))}

            {historyGames.length > 4 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showAllRecentGames ? "Show fewer recent games" : "Show more recent games"}
                onPress={() => {
                  triggerImpactHaptic("light");
                  setShowAllRecentGames((value) => !value);
                }}
                style={[styles.actionButton, styles.actionSecondary]}
              >
                <Text style={[styles.actionLabel, styles.actionLabelSecondary]}>
                  {showAllRecentGames ? "Show Fewer Games" : "Show More Games"}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.noDataText}>No completed games yet.</Text>
        )}
      </View>

      <View style={styles.actionsBlock}>
        <SecondaryActionsSheet
          primaryLabel="Open Stats"
          primaryAccessibilityLabel="Open stats"
          onPrimaryPress={() => {
            triggerImpactHaptic("light");
            onOpenStats();
          }}
          secondaryActions={[
            {
              key: "back-to-welcome",
              label: "Back To Welcome",
              accessibilityLabel: "Back to welcome",
              onPress: () => {
                triggerImpactHaptic("medium");
                onBackToWelcome();
              },
            },
          ]}
        />
      </View>
    </View>
  );
}

function toTitle(value: string): string {
  if (!value.length) {
    return value;
  }

  return `${value[0].toUpperCase()}${value.slice(1)}`;
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
  sessionBlock: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#0f172a",
  },
  sessionLabel: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  sessionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sessionKey: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "500",
  },
  sessionValue: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Menlo",
  },
  noDataText: {
    color: "#94a3b8",
    fontSize: 14,
    fontStyle: "italic",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statsBlock: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#0f172a",
  },
  statsLabel: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  statsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  statsHint: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "500",
  },
  statItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statMeta: {
    flex: 1,
    gap: 2,
  },
  statKey: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "500",
  },
  statHint: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
  },
  statValue: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
  winValue: {
    color: "#86efac",
  },
  lossValue: {
    color: "#fca5a5",
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
  actionSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#6b7280",
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "700",
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
  loadingBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  errorCard: {
    borderRadius: 10,
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  errorCardText: {
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: "500",
  },
  infoText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "500",
  },
});
