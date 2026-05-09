import type { ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileHistoryGame } from "../network/mobileGameApi";
import type { MobileGameState } from "../state/mobileGameState";

interface HistoryScreenProps {
  state: MobileGameState;
  historyGames: MobileHistoryGame[];
  isLoading: boolean;
  loadError: string | null;
  onOpenStats: () => void;
  onBackToWelcome: () => void;
}

export function HistoryScreen({
  state,
  historyGames,
  isLoading,
  loadError,
  onOpenStats,
  onBackToWelcome,
}: Readonly<HistoryScreenProps>): ReactElement {
  const recentGames = historyGames.slice(0, 8);
  const wins = historyGames.filter((game) => game.won).length;

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>HISTORY</Text>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          Your latest sessions with outcomes, difficulty, and question depth.
        </Text>
      </View>

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
        <Text style={styles.statsLabel}>Recent Games</Text>
        {recentGames.length ? (
          recentGames.map((game) => (
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
          ))
        ) : (
          <Text style={styles.noDataText}>No completed games yet.</Text>
        )}
      </View>

      <View style={styles.actionsBlock}>
        <Pressable
          onPress={onOpenStats}
          style={[styles.actionButton, styles.actionPrimary]}
        >
          <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>
            Open Stats
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
        <Text style={styles.infoText}>Loading latest history...</Text>
      ) : null}
      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
      {state.lastError ? (
        <Text style={styles.errorText}>{state.lastError}</Text>
      ) : null}
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
  actionPrimary: {
    backgroundColor: "#7c3aed",
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
