// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatsDashboard } from '../StatsDashboard'
import type { GlobalStats } from '@/hooks/useGlobalStats'

vi.mock('@phosphor-icons/react', () => {
  const Icon = ({ children }: React.PropsWithChildren) => <span>{children}</span>
  return {
    ChartBar: Icon,
    Users: Icon,
    Trophy: Icon,
    ArrowLeft: Icon,
    TrendUp: Icon,
    Database: Icon,
    Lightning: Icon,
    GameController: Icon,
    Globe: Icon,
    Question: Icon,
    Crosshair: Icon,
    ArrowsLeftRight: Icon,
  }
})

const statsFixture: GlobalStats = {
  characters: 500,
  attributes: 120,
  questions: 95,
  characterAttributes: {
    total: 1000,
    filled: 820,
    fillRate: 82,
  },
  byCategory: [{ category: 'video-games', count: 300 }],
  bySource: [{ source: 'seed', count: 500 }],
  gameStats: {
    totalGames: 40,
    wins: 31,
    winRate: 77.5,
    avgQuestions: 10.4,
    avgPoolSize: 500,
    byDifficulty: [],
    recentGames: [],
    readiness: {
      instrumentedGames: 28,
      recentInstrumentedGames: 12,
      avgConfidence: 0.84,
      avgQuestionsAtGuess: 9.8,
      strictReadinessWinRate: 78.3,
      highCertaintyWinRate: 92.1,
      forcedGuessRate: 6.4,
      forcedGuessWinRate: 70.2,
      earlyGuessWinRate: 81.5,
      lowAmbiguityWinRate: 80.4,
      maxQuestionGuessRate: 11.2,
    },
  },
  confusion: null,
  calibration: null,
}

describe('StatsDashboard', () => {
  it('shows readiness KPIs when readiness stats are available', async () => {
    const user = userEvent.setup()

    render(<StatsDashboard stats={statsFixture} loading={false} onBack={vi.fn()} />)

    await user.click(screen.getByRole('tab', { name: 'Readiness' }))

    expect(screen.getByText('Guess Readiness KPIs')).toBeInTheDocument()
    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.getByText('84%')).toBeInTheDocument()
    expect(screen.getByText('6.4%')).toBeInTheDocument()
    expect(screen.getByText('92.1%')).toBeInTheDocument()
  })
})