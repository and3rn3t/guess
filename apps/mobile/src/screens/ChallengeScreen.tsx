import { useMemo, useState, type ReactElement } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { triggerImpactHaptic } from "../lib/mobileHaptics";
import type {
  MobileDailyChallenge,
  MobileDailyLeaderboard,
  MobileLeaderboardEntry,
} from "../network/mobileGameApi";
import { SecondaryActionsSheet } from "./SecondaryActionsSheet";
import { SyncStatusBadge } from "./SyncStatusBadge";

interface ChallengeScreenProps {
  isBusy: boolean;
  errorMessage: string | null;
  daily: MobileDailyChallenge | null;
  leaderboard: MobileDailyLeaderboard | null;
  isLoading: boolean;
  loadError: string | null;
  onStartChallenge: (characterId: string) => void;
  onBackToWelcome: () => void;
  onOpenHistory: () => void;
  onRetry: () => void;
}

interface ChallengeLeaderboardProps {
  leaderboard: MobileDailyLeaderboard | null;
  isLoading: boolean;
  leaderboardRows: MobileLeaderboardEntry[];
  showAllLeaderboardRows: boolean;
  onToggleRows: () => void;
}

const LEADERBOARD_PREVIEW_COUNT = 10;

function LeaderboardRow({
  entry,
}: Readonly<{ entry: MobileLeaderboardEntry }>): ReactElement {
  return (
    <View style={[styles.lbRow, entry.isYou && styles.lbRowYou]}>
      <Text style={[styles.lbRank, entry.isYou && styles.lbRankYou]}>
        #{entry.rank}
      </Text>
      <Text
        style={[styles.lbLabel, entry.isYou && styles.lbLabelYou]}
        numberOfLines={1}
      >
        {entry.isYou ? "You" : entry.userLabel}
      </Text>
      <Text style={[styles.lbQ, entry.won ? styles.lbQWon : styles.lbQLost]}>
        {entry.won ? "✓" : "✗"} {entry.questionsAsked}q
      </Text>
    </View>
  );
}

function ChallengeLeaderboard({
  leaderboard,
  isLoading,
  leaderboardRows,
  showAllLeaderboardRows,
  onToggleRows,
}: Readonly<ChallengeLeaderboardProps>): ReactElement {
  const totalRows = leaderboard?.leaderboard.length ?? 0;
  const isEmpty = totalRows === 0;
  const canExpand = totalRows > LEADERBOARD_PREVIEW_COUNT;

  return (
    <View style={styles.lbBlock}>
      <View style={styles.lbHeaderRow}>
        <Text style={styles.lbTitle}>Today's Leaderboard</Text>
        {!isLoading && totalRows > leaderboardRows.length ? (
          <Text style={styles.lbHint}>
            Showing {leaderboardRows.length} of {totalRows}
          </Text>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#f59e0b" style={styles.lbSpinner} />
      ) : null}
      {!isLoading && isEmpty ? (
        <Text style={styles.lbEmpty}>No completions yet — be the first!</Text>
      ) : null}
      {isLoading
        ? null
        : leaderboardRows.map((entry) => (
            <LeaderboardRow
              key={`${entry.rank}-${entry.userLabel}`}
              entry={entry}
            />
          ))}

      {!isLoading && canExpand ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showAllLeaderboardRows
              ? "Show fewer leaderboard entries"
              : "Show more leaderboard entries"
          }
          onPress={onToggleRows}
          style={[styles.actionButton, styles.actionSecondary]}
        >
          <Text style={styles.actionSecondaryText}>
            {showAllLeaderboardRows
              ? "Show Fewer Entries"
              : "Show More Entries"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ChallengeScreen({
  isBusy,
  errorMessage,
  daily,
  leaderboard,
  isLoading,
  loadError,
  onStartChallenge,
  onBackToWelcome,
  onOpenHistory,
  onRetry,
}: Readonly<ChallengeScreenProps>): ReactElement {
  const [showAllLeaderboardRows, setShowAllLeaderboardRows] = useState(false);
  const today = daily?.date ?? new Date().toISOString().slice(0, 10);
  const leaderboardRows = useMemo(() => {
    if (!leaderboard) {
      return [];
    }

    return showAllLeaderboardRows
      ? leaderboard.leaderboard
      : leaderboard.leaderboard.slice(0, LEADERBOARD_PREVIEW_COUNT);
  }, [leaderboard, showAllLeaderboardRows]);

  const handleToggleLeaderboardRows = (): void => {
    triggerImpactHaptic("light");
    setShowAllLeaderboardRows((value) => !value);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.root}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>DAILY CHALLENGE</Text>
        <Text style={styles.title}>Today's Challenge</Text>
        <Text style={styles.date}>{today}</Text>
        <Text style={styles.subtitle}>
          One featured character. One run. Can you solve it in fewer questions?
        </Text>
      </View>

      {isLoading && (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color="#f59e0b" />
          <Text style={styles.loadingText}>Loading challenge…</Text>
        </View>
      )}

      {loadError && !isLoading && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading challenge"
            onPress={onRetry}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {daily && !isLoading && (
        <>
          {/* Status summary card */}
          <View
            style={[
              styles.summaryCard,
              daily.completed
                ? styles.summaryCardDone
                : styles.summaryCardPending,
            ]}
          >
            {daily.completed && daily.result ? (
              <>
                <Text style={styles.summaryStatus}>
                  {daily.result.won ? "🏆 Won!" : "💀 Lost"}
                </Text>
                <Text style={styles.summaryStat}>
                  {daily.result.questionsAsked} questions asked
                </Text>
                {daily.revealedCharacter && (
                  <Text style={styles.summaryCharacter}>
                    Character: {daily.revealedCharacter.name}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.summaryStatus}>🎯 Not played yet</Text>
                <Text style={styles.summaryStat}>
                  Think of {daily.featuredCharacter.name} and play!
                </Text>
              </>
            )}
          </View>

          {!daily.completed && (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => {
                triggerImpactHaptic("medium");
                onStartChallenge(daily.characterId);
              }}
              style={[
                styles.actionButton,
                styles.actionChallenge,
                isBusy && styles.disabled,
              ]}
            >
              <Text style={styles.actionChallengeText}>
                {isBusy ? "Starting…" : "Play Today's Challenge"}
              </Text>
            </Pressable>
          )}
        </>
      )}

      <ChallengeLeaderboard
        leaderboard={leaderboard}
        isLoading={isLoading}
        leaderboardRows={leaderboardRows}
        showAllLeaderboardRows={showAllLeaderboardRows}
        onToggleRows={handleToggleLeaderboardRows}
      />

      {errorMessage ? (
        <Text style={styles.inlineError}>{errorMessage}</Text>
      ) : null}

      <SyncStatusBadge />

      <View style={styles.actionsBlock}>
        <SecondaryActionsSheet
          primaryLabel="Open History"
          primaryAccessibilityLabel="Open history"
          onPrimaryPress={() => {
            triggerImpactHaptic("light");
            onOpenHistory();
          }}
          isPrimaryDisabled={isBusy}
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
          isSecondaryDisabled={isBusy}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: "100%",
  },
  root: {
    gap: 14,
    paddingBottom: 16,
  },
  headerBlock: {
    gap: 4,
  },
  phasePill: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "800",
    color: "#2f1b0c",
    backgroundColor: "#fde68a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  title: {
    color: "#f8fafc",
    fontSize: 30,
    fontWeight: "800",
  },
  date: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "500",
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
  },
  loadingBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  errorCard: {
    borderRadius: 10,
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "700",
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  summaryCardDone: {
    backgroundColor: "#052e16",
    borderColor: "#16a34a",
  },
  summaryCardPending: {
    backgroundColor: "#422006",
    borderColor: "#d97706",
  },
  summaryStatus: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryStat: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  summaryCharacter: {
    color: "#86efac",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  lbBlock: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#0f172a",
    gap: 5,
  },
  lbTitle: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  lbHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  lbHint: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "500",
  },
  lbSpinner: {
    marginVertical: 8,
  },
  lbEmpty: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 8,
  },
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
  },
  lbRowYou: {
    backgroundColor: "#1e1245",
  },
  lbRank: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
    width: 30,
  },
  lbRankYou: {
    color: "#a78bfa",
  },
  lbLabel: {
    flex: 1,
    color: "#cbd5e1",
    fontSize: 14,
  },
  lbLabelYou: {
    color: "#a78bfa",
    fontWeight: "700",
  },
  lbQ: {
    fontSize: 13,
    fontWeight: "600",
  },
  lbQWon: {
    color: "#4ade80",
  },
  lbQLost: {
    color: "#f87171",
  },
  inlineError: {
    color: "#fecaca",
    fontSize: 14,
    fontWeight: "600",
  },
  actionsBlock: {
    gap: 8,
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionChallenge: {
    backgroundColor: "#f59e0b",
  },
  actionChallengeText: {
    color: "#1c1917",
    fontSize: 16,
    fontWeight: "800",
  },
  actionSecondary: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
  },
  actionSecondaryText: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
});
