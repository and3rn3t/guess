import type { ReactElement } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MobileDailyChallenge, MobileDailyLeaderboard, MobileLeaderboardEntry } from '../network/mobileGameApi';

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
}

function LeaderboardRow({ entry }: Readonly<{ entry: MobileLeaderboardEntry }>): ReactElement {
  return (
    <View style={[styles.lbRow, entry.isYou && styles.lbRowYou]}>
      <Text style={[styles.lbRank, entry.isYou && styles.lbRankYou]}>#{entry.rank}</Text>
      <Text style={[styles.lbLabel, entry.isYou && styles.lbLabelYou]} numberOfLines={1}>
        {entry.isYou ? 'You' : entry.userLabel}
      </Text>
      <Text style={[styles.lbQ, entry.won ? styles.lbQWon : styles.lbQLost]}>
        {entry.won ? '✓' : '✗'} {entry.questionsAsked}q
      </Text>
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
  onOpenHistory
}: Readonly<ChallengeScreenProps>): ReactElement {
  const today = daily?.date ?? new Date().toISOString().slice(0, 10);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.root} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>DAILY CHALLENGE</Text>
        <Text style={styles.title}>Today's Challenge</Text>
        <Text style={styles.date}>{today}</Text>
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
        </View>
      )}

      {daily && !isLoading && (
        <>
          {/* Status summary card */}
          <View style={[styles.summaryCard, daily.completed ? styles.summaryCardDone : styles.summaryCardPending]}>
            {daily.completed && daily.result ? (
              <>
                <Text style={styles.summaryStatus}>{daily.result.won ? '🏆 Won!' : '💀 Lost'}</Text>
                <Text style={styles.summaryStat}>{daily.result.questionsAsked} questions asked</Text>
                {daily.revealedCharacter && (
                  <Text style={styles.summaryCharacter}>Character: {daily.revealedCharacter.name}</Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.summaryStatus}>🎯 Not played yet</Text>
                <Text style={styles.summaryStat}>Think of {daily.featuredCharacter.name} and play!</Text>
              </>
            )}
          </View>

          {!daily.completed && (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => { onStartChallenge(daily.characterId); }}
              style={[styles.actionButton, styles.actionChallenge, isBusy && styles.disabled]}
            >
              <Text style={styles.actionChallengeText}>
                {isBusy ? 'Starting…' : 'Start Challenge'}
              </Text>
            </Pressable>
          )}
        </>
      )}

      {/* Leaderboard */}
      <View style={styles.lbBlock}>
        <Text style={styles.lbTitle}>Today's Leaderboard</Text>
        {isLoading && <ActivityIndicator color="#f59e0b" style={styles.lbSpinner} />}
        {!isLoading && leaderboard && leaderboard.leaderboard.length === 0 && (
          <Text style={styles.lbEmpty}>No completions yet — be the first!</Text>
        )}
        {!isLoading && leaderboard && leaderboard.leaderboard.map((entry) => (
          <LeaderboardRow key={`${entry.rank}-${entry.userLabel}`} entry={entry} />
        ))}
      </View>

      {errorMessage ? <Text style={styles.inlineError}>{errorMessage}</Text> : null}

      <View style={styles.actionsBlock}>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onOpenHistory}
          style={[styles.actionButton, styles.actionSecondary, isBusy && styles.disabled]}
        >
          <Text style={styles.actionSecondaryText}>Open History</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onBackToWelcome}
          style={[styles.actionButton, styles.actionGhost, isBusy && styles.disabled]}
        >
          <Text style={styles.actionGhostText}>Back To Welcome</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: '100%'
  },
  root: {
    gap: 16,
    paddingBottom: 16
  },
  headerBlock: {
    gap: 4
  },
  phasePill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    color: '#2f1b0c',
    backgroundColor: '#fde68a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '800'
  },
  date: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500'
  },
  loadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14
  },
  errorCard: {
    borderRadius: 10,
    backgroundColor: '#7f1d1d',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    lineHeight: 20
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4
  },
  summaryCardDone: {
    backgroundColor: '#052e16',
    borderColor: '#16a34a'
  },
  summaryCardPending: {
    backgroundColor: '#422006',
    borderColor: '#d97706'
  },
  summaryStatus: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800'
  },
  summaryStat: {
    color: '#cbd5e1',
    fontSize: 14
  },
  summaryCharacter: {
    color: '#86efac',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2
  },
  lbBlock: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    gap: 6
  },
  lbTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4
  },
  lbSpinner: {
    marginVertical: 8
  },
  lbEmpty: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8
  },
  lbRowYou: {
    backgroundColor: '#1e1245'
  },
  lbRank: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    width: 30
  },
  lbRankYou: {
    color: '#a78bfa'
  },
  lbLabel: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 14
  },
  lbLabelYou: {
    color: '#a78bfa',
    fontWeight: '700'
  },
  lbQ: {
    fontSize: 13,
    fontWeight: '600'
  },
  lbQWon: {
    color: '#4ade80'
  },
  lbQLost: {
    color: '#f87171'
  },
  inlineError: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '600'
  },
  actionsBlock: {
    gap: 10
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center'
  },
  actionChallenge: {
    backgroundColor: '#f59e0b'
  },
  actionChallengeText: {
    color: '#1c1917',
    fontSize: 16,
    fontWeight: '800'
  },
  actionSecondary: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155'
  },
  actionSecondaryText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700'
  },
  actionGhost: {
    backgroundColor: 'transparent'
  },
  actionGhostText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600'
  },
  disabled: {
    opacity: 0.5
  }
});
