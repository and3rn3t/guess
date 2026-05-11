import type { MobileHistoryGame, MobileStatsOverview } from '../network/mobileGameApi';

export interface DifficultyComparisonRow {
  difficulty: 'easy' | 'medium' | 'hard';
  games: number;
  winRatePercent: number | null;
  avgQuestions: number | null;
}

export interface RecentMomentumSummary {
  recentGames: number;
  wins: number;
  losses: number;
  winRatePercent: number | null;
  avgQuestions: number | null;
}

export interface BestDifficultyHighlight {
  difficulty: DifficultyComparisonRow['difficulty'];
  label: string;
}

export function buildDifficultyComparisonRows(
  stats: MobileStatsOverview | null
): DifficultyComparisonRow[] {
  const byDifficulty = stats?.byDifficulty ?? [];
  const difficulties: readonly DifficultyComparisonRow['difficulty'][] = [
    'easy',
    'medium',
    'hard'
  ];

  return difficulties.map((difficulty): DifficultyComparisonRow => {
    const match = byDifficulty.find((entry) => normalizeDifficulty(entry.difficulty) === difficulty);
    if (!match) {
      return {
        difficulty,
        games: 0,
        winRatePercent: null,
        avgQuestions: null
      };
    }

    return {
      difficulty,
      games: match.games,
      winRatePercent: toPercent(match.winRate),
      avgQuestions: roundToOneDecimal(match.avgQuestions)
    };
  });
}

export function buildRecentMomentumSummary(
  historyGames: MobileHistoryGame[],
  sampleSize = 8
): RecentMomentumSummary {
  const recentGames = historyGames.slice(0, sampleSize);
  if (recentGames.length === 0) {
    return {
      recentGames: 0,
      wins: 0,
      losses: 0,
      winRatePercent: null,
      avgQuestions: null
    };
  }

  const wins = recentGames.filter((game) => game.won).length;
  const losses = recentGames.length - wins;
  const totalQuestions = recentGames.reduce((sum, game) => sum + game.questionsAsked, 0);

  return {
    recentGames: recentGames.length,
    wins,
    losses,
    winRatePercent: Math.round((wins / recentGames.length) * 100),
    avgQuestions: roundToOneDecimal(totalQuestions / recentGames.length)
  };
}

export function getBestDifficultyHighlight(
  rows: DifficultyComparisonRow[],
  minimumGames = 3
): BestDifficultyHighlight | null {
  const eligibleRows = rows.filter(
    (row): row is DifficultyComparisonRow & { winRatePercent: number } =>
      row.games >= minimumGames && row.winRatePercent !== null
  );

  if (eligibleRows.length === 0) {
    return null;
  }

  const best = [...eligibleRows].sort((left, right) => {
    if (right.winRatePercent !== left.winRatePercent) {
      return right.winRatePercent - left.winRatePercent;
    }

    const leftQuestions = left.avgQuestions ?? Number.POSITIVE_INFINITY;
    const rightQuestions = right.avgQuestions ?? Number.POSITIVE_INFINITY;
    if (leftQuestions !== rightQuestions) {
      return leftQuestions - rightQuestions;
    }

    return right.games - left.games;
  })[0];

  return {
    difficulty: best.difficulty,
    label: `${toTitle(best.difficulty)} leads at ${best.winRatePercent}% win rate`
  };
}

function normalizeDifficulty(value: string): 'easy' | 'medium' | 'hard' | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') {
    return normalized;
  }

  return null;
}

function toPercent(value: number): number {
  if (value <= 1) {
    return Math.round(value * 100);
  }

  return Math.round(value);
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function toTitle(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return value[0].toUpperCase() + value.slice(1);
}
