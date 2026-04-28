// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GamePhaseRouter } from '../GamePhaseRouter'
import type { GameContextValue } from '@/contexts/GameContext'
import type { GameState } from '@/hooks/useGameState'

// ── Heavy dep mocks ──────────────────────────────────────────
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

vi.mock('@phosphor-icons/react', () => {
  const Icon = () => <span />
  return { BrainIcon: Icon, PlayIcon: Icon, SparkleIcon: Icon }
})

// Stub heavy screens — we just want to verify routing
vi.mock('@/components/WelcomeScreen', () => ({
  WelcomeScreen: () => <div data-testid="welcome-screen" />,
}))
vi.mock('@/components/PlayingScreen', () => ({
  PlayingScreen: () => <div data-testid="playing-screen" />,
}))
vi.mock('@/components/GameOver', () => ({
  GameOver: () => <div data-testid="game-over-screen" />,
}))
vi.mock('@/components/GuessReveal', () => ({
  GuessReveal: () => <div data-testid="guess-reveal-screen" />,
}))
vi.mock('@/components/TeachingMode', () => ({
  TeachingMode: () => <div data-testid="teaching-mode-screen" />,
}))
vi.mock('@/components/DescribeYourselfScreen', () => ({
  DescribeYourselfScreen: () => <div data-testid="describe-yourself-screen" />,
}))
vi.mock('@/components/QuestionManager', () => ({
  QuestionManager: () => <div data-testid="question-manager-screen" />,
}))
vi.mock('@/components/StatsDashboard', () => ({
  StatsDashboard: () => <div data-testid="stats-dashboard-screen" />,
}))
vi.mock('@/components/CharacterComparison', () => ({
  CharacterComparison: () => <div data-testid="character-comparison-screen" />,
}))
vi.mock('@/components/GameHistory', () => ({
  GameHistory: () => <div data-testid="game-history-screen" />,
}))

// ── Context mock ─────────────────────────────────────────────
const { useGameContext } = await import('@/contexts/GameContext')
vi.mock('@/contexts/GameContext', () => ({
  useGameContext: vi.fn(),
}))

function makeGameState(phase: GameState['phase'], overrides: Partial<GameState> = {}): GameState {
  return {
    phase,
    answers: [],
    currentQuestion: null,
    reasoning: null,
    possibleCharacters: [],
    finalGuess: null,
    selectedCharacter: null,
    isThinking: false,
    gameWon: false,
    gameSteps: [],
    showDevTools: false,
    guessCount: 0,
    exhausted: false,
    surrendered: false,
    ...overrides,
  }
}

function makeContext(phase: GameState['phase'], stateOverrides: Partial<GameState> = {}): GameContextValue {
  return {
    game: makeGameState(phase, stateOverrides),
    dispatch: vi.fn(),
    navigate: vi.fn(),
    difficulty: 'medium',
    setDifficulty: vi.fn(),
    categories: [],
    setCategories: vi.fn(),
    persona: 'default',
    maxQuestions: 15,
    characters: [],
    questions: [],
    activeCharacters: [],
    serverTotal: null,
    serverReadiness: null,
    effectiveRemaining: 10,
    confidence: 50,
    globalStats: null,
    gameHistory: [],
    gamesPlayed: 0,
    statsLoading: false,
    hasSavedSession: false,
    resumeSession: vi.fn(),
    clearSession: vi.fn(),
    online: true,
    eliminatedCount: null,
    remainingHistoryRef: { current: [] },
    isNewPersonalBest: false,
    personalBest: null,
    dailyStreak: 0,
    achievements: [],
    weeklyRecap: null,
    showOnboarding: false,
    setShowOnboarding: vi.fn(),
    startGame: vi.fn(),
    handleAnswer: vi.fn(),
    handleSkip: vi.fn(),
    handleGiveUp: vi.fn(),
    handleCorrectGuess: vi.fn(),
    handleIncorrectGuess: vi.fn(),
    handleRejectGuess: vi.fn(),
    retryAfterReject: vi.fn(),
    handleShare: vi.fn(),
    handleCopyLink: vi.fn(),
    handleReveal: vi.fn(),
    handleAddCharacter: vi.fn(),
    handleAddQuestions: vi.fn(),
  } as unknown as GameContextValue
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GamePhaseRouter', () => {
  it('renders WelcomeScreen for welcome phase', () => {
    vi.mocked(useGameContext).mockReturnValue(makeContext('welcome'))
    render(<GamePhaseRouter />)
    expect(screen.getByTestId('welcome-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('playing-screen')).not.toBeInTheDocument()
  })

  it('renders PlayingScreen for playing phase', () => {
    vi.mocked(useGameContext).mockReturnValue(makeContext('playing'))
    render(<GamePhaseRouter />)
    expect(screen.getByTestId('playing-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('welcome-screen')).not.toBeInTheDocument()
  })

  it('renders GuessReveal for guessing phase with a finalGuess', async () => {
    vi.mocked(useGameContext).mockReturnValue(
      makeContext('guessing', {
        finalGuess: { id: 'mario', name: 'Mario', category: 'video-games', attributes: {} },
      }),
    )
    render(<GamePhaseRouter />)
    expect(await screen.findByTestId('guess-reveal-screen')).toBeInTheDocument()
  })

  it('does not render GuessReveal when finalGuess is null in guessing phase', () => {
    vi.mocked(useGameContext).mockReturnValue(makeContext('guessing', { finalGuess: null }))
    render(<GamePhaseRouter />)
    expect(screen.queryByTestId('guess-reveal-screen')).not.toBeInTheDocument()
  })

  it('renders GameOver for gameOver phase', async () => {
    vi.mocked(useGameContext).mockReturnValue(makeContext('gameOver'))
    render(<GamePhaseRouter />)
    expect(await screen.findByTestId('game-over-screen')).toBeInTheDocument()
  })
})
