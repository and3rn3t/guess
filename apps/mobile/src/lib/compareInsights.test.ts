import { describe, expect, it } from 'vitest';
import {
  buildDifficultyComparisonRows,
  buildRecentMomentumSummary,
  getBestDifficultyHighlight
} from './compareInsights';

describe('compareInsights', () => {
  it('builds normalized difficulty rows with defaults', () => {
    const rows = buildDifficultyComparisonRows({
      totalGames: 8,
      wins: 5,
      winRate: 0.625,
      avgQuestions: 12,
      avgPoolSize: 40,
      byDifficulty: [
        {
          difficulty: 'easy',
          games: 4,
          wins: 3,
          winRate: 0.75,
          avgQuestions: 10.2
        },
        {
          difficulty: 'HARD',
          games: 4,
          wins: 2,
          winRate: 50,
          avgQuestions: 14.6
        }
      ],
      recentGames: []
    });

    expect(rows).toEqual([
      {
        difficulty: 'easy',
        games: 4,
        winRatePercent: 75,
        avgQuestions: 10.2
      },
      {
        difficulty: 'medium',
        games: 0,
        winRatePercent: null,
        avgQuestions: null
      },
      {
        difficulty: 'hard',
        games: 4,
        winRatePercent: 50,
        avgQuestions: 14.6
      }
    ]);
  });

  it('builds recent momentum summary for latest games', () => {
    const summary = buildRecentMomentumSummary(
      [
        {
          id: '1',
          characterId: 'c1',
          characterName: 'A',
          won: true,
          difficulty: 'easy',
          questionsAsked: 8,
          poolSize: 30,
          timestamp: 1
        },
        {
          id: '2',
          characterId: 'c2',
          characterName: 'B',
          won: false,
          difficulty: 'hard',
          questionsAsked: 13,
          poolSize: 30,
          timestamp: 2
        },
        {
          id: '3',
          characterId: 'c3',
          characterName: 'C',
          won: true,
          difficulty: 'medium',
          questionsAsked: 11,
          poolSize: 30,
          timestamp: 3
        }
      ],
      2
    );

    expect(summary).toEqual({
      recentGames: 2,
      wins: 1,
      losses: 1,
      winRatePercent: 50,
      avgQuestions: 10.5
    });
  });

  it('returns empty momentum summary when there is no history', () => {
    expect(buildRecentMomentumSummary([])).toEqual({
      recentGames: 0,
      wins: 0,
      losses: 0,
      winRatePercent: null,
      avgQuestions: null
    });
  });

  it('returns best-difficulty highlight when there is enough data', () => {
    const highlight = getBestDifficultyHighlight([
      {
        difficulty: 'easy',
        games: 8,
        winRatePercent: 62,
        avgQuestions: 10.4
      },
      {
        difficulty: 'medium',
        games: 10,
        winRatePercent: 70,
        avgQuestions: 12.2
      },
      {
        difficulty: 'hard',
        games: 4,
        winRatePercent: 58,
        avgQuestions: 13.1
      }
    ]);

    expect(highlight).toEqual({
      difficulty: 'medium',
      label: 'Medium leads at 70% win rate'
    });
  });

  it('returns null highlight when minimum sample size is not met', () => {
    const highlight = getBestDifficultyHighlight(
      [
        {
          difficulty: 'easy',
          games: 2,
          winRatePercent: 100,
          avgQuestions: 8.5
        },
        {
          difficulty: 'medium',
          games: 1,
          winRatePercent: 100,
          avgQuestions: 9.2
        },
        {
          difficulty: 'hard',
          games: 0,
          winRatePercent: null,
          avgQuestions: null
        }
      ],
      3
    );

    expect(highlight).toBeNull();
  });
});
