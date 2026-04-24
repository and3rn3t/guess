// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WelcomeScreen } from '../WelcomeScreen'
import type { Character, GameHistoryEntry } from '@/lib/types'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _, animate: _a, exit: _e, transition: _t, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => {
      return <div {...rest}>{children}</div>
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

vi.mock('@phosphor-icons/react', () => {
  const Icon = () => <span />
  return {
    BrainIcon: Icon, CalendarBlankIcon: Icon, ChartBarIcon: Icon, ClipboardTextIcon: Icon, CloudCheckIcon: Icon,
    FireSimpleIcon: Icon, FlaskIcon: Icon, GearIcon: Icon, LightningIcon: Icon, PlayIcon: Icon, SparkleIcon: Icon,
    TreeStructureIcon: Icon, WifiSlashIcon: Icon, WrenchIcon: Icon,
  }
})

const CHARS: Character[] = [
  { id: 'mario', name: 'Mario', category: 'video-games', attributes: { isHuman: true } },
  { id: 'link', name: 'Link', category: 'video-games', attributes: { isHuman: true } },
]

const defaultProps = () => ({
  startGame: vi.fn(),
  serverTotal: null,
  online: true,
  maxQuestions: 20,
  gameHistory: null,
  gamesPlayed: 0,
  hasSavedSession: false,
  resumeSession: vi.fn(),
  clearSession: vi.fn(),
  showDevTools: false,
  navigate: vi.fn(),
  characters: CHARS,
  globalStats: null,
  difficulty: 'medium' as const,
  setDifficulty: vi.fn(),
  categories: [] as import('@/lib/types').CharacterCategory[],
  setCategories: vi.fn(),
  streak: 0,
})

describe('WelcomeScreen', () => {
  it('renders hero section', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    expect(screen.getByText('Think of a Character')).toBeInTheDocument()
  })

  it('shows Start Game button for new players', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    const buttons = screen.getAllByRole('button', { name: /start game/i })
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('calls startGame on CTA click', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} />)
    const buttons = screen.getAllByRole('button', { name: /start game/i })
    await user.click(buttons[0])
    expect(props.startGame).toHaveBeenCalledOnce()
  })

  it('shows Quick Play for returning players', () => {
    const history: GameHistoryEntry[] = [{
      id: '1',
      timestamp: Date.now(),
      characterId: 'mario',
      characterName: 'Mario',
      won: true,
      steps: [{ questionId: 'q1', questionText: 'Q1', attribute: 'attr1', answer: 'yes' }],
      difficulty: 'medium',
      totalQuestions: 10,
    }]
    render(<WelcomeScreen {...defaultProps()} gameHistory={history} gamesPlayed={1} />)
    expect(screen.getByRole('button', { name: /quick play/i })).toBeInTheDocument()
  })

  it('shows resume banner when saved session exists', () => {
    render(<WelcomeScreen {...defaultProps()} hasSavedSession />)
    expect(screen.getByText(/resume your game/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('calls resumeSession on Resume click', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} hasSavedSession />)
    await user.click(screen.getByRole('button', { name: /resume/i }))
    expect(props.resumeSession).toHaveBeenCalledOnce()
  })

  it('calls clearSession on Dismiss click', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} hasSavedSession />)
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(props.clearSession).toHaveBeenCalledOnce()
  })

  it('shows active character count', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    const matches = screen.getAllByText(/500\+/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders difficulty picker with three options', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /medium/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hard/i })).toBeInTheDocument()
  })

  it('calls setDifficulty when a difficulty is clicked', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} />)
    await user.click(screen.getByRole('button', { name: /hard/i }))
    expect(props.setDifficulty).toHaveBeenCalledWith('hard')
  })

  it('shows description hint for active difficulty', () => {
    render(<WelcomeScreen {...defaultProps()} difficulty="hard" />)
    expect(screen.getByText('10 questions, challenging')).toBeInTheDocument()
  })

  it('shows difficulty label in footer text', () => {
    render(<WelcomeScreen {...defaultProps()} difficulty="easy" maxQuestions={20} />)
    expect(screen.getByText(/easy/i, { selector: 'p' })).toBeInTheDocument()
  })

  it('renders all 8 category chips', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    expect(screen.getByRole('button', { name: /anime/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /movies/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /video games/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /.*/ }).filter(
      (b) => b.getAttribute('aria-pressed') !== null && !['Easy','Medium','Hard'].some(d => b.textContent?.includes(d))
    ).length).toBe(8)
  })

  it('category chip toggles aria-pressed and calls setCategories', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} />)
    const animeBtn = screen.getByRole('button', { name: /anime/i })
    expect(animeBtn).toHaveAttribute('aria-pressed', 'false')
    await user.click(animeBtn)
    expect(props.setCategories).toHaveBeenCalledWith(['anime'])
  })

  it('active category chip shows aria-pressed true', () => {
    render(<WelcomeScreen {...defaultProps()} categories={['movies']} />)
    expect(screen.getByRole('button', { name: /movies/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows filtered pool size when categories are selected and globalStats has byCategory', () => {
    const globalStats = {
      characters: 500,
      attributes: 10,
      questions: 100,
      characterAttributes: { total: 5000, filled: 4000, fillRate: 0.8 },
      byCategory: [
        { category: 'anime', count: 150 },
        { category: 'movies', count: 200 },
        { category: 'video-games', count: 100 },
      ],
      bySource: [],
      gameStats: null,
    }
    render(<WelcomeScreen {...defaultProps()} categories={['anime', 'movies']} globalStats={globalStats} serverTotal={500} />)
    expect(screen.getByText('~350')).toBeInTheDocument()
  })

  it('shows full pool size when no categories are selected', () => {
    render(<WelcomeScreen {...defaultProps()} serverTotal={500} />)
    // footer paragraph contains "500 characters"
    const footer = screen.getAllByText(/500/, { selector: 'p' })
    expect(footer.length).toBeGreaterThanOrEqual(1)
  })
})
